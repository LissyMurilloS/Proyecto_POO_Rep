// Configura tu token de Cesium Ion (reemplázalo por el tuyo)
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNzI1ZjBlNS1hNmY4LTQ0OGEtYjE5OS1hMGJiYjYzMmNhOGIiLCJpZCI6MzMxMzc2LCJpYXQiOjE3NTUwNDI2Mjd9.vMkh7Pvq2F9MhZE4H7wqPFFQs1gPKdc-Ax4q0tncRs8';

// Crear el visor
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: Cesium.createWorldTerrain(),
  animation: false,
  timeline: false,
  sceneModePicker: false
});

// Centrar la vista en Potosí (ejemplo con coordenadas de Medellín)
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-75.620, 6.217, 2500),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0
  }
});

// Ejemplo de carga de datos GeoJSON (si tienes uno de Catastro 3D)
Cesium.GeoJsonDataSource.load('./assets/catastro3d.geojson', {
  clampToGround: true
}).then((dataSource) => {
  viewer.dataSources.add(dataSource);
  viewer.flyTo(dataSource);
});
