/* =========================================================
   LÓGICA JS
   - En este diseño los submenús funcionan solo con hover (CSS).
   - Este archivo queda listo por si deseas agregar interacciones
     adicionales más adelante (por ejemplo, abrir/cerrar en móvil).
   ========================================================= */

/* Ejemplo (opcional) de mejora:
   Si detectas pantalla táctil y quieres abrir submenús al tocar,
   puedes descomentar y adaptar el siguiente bloque. Por ahora
   lo dejamos comentado porque pediste "solo al pasar el mouse".

document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll('.menu-item');

  items.forEach(item => {
    const link = item.querySelector('.menu-link');
    const submenu = item.querySelector('.submenu');
    if (!link || !submenu) return;

    link.addEventListener('click', (e) => {
      // Evita navegación inmediata
      e.preventDefault();

      // Cierra otros submenús
      items.forEach(i => {
        if (i !== item) {
          const sm = i.querySelector('.submenu');
          if (sm) sm.style.display = 'none';
        }
      });

      // Alterna el actual
      submenu.style.display = (submenu.style.display === 'block') ? 'none' : 'block';
    });
  });

  // Cierra si se hace click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-item')) {
      document.querySelectorAll('.submenu').forEach(sm => sm.style.display = 'none');
    }
  });
});
*/


// =======================
// Ajuste de alto del hero (50%)
// - El contenedor del hero tomará el 50% del alto que tendría la imagen a ancho completo.
// - Se recalcula en resize para mantener la proporción.
// =======================
(function() {
  function ajustarHero() {
    const hero = document.querySelector('.barrio-hero');
    const img = document.querySelector('.barrio-hero .barrio-img');
    if (!hero || !img) return;

    if (!img.complete || img.naturalWidth === 0) {
      img.addEventListener('load', ajustarHero, { once: true });
      return;
    }

    const width = hero.clientWidth || window.innerWidth;
    const ratio = img.naturalHeight / img.naturalWidth; // h/w
    const alturaRenderNatural = ratio * width;

    const target = Math.round(alturaRenderNatural * 0.5); // 50%
    hero.style.height = target + 'px';
    // La imagen usa height:100% y object-fit:cover desde CSS.
  }

  window.addEventListener('DOMContentLoaded', ajustarHero);
  window.addEventListener('resize', ajustarHero);
})();

