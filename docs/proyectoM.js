// Coordenadas iniciales (fallback)
const centroInicial = [4.653, -74.085];

// Inicializar el mapa
const map = L.map('map').setView(centroInicial, 14);

// Capa base: OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Estilo para el polígono del barrio
const estiloBarrio = {
  color: '#2c3e50',
  weight: 3,
  opacity: 0.8,
  fillColor: '#34495e',
  fillOpacity: 0.1
};

// Ícono con emoji de autobús 🚌
const iconoParadero = L.divIcon({
  html: '🚌',
  className: 'paradero-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Cargar el polígono del barrio Potosí
fetch('potosi.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('Error cargando potosi.geojson');
    }
    return response.json();
  })
  .then(data => {
    // Crear capa del barrio
    const barrioLayer = L.geoJSON(data, {
      style: estiloBarrio,
      onEachFeature: function (feature, layer) {
        layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
      }
    }).addTo(map);

    // Convertir a polígono con Turf.js
    const barrioPolygon = turf.polygon(data.features[0].geometry.coordinates);

    // Centrar el mapa en el barrio
    const limitesBarrio = barrioLayer.getBounds();
    if (limitesBarrio.isValid()) {
      map.flyToBounds(limitesBarrio, {
        duration: 2,
        padding: [50, 50]
      });
    } else {
      map.setView(centroInicial, 15);
    }

    // Cargar y filtrar paraderos del SITP
    cargarYFiltrarParaderos(barrioPolygon);
  })
  .catch(err => {
    console.error('Error al cargar el barrio:', err);
    alert('No se pudo cargar potosi.geojson. Verifica que esté en la carpeta.');
  });

// Función para cargar y filtrar paraderos dentro del barrio
function cargarYFiltrarParaderos(barrioPolygon) {
  fetch('Paraderos_Zonales_del_SITP.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error('Error cargando Paraderos_Zonales_del_SITP.geojson');
      }
      return response.json();
    })
    .then(data => {
      data.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates;
          const punto = [lng, lat]; // Formato Turf: [lng, lat]

          // Verificar si el punto está dentro del polígono del barrio
          if (turf.booleanPointInPolygon(punto, barrioPolygon)) {
            const props = feature.properties;
            const nombre = props.nombre || 'Sin nombre';
            const direccion = props.direccion_bandera || 'No especificada';
            const cenefa = props.cenefa || 'No especificada';
            const localidad = props.localidad || 'Desconocida';

            // Generar HTML de la imagen si existe
            let imgHtml = '';
            if (cenefa !== 'No especificada') {
              const imgSrc = `fotos/${cenefa}.jpg`;
              imgHtml = `
                <div style="margin-top: 8px;">
                  <img src="${imgSrc}" 
                       alt="Foto del paradero ${cenefa}" 
                       style="width:150px; height:auto; border-radius:4px;" 
                       onerror="this.remove(); 
                               var p = document.createElement('p'); 
                               p.style.margin='5px 0'; 
                               p.style.fontSize='0.9em'; 
                               p.style.color='#666'; 
                               p.textContent='Foto no disponible'; 
                               this.parentNode.appendChild(p);">
                </div>
              `;
            }

            // Contenido final del popup
            const popupContent = `
              <b>📍 ${nombre}</b><br>
              <strong>Dirección bandera:</strong> ${direccion}<br>
              <strong>Código cenefa:</strong> ${cenefa}<br>
              <strong>Localidad:</strong> ${localidad}<br>
              ${imgHtml}
            `;

            // Agregar marcador con emoji 🚌
            L.marker([lat, lng], { icon: iconoParadero })
              .addTo(map)
              .bindPopup(popupContent);
          }
        }
      });
    })
    .catch(err => {
      console.error('Error al cargar paraderos:', err);
      alert('No se pudieron cargar los paraderos. Verifica el archivo.');
    });
}