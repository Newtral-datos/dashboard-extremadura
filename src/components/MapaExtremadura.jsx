import React, { useMemo } from 'react';
import extremaduraGeoJSON from '../data/extremadura-provincias.json';

const SVG_WIDTH = 400;
const SVG_HEIGHT = 400;

const MapaExtremadura = () => {
  const { features, bounds } = useMemo(() => {
    const fc = extremaduraGeoJSON || {};
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
      // coords puede ser Polygon (array de anillos) o MultiPolygon (array de polígonos)
      if (!Array.isArray(coords)) return;

      // Si estamos ya en un anillo: [[lng, lat], [lng, lat], ...]
      if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        coords.forEach(([lng, lat]) => updateBounds(lng, lat));
      } else {
        // Bajamos un nivel más
        coords.forEach((ringOrPoly) => walkCoords(ringOrPoly));
      }
    };

    features.forEach((f) => {
      if (!f || !f.geometry) return;
      const { type, coordinates } = f.geometry;
      if (!coordinates) return;
      if (type === 'Polygon' || type === 'MultiPolygon') {
        walkCoords(coordinates);
      }
    });

    if (
      !isFinite(minLng) ||
      !isFinite(maxLng) ||
      !isFinite(minLat) ||
      !isFinite(maxLat)
    ) {
      // Bounds de emergencia si algo va mal
      minLng = -7.6;
      maxLng = -5.0;
      minLat = 37.3;
      maxLat = 40.6;
    }

    return {
      features,
      bounds: { minLng, maxLng, minLat, maxLat },
    };
  }, []);

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
    const { type, coordinates } = feature.geometry || {};

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
      // Ignoramos agujeros (rings[1..]) para simplificar
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((poly) => {
        const rings = poly;
        const mainPath = buildPath(rings[0]);
        if (mainPath) paths.push(mainPath);
      });
    }

    return paths;
  };

  const getFillColor = (feature) => {
    const name =
      feature.properties?.prov_name ||
      feature.properties?.name ||
      feature.properties?.provincia ||
      '';

    const lower = name.toLowerCase();

    if (lower.includes('cáceres') || lower.includes('caceres')) {
      return '#0054a6'; // Azul PP
    }
    if (lower.includes('badajoz')) {
      return '#ed1c24'; // Rojo PSOE
    }
    return '#cccccc';
  };

  const getLabel = (feature) => {
    const name =
      feature.properties?.prov_name ||
      feature.properties?.name ||
      feature.properties?.provincia ||
      '';
    const lower = name.toLowerCase();

    if (lower.includes('cáceres') || lower.includes('caceres')) {
      return 'Cáceres';
    }
    if (lower.includes('badajoz')) {
      return 'Badajoz';
    }
    return name;
  };

  const getCentroid = (feature) => {
    const coords = [];

    const collectCoords = (geometry) => {
      const { type, coordinates } = geometry || {};
      if (!coordinates) return;

      const pushRing = (ring) => {
        ring.forEach(([lng, lat]) => coords.push([lng, lat]));
      };

      if (type === 'Polygon') {
        coordinates.forEach((ring) => pushRing(ring));
      } else if (type === 'MultiPolygon') {
        coordinates.forEach((poly) => {
          poly.forEach((ring) => pushRing(ring));
        });
      }
    };

    collectCoords(feature.geometry);

    if (!coords.length) {
      return [SVG_WIDTH / 2, SVG_HEIGHT / 2];
    }

    const [sumLng, sumLat] = coords.reduce(
      (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
      [0, 0]
    );
    const avgLng = sumLng / coords.length;
    const avgLat = sumLat / coords.length;
    return projectPoint(avgLng, avgLat);
  };

  if (!features.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/40 border border-slate-700 p-6 text-slate-200">
        <p className="text-sm">
          No se ha podido cargar el GeoJSON de Extremadura.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Asegúrate de que el archivo{' '}
          <code>extremadura-provincias.json</code> existe y contiene las
          provincias de Cáceres y Badajoz.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-700 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">
        Mapa de Extremadura por provincias
      </h2>

      <div className="flex flex-col md:flex-row items-stretch gap-6">
        <div className="flex-1">
          <div className="relative w-full aspect-[4/4]">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-full drop-shadow-[0_0_30px_rgba(15,23,42,0.8)]"
            >
              {features.map((feature, index) => {
                const paths = getFeaturePaths(feature);
                const fill = getFillColor(feature);
                const [cx, cy] = getCentroid(feature);
                const label = getLabel(feature);

                return (
                  <g key={index}>
                    {paths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill={fill}
                        stroke="#0f172a"
                        strokeWidth={2}
                        className="transition-transform duration-200 hover:scale-[1.01]"
                      />
                    ))}
                    {label && (
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize="16"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="w-full md:w-52 flex flex-col justify-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Leyenda
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: '#0054a6' }}
                />
                <span className="text-xs text-slate-100">
                  PP - Cáceres
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: '#ed1c24' }}
                />
                <span className="text-xs text-slate-100">
                  PSOE - Badajoz
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-snug">
            El contorno se genera a partir de un archivo GeoJSON real con
            las provincias de Cáceres y Badajoz, proyectado de forma
            sencilla sobre el SVG.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapaExtremadura;
