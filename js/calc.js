window.TM6M = window.TM6M || {};

TM6M.calc = (function () {

  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  function numOrZero(v) { return isNum(v) ? v : 0; }

  // Enright & Sherrill, AJRCCM 1998;158:1384-87
  // En combinaciones extremas (pero válidas según LIMITES) de edad/peso/talla la fórmula
  // puede dar un resultado negativo, que no tiene sentido físico — se trata como "no
  // calculable" (igual que si faltara un dato), en vez de mostrarlo tal cual.
  function metrosPredichos(sexo, tallaCm, edad, pesoKg) {
    if (!isNum(tallaCm) || !isNum(edad) || !isNum(pesoKg)) return null;
    var val = sexo === 'M'
      ? 7.57 * tallaCm - 5.02 * edad - 1.76 * pesoKg - 309
      : 2.11 * tallaCm - 2.29 * pesoKg - 5.78 * edad + 667;
    return val > 0 ? val : null;
  }

  function bmi(pesoKg, tallaCm) {
    if (!isNum(pesoKg) || !isNum(tallaCm) || tallaCm === 0) return null;
    var t = tallaCm / 100;
    return pesoKg / (t * t);
  }

  function metrosTotales(filas) {
    return filas.reduce(function (sum, f) { return sum + numOrZero(f.metros); }, 0);
  }

  // Junta la FC de basal+6min con la de paradas y finalización anticipada — el pico
  // de FC muchas veces se da justo en esos momentos, no en una carga de minuto fijo.
  function fcMaxima(t) {
    var vals = t.filas.map(function (f) { return f.fc; }).filter(isNum);
    if (t.paradas) t.paradas.forEach(function (p) { if (isNum(p.fc)) vals.push(p.fc); });
    if (t.terminoAnticipado && isNum(t.terminoAnticipado.fc)) vals.push(t.terminoAnticipado.fc);
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
      var vitales = '';
      if (isNum(p.spo2) || isNum(p.fc)) {
        vitales = ' con SpO2 ' + fmtOrDash(p.spo2) + '% y FC ' + fmtOrDash(p.fc) + ' lpm,';
      }
      return 'Detiene la caminata en el minuto ' + fmtMinSec(p.inicioSec) + vitales + ' por disnea de ' + fmtOrDash(p.borgDisnea) +
        ' y de MMII de ' + fmtOrDash(p.borgMmii) + '. Retoma en el minuto ' + fmtMinSec(p.finSec) + '.';
    });
  }

  function buildTerminoAnticipadoLine(term) {
    if (!term || !isNum(term.sec)) return null;
    return 'Se finaliza la prueba en el minuto ' + fmtMinSec(term.sec) + ' con SpO2 de ' + fmtOrDash(term.spo2) +
      '%, FC de ' + fmtOrDash(term.fc) + ', Borg de disnea ' + fmtOrDash(term.borgDisnea) +
      ' y Borg de MMII de ' + fmtOrDash(term.borgMmii) + '.';
  }

  // "120/80" -> {sys:120, dia:80}
  // Anclado a todo el string (^...$) para no matchear un pedazo de un valor con typo
  // (ej. "1200/80" ya NO se lee como "200/80").
  function parseTa(str) {
    if (!str) return null;
    var m = String(str).trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!m) return null;
    return { sys: Number(m[1]), dia: Number(m[2]) };
  }

  function isTaPlausible(ta) {
    return !!ta &&
      ta.sys >= LIMITES.taSisMin && ta.sys <= LIMITES.taSisMax &&
      ta.dia >= LIMITES.taDiaMin && ta.dia <= LIMITES.taDiaMax;
  }

  // Respuesta tensional al ejercicio: adecuada (PAS sube >=10 mmHg), hipotensiva
  // (PAS final - PAS basal <= -10 mmHg) o aplanada (todo lo que queda en el medio).
  // Si algún valor está fuera de rango fisiológico plausible (probable error de carga),
  // no se calcula nada en vez de arriesgar una conclusión con un dato malo.
  function classifyTaResponse(taInicial, taFinal) {
    var ini = parseTa(taInicial);
    var fin = parseTa(taFinal);
    if (!ini || !fin || !isTaPlausible(ini) || !isTaPlausible(fin)) return null;
    var deltaSys = fin.sys - ini.sys;
    if (deltaSys <= -10) return 'hipotensiva';
    return deltaSys < 10 ? 'aplanada' : 'adecuada';
  }

  // Desaturación significativa: se marca si se cumple CUALQUIERA de estos dos
  // disparadores independientes (no hace falta que se den los dos juntos):
  //  1) En algún momento de la prueba el SpO2 cae 4 puntos o más respecto de
  //     CUALQUIER punto anterior (sea el basal u otro minuto ya pasado) — nunca al
  //     revés, una suba (ej. 94%→99% por ansiedad al arrancar) no cuenta. Se arma la
  //     secuencia cronológica real (basal, minuto a minuto, y paradas/finalización
  //     anticipada en su instante exacto) y se compara cada valor contra el máximo
  //     visto hasta ese momento, así también agarra una caída progresiva a lo largo
  //     de varios minutos aunque ningún salto puntual entre dos lecturas llegue a 4.
  //  2) En algún momento de la prueba el SpO2 llega a 88% o menos, aunque la caída
  //     puntual desde el pico anterior no llegue a 4 (umbral de la guía ATS de
  //     oxigenoterapia domiciliaria 2020).
  // "Saturación mínima" del informe sigue siendo el mínimo de toda la prueba,
  // independiente de este criterio — es solo un dato informativo aparte.
  function checkDesaturacion(t) {
    var points = [];
    if (isNum(t.filas[0].spo2)) points.push({ sec: 0, spo2: t.filas[0].spo2 });
    for (var i = 1; i <= 6; i++) {
      if (isNum(t.filas[i].spo2)) points.push({ sec: i * 60, spo2: t.filas[i].spo2 });
    }
    if (t.paradas) {
      t.paradas.forEach(function (p) {
        if (isNum(p.spo2) && isNum(p.inicioSec)) points.push({ sec: p.inicioSec, spo2: p.spo2 });
      });
    }
    if (t.terminoAnticipado && isNum(t.terminoAnticipado.spo2) && isNum(t.terminoAnticipado.sec)) {
      points.push({ sec: t.terminoAnticipado.sec, spo2: t.terminoAnticipado.spo2 });
    }
    if (!points.length) return null;
    points.sort(function (a, b) { return a.sec - b.sec; });

    var vals = points.map(function (p) { return p.spo2; });
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);

    var significativa = false;
    var maxSoFar = points[0].spo2;
    for (var k = 1; k < points.length; k++) {
      if (maxSoFar - points[k].spo2 >= 4) { significativa = true; break; }
      if (points[k].spo2 > maxSoFar) maxSoFar = points[k].spo2;
    }
    if (!significativa && min <= 88) significativa = true;
    return { significativa: significativa, diff: max - min, max: max, min: min };
  }

  var LIMITES = {
    edadMin: 1, edadMax: 120,
    pesoMin: 20, pesoMax: 300,
    tallaMin: 100, tallaMax: 250,
    spo2Min: 0, spo2Max: 100,
    fcMin: 20, fcMax: 250,
    taSisMin: 60, taSisMax: 260,
    taDiaMin: 30, taDiaMax: 150
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

  function buildDesaturacionLine(desat) {
    if (!desat) return null;
    return desat.significativa
      ? 'Presenta desaturación significativa durante la prueba.'
      : 'No presenta desaturación significativa durante la prueba.';
  }

  function buildTaRespLine(taResp) {
    if (!taResp) return null;
    if (taResp === 'hipotensiva') return 'Respuesta de TA con hipotensión. Se sugiere su control.';
    if (taResp === 'adecuada') return 'Respuesta de TA adecuada.';
    return 'Respuesta de TA aplanada.';
  }

  function computeReport(t) {
    var metrosTot = metrosTotales(t.filas);
    var metrosPred = metrosPredichos(t.sexo, Number(t.talla), Number(t.edad), Number(t.peso));
    var fcMax = fcMaxima(t);
    var pctFc = pctFcPredicha(fcMax, Number(t.edad));
    var pctMetros = pctMetrosPredicho(metrosTot, metrosPred);
    var bmiVal = bmi(Number(t.peso), Number(t.talla));
    var finalFila = t.filas[6];
    var desat = checkDesaturacion(t);
    var taResp = classifyTaResponse(t.taInicial, t.taFinal);

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
      terminoAnticipadoLine: buildTerminoAnticipadoLine(t.terminoAnticipado),
      taResp: taResp,
      taRespLine: buildTaRespLine(taResp),
      desaturacionLine: buildDesaturacionLine(desat),
      spo2Min: desat ? desat.min : null
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
    buildTerminoAnticipadoLine: buildTerminoAnticipadoLine,
    parseTa: parseTa,
    isTaPlausible: isTaPlausible,
    classifyTaResponse: classifyTaResponse,
    buildTaRespLine: buildTaRespLine,
    validatePatientBasics: validatePatientBasics,
    checkDesaturacion: checkDesaturacion,
    buildDesaturacionLine: buildDesaturacionLine,
    LIMITES: LIMITES,
    computeReport: computeReport
  };
})();
