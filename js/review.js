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
      grid.appendChild(gridField('TA inicial', function (box) {
        textInput(box, t.taInicial, function (v) { t.taInicial = v; });
      }));
      grid.appendChild(gridField('TA final', function (box) {
        textInput(box, t.taFinal, function (v) { t.taFinal = v; });
      }));

      c.appendChild(grid);
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
      cb.checked = !!t.notas.taAplanada;
      cb.addEventListener('change', function () { t.notas.taAplanada = cb.checked; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode('Respuesta de TA aplanada'));
      c.appendChild(label);

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
      TM6M.report.render();
      TM6M.ui.showView('report');
    });
  }

  return { init: init, render: render };
})();
