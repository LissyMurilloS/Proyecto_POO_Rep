// === Cargar Predios ===
Cesium.GeoJsonDataSource.load("./Predios-Potosi.geojson", {
  stroke: Cesium.Color.BLUE,
  fill: Cesium.Color.BLUE.withAlpha(0.3),
  strokeWidth: 2,
  clampToGround: true
}).then(function (dataSource) {
  viewer.dataSources.add(dataSource);
  viewer.zoomTo(dataSource);
});

// === Cargar Vías ===
Cesium.GeoJsonDataSource.load("./Vias.geojson", {
  stroke: Cesium.Color.RED,
  strokeWidth: 3,
  clampToGround: true
}).then(function (dataSource) {
  viewer.dataSources.add(dataSource);
});

// Borra el dataSource anterior de predios si existía
if (window.prediosDS) {
  viewer.dataSources.remove(window.prediosDS, true);
  window.prediosDS = null;
}

(async () => {
  // 1) Cargar SIN clampToGround
  const ds = await Cesium.GeoJsonDataSource.load("./Predios-Potosi.geojson", {
    stroke: Cesium.Color.DARKBLUE,
    fill: Cesium.Color.CORNFLOWERBLUE.withAlpha(0.6),
    strokeWidth: 1.5,
    clampToGround: false   // << clave: NO clamped si quieres extrusión
  });
  window.prediosDS = ds;
  viewer.dataSources.add(ds);

  // 2) Asignar extrusión a cada polígono
  const entidades = ds.entities.values;
  let cuenta = 0;
  for (const e of entidades) {
    if (e.polygon) {
      // Altura fija de ejemplo (m). Cambia a lo que quieras.
      const alturaM = 5;

      e.polygon.height = 0;                 // base al nivel 0 (elipsoide)
      e.polygon.extrudedHeight = alturaM;   // << extrusión
      e.polygon.material = Cesium.Color.CORNFLOWERBLUE.withAlpha(0.7);
      e.polygon.outline = true;
      e.polygon.outlineColor = Cesium.Color.WHITE;
      cuenta++;
    }
  }
  console.log("Polígonos extruidos:", cuenta);

  // 3) Enfocar
  viewer.flyTo(ds, { duration: 1.2 });
})();

// ================== CONFIG ==================
const VIAS_PATH = "./Vias.geojson";   // ajusta si tu ruta es distinta
let NAV_SPEED_MPS = 12;                    // velocidad por pulsación (m). Usa PageUp/PageDown para ajustar.
const CAMERA_HEIGHT = 100;                  // altura de cámara en metros
const CAMERA_PITCH = Cesium.Math.toRadians(-90);

// ================== ESTADO ==================
let VIA_FC = null;                         // GeoJSON crudo de Vías
let graph = null;                          // grafo de la red
let walker = null;                         // entidad marcador
let currentEdge = null;                    // {a:[lng,lat], b:[lng,lat]}
let currentPos = null;                     // [lng,lat]
let currentProgress = 0;                   // 0..1 dentro del segmento actual
let outgoingChoices = [];                  // opciones de salida en el vértice
let choiceIndex = 0;                       // índice de opción elegida en intersección
let currentHeading = 0;                    // heading en radianes

// ================== CARGA Y PREP ==================
(async function loadNetworkAndEnableNavigation(){
  const res = await fetch(VIAS_PATH);
  if(!res.ok){ alert("No pude leer Vias.geojson"); return; }
  VIA_FC = await res.json();

  graph = buildGraphFromVias(VIA_FC);

  // Punto inicial: tomamos el centro aproximado del mapa (o un punto fijo)
  const startLonLat = [-74.0721, 4.7110];
  // Snap al segmento más cercano
  const snap = snapToNetwork(turf.point(startLonLat), VIA_FC);
  if(!snap){ alert("No pude hacer snap a la red de vías."); return; }

  currentPos = snap.geometry.coordinates.slice(); // [lng,lat]
  // Elegir segmento inicial (buscamos el par de vértices que contiene el punto más cercano)
  currentEdge = findEdgeContainingPoint(snap, VIA_FC) || pickNearestEdge(currentPos, graph);
  currentProgress = clamp01(projectProgressOnEdge(currentPos, currentEdge));

  // Crea/posiciona el “walker”
  walker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(currentPos[0], currentPos[1], 0),
    point: { pixelSize: 12, color: Cesium.Color.YELLOW }
  });

  // Vista inicial
  currentHeading = bearingOfEdge(currentEdge);
  setCameraFollow(currentPos, currentHeading);

  // Teclado
  window.addEventListener("keydown", onKeyNav);
  // info rápida en consola
  console.log("Navegación lista: ↑ avanzar, ↓ retroceder, ←/→ elegir calle en intersecciones, PageUp/PageDown velocidad.");
})().catch(console.error);

