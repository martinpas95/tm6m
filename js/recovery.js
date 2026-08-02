window.TM6M = window.TM6M || {};

TM6M.recovery = (function () {
  function el(id) { return document.getElementById(id); }

  var running = false;
  var startedAt = null;
  var frozenMs = 0;
  var interval = null;
  var notified1min = false;
  var bleWired = false;

  function getElapsedMs() { return running ? (Date.now() - startedAt) : frozenMs; }
  function getElapsedMin() { return getElapsedMs() / 60000; }
  function round1(v) { return Math.round(v * 10) / 10; }

  function start() {
    var t = TM6M.state.current;
    running = true;
    frozenMs = 0;
    startedAt = Date.now();
    notified1min = false;
    t.recuperacion = t.recuperacion || { fcAlMinuto: null, recuperaFcEnMin: null, recuperaSatEnMin: null };

    el('r-fc-1min').value = t.recuperacion.fcAlMinuto === null ? '' : t.recuperacion.fcAlMinuto;
    el('r-ta-final').value = t.taFinal || '';
    el('recovery-timer').textContent = '00:00';
    updateStatusUI();
    renderBleHint();

    clearInterval(interval);
    interval = setInterval(tick, 250);

    TM6M.ui.setLeaveGuard('recovery', function () {
      return confirm('¿Salir de la recuperación? El cronómetro se detendrá.');
    });

    if (!bleWired) {
      bleWired = true;
      TM6M.ble.onStatusChange(renderBleHint);
      TM6M.ble.onReading(renderBleHint);
    }

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
      var t = TM6M.state.current;
      var fresh = TM6M.ble.freshReading();
      if (fresh && fresh.pr !== null && t.recuperacion.fcAlMinuto === null) {
        t.recuperacion.fcAlMinuto = fresh.pr;
        el('r-fc-1min').value = fresh.pr;
      }
      el('r-fc-1min').focus();
    }
  }

  function renderBleHint() {
    var box = el('r-ble-hint');
    var st = TM6M.ble.getStatus();
    var reading = TM6M.ble.freshReading();
    if (!st.connected || !reading) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = 'En vivo: ' + (reading.pr !== null ? reading.pr + ' lpm' : '—');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = 'Usar';
    btn.addEventListener('click', function () {
      TM6M.state.current.recuperacion.fcAlMinuto = reading.pr;
      el('r-fc-1min').value = reading.pr === null ? '' : reading.pr;
    });
    box.appendChild(span);
    box.appendChild(btn);
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
    running = false;
    TM6M.ui.setLeaveGuard('recovery', null);
    TM6M.review.render();
    TM6M.ui.showView('review');
  }

  function init() {
    el('r-fc-1min').addEventListener('input', function () {
      var v = el('r-fc-1min').value.trim();
      TM6M.state.current.recuperacion.fcAlMinuto = v === '' ? null : Number(v);
    });
    el('r-ta-final').addEventListener('input', function () {
      TM6M.state.current.taFinal = el('r-ta-final').value;
    });
    el('btn-sat-recovered').addEventListener('click', markSatRecovered);
    el('btn-fc-recovered').addEventListener('click', markFcRecovered);
    el('btn-recovery-finish').addEventListener('click', finish);
  }

  return { init: init, start: start };
})();
