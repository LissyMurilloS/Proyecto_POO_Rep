/* ==========================================================================
   proyectoU.js - JavaScript para la sección de UBICACIÓN
   Maneja el mapa interactivo con animación de zoom progresivo
   ========================================================================== */

// Configuración inicial
const BOGOTA_CENTER = [4.65, -74.1];
const POTOSI_CENTER = [4.653, -74.085]; // Coordenadas aproximadas del barrio Potosí

// Variables globales
let map;
let localidadesLayer;
let barrioLayer;
let limitesLocalidad;
let limitesBarrio;
let infoBox;
let animacionEnCurso = false;

// Estilos para las capas
const estiloLocalidades = {
  color: "#0d8d82",
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.1,
  fillColor: "#0d8d82"
};

const estiloBarrio = {
  color: "#ff4757",
  weight: 3,
  opacity: 1,
  fillOpacity: 0.3,
  fillColor: "#ff6b7a"
};

// Inicializar el mapa
function inicializarMapa() {
  // Crear el mapa centrado en Bogotá
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView(BOGOTA_CENTER, 11);

  // Capa base con estilo personalizado
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    className: 'map-tiles'
  }).addTo(map);

  // Cargar datos GeoJSON
  cargarDatos();
}

// Cargar datos de localidades y barrio
async function cargarDatos() {
  try {
    // Mostrar indicador de carga
    mostrarIndicadorCarga();

    // Cargar localidades
    const localidadesResponse = await fetch("poligonos-localidades.geojson");
    if (!localidadesResponse.ok) {
      throw new Error(`Error al cargar localidades: ${localidadesResponse.status}`);
    }
    const localidadesData = await localidadesResponse.json();

    if (!localidadesData.features || localidadesData.features.length === 0) {
      throw new Error("El archivo poligonos-localidades.geojson está vacío o tiene formato incorrecto.");
    }

    // Cargar barrio Potosí
    const barrioResponse = await fetch("potosi.geojson");
    if (!barrioResponse.ok) {
      throw new Error(`Error al cargar barrio: ${barrioResponse.status}`);
    }
    const barrioData = await barrioResponse.json();

    if (!barrioData.features || barrioData.features.length === 0) {
      throw new Error("El archivo potosi.geojson está vacío o tiene formato incorrecto.");
    }

    // Ocultar indicador de carga
    ocultarIndicadorCarga();

    // Agregar capas al mapa
    agregarCapas(localidadesData, barrioData);

    // Iniciar animación de zoom
    //setTimeout(() => iniciarAnimacionZoom(), 1500);

    // Configurar observer para iniciar animación cuando el mapa sea visible
    configurarObserverMapa();

    // Configurar Intersection Observer para detectar cuando el mapa es visible
    function configurarObserverMapa() {
      const mapContainer = document.getElementById('map');
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // Si el mapa es visible al menos en un 70%
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            // Iniciar animación después de un breve delay
            setTimeout(() => iniciarAnimacionZoom(), 1000);
            
            // Desconectar el observer para que solo se ejecute una vez
            observer.unobserve(mapContainer);
          }
        });
      }, {
        threshold: 0.7, // Se activa cuando el 70% del mapa es visible
        rootMargin: '0px' // Sin margen adicional
      });
  
  observer.observe(mapContainer);
}

  } catch (error) {
    console.error("Error al cargar datos:", error.message);
    ocultarIndicadorCarga();
    mostrarMensajeError("Hubo un problema al cargar los datos del mapa. Verifica que los archivos GeoJSON estén disponibles.");
  }
}

// Agregar capas al mapa
function agregarCapas(localidadesData, barrioData) {
  // Capa de localidades con tooltips
  localidadesLayer = L.geoJSON(localidadesData, {
    style: estiloLocalidades,
    onEachFeature: function(feature, layer) {
      if (feature.properties && feature.properties.nombre) {
        layer.bindTooltip(`Localidad: ${feature.properties.nombre}`, {
          permanent: false,
          direction: 'center',
          className: 'custom-tooltip'
        });
      }
    }
  }).addTo(map);

  // Capa del barrio con popup
  barrioLayer = L.geoJSON(barrioData, {
    style: estiloBarrio,
    onEachFeature: function(feature, layer) {
      const popupContent = `
        <div class="popup-barrio">
          <h3>🏘️ Barrio Potosí</h3>
          <p><strong>Localidad:</strong> Suba</p>
          <p><strong>Zona:</strong> Norte de Bogotá</p>
          <p><strong>Características:</strong> Sector residencial con buena conectividad vial.</p>
        </div>
      `;
      layer.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });
    }
  }).addTo(map);

  // Guardar límites
  limitesBarrio = barrioLayer.getBounds();
  limitesLocalidad = encontrarLocalidadContenedora();
}

// Encontrar la localidad que contiene el barrio
function encontrarLocalidadContenedora() {
  let localidadEncontrada = null;
  
  localidadesLayer.eachLayer(function(localidad) {
    const centroBarrio = limitesBarrio.getCenter();
    if (localidad.getBounds().contains(centroBarrio)) {
      localidadEncontrada = localidad.getBounds();
    }
  });

  return localidadEncontrada || limitesBarrio;
}

