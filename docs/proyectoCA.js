/* =========================================================
   proyecto.js — JavaScript para la sección de Calidad del Aire
   - Simulación de datos en tiempo real
   - Actualización dinámica de métricas y recomendaciones
   - Manejo de estados de calidad del aire
   - Funciones para futuras integraciones con APIs reales
   ========================================================= */

// Configuración global
const CONFIG = {
  updateInterval: 30000, // 30 segundos para la demo
  animationDuration: 300,
  
  // Umbrales para clasificación de calidad del aire (según OMS y normativas colombianas)
  thresholds: {
    pm25: { good: 15, moderate: 35, unhealthy: 55, veryUnhealthy: 150 },
    pm10: { good: 45, moderate: 75, unhealthy: 155, veryUnhealthy: 255 },
    no2: { good: 25, moderate: 50, unhealthy: 100, veryUnhealthy: 200 },
    o3: { good: 100, moderate: 140, unhealthy: 180, veryUnhealthy: 240 }
  },
  
  // Coordenadas del barrio Potosí (aproximadas)
  mapCenter: { lat: 4.7110, lng: -74.0721 },
  mapZoom: 13
};

// Datos de ejemplo y rangos para simulación
const SIMULATION_DATA = {
  pm25: { min: 8, max: 45, unit: 'µg/m³' },
  pm10: { min: 15, max: 80, unit: 'µg/m³' },
  no2: { min: 10, max: 60, unit: 'µg/m³' },
  o3: { min: 60, max: 150, unit: 'µg/m³' },
  temperature: { min: 14, max: 24, unit: '°C' },
  windSpeed: { min: 5, max: 25, unit: 'km/h' },
  humidity: { min: 45, max: 85, unit: '%' },
  pressure: { min: 1005, max: 1025, unit: 'hPa' }
};

// Estaciones de monitoreo simuladas para el área de Potosí
const MONITORING_STATIONS = [
  {
    id: 'potosi-central',
    name: 'Potosí Central',
    lat: 4.7110,
    lng: -74.0721,
    distance: 0.1,
    type: 'principal'
  },
  {
    id: 'fontibon',
    name: 'Fontibón',
    lat: 4.6697,
    lng: -74.1401,
    distance: 1.8,
    type: 'secundaria'
  },
  {
    id: 'kennedy',
    name: 'Kennedy',
    lat: 4.6280,
    lng: -74.1391,
    distance: 2.3,
    type: 'secundaria'
  },
  {
    id: 'puente-aranda',
    name: 'Puente Aranda',
    lat: 4.6415,
    lng: -74.1145,
    distance: 1.5,
    type: 'secundaria'
  },
  {
    id: 'engativa',
    name: 'Engativá',
    lat: 4.7065,
    lng: -74.1140,
    distance: 2.1,
    type: 'secundaria'
  }
];
// Estado global de la aplicación
let appState = {
  currentData: {},
  lastUpdate: null,
  isUpdating: false,
  map: null,
  stationMarkers: []
};

/* ==========================================
   FUNCIONES DEL MAPA
   ========================================== */

/**
 * Inicializa el mapa de estaciones de calidad del aire
 */
function initializeMap() {
  const mapContainer = document.getElementById('air-quality-map');
  if (!mapContainer) return;

  // Crear mapa simulado con canvas
  createSimulatedMap();
  
  // Cargar lista de estaciones
  loadStationsList();
}

/**
 * Crea un mapa simulado usando Canvas (para demo)
 * En producción se reemplazaría con Leaflet, Google Maps, etc.
 */
