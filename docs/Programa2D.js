/* Programa2.js – Navegación + Autotour (fix: giro manual y retroceso continuo) */
// ====== Parámetros ======
const CAMERA_PITCH = Cesium.Math.toRadians(-35);
const CAMERA_HEIGHT_M = 50;

const NAV_SPEED_MPS = 6;
const VERTEX_TOL_M = 12;
const EXIT_JUNCTION_MARGIN_M = 3;
const LEAVE_JUNCTION_M = 4;

const AUTO_DEFAULT_SPEED_MPS = 8;
const AUTO_STRAIGHT_BIAS_DEG = 15;
const AUTO_PAUSE_AT_JUNCTION_MS = 250;

// ====== Estado ======
let viasDS=null, prediosDS=null;
let graph={nodes:new Map(), adj:new Map(), edges:[]};

let currentEdge=null, currentProgress=0, currentHeading=0, currentPos=null;
let atJunction=false, outgoingChoices=[], choiceIndex=0, junctionCooldownM=0;

let autoOn=false, autoSpeed=AUTO_DEFAULT_SPEED_MPS, autoPause=0;
let visitedUndirected=new Set();
let lastTick=null;

const hud=document.getElementById('hud'); function HUD(s){ if(hud) hud.textContent=s; }

// ====== Viewer ======
const viewer = new Cesium.Viewer("cesiumContainer", {
  animation:false, timeline:false, sceneModePicker:false, geocoder:false, baseLayerPicker:false,
  navigationHelpButton:false, homeButton:false, fullscreenButton:false, infoBox:false, selectionIndicator:false
});
viewer.imageryLayers.removeAll();
viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", credit: "© OpenStreetMap"
}));
viewer.scene.globe.depthTestAgainstTerrain=false;
window.viewer=viewer;

// Rutas robustas
const BASE = new URL('.', location.href);
const URL_PREDIOS = new URL('Predios-Potosi.geojson', BASE).href;
const URL_VIAS    = new URL('ViasD.geojson', BASE).href;

// ====== Helpers ======
const idOf = (c)=> c[0].toFixed(6)+","+c[1].toFixed(6);
function undirectedId(e){ const a=idOf(e.a), b=idOf(e.b); return a<b? a+'|'+b : b+'|'+a; }
function cartOf(ll){ return Cesium.Cartesian3.fromDegrees(ll[0], ll[1], 0); }
function edgeLengthMeters(e){ return Cesium.Cartesian3.distance(cartOf(e.a), cartOf(e.b)); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function lerpLL(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
function bearingDeg(a,b){
  const rad=Math.PI/180, φ1=a[1]*rad, φ2=b[1]*rad, Δλ=(b[0]-a[0])*rad;
  const y=Math.sin(Δλ)*Math.cos(φ2);
  const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  let θ=Math.atan2(y,x)/rad; return (θ%360+360)%360;
}
function normalize180(d){ return ((d+180)%360+360)%360-180; }
function turnAngleDeg(from,to){ return Math.abs(normalize180(to-from)); }

function setOutgoingChoicesAt(endLL){
  const id=idOf(endLL);
  const outs = (graph.adj.get(id)||[]);
  outgoingChoices = outs.slice().sort((e1,e2)=>{
    const a1=turnAngleDeg(currentHeading, bearingDeg(e1.a,e1.b));
    const a2=turnAngleDeg(currentHeading, bearingDeg(e2.a,e2.b));
    return a1-a2;
  });
  choiceIndex=0;
  if (outgoingChoices.length){
    HUD(`En cruce. Opciones: ${outgoingChoices.length}. ←/→ elige, ↑ confirma, ↓ retrocede`);
  }
}

function updatePositionAndCamera(){
  if(!currentEdge) return;
  currentPos = lerpLL(currentEdge.a, currentEdge.b, currentProgress);
  currentHeading = bearingDeg(currentEdge.a, currentEdge.b);
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(currentPos[0], currentPos[1], CAMERA_HEIGHT_M),
    orientation: { heading: Cesium.Math.toRadians(currentHeading), pitch: CAMERA_PITCH, roll:0 }
  });
}

function computeAtJunction(){
  if (junctionCooldownM>0) return false;
  const pos = lerpLL(currentEdge.a, currentEdge.b, currentProgress);
  const end = currentProgress>0.5 ? currentEdge.b : currentEdge.a;
  const d = Cesium.Cartesian3.distance(cartOf(pos), cartOf(end));
  return d<=VERTEX_TOL_M;
}

function enterEdge(edge){
  currentEdge = edge;
  const L = Math.max(edgeLengthMeters(currentEdge), 0.001);
  const leaveDist = VERTEX_TOL_M + EXIT_JUNCTION_MARGIN_M;
  currentProgress = clamp01(leaveDist / L);
  junctionCooldownM = LEAVE_JUNCTION_M;
  atJunction=false;
  updatePositionAndCamera();
}

