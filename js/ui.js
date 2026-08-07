window.TM6M = window.TM6M || {};

TM6M.ui = (function () {
  var viewTitles = {
    home: 'Test de Marcha 6’',
    patient: 'Nuevo paciente',
    test: 'Prueba en curso',
    recovery: 'Recuperación',
    review: 'Revisar datos',
    report: 'Informe',
    settings: 'Ajustes'
  };

  var currentView = 'home';
  var guards = {};
  var toastTimer = null;
  var stepperOrder = ['patient', 'test', 'recovery', 'review', 'report'];

  function el(id) { return document.getElementById(id); }

  function updateStepper(name) {
    var stepper = el('stepper');
    var idx = stepperOrder.indexOf(name);
    stepper.hidden = idx === -1;
    if (idx === -1) return;
    var steps = stepper.querySelectorAll('.stepper-step');
    steps.forEach(function (stepEl, i) {
      stepEl.classList.toggle('active', i === idx);
      stepEl.classList.toggle('done', i < idx);
    });
  }

  function showView(name, opts) {
    opts = opts || {};
    var sections = document.querySelectorAll('.view');
    for (var i = 0; i < sections.length; i++) sections[i].classList.remove('active');
    var target = el('view-' + name);
    if (!target) return;
    target.classList.add('active');
    el('app-bar-title').textContent = viewTitles[name] || 'Test de Marcha 6’';
    el('btn-back').hidden = (name === 'home');
    el('btn-home').hidden = (name === 'home');
    updateStepper(name);
    window.scrollTo(0, 0);
    currentView = name;
    if (!opts.fromPopState) {
      if (opts.replace) history.replaceState({ view: name }, '', '#' + name);
      else history.pushState({ view: name }, '', '#' + name);
    }
  }

  function setLeaveGuard(name, fn) { guards[name] = fn; }

  function goBack() {
    var guard = guards[currentView];
    if (guard && !guard()) return;
    history.back();
  }

  function goHome() {
    if (currentView === 'home') return;
    var guard = guards[currentView];
    if (guard && !guard()) return;
    showView('home');
  }

  window.addEventListener('popstate', function (e) {
    var guard = guards[currentView];
    if (guard && !guard()) {
      history.pushState({ view: currentView }, '', '#' + currentView);
      return;
    }
    var name = (e.state && e.state.view) || 'home';
    showView(name, { fromPopState: true });
  });

  function toast(msg, ms) {
    var t = el('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function fmtTime(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function fieldBlock(label, fill) {
    var wrap = document.createElement('div');
    wrap.className = 'basal-field';
    var lab = document.createElement('p');
    lab.className = 'sub-label';
    lab.textContent = label;
    wrap.appendChild(lab);
    var box = document.createElement('div');
    wrap.appendChild(box);
    fill(box);
    return wrap;
  }

  function buildSegmented(container, options, value, onChange) {
    container.innerHTML = '';
    container.classList.add('segmented');
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      if (opt.value === value) btn.classList.add('selected');
      btn.addEventListener('click', function () {
        var btns = container.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
        btn.classList.add('selected');
        onChange(opt.value);
      });
      container.appendChild(btn);
    });
  }

  function buildBorgSelector(container, value, onChange) {
    container.innerHTML = '';
    container.classList.add('borg-selector');
    for (var i = 0; i <= 10; i++) {
      (function (n) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(n);
        if (value === n) btn.classList.add('selected');
        btn.addEventListener('click', function () {
          var btns = container.querySelectorAll('button');
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove('selected');
          btn.classList.add('selected');
          onChange(n);
        });
        container.appendChild(btn);
      })(i);
    }
  }

  // opts.min/opts.max: rango fisiológico plausible (ej. SpO2 0-100, FC 20-250). No
  // bloquea la carga — solo marca visualmente el campo como fuera de rango para que
  // se note de un vistazo antes de generar el informe.
  function buildNumberInput(container, value, onChange, opts) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = opts.decimal ? 'decimal' : 'numeric';
    if (opts.step) input.step = opts.step;
    if (opts.min !== undefined) input.min = opts.min;
    if (opts.max !== undefined) input.max = opts.max;
    input.value = (value === null || value === undefined) ? '' : value;
    input.placeholder = opts.placeholder || '';
    function markRange(v) {
      var fuera = v !== null && ((opts.min !== undefined && v < opts.min) || (opts.max !== undefined && v > opts.max));
      input.classList.toggle('out-of-range', fuera);
    }
    markRange(value === null || value === undefined ? null : value);
    input.addEventListener('input', function () {
      var raw = input.value.trim();
      var v = raw === '' ? null : Number(raw);
      if (typeof v === 'number' && isNaN(v)) v = null;
      markRange(v);
      onChange(v);
    });
    container.appendChild(input);
    return input;
  }

  // Arma "120/80" solo mientras se escribe: al completar la sistólica (3 dígitos si
  // empieza con 1 o 2, si no 2 dígitos) inserta la "/" automáticamente. La diastólica
  // acepta hasta 3 dígitos (ej. 150/100), sin importar cuántos tenga la sistólica.
  function formatTaDigits(digits, deleting) {
    var sysLen = (digits[0] === '1' || digits[0] === '2') ? 3 : 2;
    digits = digits.slice(0, sysLen + 3);
    if (digits.length === 0) return '';
    if (digits.length < sysLen) return digits;
    if (digits.length === sysLen) return deleting ? digits : (digits + '/');
    return digits.slice(0, sysLen) + '/' + digits.slice(sysLen);
  }

  function markTaRange(input, formatted) {
    var ta = TM6M.calc.parseTa(formatted);
    input.classList.toggle('out-of-range', !!ta && !TM6M.calc.isTaPlausible(ta));
  }

  function attachTaFormatter(input, onChange) {
    input.inputMode = 'numeric';
    if (!input.placeholder) input.placeholder = '120/80';
    markTaRange(input, input.value);
    input.addEventListener('input', function (e) {
      var deleting = !!(e.inputType && e.inputType.indexOf('delete') === 0);
      var digits = input.value.replace(/\D/g, '');
      var formatted = formatTaDigits(digits, deleting);
      input.value = formatted;
      markTaRange(input, formatted);
      onChange(formatted);
    });
    return input;
  }

  function buildTaInput(container, initialValue, onChange) {
    var input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue || '';
    attachTaFormatter(input, onChange);
    container.appendChild(input);
    return input;
  }

  function buildFilaFields(container, fila, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container.appendChild(fieldBlock('SpO2 %', function (box) {
      TM6M.ui.buildNumberInput(box, fila.spo2, function (v) {
        fila.spo2 = v;
        if (opts.onManualSpo2) opts.onManualSpo2();
      }, { placeholder: '%', min: TM6M.calc.LIMITES.spo2Min, max: TM6M.calc.LIMITES.spo2Max });
    }));
    container.appendChild(fieldBlock('FC (lpm)', function (box) {
      TM6M.ui.buildNumberInput(box, fila.fc, function (v) {
        fila.fc = v;
        if (opts.onManualFc) opts.onManualFc();
      }, { min: TM6M.calc.LIMITES.fcMin, max: TM6M.calc.LIMITES.fcMax });
    }));
    if (opts.showMetros !== false) {
      container.appendChild(fieldBlock('Metros', function (box) {
        TM6M.ui.buildNumberInput(box, fila.metros, function (v) {
          fila.metros = v;
          if (opts.onManualMetros) opts.onManualMetros();
        });
      }));
    }
    container.appendChild(fieldBlock('Borg disnea', function (box) {
      TM6M.ui.buildBorgSelector(box, fila.borgDisnea, function (v) { fila.borgDisnea = v; });
    }));
    container.appendChild(fieldBlock('Borg MMII', function (box) {
      TM6M.ui.buildBorgSelector(box, fila.borgMmii, function (v) { fila.borgMmii = v; });
    }));
  }

  return {
    showView: showView,
    setLeaveGuard: setLeaveGuard,
    goBack: goBack,
    goHome: goHome,
    toast: toast,
    vibrate: vibrate,
    fmtTime: fmtTime,
    fieldBlock: fieldBlock,
    buildSegmented: buildSegmented,
    buildBorgSelector: buildBorgSelector,
    buildNumberInput: buildNumberInput,
    buildFilaFields: buildFilaFields,
    formatTaDigits: formatTaDigits,
    attachTaFormatter: attachTaFormatter,
    buildTaInput: buildTaInput
  };
})();
