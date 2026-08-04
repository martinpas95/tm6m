window.TM6M = window.TM6M || {};

// Genera un PDF real (no depende de window.print()) para poder adjuntarlo por mail o subirlo a Drive.
// Diseño tipo informe clínico profesional, A4, con paginación defensiva por si el contenido
// (paradas, notas, observaciones) no entra en una sola página.
TM6M.pdfgen = (function () {
  var PRIMARY = [11, 110, 120];
  var PRIMARY_DARK = [7, 62, 71];
  var PRIMARY_LIGHT = [228, 241, 243];
  var ACCENT = [23, 167, 152];
  var WARN = [188, 96, 27];
  var DANGER = [193, 45, 45];
  var TEXT = [22, 37, 42];
  var GRAY = [117, 130, 133];
  var LIGHT_GRAY = [214, 224, 225];
  var TILE_BORDER = [203, 221, 223];
  var TILE_FILL = [246, 251, 251];

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
  function fmtDateTime(d) {
    function pad(n) { return String(n).padStart(2, '0'); }
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtCell(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }
  function tileValue(v, unit) { return (v === null || v === undefined) ? '—' : (v + (unit ? (' ' + unit) : '')); }

  function build(t, settings) {
    var c = TM6M.calc;
    var r = c.computeReport(t);
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error('jsPDF no está disponible (sin conexión la primera vez que se usa).');

    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var marginX = 16;
    var marginTop = 14;
    var marginBottom = 12;
    var contentW = pageW - marginX * 2;
    var y = 0;

    function setText(col) { doc.setTextColor(col[0], col[1], col[2]); }
    function setFill(col) { doc.setFillColor(col[0], col[1], col[2]); }
    function setDraw(col) { doc.setDrawColor(col[0], col[1], col[2]); }

    function ensureSpace(h) {
      if (y + h > pageH - marginBottom) {
        doc.addPage();
        y = marginTop;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        setText(GRAY);
        doc.text('Test de Marcha de 6 Minutos — ' + (t.paciente || 'paciente') + ' (continuación)', marginX, y);
        setText(TEXT);
        y += 7;
      }
    }

    function sectionHeading(text) {
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.3);
      setText(PRIMARY);
      doc.text(text.toUpperCase(), marginX, y);
      y += 1.3;
      setDraw(ACCENT);
      doc.setLineWidth(0.9);
      doc.line(marginX, y, marginX + 16, y);
      doc.setLineWidth(0.2);
      setText(TEXT);
      y += 3.8;
    }

    function fieldRowMulti(fields, rowH) {
      rowH = rowH || 8.2;
      var totalWeight = fields.reduce(function (s, f) { return s + (f[2] || 1); }, 0);
      var x = marginX;
      fields.forEach(function (f) {
        var w = contentW * ((f[2] || 1) / totalWeight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.3);
        setText(GRAY);
        doc.text(f[0].toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(f[3] || 10.5);
        setText(TEXT);
        doc.text(fmt(f[1]), x, y + 4.8);
        x += w;
      });
      setText(TEXT);
      y += rowH;
    }

    function fieldRowFull(label, value, size) {
      size = size || 10.5;
      ensureSpace(10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      setText(GRAY);
      doc.text(label.toUpperCase(), marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      setText(TEXT);
      var lineH = size * 0.4 + 0.7;
      var lines = doc.splitTextToSize(fmt(value), contentW);
      doc.text(lines, marginX, y + 4.3);
      setText(TEXT);
      y += 4.3 + lines.length * lineH + 1.2;
    }

    function bulletParagraph(text) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      var wrapW = contentW - 5;
      var lines = doc.splitTextToSize(text, wrapW);
      ensureSpace(lines.length * 4.4 + 2);
      setFill(ACCENT);
      doc.circle(marginX + 1, y - 1.3, 0.8, 'F');
      setText(TEXT);
      doc.text(lines, marginX + 5, y);
      y += lines.length * 4.4 + 2;
    }

    // ---------- Encabezado ----------
    var bandH = 22;
    setFill(PRIMARY);
    doc.rect(0, 0, pageW, bandH, 'F');
    setFill(ACCENT);
    doc.rect(0, bandH, pageW, 1.2, 'F');

    var logoSize = 16;
    var logoX = marginX;
    var logoY = 3;
    var textX = marginX;
    if (window.TM6M.LOGO_DATA_URI) {
      try {
        setFill([255, 255, 255]);
        doc.roundedRect(logoX - 1, logoY - 1, logoSize + 2, logoSize + 2, 1.4, 1.4, 'F');
        doc.addImage(TM6M.LOGO_DATA_URI, 'JPEG', logoX, logoY, logoSize, logoSize);
        textX = marginX + logoSize + 7;
      } catch (e) { /* si falla el logo, el informe se genera igual sin él */ }
    }

    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('TEST DE MARCHA DE 6 MINUTOS', textX, 12.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.text(settings.medico || '', pageW - marginX, 9.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (settings.especialidad) doc.text(settings.especialidad, pageW - marginX, 14, { align: 'right' });
    doc.text(settings.matricula || '', pageW - marginX, 18.2, { align: 'right' });
    setText(TEXT);

    y = bandH + 5;

    // ---------- Datos del paciente ----------
    sectionHeading('Datos del paciente');
    fieldRowMulti([['Paciente', t.paciente, 1.7, 12], ['Fecha', fmtDate(t.fecha), 1]], 9);
    fieldRowMulti([['Edad', fmt(t.edad, 'años')], ['Sexo', t.sexo === 'M' ? 'Masculino' : 'Femenino'], ['Peso', fmt(t.peso, 'kg')], ['Talla', fmt(t.talla, 'cm')]], 8.4);
    fieldRowMulti([['BMI', r.bmi ? r.bmi.toFixed(1) : '—'], ['Técnico', t.tecnico]], 8.4);
    fieldRowFull('Diagnóstico', t.diagnostico);
    y += 1;
    setDraw(LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageW - marginX, y);
    y += 4.5;

    // ---------- Tabla minuto a minuto ----------
    var headers = ['MINUTO', 'SpO2 %', 'FC (lpm)', 'METROS', 'BORG DISNEA', 'BORG MMII'];
    var colWidths = [20, 26, 26, 26, 40, 40];
    var headerH = 7.2;
    var dataRowH = 6.3;
    ensureSpace(headerH + dataRowH * t.filas.length + 6);
    sectionHeading('Registro minuto a minuto');

    var tableX = marginX;
    var tableStartY = y;
    setFill(PRIMARY);
    doc.rect(tableX, y, contentW, headerH, 'F');
    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    var cx = tableX;
    headers.forEach(function (h, idx) {
      doc.text(h, cx + colWidths[idx] / 2, y + headerH / 2 + 1.3, { align: 'center' });
      cx += colWidths[idx];
    });
    y += headerH;
    setText(TEXT);

    t.filas.forEach(function (f, idx) {
      if (idx % 2 === 1) {
        setFill(PRIMARY_LIGHT);
        doc.rect(tableX, y, contentW, dataRowH, 'F');
      }
      var label = f.minuto === 'Basal' ? 'Basal' : String(f.minuto);
      var vals = [label, fmtCell(f.spo2), fmtCell(f.fc), fmtCell(f.metros), fmtCell(f.borgDisnea), fmtCell(f.borgMmii)];
      cx = tableX;
      vals.forEach(function (v, i2) {
        doc.setFont('helvetica', i2 === 0 ? 'bold' : 'normal');
        doc.setFontSize(8.8);
        doc.text(v, cx + colWidths[i2] / 2, y + dataRowH / 2 + 1.3, { align: 'center' });
        cx += colWidths[i2];
      });
      y += dataRowH;
    });

    var tableTotalH = headerH + dataRowH * t.filas.length;
    setDraw(LIGHT_GRAY);
    doc.setLineWidth(0.25);
    doc.rect(tableX, tableStartY, contentW, tableTotalH);
    doc.line(tableX, tableStartY + headerH, tableX + contentW, tableStartY + headerH);
    cx = tableX;
    colWidths.forEach(function (w) { cx += w; doc.line(cx, tableStartY, cx, tableStartY + tableTotalH); });
    y += 6.5;

    // ---------- Resultados ----------
    var statRows = [
      ['Metros recorridos', tileValue(c.isNum(r.metrosTot) ? round1(r.metrosTot) : null, 'm')],
      ['Metros predichos (Enright & Sherrill)', tileValue(r.metrosPred ? Math.round(r.metrosPred) : null, 'm')],
      ['Porcentaje del predicho', tileValue(c.isNum(r.pctMetros) ? r.pctMetros.toFixed(1) : null, '%')],
      ['FC máxima alcanzada', tileValue(r.fcMax, 'lpm')],
      ['Porcentaje FC predicha', tileValue(r.pctFc, '%')],
      ['Saturación mínima', tileValue(r.spo2Min, '%')]
    ];
    var statRowH = 5.9;
    var taRowH = 8.5;
    var boxPad = 2.2;
    var boxH = statRows.length * statRowH + taRowH + boxPad * 2;
    ensureSpace(boxH + 10);
    sectionHeading('Resultados');

    var boxY = y;
    setDraw(TILE_BORDER);
    setFill(TILE_FILL);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, boxY, contentW, boxH, 2, 2, 'FD');
    setFill(PRIMARY);
    doc.rect(marginX, boxY, 2.2, boxH, 'F');

    var ry = boxY + boxPad;
    statRows.forEach(function (row, idx) {
      if (idx % 2 === 1) {
        setFill([255, 255, 255]);
        doc.rect(marginX + 2.2, ry, contentW - 2.2, statRowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(TEXT);
      doc.text(row[0], marginX + 7, ry + statRowH / 2 + 1.4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setText(PRIMARY_DARK);
      doc.text(row[1], marginX + contentW - 5, ry + statRowH / 2 + 1.4, { align: 'right' });
      ry += statRowH;
    });

    setFill(PRIMARY_LIGHT);
    doc.rect(marginX + 2.2, ry, contentW - 2.2, taRowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    setText(GRAY);
    doc.text('TENSIÓN ARTERIAL (inicial / final)', marginX + 7, ry + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setText(PRIMARY_DARK);
    doc.text((t.taInicial || '—') + '   »   ' + (t.taFinal || '—'), marginX + 7, ry + 7);
    if (r.taResp) {
      var pillTxt = r.taResp === 'adecuada' ? 'Respuesta adecuada' :
        (r.taResp === 'hipotensiva' ? 'Hipotensión' : 'Respuesta aplanada');
      var pillCol = r.taResp === 'adecuada' ? ACCENT : (r.taResp === 'hipotensiva' ? DANGER : WARN);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      var pillW = doc.getTextWidth(pillTxt) + 7;
      var pillH = 6;
      var pillX = marginX + contentW - pillW - 4;
      var pillY = ry + (taRowH - pillH) / 2;
      setFill(pillCol);
      doc.roundedRect(pillX, pillY, pillW, pillH, 3.2, 3.2, 'F');
      setText([255, 255, 255]);
      doc.text(pillTxt, pillX + pillW / 2, pillY + pillH / 2 + 1, { align: 'center' });
    }
    setText(TEXT);
    y = boxY + boxH + 6;

    // ---------- Conclusión ----------
    sectionHeading('Conclusión');
    r.conclusionLines.forEach(bulletParagraph);
    if (r.desaturacionLine) bulletParagraph(r.desaturacionLine);
    if (r.taResp === 'hipotensiva') bulletParagraph(r.taRespLine);

    // ---------- Incidencias durante la prueba ----------
    if (r.paradaLines.length || r.terminoAnticipadoLine) {
      y += 2;
      sectionHeading('Incidencias durante la prueba');
      r.paradaLines.forEach(bulletParagraph);
      if (r.terminoAnticipadoLine) bulletParagraph(r.terminoAnticipadoLine);
    }

    // ---------- Observaciones ----------
    var obsLines = [];
    if (t.notas.hipertensivos) obsLines.push('Se registran registros hipertensivos, se sugiere su control.');
    if (t.notas.dificultadSensado) {
      obsLines.push('Se registraron dificultades técnicas para el sensado de SpO2 y FC durante la prueba' +
        (t.notas.dificultadSensadoDetalle ? (' (' + t.notas.dificultadSensadoDetalle + ')') : '') + '.');
    }
    if (t.notas.libre) obsLines.push(t.notas.libre);
    if (obsLines.length) {
      y += 2;
      sectionHeading('Observaciones');
      obsLines.forEach(bulletParagraph);
    }

    // ---------- Pie: nota metodológica y firma ----------
    ensureSpace(26);
    y += 1.5;
    setDraw(LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.3);
    setText(GRAY);
    var oxText = (t.oxigeno && t.oxigeno.suplementario)
      ? ('Estudio realizado con oxígeno suplementario' + (t.oxigeno.detalle ? (' (' + t.oxigeno.detalle + ')') : '') + '.')
      : 'Estudio realizado al aire ambiente (FiO2 0,21%).';
    doc.text(oxText, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.text('Enright PL, Sherrill DL. Am J Respir Crit Care Med. 1998; 158: 1384-1387.', pageW / 2, y, { align: 'center' });
    setText(TEXT);

    y += 4.5;
    ensureSpace(15);
    var sigLineW = 70;
    var sigX = pageW / 2 - sigLineW / 2;
    setDraw(GRAY);
    doc.setLineWidth(0.3);
    doc.line(sigX, y, sigX + sigLineW, y);
    y += 4.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(TEXT);
    doc.text(settings.medico || '', pageW / 2, y, { align: 'center' });
    y += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    setText(GRAY);
    doc.text((settings.especialidad ? (settings.especialidad + ' — ') : '') + (settings.matricula || ''), pageW / 2, y, { align: 'center' });
    setText(TEXT);

    // ---------- Pie de página (todas las páginas) ----------
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      setText(GRAY);
      doc.text('Generado el ' + fmtDateTime(new Date()), marginX, pageH - 8);
      doc.text('Página ' + p + ' de ' + totalPages, pageW - marginX, pageH - 8, { align: 'right' });
      setText(TEXT);
    }

    return doc;
  }

  function filename(t) {
    var safe = (t.paciente || 'paciente').replace(/[^a-z0-9áéíóúñ]+/gi, '_');
    return 'TM6M_' + safe + '_' + (t.fecha || '') + '.pdf';
  }

  return { build: build, filename: filename };
})();