function pickBestAtVertex(vertexLL, desiredHeading){
  const id=idOf(vertexLL);
  const outs=(graph.adj.get(id)||[]);
  if (!outs.length) return null;
  return outs.slice().sort((e1,e2)=>{
    const a1=turnAngleDeg(desiredHeading, bearingDeg(e1.a,e1.b));
    const a2=turnAngleDeg(desiredHeading, bearingDeg(e2.a,e2.b));
    return a1-a2;
  })[0];
}

// Movimiento continuo, respetando saltos entre tramos hacia adelante y hacia atrás
function moveAlong(deltaM){
  if(!currentEdge) return;
  let L = Math.max(edgeLengthMeters(currentEdge), 0.001);
  let deltaT = deltaM / L;
  let newProg = currentProgress + deltaT;

  if (newProg >= 0 && newProg <= 1){
    currentProgress = newProg;
  } else if (newProg < 0){
    // cruzó el inicio: saltar al tramo que sale del vértice A en dirección más alineada al retroceso
    const A = currentEdge.a;
    const revHeading = bearingDeg(currentEdge.b, currentEdge.a);
    const next = pickBestAtVertex(A, revHeading);
    if (next){
      enterEdge(next);
      return; // ya reposicionado; evita “quedarse” en 0
    } else {
      currentProgress = 0; // no hay a dónde ir
    }
  } else if (newProg > 1){
    // cruzó el final: saltar al tramo que sale del vértice B en dirección más alineada a seguir
    const B = currentEdge.b;
    const fwdHeading = bearingDeg(currentEdge.a, currentEdge.b);
    const next = pickBestAtVertex(B, fwdHeading);
    if (next){
      enterEdge(next);
      return;
    } else {
      currentProgress = 1;
    }
  }

  if (junctionCooldownM>0) junctionCooldownM = Math.max(0, junctionCooldownM - Math.abs(deltaM));
  updatePositionAndCamera();

  atJunction = computeAtJunction();
  if (atJunction){
    const end = currentProgress>0.5 ? currentEdge.b : currentEdge.a;
    setOutgoingChoicesAt(end);
    // Solo en modo automático hacemos auto-recto
    if (autoOn && outgoingChoices.length){
      const straight = outgoingChoices[0];
      if (turnAngleDeg(currentHeading, bearingDeg(straight.a, straight.b))<=AUTO_STRAIGHT_BIAS_DEG){
        enterEdge(straight);
      }
    }
  }
}

// ====== Carga de capas ======
async function loadPredios(){
  if(prediosDS) viewer.dataSources.remove(prediosDS, true);
  prediosDS = await Cesium.GeoJsonDataSource.load(URL_PREDIOS, { clampToGround:false });
  for(const e of prediosDS.entities.values){
    if(!e.polygon) continue;
    let h=6; const p=e.properties?.getValue?.() || e.properties || {};
    if (p.altura!==undefined) h=Number(p.altura)||h;
    if (p.height!==undefined) h=Number(p.height)||h;
    e.polygon.material = Cesium.Color.BLUE.withAlpha(0.45);
    e.polygon.outline = true;
    e.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.6);
    e.polygon.extrudedHeight = h;
  }
  viewer.dataSources.add(prediosDS);
}
async function loadVias(){
  if(viasDS) viewer.dataSources.remove(viasDS, true);
  viasDS = await Cesium.GeoJsonDataSource.load(URL_VIAS, { clampToGround:true, stroke: Cesium.Color.RED, strokeWidth:3 });
  viewer.dataSources.add(viasDS);
}
function flyToDataSources(){
  const arr=[]; if(prediosDS) arr.push(prediosDS); if(viasDS) arr.push(viasDS);
  if(arr.length){
    viewer.flyTo(arr, { duration:1.0, offset:new Cesium.HeadingPitchRange(0, CAMERA_PITCH, 1500) });
  }else{
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-74.0958, 4.7215, 2500), orientation:{pitch:CAMERA_PITCH}, duration:1.0 });
  }
}

// ====== Grafo ======
function buildGraphFromVias(fc){
  const nodes=new Map(), adj=new Map(), edges=[];
  function pushEdge(a,b){
    const idA=idOf(a), idB=idOf(b);
    if(!nodes.has(idA)) nodes.set(idA, a);
    if(!nodes.has(idB)) nodes.set(idB, b);
    const e={a,b}; edges.push(e);
    if(!adj.has(idA)) adj.set(idA,[]);
    if(!adj.has(idB)) adj.set(idB,[]);
    adj.get(idA).push(e); adj.get(idB).push({a:b,b:a});
  }
  for(const feat of fc.features){
    if(!feat.geometry) continue;
    if(feat.geometry.type==="LineString"){
      const c=feat.geometry.coordinates;
      for(let i=0;i<c.length-1;i++) pushEdge(c[i], c[i+1]);
    }else if(feat.geometry.type==="MultiLineString"){
      for(const line of feat.geometry.coordinates){
        for(let i=0;i<line.length-1;i++) pushEdge(line[i], line[i+1]);
      }
    }
  }
  return {nodes, adj, edges};
}

