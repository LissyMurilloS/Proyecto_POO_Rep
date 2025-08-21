// proyectoC.js

document.addEventListener('DOMContentLoaded', () => {
  // Descripciones de cada contaminante
  const descriptions = {
    'NO2': 'Dióxido de nitrógeno. Proviene principalmente de vehículos y procesos industriales. Puede irritar las vías respiratorias y contribuir a la formación de smog.',
    'O3': 'Ozono troposférico. No se emite directamente, sino que se forma por reacciones químicas entre óxidos de nitrógeno y compuestos orgánicos volátiles bajo la luz solar. Afecta la salud respiratoria.',
    'PM10': 'Partículas suspendidas con diámetro menor a 10 micrómetros. Pueden inhalarse y alcanzar las vías respiratorias superiores. Provienen de polvo, combustión y actividades industriales.',
    'PM2.5': 'Partículas finas con diámetro menor a 2.5 micrómetros. Penetran profundamente en los pulmones y están asociadas con enfermedades cardiovasculares y respiratorias.',
    'SO2': 'Dióxido de azufre. Emitido principalmente por la quema de combustibles fósiles que contienen azufre. Puede causar irritación respiratoria y contribuir a la lluvia ácida.'
  };

  // Cargar el archivo GeoJSON
  fetch('datos-suba.geojson')
    .then(response => {
      if (!response.ok) throw new Error('No se pudo cargar el archivo: ' + response.statusText);
      return response.json();
    })
    .then(data => {
      const features = data.features;

      // Limpiar contenedor de carga
      const container = document.getElementById('container');
      container.innerHTML = '';

      // Agrupar datos por contaminante
      const contaminants = {
        'NO2': { values: [], timestamps: [] },
        'O3': { values: [], timestamps: [] },
        'PM10': { values: [], timestamps: [] },
        'PM2.5': { values: [], timestamps: [] },
        'SO2': { values: [], timestamps: [] }
      };

      features.forEach(feature => {
        const { contaminante, valor, fecha_hora } = feature.properties;
        if (contaminants[contaminante]) {
          contaminants[contaminante].values.push(valor);
          contaminants[contaminante].timestamps.push(new Date(fecha_hora));
        }
      });

      // Generar una gráfica por cada contaminante
      Object.keys(contaminants).forEach(contaminant => {
        const dataGroup = contaminants[contaminant];
        if (dataGroup.values.length === 0) return;

        // Crear contenedor
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-container';

        // Título
        const title = document.createElement('h2');
        title.textContent = contaminant;
        chartDiv.appendChild(title);

        // Descripción
        const description = document.createElement('p');
        description.textContent = descriptions[contaminant] || 'No hay descripción disponible.';
        description.className = 'chart-description';
        chartDiv.appendChild(description);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.height = 300;
        chartDiv.appendChild(canvas);

        // Añadir al contenedor principal
        container.appendChild(chartDiv);

        // Crear gráfica
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: dataGroup.timestamps.map(d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
            datasets: [{
              label: `${contaminant} (μg/m³)`,
              data: dataGroup.values,
              borderColor: getRandomColor(),
              backgroundColor: (ctx) => {
                const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
                const color = hexToRgb(getRandomColor());
                gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
                gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`);
                return gradient;
              },
              fill: true,
              tension: 0.2,
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: 'Hora del Día' },
                ticks: { maxRotation: 0 }
              },
              y: {
                title: { display: true, text: 'Concentración (μg/m³)' }
              }
            },
            plugins: {
              legend: { position: 'top' },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.parsed.y.toFixed(2)} μg/m³`
                }
              }
            }
          }
        });
      });
    })
    .catch(error => {
      console.error('Error:', error);
      document.getElementById('container').innerHTML = `<p style="color: red; font-weight: bold;">Error al cargar los datos: ${error.message}</p>`;
    });
});

// Función auxiliar: color aleatorio
function getRandomColor() {
  const r = Math.floor(Math.random() * 200) + 55;
  const g = Math.floor(Math.random() * 200) + 55;
  const b = Math.floor(Math.random() * 200) + 55;
  return `rgb(${r},${g},${b})`;
}

// Función auxiliar: convertir hex a RGB
function hexToRgb(hex) {
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthand, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 100, g: 100, b: 100 };
}