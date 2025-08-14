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