// ================== HANDLERS ==================
function onKeyNav(e){
  if(!graph || !currentEdge) return;
  if(e.code === "ArrowUp"){ moveAlong(+NAV_SPEED_MPS); }
  else if(e.code === "ArrowDown"){ moveAlong(-NAV_SPEED_MPS); }
  else if(e.code === "ArrowLeft"){ rotateChoice(-1); }
  else if(e.code === "ArrowRight"){ rotateChoice(+1); }
  else if(e.code === "PageUp"){ NAV_SPEED_MPS = Math.min(60, NAV_SPEED_MPS + 2); toastVel(); }
  else if(e.code === "PageDown"){ NAV_SPEED_MPS = Math.max(2, NAV_SPEED_MPS - 2); toastVel(); }
}

function toastVel(){ console.log(`Velocidad: ${NAV_SPEED_MPS} m/tecla`); }

// ================== MOVIMIENTO ==================
function moveAlong(deltaMeters){
  const segLen = turf.distance(turf.point(currentEdge.a), turf.point(currentEdge.b), {units:"kilometers"}) * 1000;
  if(segLen <= 0) return;

  // avance relativo en [0..1]
  let dProg = deltaMeters / segLen;
  let newProg = currentProgress + dProg;

  if(newProg > 1 || newProg < 0){
    // Llegamos al vértice: elegimos siguiente segmento
    const atVertex = (newProg >= 1) ? currentEdge.b : currentEdge.a; // [lng,lat]
    const prevDir = unitDir(currentEdge);
    const nextEdge = chooseNextEdge(atVertex, prevDir, newProg >= 1 ? "forward" : "backward");
    if(!nextEdge){
      // Sin salida: clipeamos y nos quedamos al final/inicio
      newProg = clamp01(newProg);
    } else {
      // Continuar al siguiente segmento: conservamos remanente de progreso
      const overflow = newProg - Math.floor(newProg); // si >1, overflow ~ (newProg-1); si <0, overflow ~ (newProg)
      currentEdge = nextEdge;
      currentProgress = (overflow >= 0) ? 0 + overflow : 1 + overflow;
      updatePositionAndCamera();
      return;
    }
  }

  currentProgress = clamp01(newProg);
  updatePositionAndCamera();
}

function rotateChoice(sign){
  if(outgoingChoices.length <= 1) return;
  choiceIndex = (choiceIndex + sign + outgoingChoices.length) % outgoingChoices.length;
  // feedback visual en consola
  const c = outgoingChoices[choiceIndex];
  console.log("Opción seleccionada:", c.a, "→", c.b);
}

// ================== UPDATES ==================
function updatePositionAndCamera(){
  const pos = interpolateOnEdge(currentEdge, currentProgress);
  currentPos = pos;
  if(walker) walker.position = Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 0);
  currentHeading = bearingOfEdge(currentEdge);
  setCameraFollow(pos, currentHeading);
  // Precalcula opciones en el vértice si estamos cerca de él
  const nearStart = currentProgress < 0.02;
  const nearEnd   = currentProgress > 0.98;
  if(nearStart || nearEnd){
    const at = nearEnd ? currentEdge.b : currentEdge.a;
    const prevDir = unitDir(currentEdge);
    outgoingChoices = listOutgoingEdges(at, prevDir);
    choiceIndex = 0;
  } else {
    outgoingChoices = [];
    choiceIndex = 0;
  }
}

function setCameraFollow(lonlat, headingRad){
  const pos = Cesium.Cartesian3.fromDegrees(lonlat[0], lonlat[1], CAMERA_HEIGHT);
  viewer.camera.setView({
    destination: pos,
    orientation: {
      heading: headingRad,
      pitch: CAMERA_PITCH,
      roll: 0
    }
  });
}

// ================== GRAFO ==================
function buildGraphFromVias(viasFC){
  const nodes = new Map(); // id -> [lng,lat]
  const adj   = new Map(); // id -> Array<{to:[lng,lat]}>
  const idOf = (c) => c[0].toFixed(5)+","+c[1].toFixed(5);

  function ensureNode(c){
    const id = idOf(c);
    if(!nodes.has(id)) nodes.set(id, [c[0], c[1]]);
    if(!adj.has(id))   adj.set(id, []);
    return id;
  }
  function connect(a,b){
    const aId = ensureNode(a), bId = ensureNode(b);
    adj.get(aId).push({to: nodes.get(bId)});
    adj.get(bId).push({to: nodes.get(aId)});
  }

  for(const f of viasFC.features){
    if(!f.geometry) continue;
    if(f.geometry.type === "LineString"){
      const cs = f.geometry.coordinates;
      for(let i=1;i<cs.length;i++) connect(cs[i-1], cs[i]);
    } else if (f.geometry.type === "MultiLineString"){
      for(const line of f.geometry.coordinates){
        for(let i=1;i<line.length;i++) connect(line[i-1], line[i]);
      }
    }
  }
  return { nodes, adj };
}

