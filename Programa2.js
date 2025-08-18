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