function createSimulatedMap() {
  const mapContainer = document.getElementById('air-quality-map');
  mapContainer.innerHTML = '';
  
  const canvas = document.createElement('canvas');
  canvas.width = mapContainer.offsetWidth || 400;
  canvas.height = mapContainer.offsetHeight || 300;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  
  const ctx = canvas.getContext('2d');
  
  // Fondo del mapa
  ctx.fillStyle = '#e8f4f1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Simular calles principales
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  
  // Calles horizontales
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (canvas.height / 6) * i);
    ctx.lineTo(canvas.width, (canvas.height / 6) * i);
    ctx.stroke();
  }
  
  // Calles verticales
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((canvas.width / 8) * i, 0);
    ctx.lineTo((canvas.width / 8) * i, canvas.height);
    ctx.stroke();
  }
  
  // Dibujar estaciones
  MONITORING_STATIONS.forEach((station, index) => {
    const x = 50 + (index * 60) + Math.random() * 40;
    const y = 50 + Math.random() * (canvas.height - 100);
    
    const status = generateStationStatus();
    const color = getStationColor(status);
    
    // Círculo de la estación
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, station.type === 'principal' ? 12 : 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Borde
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Etiqueta (solo para estación principal)
    if (station.type === 'principal') {
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Arial';
      ctx.fillText('Potosí', x - 15, y - 18);
    }
  });
  
  mapContainer.appendChild(canvas);
}

/**
 * Genera un estado aleatorio para una estación
 */
function generateStationStatus() {
  const statuses = ['good', 'moderate', 'unhealthy'];
  const weights = [0.5, 0.3, 0.2]; // Más probable que sea bueno
  
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < statuses.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      return statuses[i];
    }
  }
  
  return 'good';
}

/**
 * Obtiene el color para una estación basado en su estado
 */
function getStationColor(status) {
  const colors = {
    good: '#4CAF50',
    moderate: '#FFC107',
    unhealthy: '#FF5722',
    'very-unhealthy': '#9C27B0'
  };
  return colors[status] || '#666';
}

/**
 * Carga y muestra la lista de estaciones
 */
function loadStationsList() {
  const container = document.getElementById('stations-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  MONITORING_STATIONS.forEach(station => {
    const status = generateStationStatus();
    const value = generateStationValue(status);
    
    const stationElement = document.createElement('div');
    stationElement.className = 'station-item';
    stationElement.innerHTML = `
      <div class="station-info">
        <div class="station-name">${station.name}</div>
        <div class="station-distance">${station.distance} km</div>
      </div>
      <div class="station-status">
        <span class="station-indicator" style="background: ${getStationColor(status)}"></span>
        <span class="station-value">${value}</span>
      </div>
    `;
    
    // Evento click para centrar en la estación
    stationElement.addEventListener('click', () => {
      highlightStation(station.id);
    });
    
    container.appendChild(stationElement);
  });
}

/**
 * Genera un valor simulado para una estación basado en su estado
 */
