// Inicializar el mapa centrado cerca de Potosí
const map = L.map('map').setView([4.6962, -74.0826], 16);

// Capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Estilo para el barrio
const estiloBarrio = {
  color: "#ff0000",
  weight: 3,
  opacity: 1,
  fillOpacity: 0.35
};

// Referencias UI
const sidebar = document.getElementById('sidebar');
const btnLimpiar = document.getElementById('btn-limpiar');

// Utilidad: actualizar panel lateral
function mostrarInfo(html) {
  sidebar.innerHTML = `
    <h3>Información</h3>
    ${html}
    <button id="btn-limpiar" class="btn-limpiar">Limpiar</button>
  `;
  // Reasignar evento al nuevo botón
  document.getElementById('btn-limpiar').addEventListener('click', limpiarInfo);
}

// Limpiar panel y desactivar resaltado
function limpiarInfo() {
  sidebar.innerHTML = `
    <h3>Información</h3>
    <p>Haz clic en un marcador para ver el nombre del parque.</p>
    <button id="btn-limpiar" class="btn-limpiar">Limpiar</button>
  `;
  document.getElementById('btn-limpiar').addEventListener('click', limpiarInfo);
  if (ultimoIcono) ultimoIcono.classList.remove('marker-activo');
}

// Marcadores de parques
const parques = [
  {
    coords: [4.696923682081576, -74.08265058115799],
    nombre: 'Parque Central Pontevedra',
    imagen: img='img/Ppontevedra.jpg'
  },
  {
    coords: [4.6956940082946925, -74.08261839464893],
    nombre: 'Central Potosí',
    imagen: 'https://lh3.googleusercontent.com/gps-cs-s/AC9h4npH1nJqdBUCy5nZPkNw7am06mSjSwcBxEmMuRdEQZgs69fA-uzay8xGgqU73ao-yk7xmSFBnVWGmL7S-5Q3zSgIK7vDdy4vt8iRD2WevPQORgD9vtUZ3bGX_4wg9LblDX5SAUZf=h1440'
  }
];

// Crear icono default (permitirá añadir clase CSS al elemento <img>)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

let ultimoIcono = null;

// Cargar SOLO el barrio Potosí
fetch('potosiD.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error al cargar barrio: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(barrioData => {
    if (!barrioData.features || barrioData.features.length === 0) {
      throw new Error("El archivo potosiD.geojson está vacío o tiene formato incorrecto.");
    }

    // Dibujar polígono del barrio
    const barrioLayer = L.geoJSON(barrioData, { style: estiloBarrio }).addTo(map);

    // Ajustar vista al barrio
    const boundsBarrio = barrioLayer.getBounds();

    // Crear marcadores y ampliar bounds para que entren
    const markers = parques.map(p => {
      const m = L.marker(p.coords, { icon: defaultIcon }).addTo(map);
      m.on('click', () => {
        // Resaltar el marcador activo (añadiendo clase al elemento IMG del icono)
        if (ultimoIcono) ultimoIcono.classList.remove('marker-activo');
        const iconEl = m.getElement();
        if (iconEl) {
          const img = iconEl.querySelector('img.leaflet-marker-icon');
          if (img) {
            img.classList.add('marker-activo');
            ultimoIcono = img;
          }
        }

        // Mostrar info en el panel derecho
        mostrarInfo(`
          <p><strong>Nombre del parque:</strong><br>${p.nombre}</p>
          <p><strong>Coordenadas:</strong><br>${p.coords[0].toFixed(6)}, ${p.coords[1].toFixed(6)}</p>
          <p><strong>Imagen:</strong><br><img src='${p.imagen}'/></p>
        `);
      });
      return m;
    });

    // Extender límites con marcadores
    markers.forEach(m => boundsBarrio.extend(m.getLatLng()));

    // Volar a los límites combinados
    map.flyToBounds(boundsBarrio, { padding: [80, 80] });

    // Limpiar panel al hacer clic en el mapa vacío
    map.on('click', (e) => {
      // Evitar limpiar cuando el clic es sobre un marcador (Leaflet dispara click del mapa también)
      // Usamos un pequeño retardo; si se hizo click en marcador, ya se actualizó el panel.
      setTimeout(() => {
        // Si no hay marcador activo, limpiamos
        if (!ultimoIcono || !ultimoIcono.classList.contains('marker-activo')) {
          limpiarInfo();
        }
      }, 0);
    });
  })
  .catch(err => {
    console.error("Error en la carga de datos:", err.message);
    alert("Hubo un problema al cargar potosiD.geojson. Verifica que el archivo esté en la misma carpeta.");
  });

// Inicializar estado del panel y botón
if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarInfo);
