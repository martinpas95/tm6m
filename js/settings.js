window.TM6M = window.TM6M || {};

TM6M.settings = (function () {
  function el(id) { return document.getElementById(id); }
  var bleWired = false;

  function render() {
    var s = TM6M.storage.loadSettings();
    el('s-medico').value = s.medico;
    el('s-matricula').value = s.matricula;
    el('s-especialidad').value = s.especialidad;
    el('s-tecnico').value = s.tecnicoDefault;
    el('s-metros-vuelta').value = s.metrosPorVuelta;
    renderBleStatus();
  }

  function renderBleStatus() {
    var st = TM6M.ble.getStatus();
    var statusEl = el('ble-status');
    var connectBtn = el('btn-ble-connect');
    var disconnectBtn = el('btn-ble-disconnect');

    if (!st.supported) {
      statusEl.textContent = 'Este navegador no soporta Bluetooth. Usá Chrome en Android.';
      connectBtn.hidden = true;
      disconnectBtn.hidden = true;
      return;
    }
    if (st.connecting) {
      statusEl.textContent = 'Conectando…';
      connectBtn.hidden = true;
      disconnectBtn.hidden = true;
      return;
    }
    if (st.connected) {
      var reading = st.lastReading;
      statusEl.textContent = 'Conectado a ' + (st.deviceName || 'oxímetro') +
        (reading ? (' · SpO2 ' + (reading.spo2 !== null ? reading.spo2 + '%' : '—') + ' · FC ' + (reading.pr !== null ? reading.pr + ' lpm' : '—')) : ' · esperando datos…');
      statusEl.classList.add('done');
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
      return;
    }
    statusEl.textContent = 'No conectado. Tocá «Conectar» y elegí tu oxímetro de la lista.';
    statusEl.classList.remove('done');
    connectBtn.hidden = false;
    disconnectBtn.hidden = true;
  }

  function init() {
    el('settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = {
        medico: el('s-medico').value.trim(),
        matricula: el('s-matricula').value.trim(),
        especialidad: el('s-especialidad').value.trim(),
        tecnicoDefault: el('s-tecnico').value.trim(),
        metrosPorVuelta: Number(el('s-metros-vuelta').value) || 15
      };
      TM6M.storage.saveSettings(s);
      TM6M.ui.toast('Ajustes guardados');
      TM6M.ui.goBack();
    });

    el('btn-export').addEventListener('click', function () {
      var data = TM6M.storage.exportAll();
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tm6m_backup_' + todayCompact() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    el('input-import').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (!confirm('Esto va a reemplazar los datos guardados en este celular por los del archivo. ¿Continuar?')) return;
          TM6M.storage.importAll(reader.result);
          TM6M.ui.toast('Copia importada');
          TM6M.home.render();
        } catch (err) {
          TM6M.ui.toast('No se pudo leer el archivo');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    el('btn-ble-connect').addEventListener('click', function () {
      TM6M.ble.connect().then(function () {
        TM6M.ui.toast('Oxímetro conectado');
      }).catch(function (err) {
        var msg = (err && err.name === 'NotFoundError')
          ? 'El dispositivo elegido no expone el servicio de oximetría estándar. Este oxímetro probablemente usa un protocolo propio (no compatible). Vas a poder seguir cargando los datos a mano.'
          : 'No se pudo conectar: ' + (err && err.message ? err.message : 'error desconocido');
        TM6M.ui.toast(msg, 5000);
        renderBleStatus();
      });
    });

    el('btn-ble-disconnect').addEventListener('click', function () {
      TM6M.ble.disconnect();
    });

    if (!bleWired) {
      bleWired = true;
      TM6M.ble.onStatusChange(renderBleStatus);
    }
  }

  function todayCompact() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  return { init: init, render: render };
})();