function generateStationValue(status) {
  const ranges = {
    good: { min: 15, max: 40 },
    moderate: { min: 41, max: 80 },
    unhealthy: { min: 81, max: 120 },
    'very-unhealthy': { min: 121, max: 200 }
  };
  
  const range = ranges[status];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Resalta una estación en el mapa
 */
function highlightStation(stationId) {
  console.log(`🎯 Destacando estación: ${stationId}`);
  // En un mapa real, esto centraría y haría zoom a la estación
  
  // Efecto visual temporal
  const stationItems = document.querySelectorAll('.station-item');
  stationItems.forEach(item => {
    item.style.background = '';
  });
  
  // Encontrar y destacar la estación clickeada
  const clickedStation = Array.from(stationItems).find(item => 
    item.querySelector('.station-name').textContent.includes(
      MONITORING_STATIONS.find(s => s.id === stationId)?.name || ''
    )
  );
  
  if (clickedStation) {
    clickedStation.style.background = '#e8f4f1';
    setTimeout(() => {
      clickedStation.style.background = '';
    }, 2000);
  }
}

/**
 * Actualiza los datos de las estaciones
 */
function updateStationsData() {
  // Recrear el mapa con nuevos datos
  createSimulatedMap();
  
  // Actualizar la lista de estaciones
  loadStationsList();
}

/* ==========================================
   FUNCIONES PRINCIPALES (continuación)
   ========================================== */

/**
 * Inicializa la aplicación cuando el DOM está listo
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌱 Iniciando dashboard de Calidad del Aire - Barrio Potosí');
  
  // Configuración inicial
  initializeApp();
  
  // Inicializar mapa
  initializeMap();
  
  // Primera actualización de datos
  updateAllData();
  
  // Configurar actualizaciones automáticas
  setInterval(updateAllData, CONFIG.updateInterval);
  
  // Event listeners adicionales
  setupEventListeners();
  
  // Event listeners del mapa
  setupMapEventListeners();
});

/**
 * Configuración inicial de la aplicación
 */
function initializeApp() {
  // Configurar fecha/hora inicial
  updateTimestamp();
  
  // Aplicar animaciones de entrada
  addEntranceAnimations();
  
  // Configurar tooltips si es necesario
  // setupTooltips(); // Implementar en el futuro
}

/**
 * Actualiza todos los datos de calidad del aire y meteorológicos
 */
function updateAllData() {
  if (appState.isUpdating) return;
  
  appState.isUpdating = true;
  
  try {
    // Generar nuevos datos simulados
    const newData = generateSimulatedData();
    
    // Actualizar las métricas principales
    updateAirQualityMetrics(newData);
    
    // Actualizar indicadores meteorológicos
    updateWeatherIndicators(newData);
    
    // Actualizar recomendaciones basadas en los nuevos datos
    updateRecommendations(newData);
    
    // Actualizar estaciones en el mapa
    updateStationsData();
    
    // Actualizar timestamp
    updateTimestamp();
    
    // Guardar estado
    appState.currentData = newData;
    appState.lastUpdate = new Date();
    
    console.log('📊 Datos actualizados:', newData);
    
  } catch (error) {
    console.error('❌ Error al actualizar datos:', error);
  } finally {
    appState.isUpdating = false;
  }
}

/**
 * Genera datos simulados realistas para la demostración
 */
function generateSimulatedData() {
  const data = {};
  
  // Generar datos de contaminantes con variaciones realistas
  Object.keys(SIMULATION_DATA).forEach(key => {
    if (['temperature', 'windSpeed', 'humidity', 'pressure'].includes(key)) {
      return; // Estos se procesan por separado
    }
    
    const range = SIMULATION_DATA[key];
    // Añadir algo de variabilidad temporal realista
    const timeVariation = getTimeBasedVariation();
    const baseValue = Math.random() * (range.max - range.min) + range.min;
    data[key] = Math.round(baseValue * timeVariation);
  });
  
  // Generar datos meteorológicos
  data.temperature = Math.round(Math.random() * 10 + 14); // 14-24°C
  data.windSpeed = Math.round(Math.random() * 20 + 5);    // 5-25 km/h
  data.humidity = Math.round(Math.random() * 40 + 45);    // 45-85%
  data.pressure = Math.round(Math.random() * 20 + 1005);  // 1005-1025 hPa
  
  return data;
}

/**
 * Obtiene variación basada en la hora del día para datos más realistas
 */
function getTimeBasedVariation() {
  const hour = new Date().getHours();
  
  // Horas pico (6-9 AM y 5-8 PM) tienen más contaminación
  if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20)) {
    return 1.2 + Math.random() * 0.3; // 20-50% más contaminación
  }
  
  // Horas nocturnas tienen menos contaminación
  if (hour >= 22 || hour <= 5) {
    return 0.6 + Math.random() * 0.2; // 40-20% menos contaminación
  }
  
  // Horas normales
  return 0.8 + Math.random() * 0.4; // Variación normal
}

/**
 * Actualiza las métricas principales de calidad del aire
 */
