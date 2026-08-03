window.TM6M = window.TM6M || {};

TM6M.calc = (function () {

  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  function numOrZero(v) { return isNum(v) ? v : 0; }

  // Enright & Sherrill, AJRCCM 1998;158:1384-87
  function metrosPredichos(sexo, tallaCm, edad, pesoKg) {
    if (!isNum(tallaCm) || !isNum(edad) || !isNum(pesoKg)) return null;
    if (sexo === 'M') {
      return 7.57 * tallaCm - 5.02 * edad - 1.76 * pesoKg - 309;
    }
    return 2.11 * tallaCm - 2.29 * pesoKg - 5.78 * edad + 667;
  }

  function bmi(pesoKg, tallaCm) {
    if (!isNum(pesoKg) || !isNum(tallaCm) || tallaCm === 0) return null;
    var t = tallaCm / 100;
    return pesoKg / (t * t);
  }

  function metrosTotales(filas) {
    return filas.reduce(function (sum, f) { return sum + numOrZero(f.metros); }, 0);
  }

  function fcMaxima(filas) {
    var vals = filas.map(function (f) { return f.fc; }).filter(isNum);
    if (!vals.length) return null;
    return Math.max.apply(null, vals);
  }

  // Tanaka et al. — FC máxima teórica
  function fcMaximaTeorica(edad) {
    if (!isNum(edad)) return null;
    return 208 - 0.7 * edad;
  }

  function pctFcPredicha(fcMax, edad) {
    var teorica = fcMaximaTeorica(edad);
    if (!isNum(fcMax) || !teorica) return null;
    return Math.round(fcMax * 100 / teorica);
  }

  function pctMetrosPredicho(metrosTot, metrosPred) {
    if (!isNum(metrosTot) || !metrosPred) return null;
    return metrosTot * 100 / metrosPred;
  }

  function fmtOrDash(v) { return isNum(v) ? v : '-'; }

  function fmtMinSec(sec) {
    if (!isNum(sec)) return '—';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function buildParadaLines(paradas) {
    if (!paradas || !paradas.length) return [];
    return paradas.filter(function (p) { return isNum(p.inicioSec) && isNum(p.finSec); }).map(function (p) {
      return 'Detiene la caminata en el minuto ' + fmtMinSec(p.inicioSec) + ' por disnea de ' + fmtOrDash(p.borgDisnea) +
        ' y de MMII de ' + fmtOrDash(p.borgMmii) + '. Retoma en el minuto ' + fmtMinSec(p.finSec) + '.';
    });
  }

  // "120/80" -> {sys:120, dia:80}
  function parseTa(str) {
    if (!str) return null;
    var m = String(str).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (!m) return null;
    return { sys: Number(m[1]), dia: Number(m[2]) };
  }

  // Respuesta tensional al ejercicio: adecuada (PAS +10 a +30 mmHg) vs aplanada (PAS sube <10 mmHg)
  function classifyTaResponse(taInicial, taFinal) {
    var ini = parseTa(taInicial);
    var fin = parseTa(taFinal);
    if (!ini || !fin) return null;
    var deltaSys = fin.sys - ini.sys;
    return deltaSys < 10 ? 'aplanada' : 'adecuada';
  }

  var LIMITES = {
    edadMin: 1, edadMax: 120,
    pesoMin: 20, pesoMax: 300,
    tallaMin: 100, tallaMax: 250
  };

  function validatePatientBasics(t) {
    var errors = [];
    if (!isNum(t.edad) || t.edad < LIMITES.edadMin || t.edad > LIMITES.edadMax) {
      errors.push('La edad tiene que estar entre ' + LIMITES.edadMin + ' y ' + LIMITES.edadMax + ' años.');
    }
    if (!isNum(t.peso) || t.peso < LIMITES.pesoMin || t.peso > LIMITES.pesoMax) {
      errors.push('El peso tiene que estar entre ' + LIMITES.pesoMin + ' y ' + LIMITES.pesoMax + ' kg.');
    }
    if (!isNum(t.talla) || t.talla < LIMITES.tallaMin || t.talla > LIMITES.tallaMax) {
      errors.push('La talla tiene que estar entre ' + LIMITES.tallaMin + ' y ' + LIMITES.tallaMax + ' cm.');
    }
    return errors;
  }

  function buildConclusion(ctx) {
    var lines = [];

    var l1 = 'Prueba submáxima.';
    if (isNum(ctx.pctFc)) l1 += ' Alcanza el ' + ctx.pctFc + '% de su FC máxima predicha.';
    lines.push(l1);

    if (isNum(ctx.metrosTot)) {
      var l2 = 'Recorre ' + ctx.metrosTot + ' metros';
      l2 += isNum(ctx.pctMetros) ? (', que corresponden al ' + Math.round(ctx.pctMetros) + '% de su teórico.') : '.';
      lines.push(l2);
    }

    if (isNum(ctx.borgDFinal) || isNum(ctx.borgMFinal)) {
      lines.push('Finaliza con BORG de disnea de ' + fmtOrDash(ctx.borgDFinal) + ' y de MMII de ' + fmtOrDash(ctx.borgMFinal) + '.');
    }

    if (isNum(ctx.recuperaSatMin) || isNum(ctx.recuperaFcMin)) {
      lines.push('Recupera saturación inicial a los ' + fmtOrDash(ctx.recuperaSatMin) + ' min y FC a los ' + fmtOrDash(ctx.recuperaFcMin) + ' min.');
    }

    if (isNum(ctx.fcAlMinuto)) {
      lines.push('Fc al minuto al finalizar ' + ctx.fcAlMinuto + '.');
    }

    return lines;
  }

  function computeReport(t) {
    var metrosTot = metrosTotales(t.filas);
    var metrosPred = metrosPredichos(t.sexo, Number(t.talla), Number(t.edad), Number(t.peso));
    var fcMax = fcMaxima(t.filas);
    var pctFc = pctFcPredicha(fcMax, Number(t.edad));
    var pctMetros = pctMetrosPredicho(metrosTot, metrosPred);
    var bmiVal = bmi(Number(t.peso), Number(t.talla));
    var finalFila = t.filas[6];

    var conclusionLines = buildConclusion({
      pctFc: pctFc,
      metrosTot: metrosTot,
      pctMetros: pctMetros,
      borgDFinal: finalFila.borgDisnea,
      borgMFinal: finalFila.borgMmii,
      recuperaSatMin: t.recuperacion.recuperaSatEnMin,
      recuperaFcMin: t.recuperacion.recuperaFcEnMin,
      fcAlMinuto: t.recuperacion.fcAlMinuto
    });

    return {
      metrosTot: metrosTot,
      metrosPred: metrosPred,
      fcMax: fcMax,
      pctFc: pctFc,
      pctMetros: pctMetros,
      bmi: bmiVal,
      conclusionLines: conclusionLines,
      paradaLines: buildParadaLines(t.paradas),
      taResp: classifyTaResponse(t.taInicial, t.taFinal)
    };
  }

  return {
    isNum: isNum,
    metrosPredichos: metrosPredichos,
    bmi: bmi,
    metrosTotales: metrosTotales,
    fcMaxima: fcMaxima,
    fcMaximaTeorica: fcMaximaTeorica,
    pctFcPredicha: pctFcPredicha,
    pctMetrosPredicho: pctMetrosPredicho,
    buildConclusion: buildConclusion,
    fmtMinSec: fmtMinSec,
    buildParadaLines: buildParadaLines,
    parseTa: parseTa,
    classifyTaResponse: classifyTaResponse,
    validatePatientBasics: validatePatientBasics,
    LIMITES: LIMITES,
    computeReport: computeReport
  };
})();
