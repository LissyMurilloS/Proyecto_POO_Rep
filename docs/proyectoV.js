// Coordenadas iniciales del barrio Potosí, Suba
const centroInicial = [4.653, -74.085];

// Inicializar el mapa
const map = L.map('map').setView(centroInicial, 15);

// ✅ 1. CARCAMIENTO: Capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Estilo para el polígono del barrio (naranja)
const estiloBarrio = {
  color: '#FF8C00',
  weight: 3,
  opacity: 0.8,
  fillColor: '#FFA500',
  fillOpacity: 0.1
};

// Estilo para vías (gris oscuro)
const estiloVias = {
  color: '#333',
  weight: 3,
  opacity: 0.8
};

// ✅ Restaurar ícono por defecto de Leaflet (azul con punta blanca)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png'
});

// Función para agregar solo campos con valor
function agregarCampo(label, valor) {
  return valor ? `<strong>${label}:</strong> ${valor}<br>` : '';
}

// --- 2. CARGAR EL BARRIO ---
fetch('potosi.geojson') 
  .then(response => {
    if (!response.ok) throw new Error('Error cargando potosi.geojson: ' + response.status);
    return response.json();
  })
  .then(data => {
    // ✅ 2. BARRIO: Dibujar el polígono del barrio Potosí
    const barrioLayer = L.geoJSON(data, {
      style: estiloBarrio,
      onEachFeature: function (feature, layer) {
        layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
      }
    }).addTo(map);

    // Centrar el mapa en el barrio
    const limitesBarrio = barrioLayer.getBounds();
    if (limitesBarrio.isValid()) {
      map.flyToBounds(limitesBarrio, { duration: 2, padding: [50, 50] });
    } else {
      map.setView(centroInicial, 15);
    }

    // ✅ 3. Luego de cargar el barrio, cargar las vías
    cargarVias();
  })
  .catch(err => {
    console.error('Error al cargar el barrio:', err);
    alert('No se pudo cargar potosi.geojson. Verifica que esté en la carpeta.');
  });

// Función para cargar las vías
function cargarVias() {
  fetch('Vias.geojson') // Asegúrate de que el archivo exista y se llame así
    .then(response => {
      if (!response.ok) throw new Error('Error cargando Vias.geojson: ' + response.status);
      return response.json();
    })
    .then(data => {
      const puntosUnicos = new Set();

      data.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'MultiLineString') {
          // ✅ 3. VÍAS: Dibujar cada línea
          feature.geometry.coordinates.forEach(line => {
            const latlngs = line.map(coord => L.latLng(coord[1], coord[0]));
            L.polyline(latlngs, estiloVias).addTo(map);

            // ✅ 4. MARCADORES: Agregar íconos de ubicación en los extremos
            const inicio = line[0];
            const fin = line[line.length - 1];

            [inicio, fin].forEach(coord => {
              const lng = coord[0];
              const lat = coord[1];
              const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

              if (!puntosUnicos.has(key)) {
                puntosUnicos.add(key);

                const popupContent = `
                  <b>Información de la vía en esta intersección</b><br><br>
                  ${agregarCampo('Tipo', feature.properties.MVITIPO)}
                  ${agregarCampo('Etiqueta', feature.properties.MVIETIQUET)}
                  ${agregarCampo('Nombre', feature.properties.NAME)}
                  <strong>Latitud:</strong> ${lat.toFixed(6)}<br>
                  <strong>Longitud:</strong> ${lng.toFixed(6)}
                `;

                // ✅ 4. ÍCONO DE MARCADOR (encima de todo)
                L.marker([lat, lng])
                  .addTo(map)
                  .bindPopup(popupContent);
              }
            });
          });
        }
      });
    })
    .catch(err => {
      console.error('Error al cargar Vias.geojson:', err);
      alert('No se pudo cargar Vias.geojson. Verifica que esté en la carpeta.');
    });
}