import React from 'react';

const Participacion = ({ participacionData }) => {
  if (!participacionData || participacionData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">PARTICIPACIÓN</h2>
        <p className="text-center text-gray-500">
          Cargando datos de participación...
        </p>
      </div>
    );
  }

  // Encontrar datos de Extremadura, Badajoz y Cáceres
  const extremadura = participacionData.find(
    (d) => d.ambito === 'Comunidad' && d.nombre_ambito === 'Extremadura'
  );
  const badajoz = participacionData.find(
    (d) => d.ambito === 'Provincia' && d.nombre_ambito === 'Badajoz'
  );
  const caceres = participacionData.find(
    (d) => d.ambito === 'Provincia' && d.nombre_ambito === 'Cáceres'
  );

  // Convertir participacion (que viene como porcentaje con coma) a número
  const parseParticipacion = (participacion) => {
    if (!participacion) return 0;
    const str = String(participacion).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const dataToShow = [
    {
      nombre: 'Extremadura',
      porcentaje: parseParticipacion(extremadura?.participacion || 0),
      censo: extremadura?.censo_total || 0,
      mesas: extremadura?.mesas_totales || 0,
      color: '#01f3b3',
    },
    {
      nombre: 'Badajoz',
      porcentaje: parseParticipacion(badajoz?.participacion || 0),
      censo: badajoz?.censo_total || 0,
      mesas: badajoz?.mesas_totales || 0,
      color: '#aaaaaa',
    },
    {
      nombre: 'Cáceres',
      porcentaje: parseParticipacion(caceres?.participacion || 0),
      censo: caceres?.censo_total || 0,
      mesas: caceres?.mesas_totales || 0,
      color: '#aaaaaa',
    },
  ];

  // Formatear números con separador de miles
  const formatNumber = (num) => {
    return num.toLocaleString('es-ES');
  };

  // Formatear porcentaje con coma decimal española
  const formatPercentaje = (num) => {
    return num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">PARTICIPACIÓN</h2>

      {/* Tabla de participación */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 px-2 font-bold">Ámbito</th>
              <th className="text-center py-3 px-2 font-bold">Mesas</th>
              <th className="text-center py-3 px-2 font-bold">Censo</th>
              <th className="text-center py-3 px-2 font-bold">
                Participación
              </th>
            </tr>
          </thead>
          <tbody>
            {dataToShow.map((item) => (
              <tr
                key={item.nombre}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="font-semibold">{item.nombre}</span>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  {formatNumber(item.mesas)}
                </td>
                <td className="text-center py-3 px-2">
                  {formatNumber(item.censo)}
                </td>
                <td className="text-center py-3 px-2">
                  <span className="font-bold text-lg">
                    {formatPercentaje(item.porcentaje)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barras visuales de participación */}
      <div className="space-y-4">
        {dataToShow.map((item) => (
          <div key={`bar-${item.nombre}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold">{item.nombre}</span>
              <span className="text-sm font-bold">
                {formatPercentaje(item.porcentaje)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="h-4 rounded-full transition-all duration-500"
                style={{
                  width: `${item.porcentaje}%`,
                  backgroundColor: item.color,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Participacion;