import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import Participacion from './components/Participacion';

const SVG_WIDTH = 400;
const SVG_HEIGHT = 400;

// 🔹 Formateador común de porcentajes con coma como separador decimal
const formatPercentEs = (value) => {
  const num = Number(String(value).replace('%', '').replace(',', '.'));
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

// ✅ NUEVO: 1 decimal y coma
const formatPercent1DecimalEs = (value) => {
  const num = Number(String(value).replace('%', '').replace(',', '.'));
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

// ✅ NUEVO: Tick personalizado para XAxis (envuelve en 2 líneas si el nombre es largo)
const WrapXAxisTick = ({ x, y, payload }) => {
  const raw = String(payload?.value ?? '');

  // Si viene con guiones (PODEMOS-IU-AV), lo partimos para que no se corte
  const byDash = raw.split('-').filter(Boolean);

  let line1 = raw;
  let line2 = '';

  if (byDash.length >= 2) {
    line1 = byDash[0];
    line2 = byDash.slice(1).join('-');
  } else if (raw.length > 10) {
    // Fallback: si es una sola palabra larga, la partimos en 2
    const mid = Math.ceil(raw.length / 2);
    line1 = raw.slice(0, mid);
    line2 = raw.slice(mid);
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fill="#666"
        fontSize={12}
      >
        <tspan x="0" dy="12">
          {line1}
        </tspan>
        {line2 ? (
          <tspan x="0" dy="14">
            {line2}
          </tspan>
        ) : null}
      </text>
    </g>
  );
};

// 🔹 Normalizar textos (tildes, mayúsculas, espacios) para clave municipio+provincia
const normalizeStr = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const makeMunicipioKey = (nombre, provincia) =>
  `${normalizeStr(nombre)}|${normalizeStr(provincia)}`;

// 🔹 MAPA DE MUNICIPIOS: relleno a partir de siglas_1 del CSV (si existe) o del GeoJSON
const MapaExtremadura = ({ municipioInfo }) => {
  const [geoData, setGeoData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    // Asegúrate de tener el archivo en /public/mapa_municipios.geojson
    fetch('/mapa_municipios.geojson')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => {
        console.error('Error cargando GeoJSON de municipios:', err);
      });
  }, []);

  // Paleta fija para siglas_1
  const COLORS = {
    PSOE: '#ed1c24',
    PP: '#0655a7',
    VOX: '#5ac035',
    'PODEMOS-IU-AV': '#9169f4',
    'J.U.E.X.': '#6A5ACD',
    CS: '#FFA500',
    LEVANTA: '#2E8B57',
    UED: '#8B0000',
    'CACERES VIVA': '#228B22',
    'SOMOS CC': '#1E90FF',
    'PEX-EXT': '#800080',
    'PUM+J': '#DC143C',
  };

  const DEFAULT_COLOR = '#CCCCCC';

  const { features, bounds } = useMemo(() => {
    const fc = geoData || {};
    const features = Array.isArray(fc.features) ? fc.features : [];

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const updateBounds = (lng, lat) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    const walkCoords = (coords) => {
      if (!Array.isArray(coords)) return;
      if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        coords.forEach(([lng, lat]) => updateBounds(lng, lat));
      } else {
        coords.forEach((sub) => walkCoords(sub));
      }
    };

    features.forEach((f) => {
      if (!f || !f.geometry || !f.geometry.coordinates) return;
      walkCoords(f.geometry.coordinates);
    });

    if (
      !isFinite(minLng) ||
      !isFinite(maxLng) ||
      !isFinite(minLat) ||
      !isFinite(maxLat)
    ) {
      minLng = -7.6;
      maxLng = -5.0;
      minLat = 37.3;
      maxLat = 40.6;
    }

    return {
      features,
      bounds: { minLng, maxLng, minLat, maxLat },
    };
  }, [geoData]);

  const projectPoint = (lng, lat) => {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * SVG_WIDTH;
    const y =
      SVG_HEIGHT -
      ((lat - minLat) / (maxLat - minLat || 1)) * SVG_HEIGHT;
    return [x, y];
  };

  const getFeaturePaths = (feature) => {
    const paths = [];
    const geom = feature.geometry || {};
    const type = geom.type;
    const coordinates = geom.coordinates;

    if (!coordinates) return paths;

    const buildPath = (ring) => {
      if (!Array.isArray(ring) || !ring.length) return '';
      const [firstLng, firstLat] = ring[0];
      const [startX, startY] = projectPoint(firstLng, firstLat);
      let d = `M ${startX},${startY}`;

      for (let i = 1; i < ring.length; i += 1) {
        const [lng, lat] = ring[i];
        const [x, y] = projectPoint(lng, lat);
        d += ` L ${x},${y}`;
      }

      return d + ' Z';
    };

    if (type === 'Polygon') {
      const rings = coordinates;
      const mainPath = buildPath(rings[0]);
      if (mainPath) paths.push(mainPath);
    } else if (type === 'MultiPolygon') {
      const polys = coordinates;
      polys.forEach((poly) => {
        const rings = poly;
        const mainPath = buildPath(rings[0]);
        if (mainPath) paths.push(mainPath);
      });
    }

    return paths;
  };

  // 🔹 Obtener metadatos combinados (GeoJSON + CSV) para el popup
  const getMunicipioMeta = (feature) => {
    const props = feature.properties || {};
    const nombreMun =
      props.municipio_nombre ||
      props.nombre_municipio ||
      props.MUNICIPIO ||
      props.municipio ||
      '';
    const provincia = props.PROVINCIA || props.provincia || '';

    // ✅ NUEVO: fuerzas y porcentajes desde CSV
    let fuerza1 = { nombre: '', porcentaje: '' };
    let fuerza2 = { nombre: '', porcentaje: '' };
    let fuerza3 = { nombre: '', porcentaje: '' };

    if (municipioInfo && nombreMun && provincia) {
      const key = makeMunicipioKey(nombreMun, provincia);
      const info = municipioInfo[key];
      if (info) {
        const raw = info.raw || {};

        fuerza1 = {
          nombre: raw.siglas_1 ?? raw.SIGLAS_1 ?? '',
          porcentaje: raw.porcentaje_1 ?? raw.PORCENTAJE_1 ?? '',
        };
        fuerza2 = {
          nombre: raw.siglas_2 ?? raw.SIGLAS_2 ?? '',
          porcentaje: raw.porcentaje_2 ?? raw.PORCENTAJE_2 ?? '',
        };
        fuerza3 = {
          nombre: raw.siglas_3 ?? raw.SIGLAS_3 ?? '',
          porcentaje: raw.porcentaje_3 ?? raw.PORCENTAJE_3 ?? '',
        };
      }
    }

    return {
      nombre_municipio: nombreMun,
      PROVINCIA: provincia,
      fuerza1,
      fuerza2,
      fuerza3,
    };
  };

  const getFillColor = (feature) => {
    const props = feature.properties || {};
    const nombreMun =
      props.municipio_nombre ||
      props.nombre_municipio ||
      props.MUNICIPIO ||
      props.municipio ||
      '';
    const provincia = props.PROVINCIA || props.provincia || '';

    // Primero buscamos en los datos del CSV (municipioInfo)
    if (municipioInfo && nombreMun && provincia) {
      const key = makeMunicipioKey(nombreMun, provincia);
      const info = municipioInfo[key];
      if (info && info.siglas_1) {
        const siglaCsv = info.siglas_1;
        if (COLORS[siglaCsv]) return COLORS[siglaCsv];
      }
    }

    // Si no hay datos en CSV, fallback a siglas_1 del propio GeoJSON
    const siglaGeo =
      props.siglas_1 ||
      props.SIGLAS_1 ||
      props.sigla1 ||
      props.SIGLA1 ||
      '';
    if (COLORS[siglaGeo]) return COLORS[siglaGeo];

    return DEFAULT_COLOR;
  };

  if (!geoData || !features.length) {
    return (
      <div className="w-full text-center text-gray-500 py-8">
        Cargando mapa de Extremadura...
      </div>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full">
        {features.map((feature, index) => {
          const paths = getFeaturePaths(feature);
          const fill = getFillColor(feature);
          const meta = getMunicipioMeta(feature);

          return (
            <g key={index}>
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  className="hover:opacity-80 cursor-pointer transition-opacity"
                  onMouseEnter={(e) => {
                    setHoverInfo({
                      x: e.clientX,
                      y: e.clientY,
                      ...meta,
                    });
                  }}
                  onMouseMove={(e) => {
                    setHoverInfo((prev) =>
                      prev
                        ? {
                            ...prev,
                            x: e.clientX,
                            y: e.clientY,
                          }
                        : {
                            x: e.clientX,
                            y: e.clientY,
                            ...meta,
                          }
                    );
                  }}
                  onMouseLeave={() => setHoverInfo(null)}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* ✅ Popup flotante (MODIFICADO) */}
      {hoverInfo && (
        <div
          className="pointer-events-none bg-white text-xs shadow-lg rounded px-3 py-2 border border-gray-200"
          style={{
            position: 'fixed',
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            zIndex: 9999,
          }}
        >
          <div className="font-semibold">
            {hoverInfo.nombre_municipio || 'Municipio desconocido'}
          </div>
          <div className="text-gray-600 mb-1">{hoverInfo.PROVINCIA || ''}</div>

          <div className="space-y-1">
            <div>
              <span className="font-semibold">Primera fuerza:</span>{' '}
              {hoverInfo.fuerza1?.nombre
                ? `${hoverInfo.fuerza1.nombre} (${formatPercent1DecimalEs(
                    hoverInfo.fuerza1.porcentaje
                  )} %)`
                : '-'}
            </div>
            <div>
              <span className="font-semibold">Segunda fuerza:</span>{' '}
              {hoverInfo.fuerza2?.nombre
                ? `${hoverInfo.fuerza2.nombre} (${formatPercent1DecimalEs(
                    hoverInfo.fuerza2.porcentaje
                  )} %)`
                : '-'}
            </div>
            <div>
              <span className="font-semibold">Tercera fuerza:</span>{' '}
              {hoverInfo.fuerza3?.nombre
                ? `${hoverInfo.fuerza3.nombre} (${formatPercent1DecimalEs(
                    hoverInfo.fuerza3.porcentaje
                  )} %)`
                : '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utilidades para el nuevo hemiciclo de barras (JS puro)
const degToRad = (deg) => (deg * Math.PI) / 180;

const polarToCartesianArc = (cx, cy, radius, angleDeg) => {
  const rad = degToRad(angleDeg);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad),
  };
};

const describeArcSegment = (
  cx,
  cy,
  innerR,
  outerR,
  startAngle,
  endAngle
) => {
  const outerStart = polarToCartesianArc(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesianArc(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesianArc(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesianArc(cx, cy, innerR, startAngle);

  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweepFlag = endAngle > startAngle ? 0 : 1;
  const sweepFlagInner = sweepFlag ? 0 : 1;

  return [
    'M',
    outerStart.x,
    outerStart.y,
    'A',
    outerR,
    outerR,
    0,
    largeArcFlag,
    sweepFlag,
    outerEnd.x,
    outerEnd.y,
    'L',
    innerEnd.x,
    innerEnd.y,
    'A',
    innerR,
    innerR,
    0,
    largeArcFlag,
    sweepFlagInner,
    innerStart.x,
    innerStart.y,
    'Z',
  ].join(' ');
};

const App = () => {
  const [partidosData, setPartidosData] = useState([]);
  const [votosData, setVotosData] = useState([]);
  const [participacionData, setParticipacionData] = useState([]);
  const [municipiosInfo, setMunicipiosInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [escrutinio, setEscrutinio] = useState(96.5);

  // Función para añadir timestamp y evitar caché
  const getUrlWithCacheBuster = (url) => {
    const timestamp = new Date().getTime();
    return `${url}&_=${timestamp}`;
  };

  // URL escaños
  const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=0&single=true&output=csv';

  // URL votos (%)
  const SHEET_URL_VOTOS =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=1329011177&single=true&output=csv';

  // URL estado escrutinio (escrutado, dia, hora)
  const SHEET_URL_ESTADO =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=1948537804&single=true&output=csv';

  // URL resultados por municipio
  const SHEET_URL_MUNICIPIOS =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=1638668905&single=true&output=csv';

  // URL participación
  const SHEET_URL_PARTICIPACION =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=2046410976&single=true&output=csv';

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        responseEsc,
        responseVotos,
        responseEstado,
        responseMunicipios,
        responseParticipacion,
      ] = await Promise.all([
        fetch(getUrlWithCacheBuster(SHEET_URL)),
        fetch(getUrlWithCacheBuster(SHEET_URL_VOTOS)),
        fetch(getUrlWithCacheBuster(SHEET_URL_ESTADO)),
        fetch(getUrlWithCacheBuster(SHEET_URL_MUNICIPIOS)),
        fetch(getUrlWithCacheBuster(SHEET_URL_PARTICIPACION)),
      ]);

      const csvTextEsc = await responseEsc.text();
      const csvTextVotos = await responseVotos.text();
      const csvTextEstado = await responseEstado.text();
      const csvTextMunicipios = await responseMunicipios.text();
      const csvTextParticipacion = await responseParticipacion.text();

      // Escaños
      Papa.parse(csvTextEsc, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsEsc) => {
          processEscanosData(resultsEsc.data);
        },
        error: (error) => {
          console.error('Error parseando CSV de escaños:', error);
        },
      });

      // Votos
      Papa.parse(csvTextVotos, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsVotos) => {
          processVotosData(resultsVotos.data);
        },
        error: (error) => {
          console.error('Error parseando CSV de votos:', error);
        },
      });

      // Estado escrutinio
      Papa.parse(csvTextEstado, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsEstado) => {
          processEstadoData(resultsEstado.data);
        },
        error: (error) => {
          console.error('Error parseando CSV de estado:', error);
        },
      });

      // Municipios para el mapa
      Papa.parse(csvTextMunicipios, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsMunicipios) => {
          processMunicipiosData(resultsMunicipios.data);
        },
        error: (error) => {
          console.error('Error parseando CSV de municipios:', error);
        },
      });

      // Participación
      Papa.parse(csvTextParticipacion, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsParticipacion) => {
          processParticipacionData(resultsParticipacion.data);
        },
        error: (error) => {
          console.error('Error parseando CSV de participación:', error);
        },
      });

      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const processEscanosData = (rawData) => {
    const processed = rawData
      .filter((row) => row.Partido && row.Partido.trim() !== '')
      .map((row) => {
        const escanos2025 = parseInt(row['2025']) || 0;
        const escanos2023 = parseInt(row['2023']) || 0;
        const cambio = escanos2025 - escanos2023;

        const ladoValue = parseInt(
          row.lado ||
            row.Lado ||
            row.bloque ||
            row.Bloque ||
            row.posicion ||
            row.Posicion ||
            '0'
        );

        return {
          nombre: row.Partido.trim(),
          escanos2023,
          escanos2025,
          cambio,
          lado: ladoValue,
          color: row.color ? `#${row.color.replace('#', '')}` : '#CCCCCC',
        };
      })
      .sort((a, b) => b.escanos2025 - a.escanos2025);

    setPartidosData(processed);
  };

  const processVotosData = (rawData) => {
    const processed = rawData
      .filter((row) => row.siglas && row.siglas.trim() !== '')
      .map((row) => {
        const porcentajeNum =
          parseFloat(String(row.porcentaje).replace('%', '').replace(',', '.')) ||
          0;

        const color = row.color
          ? row.color.startsWith('#')
            ? row.color
            : `#${row.color}`
          : '#CCCCCC';

        return {
          nombre: row.siglas.trim(),
          porcentaje: porcentajeNum,
          color,
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    setVotosData(processed);
  };

  const processEstadoData = (rawData) => {
    if (!rawData || rawData.length === 0) return;

    const row = rawData[0] || {};

    const escruStr =
      row.escrutado ||
      row.Escrutado ||
      row.escrutado_porcentaje ||
      row.Escrutado_porcentaje ||
      '';

    const escruNum =
      parseFloat(String(escruStr).replace('%', '').replace(',', '.')) || 0;

    setEscrutinio(escruNum);

    const diaStr = row.dia || row.Dia || row.fecha || row.Fecha || '';
    const horaStr = row.hora || row.Hora || row.horario || row.Horario || '';

    if (diaStr && horaStr) {
      const parts = String(diaStr).split(/[\/\-.]/);
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);

        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const dateObj = new Date(y, m - 1, d);
          const mes = dateObj
            .toLocaleString('es-ES', { month: 'short' })
            .toUpperCase();
          const formatted = `ÚLTIMA ACTUALIZACIÓN | ${d} ${mes} ${y} a las ${horaStr}`;
          setLastUpdate(formatted);
          return;
        }
      }

      setLastUpdate(`${diaStr} | ÚLTIMA ACTUALIZACIÓN ${horaStr} CET`);
    }
  };

  const processMunicipiosData = (rawData) => {
    const map = {};

    (rawData || []).forEach((row) => {
      const nombre =
        row.municipio_nombre ||
        row.MUNICIPIO ||
        row.municipio ||
        row.nombre_municipio ||
        '';
      const provincia = row.PROVINCIA || row.provincia || '';

      if (!nombre || !provincia) return;

      const key = makeMunicipioKey(nombre, provincia);
      const siglas_1 =
        row.siglas_1 || row.SIGLAS_1 || row.siglas || row.SIGLAS || '';

      map[key] = {
        siglas_1,
        raw: row,
      };
    });

    setMunicipiosInfo(map);
  };

  const processParticipacionData = (rawData) => {
    const formatted = rawData
      .filter((row) => row.ambito && row.nombre_ambito)
      .map((row) => ({
        hora_minuto: row.hora_minuto || '',
        fecha_hora: parseInt(row.fecha_hora) || 0,
        ambito: row.ambito || '',
        codigo_ambito: parseInt(row.codigo_ambito) || 0,
        nombre_ambito: row.nombre_ambito || '',
        mesas_totales: parseInt(row.mesas_totales) || 0,
        censo_total: parseInt(row.censo_total) || 0,
        participacion: row.participacion || 0,
      }));
    setParticipacionData(formatted);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  const escanosData = partidosData.filter(
    (p) => p.escanos2025 > 0 || p.escanos2023 > 0
  );
  const mayoria = 33;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Cargando datos...</div>
      </div>
    );
  }

  const totalEscanos2025 = escanosData.reduce(
    (sum, p) => sum + (p.escanos2025 || 0),
    0
  );

  const leftParties = escanosData
    .filter((p) => p.lado === 1)
    .sort((a, b) => b.escanos2025 - a.escanos2025);

  const rightParties = escanosData
    .filter((p) => p.lado === 2)
    .sort((a, b) => a.escanos2025 - b.escanos2025);

  const orderedParties = [...leftParties, ...rightParties];

  const cx = 250;
  const cy = 260;
  const outerR = 200;
  const innerR = 140;

  const majorityAngle =
    totalEscanos2025 > 0 ? 180 - (mayoria / totalEscanos2025) * 180 : 180;

  const majorityStart = polarToCartesianArc(cx, cy, innerR, majorityAngle);
  const majorityEnd = polarToCartesianArc(cx, cy, outerR, majorityAngle);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="bg-white border-b-4 shadow-sm"
        style={{ borderColor: '#01f3b3' }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-start items-center"></div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-700">Escrutado:</span>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-black">
                {formatPercentEs(escrutinio)}%
              </span>
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors hover:brightness-110"
                style={{ backgroundColor: '#01f3b3', color: '#000000' }}
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ width: `${escrutinio}%`, backgroundColor: '#01f3b3' }}
            ></div>
          </div>
          <div
            className="text-right text-sm mt-1 font-semibold"
            style={{ color: '#01f3b3' }}
          >
            {lastUpdate || '28 NOV 2024 | ÚLTIMA ACTUALIZACIÓN 10:37 CET'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Primera fila: Participación */}
        <div className="grid grid-cols-1 mb-8">
          <Participacion participacionData={participacionData} />
        </div>

        {/* Segunda fila: Escaños, Votos, Mapa */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Escaños Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-4">ESCAÑOS</h2>

            <div className="mb-6 relative">
              <svg viewBox="0 0 500 300" className="w-full">
                <path
                  d={describeArcSegment(cx, cy, innerR, outerR, 180, 0)}
                  fill="#ffffff"
                />

                {totalEscanos2025 > 0 &&
                  (() => {
                    let acc = 0;
                    return orderedParties.map((p, idx) => {
                      const startAngle = 180 - (acc / totalEscanos2025) * 180;
                      const endAngle =
                        180 -
                        ((acc + p.escanos2025) / totalEscanos2025) * 180;
                      acc += p.escanos2025;

                      const pathD = describeArcSegment(
                        cx,
                        cy,
                        innerR,
                        outerR,
                        startAngle,
                        endAngle
                      );

                      const midAngle = (startAngle + endAngle) / 2;
                      const midR = (innerR + outerR) / 2;
                      const labelPos = polarToCartesianArc(cx, cy, midR, midAngle);

                      return (
                        <g key={`seg-${p.nombre}-${idx}`}>
                          <path
                            d={pathD}
                            fill={p.color}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#ffffff"
                            fontSize="14"
                            fontWeight="bold"
                          >
                            {p.escanos2025}
                          </text>
                        </g>
                      );
                    });
                  })()}

                <line
                  x1={majorityStart.x}
                  y1={majorityStart.y}
                  x2={majorityEnd.x}
                  y2={majorityEnd.y}
                  stroke="#494949"
                  strokeWidth={3}
                  strokeDasharray="5,5"
                />
                <text
                  x={cx}
                  y={cy - innerR + 60}
                  textAnchor="middle"
                  fill="#999999"
                  fontSize="14"
                  fontWeight="bold"
                >
                  Mayoría
                </text>
                <text
                  x={cx}
                  y={cy - innerR + 80}
                  textAnchor="middle"
                  fill="#999999"
                  fontSize="14"
                >
                  {mayoria} escaños
                </text>
              </svg>
            </div>

            <div className="mb-6 flex flex-wrap justify-center gap-4">
              {escanosData.map((partido) => (
                <div key={partido.nombre} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: partido.color }}
                  ></div>
                  <span className="text-sm font-semibold">{partido.nombre}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold">Partido</th>
                    <th className="text-center py-3 px-2 font-bold">2025</th>
                    <th className="text-center py-3 px-2 font-bold">2023</th>
                    <th className="text-center py-3 px-2 font-bold">
                      Evolución respecto a 2023
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {escanosData.map((partido) => {
                    const cambio = partido.cambio || 0;
                    return (
                      <tr
                        key={partido.nombre}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: partido.color }}
                            ></div>
                            <span className="font-semibold">{partido.nombre}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2 font-bold">
                          {partido.escanos2025}
                        </td>
                        <td className="text-center py-3 px-2">
                          {partido.escanos2023}
                        </td>
                        <td className="text-center py-3 px-2">
                          <span
                            className={`font-bold ${
                              cambio > 0
                                ? 'text-green-600'
                                : cambio < 0
                                ? 'text-red-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {cambio > 0 ? '↑' : cambio < 0 ? '↓' : '='}{' '}
                            {Math.abs(cambio)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Votos Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-6">VOTOS (%)</h2>

            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={votosData}
                // ✅ Ajuste de margen inferior para dar espacio a etiquetas en 2 líneas
                margin={{ top: 20, right: 30, left: 20, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="nombre"
                  stroke="#666"
                  interval={0}
                  // ✅ Tick envuelto (2 líneas), sin diagonal
                  tick={<WrapXAxisTick />}
                  height={55}
                />
                <YAxis stroke="#666" tickFormatter={formatPercentEs} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                  }}
                  formatter={(value) => `${formatPercentEs(value)} %`}
                  labelFormatter={(label) => `Partido: ${label}`}
                />
                <Bar
                  dataKey="porcentaje"
                  name="Porcentaje de voto"
                  radius={[4, 4, 0, 0]}
                >
                  {votosData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mapa Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-6">
              Mapa de Extremadura
            </h2>

            <MapaExtremadura municipioInfo={municipiosInfo} />

            <p className="text-center text-gray-600 mt-6 text-sm">
              Pulse en un territorio para ir a su detalle
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
