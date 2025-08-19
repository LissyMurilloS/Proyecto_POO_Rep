// Coordenadas iniciales del barrio Potosí, Suba
const centroInicial = [4.653, -74.085];

// Inicializar el mapa
const map = L.map('map').setView(centroInicial, 15);

// Capa base: OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// ✅ Restaurar íconos por defecto de Leaflet (azul con punta blanca)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png'
});

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

// Cargar el polígono del barrio Potosí
fetch('potosi.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Error cargando potosi.geojson');
    return response.json();
  })
  .then(data => {
    // Crear capa del barrio
    L.geoJSON(data, {
      style: estiloBarrio,
      onEachFeature: function (feature, layer) {
        layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
      }
    }).addTo(map);

    // Convertir a polígono con Turf.js
    const barrioPolygon = turf.polygon(data.features[0].geometry.coordinates);

    // Centrar el mapa
    const limitesBarrio = L.geoJSON(data).getBounds();
    if (limitesBarrio.isValid()) {
      map.flyToBounds(limitesBarrio, { duration: 2, padding: [50, 50] });
    } else {
      map.setView(centroInicial, 15);
    }

    // Cargar y filtrar la malla vial
    cargarMallaVial(barrioPolygon);
  })
  .catch(err => {
    console.error('Error al cargar el barrio:', err);
    alert('No se pudo cargar potosi.geojson. Verifica que esté en la carpeta.');
  });

// Función para cargar y filtrar vías que intersectan el barrio
function cargarMallaVial(barrioPolygon) {
  fetch('Malla_Vial_Integral_Bogota_D_C.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error('Error cargando Malla_Vial_Integral_Bogota_D_C.geojson');
      }
      return response.json();
    })
    .then(data => {
      const puntosUnicos = new Set();

      // Función para agregar solo campos con valor
      function agregarCampo(label, valor) {
        return valor ? `<strong>${label}:</strong> ${valor}<br>` : '';
      }

      data.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'LineString') {
          const coords = feature.geometry.coordinates;
          const props = feature.properties;

          const linea = turf.lineString(coords);

          if (turf.booleanIntersects(linea, barrioPolygon)) {
            const latlngs = coords.map(coord => L.latLng(coord[1], coord[0]));
            L.polyline(latlngs, estiloVias).addTo(map);

            // Agregar marcadores en los extremos
            [coords[0], coords[coords.length - 1]].forEach(coord => {
              const lng = coord[0];
              const lat = coord[1];
              const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

              if (!puntosUnicos.has(key)) {
                puntosUnicos.add(key);

                // ✅ Popup limpio, sin íconos, como en Leaflet oficial
                const popupContent = `
                  <b>Información de la vía en esta intersección</b><br><br>
                  ${agregarCampo('Tipo', props.MVITIPO)}
                  ${agregarCampo('Etiqueta', props.MVIETIQUET)}
                  ${agregarCampo('Nombre', props.NAME)}
                  <strong>Latitud:</strong> ${lat.toFixed(6)}<br>
                  <strong>Longitud:</strong> ${lng.toFixed(6)}
                `;

                // ✅ Marcador por defecto de Leaflet (azul)
                L.marker([lat, lng])
                  .addTo(map)
                  .bindPopup(popupContent);
              }
            });
          }
        }
      });
    })
    .catch(err => {
      console.error('Error al cargar la malla vial:', err);
      alert('No se pudo cargar Malla_Vial_Integral_Bogota_D_C.geojson. Verifica que esté en la carpeta.');
    });
}