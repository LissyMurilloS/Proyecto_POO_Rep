/* ===========================================================
   proyectoCASuba.js
   - Mapa Leaflet + Suba (GeoJSON)
   - Estaciones desde WFS (con fallback simulado)
   - Filtro de estaciones dentro de Suba (turf.booleanPointInPolygon)
   - Métricas + Gráficas Chart.js
   =========================================================== */

const CONFIG = {
  // Centro aproximado de Suba (ajústalo si lo prefieres)
  mapCenter: [4.744, -74.082],
  mapZoom: 12,

  // GeoServer WFS (Bogotá)
  wfsBase: "http://iboca.ambientebogota.gov.co:8080/geoserver/sda_ca/ows",
  // 👇 Ajusta el nombre de la capa de estaciones si es distinto
  wfsStationsTypeName: "sda_ca:estaciones_ca",

  // Campos esperados (ajústalos a tu schema real si cambian)
  fields: {
    id: "id_estacion",
    name: "nombre_estacion",
    pm25: "pm25",
    pm10: "pm10",
    no2: "no2",
    o3: "o3"
  },

  // Umbrales OMS (para badges)
  thresholds: {
    pm25: { good: 15, moderate: 35, unhealthy: 55 },
    pm10: { good: 45, moderate: 75, unhealthy: 155 },
    no2:  { good: 25, moderate: 50, unhealthy: 100 },
    o3:   { good: 100, moderate: 140, unhealthy: 180 }
  }
};

let map, subaPolygon, stationLayer;
let charts = {};
let stationIndex = {}; // id -> properties

document.addEventListener("DOMContentLoaded", init);

async function init(){
  initMap();

  // Cargar GeoJSON de localidades y aislar SUBA
  await loadSubaPolygon();

  // Intentar cargar estaciones desde WFS (con fallback)
  const stationsGeoJSON = await loadStationsWFS().catch(() => null);
  if (stationsGeoJSON && stationsGeoJSON.features?.length){
    addStationsToMap(filterStationsInSuba(stationsGeoJSON));
  } else {
    console.warn("⚠️ WFS falló o vino vacío. Usando datos simulados.");
    const fake = generateSimulatedStations();
    addStationsToMap(filterStationsInSuba(fake));
  }

  // Inicializa gráficos vacíos
  setupEmptyCharts();

  // Marca timestamp
  updateTimestamp();
}

/* ============== MAPA ============== */
function initMap(){
  map = L.map("map").setView(CONFIG.mapCenter, CONFIG.mapZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

async function loadSubaPolygon(){
  const res = await fetch("poligonos-localidades.geojson");
  const gj = await res.json();

  // Heurística: buscar 'suba' en alguna propiedad de nombre
  let subaFeature = null;
  for (const f of gj.features){
    const props = f.properties || {};
    const hit = Object.values(props).some(v => String(v).toLowerCase().includes("suba"));
    if (hit){ subaFeature = f; break; }
  }
  if (!subaFeature){
    console.warn("No se encontró SUBA por nombre. Tomando el primer polígono como fallback.");
    subaFeature = gj.features[0];
  }

  subaPolygon = subaFeature;

  // Pintar contorno de SUBA
  L.geoJSON(subaFeature, {
    style:{ color:"#2563eb", weight:2, fillOpacity:0.05 }
  }).addTo(map);

  // Ajustar mapa al polígono
  try {
    const bounds = L.geoJSON(subaFeature).getBounds();
    map.fitBounds(bounds.pad(0.05));
  } catch(e){
    console.warn("No se pudo ajustar al polígono, usando centro por defecto.");
  }
}

/* ============== WFS ============== */
async function loadStationsWFS(){
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: CONFIG.wfsStationsTypeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326"
  });
  const url = `${CONFIG.wfsBase}?${params}`;

  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`WFS HTTP ${res.status}`);
  return await res.json();
}

/* ============== FILTRO EN SUBA (turf) ============== */
function filterStationsInSuba(geojsonPoints){
  if (!subaPolygon) return geojsonPoints;

  const poly = turf.feature(subaPolygon.geometry);
  const features = (geojsonPoints.features || []).filter(pt => {
    try {
      return turf.booleanPointInPolygon(pt, poly);
    } catch(e){
      return true;
    }
  });

  return { type:"FeatureCollection", features };
}

/* ============== ESTACIONES EN MAPA ============== */
function addStationsToMap(geojson){
  if (stationLayer) map.removeLayer(stationLayer);

  stationLayer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const st = mapFeatureToStation(feature);
      const color = colorByAirQuality(st);
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9
      });
      return marker;
    },
    onEachFeature: (feature, layer) => {
      const st = mapFeatureToStation(feature);
      // Index por id
      stationIndex[st.id] = st;

      const html = `
        <div style="min-width:200px">
          <strong>${st.name}</strong><br/>
          PM2.5: <b>${safe(st.pm25)} µg/m³</b><br/>
          PM10: <b>${safe(st.pm10)} µg/m³</b><br/>
          NO₂: <b>${safe(st.no2)} µg/m³</b><br/>
          O₃: <b>${safe(st.o3)} µg/m³</b>
        </div>
      `;
      layer.bindPopup(html);

      layer.on("click", () => updateRightPanel(st));
    }
  }).addTo(map);
}

