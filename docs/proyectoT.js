// Coordenadas iniciales del barrio Potosí
const centroInicial = [4.696, -74.081];

// Inicializar el mapa
const map = L.map('map').setView(centroInicial, 14);

// Capa base: OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Estilo para el polígono del barrio
const estiloBarrio = {
  color: '#FF8C00',
  weight: 3,
  opacity: 0.8,
  fillColor: '#FFA500',
  fillOpacity: 0.1
};

// Estilo para la zona de influencia (Buffer 800 m)
const estiloBuffer = {
  color: '#8e44ad',
  weight: 2,
  opacity: 0.7,
  fillColor: '#8e44ad',
  fillOpacity: 0.05
};

// Estilo para las rutas troncales
const estiloRuta = {
  color: '#2980b9',     // Azul fuerte
  weight: 5,
  opacity: 0.9,
  dashArray: '10, 6'
};

// Ícono para estaciones troncales
const iconoEstacion = L.divIcon({
  html: '🚉',
  className: 'estacion-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Cargar el polígono del barrio Potosí
Promise.all([
  fetch('potosi.geojson').then(r => r.json()),
  fetch('Buffer_800.geojson').then(r => r.json()),
  fetch('RutasT_Buffer.geojson').then(r => r.json()),
  fetch('EstacionesT_Buffer.geojson').then(r => r.json())
])
.then(([barrioData, bufferData, rutasData, estacionesData]) => {
  // Dibujar barrio
  L.geoJSON(barrioData, {
    style: estiloBarrio,
    onEachFeature: function (feature, layer) {
      layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
    }
  }).addTo(map);

  // Dibujar zona de influencia (800 m)
  L.geoJSON(bufferData, {
    style: estiloBuffer,
    onEachFeature: function (feature, layer) {
      layer.bindPopup('<b>Zona de influencia</b><br>800 metros alrededor del barrio');
    }
  }).addTo(map);

  // Dibujar rutas troncales
  rutasData.features.forEach(ruta => {
    const props = ruta.properties;
    const popupContent = `
      <b>🚄 Ruta ${props.route_name_ruta_troncal}</b><br>
      <strong>Nombre:</strong> ${props.nombre_ruta_troncal}<br>
      <strong>Origen:</strong> ${props.origen_ruta_troncal}<br>
      <strong>Destino:</strong> ${props.destino_ruta_troncal}<br>
      <strong>Tipo:</strong> ${props.desc_tipo_ruta_troncal}<br>
      <strong>Horario:</strong> ${props.horario_lunes_viernes}
    `;

    L.geoJSON(ruta.geometry, {
      style: estiloRuta
    })
    .bindPopup(popupContent)
    .addTo(map);
  });

  // Dibujar estaciones troncales
  estacionesData.features.forEach(estacion => {
    const [lng, lat] = estacion.geometry.coordinates;
    const props = estacion.properties;

    const popupContent = `
      <b>🚉 ${props.nombre_estacion}</b><br>
      <strong>Troncal:</strong> ${props.troncal_estacion}<br>
      <strong>Código:</strong> ${props.numero_estacion}<br>
      <strong>Ubicación:</strong> ${props.ubicacion_estacion}<br>
      <strong>Vagones:</strong> ${props.numero_vagones_estacion}
    `;

    L.marker([lat, lng], { icon: iconoEstacion })
      .bindPopup(popupContent)
      .addTo(map);
  });

  // Centrar el mapa en el barrio
  const bounds = L.geoJSON(barrioData).getBounds();
  if (bounds.isValid()) {
    map.flyToBounds(bounds, { duration: 2, padding: [50, 50] });
  }

  // --- LEYENDA ---
  const legend = L.control({ position: 'topright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '8px';
    div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    div.style.fontFamily = '"Delius", cursive';
    div.style.color = '#0f172a';
    div.style.fontSize = '14px';

    const labels = [
      '<strong>Convenciones:</strong><br>',
      '<i style="background:#FF8C00; width:20px; height:20px; display:block; float:left; margin-right:8px;"></i> Barrio Potosí<br>',
      '<hr style="margin:8px 0; border:0.5px solid #ddd;">',
      '<i style="background:#8e44ad; width:20px; height:20px; display:block; float:left; margin-right:8px; opacity:0.1;"></i> Zona 800 m<br>',
      '<hr style="margin:8px 0; border:0.5px solid #ddd;">',
      '<i style="background:#2980b9; width:20px; height:3px; display:block; float:left; margin-right:8px; margin-top:6px;"></i> Ruta troncal<br>',
      '<hr style="margin:8px 0; border:0.5px solid #ddd;">',
      '<span style="display: inline-block; width: 20px; text-align: center; margin-right: 8px; font-size: 18px;">🚉</span> Estación troncal'
    ];

    div.innerHTML = labels.join('');
    return div;
  };
  legend.addTo(map);
})
.catch(err => {
  console.error('Error al cargar los datos:', err);
  alert('No se pudieron cargar los datos de troncales.');
});