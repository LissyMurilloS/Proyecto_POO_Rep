// ======================
// Mapa base
// ======================
const map = L.map("map").setView([4.75, -74.1], 11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(map);

// ======================
// WFS en vivo (Histórico por estación)
// ======================
const WFS_BASE_URL = "http://iboca.ambientebogota.gov.co:8080/geoserver/sda_ca/wfs";
const WFS_TYPENAME_HIST = "sda_ca:Hist_ca_aire_estaciones";

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, "");
  return { start: fmt(start), end: fmt(end) };
}

async function fetchHistorical(opts = {}) {
  const { start, end } = opts.start && opts.end ? opts : defaultDateRange();
  const limit = opts.limit ?? 5000;
  const cql = `fecha_hora BETWEEN '${start}' AND '${end}'`;

  // Intento 2.0.0
  const params200 = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typenames: WFS_TYPENAME_HIST,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    count: String(limit),
    CQL_FILTER: cql
  });

  try {
    const r = await fetch(WFS_BASE_URL + "?" + params200.toString());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const gj = await r.json();
    if (gj && gj.features) return gj;
  } catch (e) {
    console.warn("WFS 2.0.0 falló", e);
  }

  // Intento 1.1.0
  const params110 = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: WFS_TYPENAME_HIST,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: String(limit),
    CQL_FILTER: cql
  });

  try {
    const r = await fetch(WFS_BASE_URL + "?" + params110.toString());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const gj = await r.json();
    if (gj && gj.features) return gj;
  } catch (e) {
    console.error("Ambos intentos fallaron", e);
  }
  return null;
}

// ======================
// Selectores + Chart.js
// ======================
let chart;

async function setupSelectorsAndChart() {
  const data = await fetchHistorical();
  if (!data) {
    alert("No se pudieron obtener datos");
    return;
  }

  // Llenar select contaminantes
  const contaminantes = [...new Set(data.features.map(f => f.properties.contaminante))];
  const contaminantSelect = document.getElementById("contaminant-select");
  contaminantes.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    contaminantSelect.appendChild(opt);
  });

  contaminantSelect.addEventListener("change", () => {
    const c = contaminantSelect.value;
    const estaciones = [...new Set(data.features.filter(f => f.properties.contaminante === c).map(f => f.properties.estacion))];
    const stationSelect = document.getElementById("station-select");
    stationSelect.innerHTML = "<option disabled selected>Elige una estación</option>";
    estaciones.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e;
      opt.textContent = e;
      stationSelect.appendChild(opt);
    });
    stationSelect.disabled = false;
  });

  document.getElementById("station-select").addEventListener("change", () => {
    const c = contaminantSelect.value;
    const s = document.getElementById("station-select").value;
    const registros = data.features
      .filter(f => f.properties.contaminante === c && f.properties.estacion === s)
      .map(f => ({ fecha: new Date(f.properties.fecha_hora), valor: f.properties.valor }))
      .sort((a, b) => a.fecha - b.fecha);

    const labels = registros.map(r => r.fecha.toLocaleString());
    const valores = registros.map(r => r.valor);

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("timeseries-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [{ label: `${c} - ${s}`, data: valores, borderColor: "blue", backgroundColor: "rgba(0,0,255,0.2)" }]
      },
      options: { responsive: true }
    });
  });
}

document.addEventListener("DOMContentLoaded", setupSelectorsAndChart);

async function probarWFS() {
  const url = "http://iboca.ambientebogota.gov.co:8080/geoserver/sda_ca/wfs";
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "sda_ca:Hist_ca_aire_estaciones",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    count: "50", // traemos solo 50 registros para probar
    CQL_FILTER: "fecha_hora BETWEEN '2023-01-01T00:00:00' AND '2023-01-02T23:59:59'"
  });

  try {
    const resp = await fetch(url + "?" + params.toString());
    const data = await resp.json();
    console.log("✅ Datos recibidos:", data);

    // Mostrar nombres de estaciones únicas
    const estaciones = [...new Set(data.features.map(f => f.properties.estacion))];
    console.log("📍 Estaciones únicas:", estaciones);
  } catch (err) {
    console.error("❌ Error al consultar WFS", err);
  }
}

// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", probarWFS);