function mapFeatureToStation(feature){
  const p = feature.properties || {};
  const F = CONFIG.fields;

  // Si faltan campos, crear valores simulados (para robustez)
  const station = {
    id: p[F.id] ?? `st_${Math.random().toString(36).slice(2,8)}`,
    name: p[F.name] ?? (p["nombre"] || p["estacion"] || "Estación sin nombre"),
    pm25: toNumber(p[F.pm25], rand(8,45)),
    pm10: toNumber(p[F.pm10], rand(15,80)),
    no2 : toNumber(p[F.no2 ], rand(10,60)),
    o3  : toNumber(p[F.o3  ], rand(60,150)),
    // Históricos simulados por ahora (24 puntos/h)
    hist: {
      pm25: genHistory(rand(18,30), 24, 4),
      pm10: genHistory(rand(20,50), 24, 8),
      no2 : genHistory(rand(12,30), 24, 5),
      o3  : genHistory(rand(70,120),24, 10),
    }
  };
  return station;
}

/* ============== PANEL DERECHO ============== */
function updateRightPanel(st){
  // Título + timestamp
  byId("station-title").textContent = st.name;
  updateTimestamp();

  // Valores
  setMetric("pm25", st.pm25);
  setMetric("pm10", st.pm10);
  setMetric("no2",  st.no2);
  setMetric("o3",   st.o3);

  // Badges
  setBadge("pm25-badge", st.pm25, "pm25");
  setBadge("pm10-badge", st.pm10, "pm10");
  setBadge("no2-badge",  st.no2,  "no2");
  setBadge("o3-badge",   st.o3,   "o3");

  // Gráficas
  updateChart("chart-pm25", "PM2.5 (µg/m³)", st.hist.pm25, "#0d8d82");
  updateChart("chart-pm10", "PM10 (µg/m³)",   st.hist.pm10, "#0891b2");
  updateChart("chart-no2",  "NO₂ (µg/m³)",    st.hist.no2,  "#7c3aed");
  updateChart("chart-o3",   "O₃ (µg/m³)",     st.hist.o3,   "#f59e0b");
}

/* ============== GRÁFICAS (Chart.js) ============== */
function setupEmptyCharts(){
  ["pm25","pm10","no2","o3"].forEach((k,i)=>{
    updateChart(`chart-${k}`, `${k.toUpperCase()} (µg/m³)`, new Array(24).fill(null), ["#0d8d82","#0891b2","#7c3aed","#f59e0b"][i]);
  });
}

function updateChart(canvasId, label, data, color){
  const ctx = byId(canvasId).getContext("2d");
  const labels = Array.from({length:data.length}, (_,i)=> `${24-i}h`);
  if (charts[canvasId]){
    charts[canvasId].data.labels = labels;
    charts[canvasId].data.datasets[0].data = data;
    charts[canvasId].update();
    return;
  }
  charts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "33",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.35
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins: {
        legend: { display: true },
        tooltip: { mode: "index", intersect: false }
      },
      scales:{
        x: { title:{ display:true, text:"Horas atrás"} },
        y: { title:{ display:true, text: label }, beginAtZero: true }
      }
    }
  });
}

/* ============== UTILIDADES ============== */
function setMetric(key, value){
  byId(`${key}-val`).textContent = value != null ? value : "—";
}
function setBadge(id, value, pollutantKey){
  const el = byId(id);
  el.textContent = classifyText(value, pollutantKey).text;
  el.className = "metric-badge " + classifyText(value, pollutantKey).className;
}
function classifyText(val, pol){
  const th = CONFIG.thresholds[pol];
  if (val <= th.good) return { text:"Bueno", className:"badge-good" };
  if (val <= th.moderate) return { text:"Moderado", className:"badge-moderate" };
  if (val <= th.unhealthy) return { text:"No saludable", className:"badge-unhealthy" };
  return { text:"Muy no saludable", className:"badge-very-unhealthy" };
}
function colorByAirQuality(st){
  const worst = Math.max(
    score(st.pm25, CONFIG.thresholds.pm25),
    score(st.pm10, CONFIG.thresholds.pm10),
    score(st.no2 , CONFIG.thresholds.no2),
    score(st.o3  , CONFIG.thresholds.o3)
  );
  return [null,"#4CAF50","#FFC107","#FF5722","#9C27B0"][worst];
}
function score(val, th){
  if (val <= th.good) return 1;
  if (val <= th.moderate) return 2;
  if (val <= th.unhealthy) return 3;
  return 4;
}
function updateTimestamp(){
  const now = new Date();
  byId("last-update").textContent = now.toLocaleDateString("es-ES",{
    day:"numeric", month:"long", year:"numeric"
  }) + " — " + now.toLocaleTimeString("es-ES",{ hour:"2-digit", minute:"2-digit" });
}
function rand(min, max){ return Math.round(Math.random()*(max-min)+min); }
function genHistory(center, n=24, maxVar=6){
  return Array.from({length:n}, ()=> Math.max(0, center + Math.round((Math.random()*2-1)*maxVar)));
}
function toNumber(v, fallback=null){
  const n = Number(v); return Number.isFinite(n) ? n : fallback;
}
function byId(id){ return document.getElementById(id); }
function safe(v){ return (v==null || Number.isNaN(v)) ? "—" : v; }

/* ============== SIMULACIÓN (fallback) ============== */
function generateSimulatedStations(){
  // 5 puntos simulados dentro de Suba (aprox)
  const pts = [
    [-74.076, 4.756],
    [-74.095, 4.743],
    [-74.067, 4.734],
    [-74.090, 4.768],
    [-74.060, 4.748]
  ].map((lnglat,i)=> turf.point(lnglat, {
    [CONFIG.fields.id]: `sim_${i+1}`,
    [CONFIG.fields.name]: `Estación Simulada ${i+1}`,
    [CONFIG.fields.pm25]: rand(8,45),
    [CONFIG.fields.pm10]: rand(15,80),
    [CONFIG.fields.no2] : rand(10,60),
    [CONFIG.fields.o3]  : rand(60,150)
  }));

  return turf.featureCollection(pts);
}
