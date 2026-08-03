window.TM6M = window.TM6M || {};
TM6M.state = TM6M.state || { current: null };

TM6M.storage = (function () {
  var KEY_TESTS = 'tm6m_tests_v1';
  var KEY_SETTINGS = 'tm6m_settings_v1';

  var DEFAULT_SETTINGS = {
    medico: 'Dr. Martín Pascansky',
    matricula: 'M.N 176.629',
    especialidad: 'Neumonólogo Universitario',
    tecnicoDefault: 'Dr. Pascansky Martin',
    metrosPorVuelta: 15,
    googleClientId: '',
    remitenteNombre: 'Test de Caminata - Sanatorio Finochietto'
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(KEY_SETTINGS);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }

  function loadTests() {
    try {
      var raw = localStorage.getItem(KEY_TESTS);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveTests(tests) {
    localStorage.setItem(KEY_TESTS, JSON.stringify(tests));
  }

  function upsertTest(test) {
    var tests = loadTests();
    var idx = -1;
    for (var i = 0; i < tests.length; i++) { if (tests[i].id === test.id) { idx = i; break; } }
    if (idx >= 0) tests[idx] = test; else tests.unshift(test);
    saveTests(tests);
    return test;
  }

  function deleteTest(id) {
    var tests = loadTests().filter(function (t) { return t.id !== id; });
    saveTests(tests);
  }

  function getTest(id) {
    var tests = loadTests();
    for (var i = 0; i < tests.length; i++) { if (tests[i].id === id) return tests[i]; }
    return null;
  }

  function exportAll() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      tests: loadTests()
    }, null, 2);
  }

  function importAll(jsonText) {
    var data = JSON.parse(jsonText);
    if (data.settings) saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
    if (Array.isArray(data.tests)) saveTests(data.tests);
  }

  function newId() {
    return 'tm6m_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadTests: loadTests,
    saveTests: saveTests,
    upsertTest: upsertTest,
    deleteTest: deleteTest,
    getTest: getTest,
    exportAll: exportAll,
    importAll: importAll,
    newId: newId
  };
})();

TM6M.model = (function () {
  function todayStr() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function newFila(minuto) {
    return {
      minuto: minuto,
      spo2: null,
      fc: null,
      metros: minuto === 'Basal' ? 0 : null,
      borgDisnea: null,
      borgMmii: null,
      completado: false
    };
  }

  function newTest(settings) {
    var filas = [newFila('Basal')];
    for (var i = 1; i <= 6; i++) filas.push(newFila(i));
    return {
      id: TM6M.storage.newId(),
      createdAt: new Date().toISOString(),
      fecha: todayStr(),
      paciente: '',
      edad: null,
      sexo: 'F',
      peso: null,
      talla: null,
      diagnostico: '',
      tecnico: (settings && settings.tecnicoDefault) || '',
      taInicial: '',
      taFinal: '',
      metrosPorVuelta: (settings && settings.metrosPorVuelta) || 15,
      filas: filas,
      vueltas: [],
      paradas: [],
      terminoAnticipado: null,
      startedAt: null,
      recuperacion: { fcAlMinuto: null, recuperaFcEnMin: null, recuperaSatEnMin: null },
      oxigeno: { suplementario: false, detalle: '' },
      notas: { hipertensivos: false, dificultadSensado: false, dificultadSensadoDetalle: '', libre: '' },
      pacienteEmail: '',
      finalizado: false
    };
  }

  return { newTest: newTest, todayStr: todayStr };
})();