function updateAirQualityMetrics(data) {
  const metrics = ['pm25', 'pm10', 'no2', 'o3'];
  
  metrics.forEach(metric => {
    const value = data[metric];
    const status = getAirQualityStatus(metric, value);
    
    // Actualizar valor con animación
    updateValueWithAnimation(`${metric}-value`, value);
    
    // Actualizar estado
    updateStatusBadge(`${metric}-status`, status);
  });
}

/**
 * Actualiza los indicadores meteorológicos
 */
function updateWeatherIndicators(data) {
  updateValueWithAnimation('temperature', `${data.temperature}°C`);
  updateValueWithAnimation('wind-speed', `${data.windSpeed} km/h`);
  updateValueWithAnimation('humidity', `${data.humidity}%`);
  updateValueWithAnimation('pressure', `${data.pressure} hPa`);
}

/**
 * Actualiza un valor con animación suave
 */
function updateValueWithAnimation(elementId, newValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Añadir clase de actualización
  element.classList.add('updating');
  
  setTimeout(() => {
    element.textContent = newValue;
    element.classList.remove('updating');
  }, CONFIG.animationDuration / 2);
}

/**
 * Actualiza el badge de estado de calidad del aire
 */
function updateStatusBadge(elementId, status) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Remover clases de estado anteriores
  element.className = element.className.replace(/status-\w+/g, '');
  
  // Añadir nueva clase y texto
  element.classList.add(`status-${status.class}`);
  element.textContent = status.text;
}

/**
 * Determina el estado de calidad del aire basado en el valor y tipo de contaminante
 */
function getAirQualityStatus(pollutant, value) {
  const thresholds = CONFIG.thresholds[pollutant];
  
  if (value <= thresholds.good) {
    return { class: 'good', text: 'Bueno' };
  } else if (value <= thresholds.moderate) {
    return { class: 'moderate', text: 'Moderado' };
  } else if (value <= thresholds.unhealthy) {
    return { class: 'unhealthy', text: 'No saludable' };
  } else {
    return { class: 'very-unhealthy', text: 'Muy no saludable' };
  }
}

/**
 * Actualiza las recomendaciones basadas en los datos actuales
 */
function updateRecommendations(data) {
  const recommendations = generateRecommendations(data);
  const listElement = document.getElementById('recommendation-list');
  
  if (!listElement) return;
  
  // Limpiar recomendaciones actuales
  listElement.innerHTML = '';
  
  // Añadir nuevas recomendaciones
  recommendations.forEach(rec => {
    const li = document.createElement('li');
    li.className = 'recommendation-item';
    li.innerHTML = `
      <span class="recommendation-icon">${rec.icon}</span>
      <span class="recommendation-text">
        <strong>${rec.category}:</strong> ${rec.text}
      </span>
    `;
    listElement.appendChild(li);
  });
}

/**
 * Genera recomendaciones dinámicas basadas en los datos actuales
 */
