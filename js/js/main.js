window.TM6M = window.TM6M || {};

(function () {
  function el(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    TM6M.home.init();
    TM6M.patient.init();
    TM6M.test.init();
    TM6M.recovery.init();
    TM6M.review.init();
    TM6M.report.init();
    TM6M.settings.init();

    el('btn-back').addEventListener('click', function () { TM6M.ui.goBack(); });
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
  });
})();
