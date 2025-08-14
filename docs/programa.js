Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNzI1ZjBlNS1hNmY4LTQ0OGEtYjE5OS1hMGJiYjYzMmNhOGIiLCJpZCI6MzMxMzc2LCJpYXQiOjE3NTUwNDI2Mjd9.vMkh7Pvq2F9MhZE4H7wqPFFQs1gPKdc-Ax4q0tncRs8';

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.ArcGisMapServerImageryProvider.fromBasemapType(
      Cesium.ArcGisBaseMapType.SATELLITE
    )
  ),
  timeline: false,
  animation: false,
  shadows: true
});
viewer.scene.globe.depthTestAgainstTerrain = true;

// 1) Capa del barrio: SOLO para ubicar/recortar (sin extrusión)

const barrio = await Cesium.GeoJsonDataSource.load("Potosi.geojson", {
  clampToGround: true
});
viewer.dataSources.add(barrio);
for (const e of barrio.entities.values) {
  if (!e.polygon) continue;
  e.polygon.material = Cesium.Color.fromCssColorString("#ff9800").withAlpha(0.25);
  e.polygon.outline = true;
  e.polygon.outlineColor = Cesium.Color.fromCssColorString("#0d47a1");
}

// Centra la cámara en el barrio
await viewer.flyTo(barrio);

// 2) PREDIOS: extrusión (usa 'altura' o 'pisos'; fallback 6 m)
// Exporta desde QGIS como EPSG:4326 ; Cesium trabaja en WGS84 (EPSG:4326)

const predios = await Cesium.GeoJsonDataSource.load("Predios-Potosi.geojson", {
  // importante: SIN clampToGround si vas a extruir
});
viewer.dataSources.add(predios);

for (const e of predios.entities.values) {
  const pol = e.polygon;
  if (!pol) continue;

  const props = e.properties || {};
  const hasAltura = props.altura && !isNaN(+props.altura.getValue?.());
  const hasPisos  = props.pisos  && !isNaN(+props.pisos.getValue?.());
  const altura = hasAltura ? +props.altura.getValue()
                : hasPisos  ? +props.pisos.getValue() * 3   // 3 m por piso
                            : 6;

  pol.material = Cesium.Color.fromCssColorString("#9e9e9e").withAlpha(0.95);
  pol.outline = true;
  pol.outlineColor = Cesium.Color.BLACK;

  pol.height = 0 //Base del terreno
  pol.heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
  pol.extrudedHeight = altura; // en metros
  pol.extrudedHeightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
}

// 3) Cargar vías recortadas y mostrarlas; Cesium trabaja en WGS84 (EPSG:4326)
try {
  // Cargar el GeoJSON de vías con clampToGround para que sigan la superficie del terreno
  const viasDataSource = await Cesium.GeoJsonDataSource.load("Vias.geojson", {
    clampToGround: true
  });
  viewer.dataSources.add(viasDataSource);
  console.log("Vías cargadas:", viasDataSource.entities.values.length, "entidades");

  // Estilizar vías para que se vean bien sobre imágenes satelitales
  viasDataSource.entities.values.forEach(entity => {
    if (entity.polyline) {
      // Grosor de la línea
      entity.polyline.width = 3;

      // Color principal + borde para mejorar visibilidad
      entity.polyline.material = new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1
      });

      // Ajustar al relieve del terreno
      entity.polyline.clampToGround = true;
    }
  });

} catch (error) {
  console.error("Error al cargar Vias.geojson:", error);
}

// 4) Cámara inicial manual (por si lo prefieres)
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-74.082449, 4.688547, 3000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-25) }
});