function generateRecommendations(data) {
  const recommendations = [];
  const overallAirQuality = getOverallAirQuality(data);
  const hour = new Date().getHours();
  
  // Recomendaciones basadas en calidad del aire general
  switch (overallAirQuality) {
    case 'good':
      recommendations.push({
        icon: '✅',
        category: 'Actividades al aire libre',
        text: 'Excelente momento para ejercitarse y realizar actividades al aire libre.'
      });
      break;
      
    case 'moderate':
      recommendations.push({
        icon: '⚠️',
        category: 'Precauciones',
        text: 'Condiciones aceptables. Grupos sensibles deben considerar limitar actividades prolongadas.'
      });
      break;
      
    case 'unhealthy':
      recommendations.push({
        icon: '🚨',
        category: 'Alerta',
        text: 'Evite actividades intensas al aire libre. Use mascarilla si es necesario salir.'
      });
      break;
  }
  
  // Recomendaciones específicas por contaminante
  if (data.pm25 > 25) {
    recommendations.push({
      icon: '😷',
      category: 'PM2.5 elevado',
      text: 'Use mascarilla N95 si debe realizar actividades al aire libre.'
    });
  }
  
  if (data.o3 > 120) {
    recommendations.push({
      icon: '🌅',
      category: 'Ozono alto',
      text: 'Evite ejercitarse al aire libre durante las horas de mayor calor (10 AM - 4 PM).'
    });
  }
  
  // Recomendaciones basadas en la hora
  if (hour >= 6 && hour <= 9) {
    recommendations.push({
      icon: '🚗',
      category: 'Hora pico matutina',
      text: 'Consider usar transporte público para reducir emisiones locales.'
    });
  } else if (hour >= 17 && hour <= 20) {
    recommendations.push({
      icon: '🏠',
      category: 'Hora pico vespertina',
      text: 'Mantenga ventanas cerradas durante las próximas horas.'
    });
  }
  
  // Recomendaciones meteorológicas
  if (data.windSpeed < 10) {
    recommendations.push({
      icon: '💨',
      category: 'Viento bajo',
      text: 'Condiciones de poco viento pueden concentrar contaminantes.'
    });
  }
  
  // Recomendación general de ventilación
  if (overallAirQuality === 'good' && (hour >= 6 && hour <= 10)) {
    recommendations.push({
      icon: '🪟',
      category: 'Ventilación',
      text: 'Aproveche las buenas condiciones para ventilar espacios interiores.'
    });
  }
  
  return recommendations;
}

/**
 * Calcula la calidad del aire general basada en todos los contaminantes
 */
function getOverallAirQuality(data) {
  const statuses = ['pm25', 'pm10', 'no2', 'o3'].map(pollutant => {
    const status = getAirQualityStatus(pollutant, data[pollutant]);
    
    // Convertir a valor numérico para comparación
    const statusValues = { good: 1, moderate: 2, unhealthy: 3, 'very-unhealthy': 4 };
    return statusValues[status.class];
  });
  
  const maxStatus = Math.max(...statuses);
  const statusNames = ['', 'good', 'moderate', 'unhealthy', 'very-unhealthy'];
  
  return statusNames[maxStatus];
}

/**
 * Actualiza el timestamp de última actualización
 */
function updateTimestamp() {
  const element = document.getElementById('last-update');
  if (!element) return;
  
  const now = new Date();
  const timeString = now.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) + ' - ' + now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  element.textContent = timeString;
}

/**
 * Configura animaciones de entrada para los elementos
 */
function addEntranceAnimations() {
  const cards = document.querySelectorAll('.metric-card, .air-quality-chart, .recommendations');
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });
}

/**
 * Configura event listeners adicionales
 */
function setupEventListeners() {
  // Listener para actualización manual (si se añade un botón en el futuro)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      console.log('🔄 Actualizando datos manualmente...');
      updateAllData();
    }
  });
  
  // Listener para cambios de visibilidad (pausar actualizaciones cuando no está visible)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('⏸️ Página oculta - pausando actualizaciones');
    } else {
      console.log('▶️ Página visible - reanudando actualizaciones');
      updateAllData(); // Actualizar inmediatamente al volver a ser visible
    }
  });
}

/**
 * Configura event listeners específicos del mapa
 */
function setupMapEventListeners() {
  // Botón de actualizar mapa
  const refreshBtn = document.getElementById('refresh-map');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('🔄 Actualizando mapa...');
      updateStationsData();
    });
  }
  
  // Botón de pantalla completa
  const fullscreenBtn = document.getElementById('fullscreen-map');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      toggleFullscreenMap();
    });
  }
  
  // Redimensionar mapa cuando cambia el tamaño de ventana
  window.addEventListener('resize', () => {
    setTimeout(() => {
      createSimulatedMap();
    }, 100);
  });
}

/**
 * Alterna el mapa a pantalla completa
 */
