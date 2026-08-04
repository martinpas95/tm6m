window.TM6M = window.TM6M || {};

TM6M.review = (function () {
  function el(id) { return document.getElementById(id); }

  function render() {
    var t = TM6M.state.current;
    var root = el('review-content');
    root.innerHTML = '';

    root.appendChild(patientCard(t));
    for (var i = 0; i <= 6; i++) root.appendChild(filaCard(t, i));
    root.appendChild(postCard(t));
    if (t.paradas && t.paradas.length) root.appendChild(paradasCard(t));
    if (t.terminoAnticipado) root.appendChild(terminoCard(t));
    root.appendChild(oxigenoCard(t));
    root.appendChild(notesCard(t));
  }

  function card(titleText, buildFn) {
    var c = document.createElement('div');
    c.className = 'card';
    var h = document.createElement('p');
    h.className = 'section-label';
    h.textContent = titleText;
    c.appendChild(h);
    buildFn(c);
    return c;
  }

  function gridField(label, fill, full) {
    var wrap = document.createElement('label');
    if (full) wrap.className = 'full';
    var span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    var box = document.createElement('div');
    wrap.appendChild(box);
    fill(box);
    return wrap;
  }

  function textInput(box, value, onChange) {
    var i = document.createElement('input');
    i.type = 'text';
    i.value = value || '';
    i.addEventListener('input', function () { onChange(i.value); });
    box.appendChild(i);
    return i;
  }

  function patientCard(t) {
    return card('Datos del paciente', function (c) {
      var grid = document.createElement('div');
      grid.className = 'field-grid';

      grid.appendChild(gridField('Fecha', function (box) {
        var i = document.createElement('input');
        i.type = 'date';
        i.value = t.fecha;
        i.addEventListener('input', function () { t.fecha = i.value; });
        box.appendChild(i);
      }, true));

      grid.appendChild(gridField('Paciente', function (box) {
        textInput(box, t.paciente, function (v) { t.paciente = v; });
      }, true));

      grid.appendChild(gridField('Edad', function (box) {
        TM6M.ui.buildNumberInput(box, t.edad, function (v) { t.edad = v; });
      }));
      grid.appendChild(gridField('Sexo', function (box) {
        TM6M.ui.buildSegmented(box, [{ value: 'F', label: 'F' }, { value: 'M', label: 'M' }], t.sexo, function (v) { t.sexo = v; });
      }));
      grid.appendChild(gridField('Peso (kg)', function (box) {
        TM6M.ui.buildNumberInput(box, t.peso, function (v) { t.peso = v; }, { decimal: true, step: '0.1' });
      }));
      grid.appendChild(gridField('Talla (cm)', function (box) {
        TM6M.ui.buildNumberInput(box, t.talla, function (v) { t.talla = v; });
      }));
      grid.appendChild(gridField('Diagnóstico', function (box) {
        textInput(box, t.diagnostico, function (v) { t.diagnostico = v; });
      }, true));
      grid.appendChild(gridField('Técnico', function (box) {
        textInput(box, t.tecnico, function (v) { t.tecnico = v; });
      }, true));
      var taRespHint = document.createElement('p');
      taRespHint.className = 'hint ta-resp-hint full';

      function refreshTaResp() {
        var resp = TM6M.calc.classifyTaResponse(t.taInicial, t.taFinal);
        if (!resp) { taRespHint.textContent = 'Respuesta de TA: completá TA inicial y final (ej: 120/80) para calcularla sola.'; }
        else {
          var label = resp === 'adecuada' ? 'Adecuada' : (resp === 'hipotensiva' ? 'Hipotensiva (se sugiere control)' : 'Aplanada');
          taRespHint.textContent = 'Respuesta de TA calculada: ' + label + '.';
        }
      }

      grid.appendChild(gridField('TA inicial', function (box) {
        TM6M.ui.buildTaInput(box, t.taInicial, function (v) { t.taInicial = v; refreshTaResp(); });
      }));
      grid.appendChild(gridField('TA final', function (box) {
        TM6M.ui.buildTaInput(box, t.taFinal, function (v) { t.taFinal = v; refreshTaResp(); });
      }));
      grid.appendChild(taRespHint);
      refreshTaResp();

      c.appendChild(grid);
    });
  }

  function paradasCard(t) {
    return card('Paradas durante la caminata', function (c) {
      t.paradas.forEach(function (p, idx) {
        var row = document.createElement('div');
        row.className = 'parada-review-row';
        var title = document.createElement('p');
        title.className = 'sub-label';
        title.textContent = 'Parada ' + (idx + 1) + ': minuto ' + TM6M.calc.fmtMinSec(p.inicioSec) + (TM6M.calc.isNum(p.finSec) ? (' – ' + TM6M.calc.fmtMinSec(p.finSec)) : ' (sin retomar)');
        row.appendChild(title);
        var box = document.createElement('div');
        box.appendChild(TM6M.ui.fieldBlock('SpO2 %', function (b) {
          TM6M.ui.buildNumberInput(b, p.spo2 === undefined ? null : p.spo2, function (v) { p.spo2 = v; }, { placeholder: '%' });
        }));
        box.appendChild(TM6M.ui.fieldBlock('FC (lpm)', function (b) {
          TM6M.ui.buildNumberInput(b, p.fc === undefined ? null : p.fc, function (v) { p.fc = v; });
        }));
        box.appendChild(TM6M.ui.fieldBlock('Borg disnea', function (b) {
          TM6M.ui.buildBorgSelector(b, p.borgDisnea, function (v) { p.borgDisnea = v; });
        }));
        box.appendChild(TM6M.ui.fieldBlock('Borg MMII', function (b) {
          TM6M.ui.buildBorgSelector(b, p.borgMmii, function (v) { p.borgMmii = v; });
        }));
        row.appendChild(box);
        c.appendChild(row);
      });
    });
  }

  function terminoCard(t) {
    return card('Finalización antes de tiempo', function (c) {
      var d = t.terminoAnticipado;
      var title = document.createElement('p');
      title.className = 'sub-label';
      title.textContent = 'Se detuvo en el minuto ' + TM6M.calc.fmtMinSec(d.sec);
      c.appendChild(title);
      var box = document.createElement('div');
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
      c.appendChild(box);
    });
  }

  function oxigenoCard(t) {
    return card('Oxígeno durante la prueba', function (c) {
      var label = document.createElement('label');
      label.className = 'checkbox-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!t.oxigeno.suplementario;
      var detalleWrap = document.createElement('div');

      function renderDetalle() {
        detalleWrap.innerHTML = '';
        if (!t.oxigeno.suplementario) return;
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'ej: 2 L/min por cánula nasal';
        input.value = t.oxigeno.detalle || '';
        input.addEventListener('input', function () { t.oxigeno.detalle = input.value; });
        detalleWrap.appendChild(input);
      }

      cb.addEventListener('change', function () {
        t.oxigeno.suplementario = cb.checked;
        renderDetalle();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode('Prueba realizada con oxígeno suplementario (por defecto es al aire ambiente, FiO₂ 0,21%)'));
      c.appendChild(label);
      c.appendChild(detalleWrap);
      renderDetalle();
    });
  }

  function filaCard(t, i) {
    var fila = t.filas[i];
    var title = i === 0 ? 'Basal' : ('Minuto ' + i);
    return card(title, function (c) {
      var box = document.createElement('div');
      TM6M.ui.buildFilaFields(box, fila, { showMetros: i !== 0 });
      c.appendChild(box);
    });
  }

  function postCard(t) {
    return card('Recuperación', function (c) {
      var grid = document.createElement('div');
      grid.className = 'field-grid';
      grid.appendChild(gridField('FC al minuto de finalizar', function (box) {
        TM6M.ui.buildNumberInput(box, t.recuperacion.fcAlMinuto, function (v) { t.recuperacion.fcAlMinuto = v; });
      }));
      grid.appendChild(gridField('Recupera FC en (min)', function (box) {
        TM6M.ui.buildNumberInput(box, t.recuperacion.recuperaFcEnMin, function (v) { t.recuperacion.recuperaFcEnMin = v; }, { decimal: true, step: '0.1' });
      }));
      grid.appendChild(gridField('Recupera Sat en (min)', function (box) {
        TM6M.ui.buildNumberInput(box, t.recuperacion.recuperaSatEnMin, function (v) { t.recuperacion.recuperaSatEnMin = v; }, { decimal: true, step: '0.1' });
      }));
      c.appendChild(grid);
    });
  }

  function notesCard(t) {
    return card('Notas', function (c) {
      var label = document.createElement('label');
      label.className = 'checkbox-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!t.notas.hipertensivos;
      cb.addEventListener('change', function () { t.notas.hipertensivos = cb.checked; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode('Se registraron picos hipertensivos durante la prueba'));
      c.appendChild(label);

      var label2 = document.createElement('label');
      label2.className = 'checkbox-label';
      var cb2 = document.createElement('input');
      cb2.type = 'checkbox';
      cb2.checked = !!t.notas.dificultadSensado;
      var detalleWrap2 = document.createElement('div');

      function renderDetalle2() {
        detalleWrap2.innerHTML = '';
        if (!t.notas.dificultadSensado) return;
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'ej: esclerodactilia, uñas pintadas, mala perfusión periférica';
        input.value = t.notas.dificultadSensadoDetalle || '';
        input.addEventListener('input', function () { t.notas.dificultadSensadoDetalle = input.value; });
        detalleWrap2.appendChild(input);
      }

      cb2.addEventListener('change', function () {
        t.notas.dificultadSensado = cb2.checked;
        renderDetalle2();
      });
      label2.appendChild(cb2);
      label2.appendChild(document.createTextNode('Hubo dificultad para sensar SpO2/FC durante la prueba'));
      c.appendChild(label2);
      c.appendChild(detalleWrap2);
      renderDetalle2();

      var ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'Observaciones adicionales (opcional)';
      ta.value = t.notas.libre || '';
      ta.addEventListener('input', function () { t.notas.libre = ta.value; });
      c.appendChild(ta);
    });
  }

  function init() {
    el('btn-review-generate').addEventListener('click', function () {
      var errors = TM6M.calc.validatePatientBasics(TM6M.state.current);
      if (errors.length) {
        TM6M.ui.toast(errors[0], 3500);
        return;
      }
      TM6M.report.render();
      TM6M.ui.showView('report');
    });
  }

  return { init: init, render: render };
})();
