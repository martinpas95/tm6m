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
    d.className = full ? 'report-field full' : 'report-field';
    var l = document.createElement('strong');
    l.textContent = label + ': ';
    var v = document.createElement('span');
    v.textContent = String(value);
    d.appendChild(l);
    d.appendChild(v);
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
    var r = c.computeReport(t);
    var metrosTot = r.metrosTot, metrosPred = r.metrosPred, fcMax = r.fcMax, pctFc = r.pctFc,
      pctMetros = r.pctMetros, bmiVal = r.bmi, conclusionLines = r.conclusionLines;

    var sheet = el('report-sheet');
    sheet.innerHTML = '';

    if (TM6M.LOGO_DATA_URI) {
      var logo = document.createElement('img');
      logo.src = TM6M.LOGO_DATA_URI;
      logo.alt = 'Sanatorio Finochietto';
      logo.className = 'report-logo';
      sheet.appendChild(logo);
    }

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

    var paradaLines = r.paradaLines;
    var taResp = r.taResp;

    var conclusion = document.createElement('div');
    conclusion.className = 'report-conclusion';
    conclusionLines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      conclusion.appendChild(p);
    });
    paradaLines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      conclusion.appendChild(p);
    });
    if (r.terminoAnticipadoLine) {
      var pTermino = document.createElement('p');
      pTermino.textContent = r.terminoAnticipadoLine;
      conclusion.appendChild(pTermino);
    }
    if (taResp) {
      var pTa = document.createElement('p');
      pTa.textContent = 'Respuesta de TA ' + (taResp === 'adecuada' ? 'adecuada' : 'aplanada') + '.';
      conclusion.appendChild(pTa);
    }
    if (t.notas.hipertensivos) {
      var pHiper = document.createElement('p');
      pHiper.textContent = 'Se registran registros hipertensivos, se sugiere su control.';
      conclusion.appendChild(pHiper);
    }
    if (t.notas.dificultadSensado) {
      var pSensado = document.createElement('p');
      pSensado.textContent = 'Se registraron dificultades técnicas para el sensado de SpO2 y FC durante la prueba' +
        (t.notas.dificultadSensadoDetalle ? (' (' + t.notas.dificultadSensadoDetalle + ')') : '') + '.';
      conclusion.appendChild(pSensado);
    }
    if (t.notas.libre) {
      var pLibre = document.createElement('p');
      pLibre.textContent = t.notas.libre;
      conclusion.appendChild(pLibre);
    }
    sheet.appendChild(conclusion);

    var foot = document.createElement('p');
    foot.className = 'report-footnote';
    var oxText = (t.oxigeno && t.oxigeno.suplementario)
      ? ('Estudio realizado con oxígeno suplementario' + (t.oxigeno.detalle ? (' (' + escapeHtml(t.oxigeno.detalle) + ')') : '') + '.')
      : 'Estudio realizado al aire ambiente (FiO&#8322; 0,21%).';
    foot.innerHTML = oxText + '<br>AJRCCM 1998; 158: 1384-1387';
    sheet.appendChild(foot);

    var sig = document.createElement('p');
    sig.className = 'report-signature';
    sig.textContent = s.medico + ' — ' + s.matricula;
    sheet.appendChild(sig);

    el('r-paciente-email').value = t.pacienteEmail || '';
    el('report-mail-status').textContent = '';
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

  function downloadPdf() {
    try {
      var t = TM6M.state.current;
      var s = TM6M.storage.loadSettings();
      var doc = TM6M.pdfgen.build(t, s);
      doc.save(TM6M.pdfgen.filename(t));
    } catch (err) {
      TM6M.ui.toast('No se pudo generar el PDF: ' + err.message, 4000);
    }
  }

  function sendMail() {
    var t = TM6M.state.current;
    var s = TM6M.storage.loadSettings();
    var email = el('r-paciente-email').value.trim();
    var statusEl = el('report-mail-status');
    t.pacienteEmail = email;

    if (!email) { TM6M.ui.toast('Ingresá el email del paciente'); return; }
    if (!s.googleClientId) {
      statusEl.textContent = 'Falta configurar Google en Ajustes antes de poder enviar mails.';
      TM6M.ui.toast('Configurá la conexión con Google en Ajustes primero', 3500);
      return;
    }

    var btn = el('btn-report-mail');
    btn.disabled = true;
    statusEl.textContent = 'Generando PDF y conectando con Google…';

    var pdfBlob;
    Promise.resolve().then(function () {
      var doc = TM6M.pdfgen.build(t, s);
      pdfBlob = doc.output('blob');
      return TM6M.google.sendMailWithAttachment({
        to: email,
        subject: 'Test de caminata',
        body: '',
        filename: TM6M.pdfgen.filename(t),
        blob: pdfBlob
      });
    }).then(function () {
      // El mail ya salió bien. Guardar en Drive es un paso aparte: si falla (ej. la
      // Google Drive API no está habilitada en Cloud Console), no hay que dar a entender
      // que el envío del mail falló, porque no fue así.
      TM6M.ui.toast('Mail enviado');
      statusEl.textContent = 'Mail enviado a ' + email + '. Guardando copia en Drive…';
      return TM6M.google.uploadToDrive({ filename: TM6M.pdfgen.filename(t), blob: pdfBlob })
        .then(function () {
          statusEl.textContent = 'Mail enviado a ' + email + ' y copia guardada en tu Drive.';
        })
        .catch(function (driveErr) {
          statusEl.textContent = 'Mail enviado a ' + email + '. No se pudo guardar la copia en Drive: ' +
            (driveErr && driveErr.message ? driveErr.message : 'error desconocido') +
            ' (revisá que la Google Drive API esté habilitada en Cloud Console).';
        });
    }).catch(function (err) {
      statusEl.textContent = 'No se pudo enviar el mail: ' + (err && err.message ? err.message : 'error desconocido');
      TM6M.ui.toast('No se pudo enviar el mail', 4000);
    }).finally(function () {
      btn.disabled = false;
    });
  }

  function init() {
    el('btn-report-print').addEventListener('click', print);
    el('btn-report-pdf').addEventListener('click', downloadPdf);
    el('btn-report-save').addEventListener('click', save);
    el('btn-report-mail').addEventListener('click', sendMail);
    el('btn-report-new').addEventListener('click', function () { TM6M.home.startNewTest(); });
    el('r-paciente-email').addEventListener('input', function () {
      TM6M.state.current.pacienteEmail = el('r-paciente-email').value;
    });
    el('btn-report-edit').addEventListener('click', function () {
      TM6M.review.render();
      TM6M.ui.showView('review');
    });
  }

  return { init: init, render: render, save: save };
})();