// ================== ELEGIR SIGUIENTE CALLE ==================
function listOutgoingEdges(vertex, prevDir){
  const id = vertex[0].toFixed(6)+","+vertex[1].toFixed(6);
  const outs = (graph.adj.get(id) || []).map(n => ({ a: vertex, b: n.to }));
  // Ordenar por giro respecto a prevDir (menor ángulo primero)
  return outs.sort((e1, e2) => angleTo(prevDir, unitVec(e1)) - angleTo(prevDir, unitVec(e2)));
}

function chooseNextEdge(vertex, prevDir, sense){
  const opts = listOutgoingEdges(vertex, prevDir);
  if(opts.length === 0) return null;
  // si hay >1 opciones, respetar selección del usuario (choiceIndex)
  // además, evitar regresar por el mismo segmento salvo que no haya más
  const avoidBack = opts.filter(e => angleTo(prevDir, unitVec(e)) > 0.05); // evita giro 180°
  const pool = (avoidBack.length>0) ? avoidBack : opts;
  const chosen = pool[(choiceIndex % pool.length + pool.length) % pool.length];
  // Reset opciones tras tomar la decisión
  outgoingChoices = [];
  choiceIndex = 0;
  return chosen;
}

// ================== GEOMETRÍA VARIA ==================
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function interpolateOnEdge(edge, t){
  return [
    edge.a[0] + (edge.b[0]-edge.a[0]) * t,
    edge.a[1] + (edge.b[1]-edge.a[1]) * t
  ];
}

function unitDir(edge){
  const dx = edge.b[0]-edge.a[0], dy = edge.b[1]-edge.a[1];
  const L = Math.hypot(dx, dy) || 1;
  return [dx/L, dy/L];
}
function unitVec(edge){ return unitDir(edge); }

function angleTo(v1, v2){
  // ángulo absoluto entre vectores unitarios 2D
  const dot = v1[0]*v2[0] + v1[1]*v2[1];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function bearingOfEdge(edge){
  const b = turf.bearing(turf.point(edge.a), turf.point(edge.b)); // grados
  return Cesium.Math.toRadians(b);
}

// Proyecta progreso (0..1) del punto sobre el segmento (aprox 2D lon/lat)
function projectProgressOnEdge(ptLonLat, edge){
  const ax = edge.a[0], ay = edge.a[1];
  const bx = edge.b[0], by = edge.b[1];
  const px = ptLonLat[0], py = ptLonLat[1];
  const vx = bx-ax, vy = by-ay;
  const wx = px-ax, wy = py-ay;
  const vv = vx*vx + vy*vy || 1e-9;
  const t = (vx*wx + vy*wy)/vv;
  return clamp01(t);
}

// Buscar el segmento del feature más cercano utilizado en el snap
function findEdgeContainingPoint(snapPoint, viasFC){
  let best = null, bestDist = Infinity;
  for(const f of viasFC.features){
    if(!f.geometry) continue;
    if(f.geometry.type === "LineString"){
      const cs = f.geometry.coordinates;
      for(let i=1;i<cs.length;i++){
        const seg = { a: cs[i-1], b: cs[i] };
        const d = pointToSegmentDist(snapPoint.geometry.coordinates, seg);
        if(d < bestDist){ bestDist = d; best = seg; }
      }
    } else if (f.geometry.type === "MultiLineString"){
      for(const line of f.geometry.coordinates){
        for(let i=1;i<line.length;i++){
          const seg = { a: line[i-1], b: line[i] };
          const d = pointToSegmentDist(snapPoint.geometry.coordinates, seg);
          if(d < bestDist){ bestDist = d; best = seg; }
        }
      }
    }
  }
  return best;
}

function pickNearestEdge(lonlat, g){
  // fallback: busca en todo el grafo
  let best=null, bestD=Infinity;
  for(const [idA, a] of g.nodes){
    for(const nbr of (g.adj.get(idA)||[])){
      const seg = { a, b: nbr.to };
      const d = pointToSegmentDist(lonlat, seg);
      if(d<bestD){ bestD=d; best=seg; }
    }
  }
  return best;
}

function pointToSegmentDist(p, seg){
  // distancia euclídea en lon/lat (suficiente para elección de segmento)
  const t = projectProgressOnEdge(p, seg);
  const q = interpolateOnEdge(seg, t);
  const dx = p[0]-q[0], dy = p[1]-q[1];
  return Math.hypot(dx, dy);
}

// ================== SNAP ==================
function snapToNetwork(pt, viasFC){
  let best=null, bestDist=Infinity;
  for(const f of viasFC.features){
    if(!f.geometry) continue;
    if(f.geometry.type === "LineString"){
      const s = turf.nearestPointOnLine(f, pt);
      if(s?.properties?.dist < bestDist){ bestDist = s.properties.dist; best = s; }
    } else if (f.geometry.type === "MultiLineString"){
      for(const line of f.geometry.coordinates){
        const s = turf.nearestPointOnLine({type:"Feature", geometry:{type:"LineString", coordinates: line}}, pt);
        if(s?.properties?.dist < bestDist){ bestDist = s.properties.dist; best = s; }
      }
    }
  }
  return best;
}
