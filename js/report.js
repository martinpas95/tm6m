window.TM6M = window.TM6M || {};

TM6M.report = (function () {
  function el(id) { return document.getElementById(id); }

  function fmt(v, suffix) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) return '—';
    return suffix ? (v + ' ' + suffix) : String(v);
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtCell(v) { return (v === null || v === undefined) ? '' : v; }

  function fieldLine(label, value, full) {
    var d = document.createElement('div');
    if (full) d.className = 'full';
    d.innerHTML = '<strong>' + label + ':</strong> ' + escapeHtml(String(value));
    return d;
  }

  function resultLine(label, value) {
    var d = document.createElement('div');
    var l = document.createElement('span');
    l.textContent = label;
    var v = document.createElement('strong');
    v.textContent = value;
    d.appendChild(l);
    d.appendChild(v);
    return d;
  }

  function buildTable(t) {
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Minuto</th><th>SpO2%</th><th>FC</th><th>Metros</th><th>Borg Disnea</th><th>Borg MMII</th></tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    t.filas.forEach(function (f) {
      var tr = document.createElement('tr');
      var label = f.minuto === 'Basal' ? 'Basal' : f.minuto;
      tr.innerHTML = '<td>' + label + '</td><td>' + fmtCell(f.spo2) + '</td><td>' + fmtCell(f.fc) + '</td><td>' + fmtCell(f.metros) + '</td><td>' + fmtCell(f.borgDisnea) + '</td><td>' + fmtCell(f.borgMmii) + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function render() {
    var t = TM6M.state.current;
    var s = TM6M.storage.loadSettings();
    var c = TM6M.calc;

    var metrosTot = c.metrosTotales(t.filas);
    var metrosPred = c.metrosPredichos(t.sexo, Number(t.talla), Number(t.edad), Number(t.peso));
    var fcMax = c.fcMaxima(t.filas);
    var pctFc = c.pctFcPredicha(fcMax, Number(t.edad));
    var pctMetros = c.pctMetrosPredicho(metrosTot, metrosPred);
    var bmiVal = c.bmi(Number(t.peso), Number(t.talla));
    var finalFila = t.filas[6];

    var conclusionLines = c.buildConclusion({
      pctFc: pctFc,
      metrosTot: metrosTot,
      pctMetros: pctMetros,
      borgDFinal: finalFila.borgDisnea,
      borgMFinal: finalFila.borgMmii,
      recuperaSatMin: t.recuperacion.recuperaSatEnMin,
      recuperaFcMin: t.recuperacion.recuperaFcEnMin,
      fcAlMinuto: t.recuperacion.fcAlMinuto
    });

    var sheet = el('report-sheet');
    sheet.innerHTML = '';

    var h2 = document.createElement('h2');
    h2.textContent = 'TEST DE MARCHA DE 6 MINUTOS';
    sheet.appendChild(h2);

    var doc = document.createElement('p');
    doc.className = 'report-doctor';
    doc.textContent = s.medico + (s.especialidad ? (' - ' + s.especialidad) : '');
    sheet.appendChild(doc);

    var lic = document.createElement('p');
    lic.className = 'report-license';
    lic.textContent = s.matricula;
    sheet.appendChild(lic);

    var fields = document.createElement('div');
    fields.className = 'report-fields';
    fields.appendChild(fieldLine('Fecha', fmtDate(t.fecha)));
    fields.appendChild(fieldLine('Paciente', t.paciente || '—'));
    fields.appendChild(fieldLine('Edad', fmt(t.edad)));
    fields.appendChild(fieldLine('Sexo', t.sexo));
    fields.appendChild(fieldLine('Peso', fmt(t.peso, 'kg')));
    fields.appendChild(fieldLine('Talla', fmt(t.talla, 'cm')));
    fields.appendChild(fieldLine('BMI', bmiVal ? bmiVal.toFixed(1) : '—'));
    fields.appendChild(fieldLine('Técnico', t.tecnico || '—'));
    fields.appendChild(fieldLine('Diagnóstico', t.diagnostico || '—', true));
    sheet.appendChild(fields);

    sheet.appendChild(buildTable(t));

    var results = document.createElement('div');
    results.className = 'report-results';
    results.appendChild(resultLine('TA inicial / final', (t.taInicial || '—') + ' / ' + (t.taFinal || '—')));
    results.appendChild(resultLine('Total de metros recorridos', fmt(round1(metrosTot), 'm')));
    results.appendChild(resultLine('Valores predichos', metrosPred ? (Math.round(metrosPred) + ' m') : '—'));
    results.appendChild(resultLine('FC máxima alcanzada', fmt(fcMax, 'lpm')));
    results.appendChild(resultLine('Porcentaje FC predicha', fmt(pctFc, '%')));
    results.appendChild(resultLine('Porcentaje metros predicho', c.isNum(pctMetros) ? (pctMetros.toFixed(1) + '%') : '—'));
    sheet.appendChild(results);

    var conclusion = document.createElement('div');
    conclusion.className = 'report-conclusion';
    conclusionLines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      conclusion.appendChild(p);
    });
    if (t.notas.taAplanada) {
      var pTa = document.createElement('p');
      pTa.textContent = 'Respuesta de TA aplanada.';
      conclusion.appendChild(pTa);
    }
    if (t.notas.libre) {
      var pLibre = document.createElement('p');
      pLibre.textContent = t.notas.libre;
      conclusion.appendChild(pLibre);
    }
    sheet.appendChild(conclusion);

    var foot = document.createElement('p');
    foot.className = 'report-footnote';
    foot.innerHTML = 'Estudio realizado al aire ambiente (FiO&#8322; 0,21%).<br>AJRCCM 1998; 158: 1384-1387';
    sheet.appendChild(foot);

    var sig = document.createElement('p');
    sig.className = 'report-signature';
    sig.textContent = s.medico + ' — ' + s.matricula;
    sheet.appendChild(sig);
  }

  function save() {
    var t = TM6M.state.current;
    t.finalizado = true;
    TM6M.storage.upsertTest(t);
    TM6M.ui.toast('Informe guardado');
  }

  function print() {
    window.print();
  }

  function init() {
    el('btn-report-print').addEventListener('click', print);
    el('btn-report-save').addEventListener('click', save);
    el('btn-report-edit').addEventListener('click', function () {
      TM6M.review.render();
      TM6M.ui.showView('review');
    });
  }

  return { init: init, render: render, save: save };
})();