// ====== Autotour ======
function pickNextForAuto(){
  const end = currentProgress>0.5 ? currentEdge.b : currentEdge.a;
  const id=idOf(end);
  let outs=(graph.adj.get(id)||[]);
  if(!outs.length) return null;
  const scored = outs.map(e=>{
    const unId=undirectedId(e);
    const notVisited = !visitedUndirected.has(unId);
    const turn = turnAngleDeg(currentHeading, bearingDeg(e.a,e.b));
    const straightBias = (turn<=AUTO_STRAIGHT_BIAS_DEG)? -1 : 0;
    return {e, notVisited, turn, straightBias};
  });
  scored.sort((x,y)=>{
    if (x.notVisited!==y.notVisited) return y.notVisited - x.notVisited;
    if (x.straightBias!==y.straightBias) return y.straightBias - x.straightBias;
    return x.turn - y.turn;
  });
  return scored[0].e;
}
function stepAuto(dt){
  if(!autoOn || !currentEdge) return;
  if (autoPause>0){ autoPause -= dt*1000; return; }
  moveAlong(autoSpeed * dt);
  if (computeAtJunction()){
    const next = pickNextForAuto();
    if (next){
      visitedUndirected.add(undirectedId(next));
      enterEdge(next);
      autoPause = AUTO_PAUSE_AT_JUNCTION_MS;
    }
  }
  HUD(`Auto: ${autoOn?'ON':'OFF'} • Vel: ${autoSpeed.toFixed(1)} m/s • Progreso ${(currentProgress*100).toFixed(0)}%`);
}

// ====== Input ======
document.addEventListener("keydown", (e)=>{
  if(e.code==="ArrowLeft"){
    if(atJunction && outgoingChoices.length){ choiceIndex=(choiceIndex-1+outgoingChoices.length)%outgoingChoices.length; HUD(`Opción ${choiceIndex+1}/${outgoingChoices.length}. ↑ para confirmar`); }
    else { moveAlong(-NAV_SPEED_MPS); }
    e.preventDefault(); return;
  }
  if(e.code==="ArrowRight"){
    if(atJunction && outgoingChoices.length){ choiceIndex=(choiceIndex+1)%outgoingChoices.length; HUD(`Opción ${choiceIndex+1}/${outgoingChoices.length}. ↑ para confirmar`); }
    else { moveAlong(+NAV_SPEED_MPS); }
    e.preventDefault(); return;
  }
  if(e.code==="ArrowUp"){
    if(atJunction && outgoingChoices.length){ enterEdge(outgoingChoices[choiceIndex]||outgoingChoices[0]); }
    else { moveAlong(+NAV_SPEED_MPS); }
    e.preventDefault(); return;
  }
  if(e.code==="ArrowDown"){
    moveAlong(-NAV_SPEED_MPS);
    e.preventDefault(); return;
  }
  if(e.code==="KeyT"){ autoOn = !autoOn; autoPause=0; HUD(`Auto: ${autoOn?'ON':'OFF'}`); e.preventDefault(); return; }
  if(e.code==="Space"){ autoOn = !autoOn; e.preventDefault(); return; }
  if(e.code==="BracketRight"){ autoSpeed = Math.min(20, autoSpeed+1); HUD(`Velocidad auto: ${autoSpeed} m/s`); e.preventDefault(); return; }
  if(e.code==="BracketLeft"){ autoSpeed = Math.max(1, autoSpeed-1); HUD(`Velocidad auto: ${autoSpeed} m/s`); e.preventDefault(); return; }
  if(e.code==="Escape"){ autoOn=false; e.preventDefault(); return; }
});

// ====== Init ======
(async function init(){
  try{
    HUD("Cargando datos…");
    await loadPredios();
    await loadVias();
    flyToDataSources();

    const rawVias = await fetch(URL_VIAS).then(r=>r.json());
    graph = buildGraphFromVias(rawVias);

    // tramo inicial: el más largo
    graph.edges.sort((a,b)=> edgeLengthMeters(b)-edgeLengthMeters(a));
    currentEdge = graph.edges[0];
    visitedUndirected.add(undirectedId(currentEdge));
    currentProgress = 0.1;
    currentHeading = bearingDeg(currentEdge.a, currentEdge.b);
    updatePositionAndCamera();

    // loop de animación
    viewer.clock.shouldAnimate = true;
    lastTick = viewer.clock.currentTime;
    viewer.clock.onTick.addEventListener((clock)=>{
      const now = clock.currentTime;
      const dt = Cesium.JulianDate.secondsDifference(now, lastTick);
      lastTick = now;
      stepAuto(dt);
    });

    HUD("Listo. ←/→ elegir/avanzar, ↑ confirmar, ↓ retroceder. [T] Auto ON/OFF, [ ]/[ ] vel.");
  }catch(err){
    console.error(err);
    HUD("Error: " + (err.message||err));
  }
})();