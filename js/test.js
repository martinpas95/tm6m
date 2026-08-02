window.TM6M = window.TM6M || {};

TM6M.test = (function () {
  function el(id) { return document.getElementById(id); }

  var running = false;
  var startedAt = null;
  var frozenElapsedMs = 0;
  var timerInterval = null;
  var notifiedBoundary = {};
  var openRow = null;
  var openRowCtrl = null;
  var manualMetros = {};
  var bleLocked = {};
  var bleWired = false;

  function getElapsedMs() { return running ? (Date.now() - startedAt) : frozenElapsedMs; }

  function start() {
    var t = TM6M.state.current;
    t.vueltas = [];
    manualMetros = {};
    bleLocked = {};
    openRow = null;
    openRowCtrl = null;
    notifiedBoundary = {};
    running = true;
    frozenElapsedMs = 0;
    startedAt = Date.now();
    t.startedAt = new Date(startedAt).toISOString();

    el('lap-meters').textContent = t.metrosPorVuelta;
    el('btn-test-pause').textContent = 'Pausar';

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 250);

    TM6M.ui.setLeaveGuard('test', function () {
      return confirm('¿Salir de la prueba en curso? El cronómetro se detendrá.');
    });

    if (!bleWired) {
      bleWired = true;
      TM6M.ble.onStatusChange(updateBleBadge);
      TM6M.ble.onReading(handleBleReading);
    }

    render();
    TM6M.ui.showView('test');
    tick();
  }

  function togglePause() {
    if (running) {
      frozenElapsedMs = Date.now() - startedAt;
      running = false;
      clearInterval(timerInterval);
      el('btn-test-pause').textContent = 'Reanudar';
    } else {
      startedAt = Date.now() - frozenElapsedMs;
      running = true;
      timerInterval = setInterval(tick, 250);
      el('btn-test-pause').textContent = 'Pausar';
    }
  }

  function addLap() {
    if (!running) { TM6M.ui.toast('Reanudá el cronómetro primero'); return; }
    var sec = Math.floor(getElapsedMs() / 1000);
    var t = TM6M.state.current;
    t.vueltas.push(sec);
    recomputeMetros();
    updateMetersUI();
    renderRows();
    TM6M.ui.vibrate(30);
  }

  function recomputeMetros() {
    var t = TM6M.state.current;
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    t.vueltas.forEach(function (sec) {
      var m = Math.min(6, Math.floor(sec / 60) + 1);
      counts[m] = (counts[m] || 0) + 1;
    });
    for (var i = 1; i <= 6; i++) {
      if (!manualMetros[i]) t.filas[i].metros = counts[i] * t.metrosPorVuelta;
    }
  }

  function updateMetersUI() {
    var t = TM6M.state.current;
    el('lap-count').textContent = t.vueltas.length;
    el('test-meters-total').textContent = TM6M.calc.metrosTotales(t.filas);
  }

  function tick() {
    var ms = getElapsedMs();
    el('test-timer').textContent = TM6M.ui.fmtTime(ms);
    var sec = Math.floor(ms / 1000);
    var t = TM6M.state.current;

    for (var m = 1; m <= 6; m++) {
      var boundary = m * 60;
      if (sec >= boundary && !notifiedBoundary[m]) {
        notifiedBoundary[m] = true;
        var fila = t.filas[m];
        if (!fila.completado) {
          openRow = m;
          var fresh = TM6M.ble.freshReading();
          if (fresh && !bleLocked[m]) {
            fila.spo2 = fresh.spo2;
            fila.fc = fresh.pr;
          }
          TM6M.ui.vibrate([80, 60, 80]);
          TM6M.ui.toast('Minuto ' + m + ': cargar SpO2, FC y Borg');
        }
        renderRows();
      }
    }

    if (sec >= 360 && running) {
      finishWalk();
    }
  }

  function handleBleReading(reading) {
    updateBleBadge();
    if (openRow && openRowCtrl) {
      var fila = TM6M.state.current.filas[openRow];
      if (!fila.completado && !bleLocked[openRow]) {
        openRowCtrl.setSpo2(reading.spo2);
        openRowCtrl.setFc(reading.pr);
      }
    }
  }

  function updateBleBadge() {
    var badge = el('test-ble-badge');
    if (!badge) return;
    var st = TM6M.ble.getStatus();
    var reading = TM6M.ble.freshReading();
    if (!st.connected) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.classList.toggle('live', !!reading);
    var dot = '<span class="dot"></span>';
    var text = reading
      ? ('SpO2 ' + (reading.spo2 !== null ? reading.spo2 + '%' : '—') + ' · FC ' + (reading.pr !== null ? reading.pr + ' lpm' : '—') + ' (en vivo)')
      : ('Conectado a ' + (st.deviceName || 'oxímetro') + '…');
    badge.innerHTML = dot + '<span>' + text + '</span>';
  }

  function finishWalk() {
    running = false;
    clearInterval(timerInterval);
    TM6M.ui.setLeaveGuard('test', null);
    TM6M.recovery.start();
  }

  function summaryText(f) {
    var allEmpty = !f.completado && f.spo2 === null && f.fc === null && f.borgDisnea === null && f.borgMmii === null;
    if (allEmpty) return 'pendiente';
    var spo2 = f.spo2 === null ? 'SpO2 —' : f.spo2 + '%';
    var fc = f.fc === null ? 'FC —' : f.fc + ' lpm';
    return spo2 + ' · ' + fc;
  }

  function renderRows() {
    var t = TM6M.state.current;
    var container = el('test-rows');
    container.innerHTML = '';
    var sec = Math.floor(getElapsedMs() / 1000);
    openRowCtrl = null;

    for (var i = 1; i <= 6; i++) {
      (function (i) {
        var fila = t.filas[i];
        var due = sec >= i * 60;
        var pending = due && !fila.completado;
        var row = document.createElement('div');
        row.className = 'minute-row' + (pending ? ' pending' : '') + (fila.completado ? ' done' : '') + (openRow === i ? ' open' : '');

        var head = document.createElement('div');
        head.className = 'minute-row-head';
        head.innerHTML = '<span class="minute-row-title">Minuto ' + i + '</span><span class="minute-row-summary">' + summaryText(fila) + '</span>';
        head.addEventListener('click', function () {
          openRow = (openRow === i ? null : i);
          renderRows();
        });
        row.appendChild(head);

        var body = document.createElement('div');
        body.className = 'minute-row-body';
        if (openRow === i) {
          var ctrl = TM6M.ui.buildFilaFields(body, fila, {
            onManualMetros: function () { manualMetros[i] = true; },
            onManualSpo2: function () { bleLocked[i] = true; },
            onManualFc: function () { bleLocked[i] = true; }
          });
          openRowCtrl = ctrl;

          var doneBtn = document.createElement('button');
          doneBtn.type = 'button';
          doneBtn.className = 'btn btn-primary btn-block';
          doneBtn.textContent = fila.completado ? 'Editado ✓' : 'Listo ✓';
          doneBtn.addEventListener('click', function () {
            fila.completado = true;
            openRow = null;
            TM6M.ui.vibrate(60);
            renderRows();
          });
          body.appendChild(doneBtn);
        }
        row.appendChild(body);
        container.appendChild(row);
      })(i);
    }
  }

  function render() {
    var t = TM6M.state.current;
    el('test-timer').textContent = TM6M.ui.fmtTime(getElapsedMs());
    el('lap-meters').textContent = t.metrosPorVuelta;
    updateMetersUI();
    updateBleBadge();
    renderRows();
  }

  function init() {
    el('btn-lap').addEventListener('click', addLap);
    el('btn-test-pause').addEventListener('click', togglePause);
    el('btn-test-finish').addEventListener('click', function () {
      if (confirm('¿Finalizar la caminata ahora?')) finishWalk();
    });
  }

  return { init: init, start: start, render: render };
})();