// Iniciar animación de zoom progresivo
async function iniciarAnimacionZoom() {
  if (animacionEnCurso) return;
  
  animacionEnCurso = true;
  
  try {
    // 1. Vista general de Bogotá
    await animarHacia(BOGOTA_CENTER, 10, 2000, "Vista general de Bogotá");
    await esperar(2000);

    // 2. Zoom a la localidad
    await animarHacia(limitesLocalidad, null, 3000, "Localizando la localidad de Suba");
    await esperar(2000);

    // 3. Zoom al barrio Potosí
    await animarHacia(limitesBarrio, null, 4000, "Enfocando en el barrio Potosí");
    await esperar(1500);

    // 4. Mostrar información
    mostrarRecuadroInfo();
    
  } catch (error) {
    console.error("Error en la animación:", error);
  } finally {
    animacionEnCurso = false;
  }
}

// Función auxiliar para animar hacia un punto o bounds
function animarHacia(destino, zoom, duracion, mensaje) {
  return new Promise((resolve) => {
    if (mensaje) {
      mostrarMensajeEstado(mensaje);
    }

    if (Array.isArray(destino)) {
      // Es un punto [lat, lng]
      map.flyTo(destino, zoom, {
        duration: duracion / 1000
      });
    } else {
      // Es un bounds
      map.flyToBounds(destino, {
        duration: duracion / 1000,
        padding: [50, 50]
      });
    }

    setTimeout(() => {
      ocultarMensajeEstado();
      resolve();
    }, duracion);
  });
}

// Función auxiliar para esperar
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mostrar recuadro de información
function mostrarRecuadroInfo() {
  if (infoBox) {
    infoBox.remove();
  }

  infoBox = L.control({ position: 'topright' });

  infoBox.onAdd = function() {
    const div = L.DomUtil.create('div', 'info-box');
    div.innerHTML = `
      <h3>📍 Barrio Potosí</h3>
      <p><strong>Localidad:</strong> Suba</p>
      <p><strong>Zona:</strong> Norte de Bogotá</p>
      <p><strong>Características:</strong> Ubicado en zona residencial, cerca de vías principales como la Avenida Boyacá y la Calle 80.</p>
      <p><strong>Acceso:</strong> Conectado por varias rutas de transporte público.</p>
      <button onclick="cerrarRecuadroInfo()">✖️ Cerrar</button>
    `;
    
    // Prevenir que los clics en el control afecten el mapa
    L.DomEvent.disableClickPropagation(div);
    
    return div;
  };

  infoBox.addTo(map);
}

// Cerrar recuadro de información
window.cerrarRecuadroInfo = function() {
  if (infoBox) {
    infoBox.remove();
    infoBox = null;
  }
};

// Reiniciar animación
function reiniciarAnimacion() {
  if (animacionEnCurso) {
    return;
  }
  
  cerrarRecuadroInfo();
  ocultarMensajeEstado();
  
  // Volver a la vista inicial
  map.setView(BOGOTA_CENTER, 11);
  
  // Reiniciar después de un momento
  setTimeout(() => iniciarAnimacionZoom(), 1000);
}

// Mostrar indicador de carga
function mostrarIndicadorCarga() {
  const indicator = document.createElement('div');
  indicator.id = 'loading-indicator';
  indicator.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p>Cargando datos del mapa...</p>
    </div>
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: var(--main-font);
  `;
  
  // Agregar estilos para el spinner
  const style = document.createElement('style');
  style.textContent = `
    .loading-content {
      text-align: center;
      color: #0d8d82;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #0d8d82;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
}

// Ocultar indicador de carga
function ocultarIndicadorCarga() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Mostrar mensaje de estado durante la animación
function mostrarMensajeEstado(mensaje) {
  let statusDiv = document.getElementById('status-message');
  
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'status-message';
    statusDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(13, 141, 130, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      z-index: 9999;
      font-family: var(--main-font);
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      animation: fadeInDown 0.5s ease;
    `;
    
    document.body.appendChild(statusDiv);
  }
  
  statusDiv.textContent = mensaje;
  statusDiv.style.display = 'block';
}

// Ocultar mensaje de estado
function ocultarMensajeEstado() {
  const statusDiv = document.getElementById('status-message');
  if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}

// Mostrar mensaje de error
function mostrarMensajeError(mensaje) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ff4757;
    color: white;
    padding: 20px;
    border-radius: 8px;
    z-index: 10000;
    font-family: var(--main-font);
    max-width: 400px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  `;
  
  errorDiv.innerHTML = `
    <h3>⚠️ Error</h3>
    <p>${mensaje}</p>
    <button onclick="this.parentElement.remove()" style="
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid white;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    ">Cerrar</button>
  `;
  
  document.body.appendChild(errorDiv);
  
  // Auto-remover después de 8 segundos
  setTimeout(() => {
    if (errorDiv.parentElement) {
      errorDiv.remove();
    }
  }, 8000);
}

// Event listeners para los botones
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar el mapa cuando la página esté lista
  inicializarMapa();
  
  // Botón para mostrar información
  const btnInfo = document.getElementById('btn-abrir-info');
  if (btnInfo) {
    btnInfo.addEventListener('click', mostrarRecuadroInfo);
  }
  
  // Botón para reiniciar animación
  const btnReset = document.getElementById('btn-reset-vista');
  if (btnReset) {
    btnReset.addEventListener('click', reiniciarAnimacion);
  }
});

// Agregar estilos CSS adicionales
const additionalStyles = `
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  .custom-tooltip {
    background: rgba(13, 141, 130, 0.9);
    border: none;
    border-radius: 6px;
    color: white;
    font-family: var(--main-font);
    font-size: 14px;
    padding: 8px 12px;
  }
  
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 8px;
    font-family: var(--main-font);
  }
  
  .popup-barrio h3 {
    margin-top: 0;
    color: #0d8d82;
    border-bottom: 2px solid #0d8d82;
    padding-bottom: 5px;
  }
`;

// Agregar los estilos al documento
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);