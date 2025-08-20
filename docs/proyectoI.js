// Coordenadas iniciales (backup)
const centroInicial = [4.696, -74.081];

// Inicializar el mapa (sin setView aún)
const map = L.map('map');

// Capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Estilo para el barrio (verde oscuro)
const estiloBarrio = {
  color: '#1e5631',        // Verde oscuro
  weight: 3,
  opacity: 0.9,
  fillColor: '#1e5631',
  fillOpacity: 0.3
};

// Estilos para los buffers (por distancia)
const estiloBuffer200 = {
  color: '#1e5631',        // Borde verde oscuro
  weight: 1.5,
  opacity: 0.8,
  fillColor: '#acdf87',    // Verde claro
  fillOpacity: 0.25
};

const estiloBuffer400 = {
  color: '#b58000',        // Borde amarillo oscuro
  weight: 1.5,
  opacity: 0.8,
  fillColor: '#ffcf40',    // Amarillo
  fillOpacity: 0.22
};

const estiloBuffer600 = {
  color: '#a03913',        // Borde naranja oscuro
  weight: 1.5,
  opacity: 0.8,
  fillColor: '#f17c67',    // Naranja
  fillOpacity: 0.20
};

const estiloBuffer800 = {
  color: '#a00000',        // Borde rojo oscuro
  weight: 1.5,
  opacity: 0.8,
  fillColor: '#d93025',    // Rojo
  fillOpacity: 0.18
};

// Variable global para el barrio
let barrioLayer;

// Restaurar ícono por defecto de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png'
});

// --- 1. CARGAR BUFFER_800 Y CENTRAR EL MAPA ---
fetch('Buffer_800.geojson')
  .then(response => {
    if (!response.ok) throw new Error('Error cargando Buffer_800.geojson');
    return response.json();
  })
  .then(data => {
    console.log("Buffer 800 cargado:", data);

    // Añadir al mapa
    const buffer800Layer = L.geoJSON(data, {
      style: estiloBuffer800,
      onEachFeature: function (feature, layer) {
        layer.bindPopup('<b>Área de influencia: 800 m</b>');
      }
    }).addTo(map);

    // Centrar el mapa en el buffer de 800 m
    const bounds = buffer800Layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView(centroInicial, 15);
    }

    // Ahora cargar los otros buffers y el resto
    cargarBuffersRestantes();
    cargarBarrio();
    cargarSitiosInteres();
  })
  .catch(err => {
    console.error('Error al cargar Buffer_800.geojson:', err);
    alert('No se pudo cargar Buffer_800.geojson. Verifica que esté en la carpeta docs/.');
    map.setView(centroInicial, 15);
    cargarBuffersRestantes();
    cargarBarrio();
    cargarSitiosInteres();
  });

// --- 2. CARGAR LOS DEMÁS BUFFERS ---
function cargarBuffersRestantes() {
  // Buffer 600 m
  fetch('Buffer_600.geojson')
    .then(response => response.json())
    .then(data => {
      L.geoJSON(data, {
        style: estiloBuffer600,
        onEachFeature: function (feature, layer) {
          layer.bindPopup('<b>Área de influencia: 600 m</b>');
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error al cargar Buffer_600.geojson:', err));

  // Buffer 400 m
  fetch('Buffer_400.geojson')
    .then(response => response.json())
    .then(data => {
      L.geoJSON(data, {
        style: estiloBuffer400,
        onEachFeature: function (feature, layer) {
          layer.bindPopup('<b>Área de influencia: 400 m</b>');
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error al cargar Buffer_400.geojson:', err));

  // Buffer 200 m
  fetch('Buffer_200.geojson')
    .then(response => response.json())
    .then(data => {
      L.geoJSON(data, {
        style: estiloBuffer200,
        onEachFeature: function (feature, layer) {
          layer.bindPopup('<b>Área de influencia: 200 m</b>');
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error al cargar Buffer_200.geojson:', err));
}

// --- 3. CARGAR EL BARRIO ---
function cargarBarrio() {
  fetch('potosi.geojson')
    .then(response => response.json())
    .then(data => {
      barrioLayer = L.geoJSON(data, {
        style: estiloBarrio,
        onEachFeature: function (feature, layer) {
          layer.bindPopup('<b>Barrio Potosí</b><br>Localidad: Suba');
        }
      }).addTo(map);
    })
    .catch(err => {
      console.error('Error al cargar potosi.geojson:', err);
      alert('No se pudo cargar potosi.geojson.');
    });
}

// --- 4. CARGAR LOS SITIOS DE INTERÉS ---
function cargarSitiosInteres() {
  fetch('Sitios_Buffer_Poto.geojson')
    .then(response => response.json())
    .then(data => {
      if (!data || !data.features || data.features.length === 0) {
        console.error("No hay sitios de interés.");
        return;
      }

      // Función para obtener emoji según tipo
      function getEmoji(tipo) {
        const t = tipo || '';
        if (t === 'DEP-REC') return '🌳';
        if (t === 'COM-IND-TURI') return '🛍️';
        if (t === 'FUN-PUB') return '🏛️';
        if (t.includes('EDU')) return '🎓';
        return 'ℹ️';
      }

      data.features.forEach(feature => {
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        const tipo = props.NGeClasifi;

        // Validar coordenadas
        if (!Array.isArray(coords) || coords.length < 2) {
          console.warn("Coordenadas inválidas:", coords);
          return;
        }

        const latlng = L.latLng(coords[1], coords[0]);
        const emoji = getEmoji(tipo);

        // Popup con emoji
        const popupContent = `
          <b>${emoji} ${props.NGeNombre}</b><br><br>
          <strong>📍 Tipo:</strong> ${tipo || 'No especificado'}<br>
          <strong>🔖 ID:</strong> ${props.NGeIdentif || 'N/A'}<br>
          <strong>🏢 Fuente:</strong> ${props.NGeFuente || 'Desconocida'}
        `;

        // Ícono con emoji
        const icon = L.divIcon({
          html: `<span style="font-size: 16px; color: #000;">${emoji}</span>`,
          className: 'custom-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker(latlng, { icon: icon })
          .bindPopup(popupContent)
          .addTo(map);
      });

      // Añadir leyenda: emojis + colores de buffers + proximidad
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
          <strong>Convenciones</strong><br>
          <!-- Emojis -->
          🌳 Parque (DEP-REC)<br>
          🛍️ Comercio (COM-IND-TURI)<br>
          🏛️ Público (FUN-PUB)<br>
          🎓 Educación<br>
          ℹ️ Otros<br><br>

          <!-- Buffer de proximidad -->
          <strong>Proximidad al barrio</strong><br>
          <i style="background:#1e5631; width:12px; height:12px; border-radius:4px; display:inline-block;"></i> Verde oscuro: Barrio Potosí<br>
          <i style="background:#acdf87; width:12px; height:12px; border-radius:4px; display:inline-block;"></i> Verde claro: Buffer 200 m<br>
          <i style="background:#ffcf40; width:12px; height:12px; border-radius:4px; display:inline-block;"></i> Amarillo: Buffer 400 m<br>
          <i style="background:#f17c67; width:12px; height:12px; border-radius:4px; display:inline-block;"></i> Naranja: Buffer 600 m<br>
          <i style="background:#d93025; width:12px; height:12px; border-radius:4px; display:inline-block;"></i> Rojo: Buffer 800 m
        `;
        return div;
      };
      legend.addTo(map);
    })
    .catch(err => {
      console.error('Error al cargar Sitios_Buffer_Poto.geojson:', err);
      alert('No se pudo cargar Sitios_Buffer_Poto.geojson.');
    });
}