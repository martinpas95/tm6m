window.TM6M = window.TM6M || {};

TM6M.test = (function () {
  function el(id) { return document.getElementById(id); }

  var startedAt = null;
  var timerInterval = null;
  var autosaveInterval = null;
  var notifiedBoundary = {};
  var openRow = null;
  var manualMetros = {};
  var detenido = false;
  var pendingEarlyFinish = null;

  function getElapsedMs() { return Date.now() - startedAt; }

  // Guardado provisorio cada 2 minutos mientras dura la caminata, para no perder
  // todo lo cargado si se cierra la app antes de llegar al guardado definitivo del
  // informe. Es solo un upsert en localStorage (rápido, no toca la UI), y el test
  // queda como "no finalizado" hasta que se guarde/envíe el informe de verdad.
  function autosave() {
    TM6M.storage.upsertTest(TM6M.state.current);
  }

  function start() {
    var t = TM6M.state.current;
    t.vueltas = [];
    t.paradas = [];
    t.terminoAnticipado = null;
    manualMetros = {};
    openRow = null;
    notifiedBoundary = {};
    detenido = false;
    pendingEarlyFinish = null;
    startedAt = Date.now();
    t.startedAt = new Date(startedAt).toISOString();

    el('lap-meters').textContent = t.metrosPorVuelta;

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 250);
    clearInterval(autosaveInterval);
    autosaveInterval = setInterval(autosave, 120000);

    TM6M.ui.setLeaveGuard('test', function () {
      return confirm('¿Salir de la prueba en curso? El cronómetro se detendrá.');
    });

    recomputeMetros();
    render();
    TM6M.ui.showView('test');
    tick();
  }

  function addLap() {
    if (detenido) { TM6M.ui.toast('El paciente está detenido, no se cuentan vueltas ahora'); return; }
    var sec = Math.floor(getElapsedMs() / 1000);
    var t = TM6M.state.current;
    t.vueltas.push(sec);
    recomputeMetros();
    updateMetersUI();
    updateDirectionBox();
    renderRows();
    TM6M.ui.vibrate(30);
  }

  function lapCountsByMinute() {
    var t = TM6M.state.current;
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    t.vueltas.forEach(function (sec) {
      var m = Math.min(6, Math.floor(sec / 60) + 1);
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }

  function recomputeMetros() {
    var t = TM6M.state.current;
    var counts = lapCountsByMinute();
    for (var i = 1; i <= 6; i++) {
      if (!manualMetros[i]) {
        // Al arrancar la prueba el paciente ya recorre la primera vuelta antes de
        // que se llegue a tocar "Vuelta" por primera vez, así que el minuto 1
        // arranca con esa vuelta ya acreditada.
        var base = (i === 1) ? t.metrosPorVuelta : 0;
        t.filas[i].metros = base + counts[i] * t.metrosPorVuelta;
      }
    }
  }

  function updateMetersUI() {
    var t = TM6M.state.current;
    // +1 porque la primera vuelta ya se acredita sola al arrancar (ver recomputeMetros).
    el('lap-count').textContent = t.vueltas.length + 1;
    el('test-meters-total').textContent = TM6M.calc.metrosTotales(t.filas);
  }

  // --- Flechas de sentido de marcha ---
  // La alternancia (↑ inicial, después ↓/↑/↓...) es continua a lo largo de TODA la
  // prueba, sin importar el minuto: cada toque real de "Vuelta" es lo opuesto del
  // toque anterior (o del ↑ inicial si es el primero). El recuadro en pantalla y lo
  // que queda junto a cada "Minuto X" solo muestran el tramo de esa alternancia que
  // corresponde a ese minuto, pero la secuencia en sí nunca se reinicia.

  // Una entrada por cada vuelta real, en orden cronológico: {minuto, dir}.
  function globalArrowTaps() {
    var t = TM6M.state.current;
    return t.vueltas.map(function (sec, idx) {
      return {
        minute: Math.min(6, Math.floor(sec / 60) + 1),
        dir: idx % 2 === 0 ? 'down' : 'up'
      };
    });
  }

  function arrowsForMinute(globalTaps, minuteIndex) {
    var seq = (minuteIndex === 1) ? ['up'] : [];
    globalTaps.forEach(function (tap) {
      if (tap.minute === minuteIndex) seq.push(tap.dir);
    });
    return seq;
  }

  function arrowGlyphsHtml(seq) {
    return seq.map(function (d) {
      return '<span class="arrow-chip ' + d + '">' + (d === 'up' ? '↑' : '↓') + '</span>';
    }).join('');
  }

  function currentMinuteIndex() {
    var sec = Math.floor(getElapsedMs() / 1000);
    return Math.max(1, Math.min(6, Math.floor(sec / 60) + 1));
  }

  function updateDirectionBox() {
    var box = el('test-direction-box');
    if (!box) return;
    var seq = arrowsForMinute(globalArrowTaps(), currentMinuteIndex());
    box.innerHTML = arrowGlyphsHtml(seq);
  }

  function tick() {
    var ms = getElapsedMs();
    el('test-timer').textContent = TM6M.ui.fmtTime(ms);
    updateTimerRing(ms);
    updateDirectionBox();
    var sec = Math.floor(ms / 1000);
    var t = TM6M.state.current;

    for (var m = 1; m <= 6; m++) {
      var boundary = m * 60;
      if (sec >= boundary && !notifiedBoundary[m]) {
        notifiedBoundary[m] = true;
        var fila = t.filas[m];
        if (!fila.completado) {
          openRow = m;
          TM6M.ui.vibrate([80, 60, 80]);
          TM6M.ui.toast('Minuto ' + m + ': cargar SpO2, FC y Borg');
        }
        renderRows();
      }
    }
  }

  function updateTimerRing(ms) {
    var ring = el('test-timer-ring');
    if (!ring) return;
    var pct = Math.min(1, ms / 360000);
    var circumference = 2 * Math.PI * 54;
    ring.style.strokeDashoffset = String(circumference * (1 - pct));
  }

  function finishWalk() {
    clearInterval(timerInterval);
    clearInterval(autosaveInterval);
    autosave();
    TM6M.ui.setLeaveGuard('test', null);
    TM6M.ui.toast('Caminata finalizada, iniciando recuperación');
    // La recuperación arranca en el instante real en que se cumplieron los 6:00 de
    // caminata (aunque falte cargar el minuto 6), no cuando se termina de cargar el dato.
    // Si se finalizó antes de tiempo, arranca ahora mismo.
    var recoveryStart = Math.min(Date.now(), startedAt + 360000);
    TM6M.recovery.start(recoveryStart);
  }

  // --- Parada del paciente (el cronómetro sigue corriendo) ---

  function toggleParada() {
    var t = TM6M.state.current;
    if (!detenido) {
      detenido = true;
      t.paradas.push({ inicioSec: Math.floor(getElapsedMs() / 1000), finSec: null, spo2: null, fc: null, borgDisnea: null, borgMmii: null });
      TM6M.ui.vibrate(50);
    } else {
      var actual = t.paradas[t.paradas.length - 1];
      actual.finSec = Math.floor(getElapsedMs() / 1000);
      detenido = false;
      TM6M.ui.vibrate(50);
    }
    renderParadas();
  }

  function renderParadas() {
    var t = TM6M.state.current;
    var box = el('test-parada-box');
    var btn = el('btn-test-parada');
    var list = el('test-parada-list');

    btn.textContent = detenido ? '▶ El paciente retoma la marcha' : '⏸ El paciente se detiene';
    btn.className = 'btn btn-block btn-lg ' + (detenido ? 'btn-warning' : 'btn-secondary');
    el('btn-lap').disabled = detenido;

    var actual = detenido ? t.paradas[t.paradas.length - 1] : null;
    if (actual) {
      box.hidden = false;
      box.innerHTML = '';
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Se detuvo en el minuto ' + TM6M.calc.fmtMinSec(actual.inicioSec) + '. Cargá cómo estaba en ese momento:';
      box.appendChild(hint);
      box.appendChild(TM6M.ui.fieldBlock('SpO2 %', function (b) {
        TM6M.ui.buildNumberInput(b, actual.spo2, function (v) { actual.spo2 = v; }, { placeholder: '%' });
      }));
      box.appendChild(TM6M.ui.fieldBlock('FC (lpm)', function (b) {
        TM6M.ui.buildNumberInput(b, actual.fc, function (v) { actual.fc = v; });
      }));
      box.appendChild(TM6M.ui.fieldBlock('Borg disnea', function (b) {
        TM6M.ui.buildBorgSelector(b, actual.borgDisnea, function (v) { actual.borgDisnea = v; });
      }));
      box.appendChild(TM6M.ui.fieldBlock('Borg MMII', function (b) {
        TM6M.ui.buildBorgSelector(b, actual.borgMmii, function (v) { actual.borgMmii = v; });
      }));
    } else {
      box.hidden = true;
      box.innerHTML = '';
    }

    list.innerHTML = '';
    t.paradas.forEach(function (p, idx) {
      if (p.finSec === null) return;
      var li = document.createElement('li');
      var parts = [TM6M.calc.fmtMinSec(p.inicioSec) + '–' + TM6M.calc.fmtMinSec(p.finSec)];
      if (TM6M.calc.isNum(p.spo2)) parts.push('SpO2 ' + p.spo2 + '%');
      if (TM6M.calc.isNum(p.fc)) parts.push('FC ' + p.fc + ' lpm');
      parts.push('Borg disnea ' + (TM6M.calc.isNum(p.borgDisnea) ? p.borgDisnea : '—'));
      parts.push('MMII ' + (TM6M.calc.isNum(p.borgMmii) ? p.borgMmii : '—'));
      li.textContent = 'Parada ' + (idx + 1) + ': ' + parts.join(' · ');
      list.appendChild(li);
    });
  }

  // --- Finalizar antes de tiempo ---

  function requestEarlyFinish() {
    if (!confirm('¿Terminar la caminata antes de tiempo? Se va a pedir SpO2, FC y Borg del momento antes de pasar a recuperación.')) return;
    pendingEarlyFinish = { sec: Math.floor(getElapsedMs() / 1000), spo2: null, fc: null, borgDisnea: null, borgMmii: null };
    renderEarlyFinishBox();
  }

  function renderEarlyFinishBox() {
    var box = el('test-earlyfinish-box');
    if (!pendingEarlyFinish) { box.hidden = true; box.innerHTML = ''; return; }
    var d = pendingEarlyFinish;
    box.hidden = false;
    box.innerHTML = '';
    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Se termina antes de tiempo en el minuto ' + TM6M.calc.fmtMinSec(d.sec) + '. Cargá cómo estaba en ese momento:';
    box.appendChild(hint);
    box.appendChild(TM6M.ui.fieldBlock('SpO2 %', function (b) {
      TM6M.ui.buildNumberInput(b, d.spo2, function (v) { d.spo2 = v; }, { placeholder: '%' });
    }));
    box.appendChild(TM6M.ui.fieldBlock('FC (lpm)', function (b) {
      TM6M.ui.buildNumberInput(b, d.fc, function (v) { d.fc = v; });
    }));
    box.appendChild(TM6M.ui.fieldBlock('Borg disnea', function (b) {
      TM6M.ui.buildBorgSelector(b, d.borgDisnea, function (v) { d.borgDisnea = v; });
    }));
    box.appendChild(TM6M.ui.fieldBlock('Borg MMII', function (b) {
      TM6M.ui.buildBorgSelector(b, d.borgMmii, function (v) { d.borgMmii = v; });
    }));

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary btn-block';
    confirmBtn.textContent = 'Confirmar y finalizar';
    confirmBtn.addEventListener('click', function () {
      TM6M.state.current.terminoAnticipado = pendingEarlyFinish;
      finishWalk();
    });
    box.appendChild(confirmBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-block';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', function () {
      pendingEarlyFinish = null;
      renderEarlyFinishBox();
    });
    box.appendChild(cancelBtn);
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
    var globalTaps = globalArrowTaps();

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

        var seqForRow = arrowsForMinute(globalTaps, i);
        if (seqForRow.length) {
          var arrowsRow = document.createElement('div');
          arrowsRow.className = 'minute-row-arrows';
          arrowsRow.innerHTML = arrowGlyphsHtml(seqForRow);
          row.appendChild(arrowsRow);
        }

        var body = document.createElement('div');
        body.className = 'minute-row-body';
        if (openRow === i) {
          TM6M.ui.buildFilaFields(body, fila, {
            onManualMetros: function () { manualMetros[i] = true; updateMetersUI(); }
          });

          var doneBtn = document.createElement('button');
          doneBtn.type = 'button';
          doneBtn.className = 'btn btn-primary btn-block';
          doneBtn.textContent = fila.completado ? 'Editado ✓' : (i === 6 ? 'Listo ✓ y pasar a recuperación' : 'Listo ✓');
          doneBtn.addEventListener('click', function () {
            fila.completado = true;
            openRow = null;
            TM6M.ui.vibrate(60);
            renderRows();
            if (i === 6) finishWalk();
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
    updateTimerRing(getElapsedMs());
    updateDirectionBox();
    renderRows();
    renderParadas();
    renderEarlyFinishBox();
  }

  function init() {
    el('btn-lap').addEventListener('click', addLap);
    el('btn-test-parada').addEventListener('click', toggleParada);
    el('btn-test-finish').addEventListener('click', requestEarlyFinish);
  }

  return { init: init, start: start, render: render };
})();