function toggleFullscreenMap() {
  const mapPanel = document.querySelector('.map-panel');
  
  if (!mapPanel.classList.contains('fullscreen')) {
    mapPanel.classList.add('fullscreen');
    mapPanel.style.position = 'fixed';
    mapPanel.style.top = '0';
    mapPanel.style.left = '0';
    mapPanel.style.width = '100vw';
    mapPanel.style.height = '100vh';
    mapPanel.style.zIndex = '9999';
    mapPanel.style.maxHeight = '100vh';
    
    // Redimensionar mapa
    setTimeout(() => createSimulatedMap(), 100);
  } else {
    mapPanel.classList.remove('fullscreen');
    mapPanel.style.position = '';
    mapPanel.style.top = '';
    mapPanel.style.left = '';
    mapPanel.style.width = '';
    mapPanel.style.height = '';
    mapPanel.style.zIndex = '';
    mapPanel.style.maxHeight = '';
    
    // Redimensionar mapa
    setTimeout(() => createSimulatedMap(), 100);
  }
}) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      console.log('🔄 Actualizando datos manualmente...');
      updateAllData();
    }
  });
  
  // Listener para cambios de visibilidad (pausar actualizaciones cuando no está visible)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('⏸️ Página oculta - pausando actualizaciones');
    } else {
      console.log('▶️ Página visible - reanudando actualizaciones');
      updateAllData(); // Actualizar inmediatamente al volver a ser visible
    }
  });
}

/* ==========================================
   FUNCIONES UTILITARIAS
   ========================================== */

/**
 * Formatea números con separadores de miles
 */
function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}

/**
 * Convierte valores de temperatura
 */
function convertTemperature(celsius, to = 'fahrenheit') {
  if (to === 'fahrenheit') {
    return Math.round((celsius * 9/5) + 32);
  }
  return celsius;
}

/**
 * Obtiene el color representativo para un nivel de calidad del aire
 */
function getAirQualityColor(status) {
  const colors = {
    good: '#4CAF50',
    moderate: '#FFC107',
    unhealthy: '#FF5722',
    'very-unhealthy': '#9C27B0'
  };
  return colors[status] || '#666';
}

/* ==========================================
   FUNCIONES PARA FUTURAS INTEGRACIONES
   ========================================== */

/**
 * Función preparada para integrar con APIs reales de calidad del aire
 */
async function fetchRealAirQualityData() {
  // Placeholder para integración con API real
  // Ejemplos: OpenWeatherMap Air Pollution API, IQAIR API, etc.
  
  try {
    // const response = await fetch('API_ENDPOINT');
    // const data = await response.json();
    // return processAPIData(data);
    
    console.log('⚠️ API real no configurada - usando datos simulados');
    return generateSimulatedData();
    
  } catch (error) {
    console.error('❌ Error al obtener datos reales:', error);
    return generateSimulatedData(); // Fallback a datos simulados
  }
}

/**
 * Procesa datos de API externa (formato específico por API)
 */
function processAPIData(apiData) {
  // Transformar datos de API al formato interno
  return {
    pm25: apiData.components?.pm2_5 || 0,
    pm10: apiData.components?.pm10 || 0,
    no2: apiData.components?.no2 || 0,
    o3: apiData.components?.o3 || 0,
    // ... otros mapeos según la API
  };
}

/**
 * Función para exportar datos históricos (futura implementación)
 */
function exportHistoricalData(format = 'json') {
  console.log(`📊 Exportando datos históricos en formato ${format}`);
  // Implementar exportación a CSV, JSON, etc.
}

// Exportar funciones principales para uso externo si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateAllData,
    generateSimulatedData,
    getAirQualityStatus,
    CONFIG
  };
}

/* ==========================================
   INICIALIZACIÓN Y LOGS
   ========================================== */

console.log('📋 Script de Calidad del Aire cargado correctamente');
console.log('🏢 Barrio: Potosí, Bogotá D.C.');
console.log('🔄 Intervalo de actualización:', CONFIG.updateInterval / 1000, 'segundos');