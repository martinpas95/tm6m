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

  return {
    isNum: isNum,
    metrosPredichos: metrosPredichos,
    bmi: bmi,
    metrosTotales: metrosTotales,
    fcMaxima: fcMaxima,
    fcMaximaTeorica: fcMaximaTeorica,
    pctFcPredicha: pctFcPredicha,
    pctMetrosPredicho: pctMetrosPredicho,
    buildConclusion: buildConclusion
  };
})();
