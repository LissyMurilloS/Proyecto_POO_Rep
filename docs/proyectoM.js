// Coordenadas iniciales del barrio Potosí
const centroInicial = [4.696, -74.081];

// Inicializar el mapa
const map = L.map('map').setView(centroInicial, 15);

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

// Ícono con emoji de autobús 🚌
const iconoParadero = L.divIcon({
  html: '🚌',
  className: 'paradero-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// ✅ Estilo para las rutas del SITP: línea segmentada, delgada y con separación
const estiloRuta = {
  color: '#6c757d',     // Gris profesional
  weight: 2.5,          // Delgado
  opacity: 0.8,         // Suave
  dashArray: '14, 10'   // Línea: — — — — (ideal para rutas urbanas)
};

// Palabras clave para asociar rutas con paraderos
const keywordsPorCenefa = {
  '084B03': ['PONTEVEDRA'],
  '084A03': ['POTOSI'],
  '083B03': ['POTOSI', 'MAZUREN'],
  '603A03': ['CALLE 100', 'CL 100']
};

// Cargar el polígono del barrio Potosí
fetch('potosi.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Error cargando potosi.geojson');
    return response.json();
  })
  .then(data => {
    // Dibujar el barrio
    L.geoJSON(data, {
      style: estiloBarrio,
      onEachFeature: function (feature, layer) {
        layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
      }
    }).addTo(map);

    // Centrar el mapa
    const limitesBarrio = L.geoJSON(data).getBounds();
    if (limitesBarrio.isValid()) {
      map.flyToBounds(limitesBarrio, { duration: 2, padding: [50, 50] });
    }

    // Convertir a polígono con Turf.js
    const barrioPolygon = turf.polygon(data.features[0].geometry.coordinates);

    // Cargar paraderos y rutas
    Promise.all([
      fetch('Paraderos_Zonales_del_SITP.geojson').then(r => r.json()),
      fetch('rutas_poto.geojson').then(r => r.json())
    ])
    .then(([paraderosData, rutasData]) => {
      const codigosClave = ['083B03', '084A03', '084B03', '603A03'];

      const paraderosFiltrados = paraderosData.features.filter(feature => {
        if (feature.geometry?.type !== 'Point') return false;
        const cenefa = feature.properties.cenefa;
        if (!codigosClave.includes(cenefa)) return false;

        const [lng, lat] = feature.geometry.coordinates;
        const punto = turf.point([lng, lat]);

        return turf.booleanPointInPolygon(punto, barrioPolygon);
      });

      // Dibujar cada paradero
      paraderosFiltrados.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        const nombre = props.nombre;
        const direccion = props.direccion_bandera;
        const cenefa = props.cenefa;

        // Buscar rutas que pasan por este paradero
        const keywords = keywordsPorCenefa[cenefa] || [];
        const rutasParadero = rutasData.features.filter(ruta => {
          const origen = ruta.properties.origen_ruta_zonal.toUpperCase();
          const destino = ruta.properties.destino_ruta_zonal.toUpperCase();
          return keywords.some(word => origen.includes(word) || destino.includes(word));
        });

        // Generar lista de rutas
        let rutasHtml = '';
        if (rutasParadero.length > 0) {
          rutasHtml = '<strong>Rutas que pasan:</strong><br><ul>';
          rutasParadero.forEach(ruta => {
            rutasHtml += `<li>${ruta.properties.codigo_definitivo_ruta_zonal} → ${ruta.properties.destino_ruta_zonal}</li>`;
          });
          rutasHtml += '</ul>';
        }

        // Mostrar foto si existe
        let imgHtml = '';
        if (cenefa) {
          const imgSrc = `fotos/${cenefa}.jpg`;
          imgHtml = `
            <div style="margin-top: 8px;">
              <img src="${imgSrc}" 
                   alt="Foto del paradero ${cenefa}" 
                   style="width:150px; height:auto; border-radius:4px;"
                   onerror="this.style.display='none'; 
                           var span = document.createElement('span');
                           span.style.color='#666'; 
                           span.style.fontSize='0.9em'; 
                           span.textContent='Foto no disponible';
                           this.parentNode.appendChild(span);">
            </div>
          `;
        }

        // Contenido del popup
        const popupContent = `
          <b>📍 ${nombre}</b><br>
          <strong>Dirección:</strong> ${direccion}<br>
          <strong>Código:</strong> ${cenefa}<br>
          ${rutasHtml}
          ${imgHtml}
        `;

        // Agregar marcador
        L.marker([lat, lng], { icon: iconoParadero })
          .addTo(map)
          .bindPopup(popupContent);
      });

      // Dibujar rutas que pasan por los paraderos clave
      rutasData.features.forEach(ruta => {
        const origen = ruta.properties.origen_ruta_zonal.toUpperCase();
        const destino = ruta.properties.destino_ruta_zonal.toUpperCase();
        const pasaPorBarrio = [
          'PONTEVEDRA', 'POTOSI', 'MAZUREN', 'CALLE 100', 'CL 100'
        ].some(word => origen.includes(word) || destino.includes(word));

        if (pasaPorBarrio) {
          L.geoJSON(ruta.geometry, {
            style: estiloRuta
          })
          .addTo(map)
          .bindPopup(`
            <b>🚌 Ruta ${ruta.properties.codigo_definitivo_ruta_zonal}</b><br>
            ${ruta.properties.origen_ruta_zonal} → ${ruta.properties.destino_ruta_zonal}<br>
            <em>Operador: ${ruta.properties.operador_ruta_zonal}</em>
          `);
        }
      });

      // --- LEYENDA DEL MAPA ---
      const legend = L.control({ position: 'topright' });

      legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        div.style.fontFamily = '"Delius", cursive';
        div.style.color = '#0f172a';
        div.style.fontSize = '14px';
        div.style.lineHeight = '1.8';

        const labels = [
          '<strong>Convenciones:</strong><br>',
          '<span style="display: inline-block; width: 20px; text-align: center; margin-right: 8px; font-size: 18px;">🚌</span> Paradero SITP<br>',
          '<hr style="margin:8px 0; border:0.5px solid #ddd;">',
          '<i style="background:transparent; border:2px solid #6c757d; width:20px; height:3px; display:block; float:left; margin-right:8px; margin-top:6px;"></i> Ruta del SITP<br>',
          '<hr style="margin:8px 0; border:0.5px solid #ddd;">',
          '<i style="border:2px solid #FF8C00; background:#FFA50010; width:20px; height:20px; display:block; float:left; margin-right:8px;"></i> Barrio Potosí'
        ];

        div.innerHTML = labels.join('');
        return div;
      };

legend.addTo(map);
    })
    .catch(err => {
      console.error('Error al cargar paraderos o rutas:', err);
      alert('No se pudieron cargar los datos de movilidad.');
    });
  })
  .catch(err => {
    console.error('Error al cargar potosi.geojson:', err);
    alert('No se pudo cargar potosi.geojson. Verifica que esté en la carpeta.');
  });