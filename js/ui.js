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

  function buildNumberInput(container, value, onChange, opts) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = opts.decimal ? 'decimal' : 'numeric';
    if (opts.step) input.step = opts.step;
    input.value = (value === null || value === undefined) ? '' : value;
    input.placeholder = opts.placeholder || '';
    input.addEventListener('input', function () {
      var raw = input.value.trim();
      var v = raw === '' ? null : Number(raw);
      if (typeof v === 'number' && isNaN(v)) v = null;
      onChange(v);
    });
    container.appendChild(input);
    return input;
  }

  // Arma "120/80" solo mientras se escribe: al completar la sistólica (3 dígitos si
  // empieza con 1 o 2, si no 2 dígitos) inserta la "/" automáticamente.
  function formatTaDigits(digits, deleting) {
    digits = digits.slice(0, 5);
    if (digits.length === 0) return '';
    var sysLen = (digits[0] === '1' || digits[0] === '2') ? 3 : 2;
    if (digits.length < sysLen) return digits;
    if (digits.length === sysLen) return deleting ? digits : (digits + '/');
    return digits.slice(0, sysLen) + '/' + digits.slice(sysLen);
  }

  function attachTaFormatter(input, onChange) {
    input.inputMode = 'numeric';
    if (!input.placeholder) input.placeholder = '120/80';
    input.addEventListener('input', function (e) {
      var deleting = !!(e.inputType && e.inputType.indexOf('delete') === 0);
      var digits = input.value.replace(/\D/g, '');
      var formatted = formatTaDigits(digits, deleting);
      input.value = formatted;
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
      }, { placeholder: '%' });
    }));
    container.appendChild(fieldBlock('FC (lpm)', function (box) {
      TM6M.ui.buildNumberInput(box, fila.fc, function (v) {
        fila.fc = v;
        if (opts.onManualFc) opts.onManualFc();
      });
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
