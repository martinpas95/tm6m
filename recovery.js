window.TM6M = window.TM6M || {};

TM6M.recovery = (function () {
  function el(id) { return document.getElementById(id); }

  var startedAt = null;
  var interval = null;
  var notified1min = false;

  function getElapsedMs() { return Date.now() - startedAt; }
  function getElapsedMin() { return getElapsedMs() / 60000; }
  function round1(v) { return Math.round(v * 10) / 10; }

  // startTimestamp: instante real (Date.now()) en que arrancó la recuperación —
  // puede ser en el pasado si tardó en cargarse el minuto 6, el cronómetro ya
  // viene corriendo desde ese momento.
  function start(startTimestamp) {
    var t = TM6M.state.current;
    startedAt = startTimestamp || Date.now();
    notified1min = false;
    t.recuperacion = t.recuperacion || { fcAlMinuto: null, recuperaFcEnMin: null, recuperaSatEnMin: null };

    el('r-fc-1min').value = t.recuperacion.fcAlMinuto === null ? '' : t.recuperacion.fcAlMinuto;
    el('r-ta-final').value = t.taFinal || '';
    var basal = t.filas[0];
    el('recovery-sat-basal').textContent = TM6M.calc.isNum(basal.spo2) ? ('(basal: ' + basal.spo2 + '%)') : '';
    el('recovery-fc-basal').textContent = TM6M.calc.isNum(basal.fc) ? ('(basal: ' + basal.fc + ' lpm)') : '';
    updateStatusUI();

    clearInterval(interval);
    interval = setInterval(tick, 250);
    tick();

    TM6M.ui.setLeaveGuard('recovery', function () {
      return confirm('¿Salir de la recuperación? El cronómetro se detendrá.');
    });

    TM6M.ui.showView('recovery');
  }

  function tick() {
    var ms = getElapsedMs();
    el('recovery-timer').textContent = TM6M.ui.fmtTime(ms);
    var sec = Math.floor(ms / 1000);
    if (sec >= 60 && !notified1min) {
      notified1min = true;
      TM6M.ui.vibrate([80, 60, 80]);
      TM6M.ui.toast('Cargar FC al minuto de finalizar');
      el('r-fc-1min').focus();
    }
  }

  function markSatRecovered() {
    var t = TM6M.state.current;
    t.recuperacion.recuperaSatEnMin = round1(getElapsedMin());
    updateStatusUI();
    TM6M.ui.vibrate(40);
  }

  function markFcRecovered() {
    var t = TM6M.state.current;
    t.recuperacion.recuperaFcEnMin = round1(getElapsedMin());
    updateStatusUI();
    TM6M.ui.vibrate(40);
  }

  function updateStatusUI() {
    var t = TM6M.state.current;
    var sat = t.recuperacion.recuperaSatEnMin;
    var fc = t.recuperacion.recuperaFcEnMin;
    var satEl = el('recovery-sat-status');
    satEl.textContent = sat === null ? 'Sin marcar' : ('Recuperada a los ' + sat + ' min');
    satEl.classList.toggle('done', sat !== null);
    var fcEl = el('recovery-fc-status');
    fcEl.textContent = fc === null ? 'Sin marcar' : ('Recuperada a los ' + fc + ' min');
    fcEl.classList.toggle('done', fc !== null);
  }

  function finish() {
    clearInterval(interval);
    TM6M.ui.setLeaveGuard('recovery', null);
    TM6M.review.render();
    TM6M.ui.showView('review');
  }

  function init() {
    el('r-fc-1min').addEventListener('input', function () {
      var v = el('r-fc-1min').value.trim();
      TM6M.state.current.recuperacion.fcAlMinuto = v === '' ? null : Number(v);
    });
    TM6M.ui.attachTaFormatter(el('r-ta-final'), function (v) {
      TM6M.state.current.taFinal = v;
    });
    el('btn-sat-recovered').addEventListener('click', markSatRecovered);
    el('btn-fc-recovered').addEventListener('click', markFcRecovered);
    el('btn-recovery-finish').addEventListener('click', finish);
  }

  return { init: init, start: start };
})();
