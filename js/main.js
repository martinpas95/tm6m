window.TM6M = window.TM6M || {};

(function () {
  function el(id) { return document.getElementById(id); }

  function init() {
    TM6M.home.init();
    TM6M.patient.init();
    TM6M.test.init();
    TM6M.recovery.init();
    TM6M.review.init();
    TM6M.report.init();
    TM6M.settings.init();

    el('btn-back').addEventListener('click', function () { TM6M.ui.goBack(); });
    el('btn-home').addEventListener('click', function () {
      TM6M.home.render();
      TM6M.ui.goHome();
    });
    el('btn-settings').addEventListener('click', function () {
      TM6M.settings.render();
      TM6M.ui.showView('settings');
    });

    TM6M.home.render();
    TM6M.ui.showView('home', { replace: true });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  // Si el script se ejecuta después de que el documento ya terminó de parsear
  // (puede pasar según cómo/cuándo se cargan los scripts), DOMContentLoaded ya
  // disparó y nunca lo vamos a escuchar — en ese caso arrancamos directo.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
