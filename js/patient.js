window.TM6M = window.TM6M || {};

TM6M.patient = (function () {
  function el(id) { return document.getElementById(id); }
  var bleUnsub = false;

  function render() {
    var t = TM6M.state.current;
    el('p-fecha').value = t.fecha;
    el('p-nombre').value = t.paciente || '';
    el('p-edad').value = t.edad === null ? '' : t.edad;
    el('p-peso').value = t.peso === null ? '' : t.peso;
    el('p-talla').value = t.talla === null ? '' : t.talla;
    el('p-diagnostico').value = t.diagnostico || '';
    el('p-tecnico').value = t.tecnico || '';
    el('p-ta-inicial').value = t.taInicial || '';

    TM6M.ui.buildSegmented(el('p-sexo'), [{ value: 'F', label: 'F' }, { value: 'M', label: 'M' }], t.sexo, function (v) {
      t.sexo = v;
      updateBmi();
    });

    updateBmi();
    renderBasal();
    renderBleHint();

    if (!bleUnsub) {
      bleUnsub = true;
      TM6M.ble.onStatusChange(function () { renderBleHint(); });
    }
  }

  function renderBasal() {
    var t = TM6M.state.current;
    TM6M.ui.buildFilaFields(el('p-basal-fields'), t.filas[0], { showMetros: false });
  }

  function renderBleHint() {
    var box = el('p-ble-hint');
    var st = TM6M.ble.getStatus();
    var reading = TM6M.ble.freshReading();
    if (!st.connected || !reading) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = 'En vivo: ' + (reading.spo2 !== null ? reading.spo2 + '%' : '—') + ' · ' + (reading.pr !== null ? reading.pr + ' lpm' : '—');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = 'Usar';
    btn.addEventListener('click', function () {
      var basal = TM6M.state.current.filas[0];
      basal.spo2 = reading.spo2;
      basal.fc = reading.pr;
      renderBasal();
    });
    box.appendChild(span);
    box.appendChild(btn);
  }

  function updateBmi() {
    var t = TM6M.state.current;
    var b = TM6M.calc.bmi(Number(t.peso), Number(t.talla));
    el('p-bmi-hint').textContent = 'BMI: ' + (b ? b.toFixed(1) : '—');
  }

  function numOrNull(v) {
    v = v.trim();
    return v === '' ? null : Number(v);
  }

  function init() {
    el('p-edad').addEventListener('input', function () { TM6M.state.current.edad = numOrNull(el('p-edad').value); });
    el('p-peso').addEventListener('input', function () { TM6M.state.current.peso = numOrNull(el('p-peso').value); updateBmi(); });
    el('p-talla').addEventListener('input', function () { TM6M.state.current.talla = numOrNull(el('p-talla').value); updateBmi(); });
    el('p-nombre').addEventListener('input', function () { TM6M.state.current.paciente = el('p-nombre').value; });
    el('p-diagnostico').addEventListener('input', function () { TM6M.state.current.diagnostico = el('p-diagnostico').value; });
    el('p-tecnico').addEventListener('input', function () { TM6M.state.current.tecnico = el('p-tecnico').value; });
    el('p-fecha').addEventListener('input', function () { TM6M.state.current.fecha = el('p-fecha').value; });
    el('p-ta-inicial').addEventListener('input', function () { TM6M.state.current.taInicial = el('p-ta-inicial').value; });

    el('patient-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = TM6M.state.current;
      if (!t.paciente) {
        TM6M.ui.toast('Falta el nombre del paciente');
        return;
      }
      var errors = TM6M.calc.validatePatientBasics(t);
      if (errors.length) {
        TM6M.ui.toast(errors[0], 3500);
        return;
      }
      if (!Number.isInteger(Number(t.talla))) {
        if (!confirm('La talla no es un número entero de centímetros. ¿Continuar igual?')) return;
      }
      TM6M.test.start();
    });
  }

  return { init: init, render: render };
})();
