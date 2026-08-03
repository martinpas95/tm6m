window.TM6M = window.TM6M || {};

// Genera un PDF real (no depende de window.print()) para poder adjuntarlo por mail o subirlo a Drive.
TM6M.pdfgen = (function () {
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
  function fmtCell(v) { return (v === null || v === undefined) ? '' : String(v); }

  function build(t, settings) {
    var c = TM6M.calc;
    var r = c.computeReport(t);
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error('jsPDF no está disponible (sin conexión la primera vez que se usa).');

    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var marginX = 16;
    var y = 18;
    var contentW = pageW - marginX * 2;

    function center(text, size, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(text, pageW / 2, y, { align: 'center' });
      y += size * 0.5;
    }
    function line(y1) {
      doc.setDrawColor(180);
      doc.line(marginX, y1, pageW - marginX, y1);
    }
    function paragraph(text, size) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size || 10);
      var lines = doc.splitTextToSize(text, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * (size || 10) * 0.42 + 1.5;
    }

    if (window.TM6M.LOGO_DATA_URI) {
      try {
        var logoSize = 34;
        doc.addImage(TM6M.LOGO_DATA_URI, 'JPEG', pageW / 2 - logoSize / 2, y - 8, logoSize, logoSize);
        y += logoSize - 12;
      } catch (e) { /* si falla el logo, el informe se genera igual sin él */ }
    }

    center('TEST DE MARCHA DE 6 MINUTOS', 15, true);
    y += 1;
    center(settings.medico + (settings.especialidad ? (' - ' + settings.especialidad) : ''), 11, false);
    y += 1;
    center(settings.matricula, 9, false);
    y += 3;
    line(y);
    y += 6;

    var bmiVal = r.bmi ? r.bmi.toFixed(1) : '—';
    var fieldPairs = [
      ['Fecha', fmtDate(t.fecha)], ['Paciente', t.paciente || '—'],
      ['Edad', fmt(t.edad)], ['Sexo', t.sexo],
      ['Peso', fmt(t.peso, 'kg')], ['Talla', fmt(t.talla, 'cm')],
      ['BMI', bmiVal], ['Técnico', t.tecnico || '—']
    ];
    doc.setFontSize(10);
    var colW = contentW / 2;
    for (var i = 0; i < fieldPairs.length; i += 2) {
      var rowY = y;
      drawField(fieldPairs[i][0], fieldPairs[i][1], marginX, rowY, colW);
      if (fieldPairs[i + 1]) drawField(fieldPairs[i + 1][0], fieldPairs[i + 1][1], marginX + colW, rowY, colW);
      y += 5.5;
    }
    drawField('Diagnóstico', t.diagnostico || '—', marginX, y, contentW);
    y += 8;

    function drawField(label, value, x, yy, w) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      var labelText = label + ':';
      doc.text(labelText, x, yy);
      doc.setFont('helvetica', 'normal');
      var labelW = doc.getTextWidth(labelText) + 1.5;
      doc.text(String(value), x + labelW, yy, { maxWidth: w - labelW });
    }

    // Tabla minuto a minuto
    var headers = ['Minuto', 'SpO2%', 'FC', 'Metros', 'Borg Disnea', 'Borg MMII'];
    var colWidths = [22, 22, 22, 24, 32, 32];
    var tableX = marginX;
    var rowH = 6.5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(228, 241, 243);
    doc.rect(tableX, y, colWidths.reduce(function (a, b) { return a + b; }, 0), rowH, 'F');
    var cx = tableX;
    headers.forEach(function (h, idx) {
      doc.text(h, cx + colWidths[idx] / 2, y + rowH / 2 + 1.3, { align: 'center' });
      cx += colWidths[idx];
    });
    y += rowH;

    doc.setFont('helvetica', 'normal');
    t.filas.forEach(function (f) {
      var label = f.minuto === 'Basal' ? 'Basal' : String(f.minuto);
      var vals = [label, fmtCell(f.spo2), fmtCell(f.fc), fmtCell(f.metros), fmtCell(f.borgDisnea), fmtCell(f.borgMmii)];
      cx = tableX;
      vals.forEach(function (v, idx) {
        doc.text(v, cx + colWidths[idx] / 2, y + rowH / 2 + 1.3, { align: 'center' });
        cx += colWidths[idx];
      });
      y += rowH;
    });
    // borde de la tabla
    doc.setDrawColor(150);
    var tableTotalW = colWidths.reduce(function (a, b) { return a + b; }, 0);
    var tableTop = y - rowH * (t.filas.length + 1);
    doc.rect(tableX, tableTop, tableTotalW, rowH * (t.filas.length + 1));
    cx = tableX;
    colWidths.forEach(function (w) { cx += w; doc.line(cx, tableTop, cx, y); });
    for (var rIdx = 0; rIdx <= t.filas.length + 1; rIdx++) {
      doc.line(tableX, tableTop + rIdx * rowH, tableX + tableTotalW, tableTop + rIdx * rowH);
    }
    y += 6;

    // Resultados
    doc.setFillColor(228, 241, 243);
    var resultsStartY = y;
    var resultLines = [
      ['TA inicial / final', (t.taInicial || '—') + ' / ' + (t.taFinal || '—')],
      ['Total de metros recorridos', fmt(round1(r.metrosTot), 'm')],
      ['Valores predichos', r.metrosPred ? (Math.round(r.metrosPred) + ' m') : '—'],
      ['FC máxima alcanzada', fmt(r.fcMax, 'lpm')],
      ['Saturación mínima', fmt(r.spo2Min, '%')],
      ['Porcentaje FC predicha', fmt(r.pctFc, '%')],
      ['Porcentaje metros predicho', c.isNum(r.pctMetros) ? (r.pctMetros.toFixed(1) + '%') : '—']
    ];
    var boxH = resultLines.length * 5.2 + 4;
    doc.rect(marginX, resultsStartY, contentW, boxH, 'F');
    y = resultsStartY + 6;
    resultLines.forEach(function (rl) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(rl[0], marginX + 2.5, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(rl[1]), pageW - marginX - 2.5, y, { align: 'right' });
      y += 5.2;
    });
    y = resultsStartY + boxH + 6;

    r.conclusionLines.forEach(function (l) { paragraph(l, 10); });
    r.paradaLines.forEach(function (l) { paragraph(l, 10); });
    if (r.terminoAnticipadoLine) paragraph(r.terminoAnticipadoLine, 10);
    if (r.desaturacionLine) paragraph(r.desaturacionLine, 10);
    if (r.taResp) paragraph('Respuesta de TA ' + (r.taResp === 'adecuada' ? 'adecuada' : 'aplanada') + '.', 10);
    if (t.notas.hipertensivos) paragraph('Se registran registros hipertensivos, se sugiere su control.', 10);
    if (t.notas.dificultadSensado) {
      paragraph('Se registraron dificultades técnicas para el sensado de SpO2 y FC durante la prueba' +
        (t.notas.dificultadSensadoDetalle ? (' (' + t.notas.dificultadSensadoDetalle + ')') : '') + '.', 10);
    }
    if (t.notas.libre) paragraph(t.notas.libre, 10);

    y += 3;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(110);
    var oxText = (t.oxigeno && t.oxigeno.suplementario)
      ? ('Estudio realizado con oxígeno suplementario' + (t.oxigeno.detalle ? (' (' + t.oxigeno.detalle + ')') : '') + '.')
      : 'Estudio realizado al aire ambiente (FiO2 0,21%).';
    doc.text(oxText, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.text('AJRCCM 1998; 158: 1384-1387', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(settings.medico + ' — ' + settings.matricula, pageW / 2, y, { align: 'center' });

    return doc;
  }

  function filename(t) {
    var safe = (t.paciente || 'paciente').replace(/[^a-z0-9áéíóúñ]+/gi, '_');
    return 'TM6M_' + safe + '_' + (t.fecha || '') + '.pdf';
  }

  return { build: build, filename: filename };
})();
