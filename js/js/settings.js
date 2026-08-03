window.TM6M = window.TM6M || {};

TM6M.settings = (function () {
  function el(id) { return document.getElementById(id); }

  function render() {
    var s = TM6M.storage.loadSettings();
    el('s-medico').value = s.medico;
    el('s-matricula').value = s.matricula;
    el('s-especialidad').value = s.especialidad;
    el('s-tecnico').value = s.tecnicoDefault;
    el('s-metros-vuelta').value = s.metrosPorVuelta;
    el('s-google-client-id').value = s.googleClientId || '';
    el('s-remitente').value = s.remitenteNombre || '';
    renderGoogleStatus();
  }

  function renderGoogleStatus() {
    var s = TM6M.storage.loadSettings();
    var statusEl = el('google-status');
    var connectBtn = el('btn-google-connect');
    var disconnectBtn = el('btn-google-disconnect');

    if (!s.googleClientId) {
      statusEl.textContent = 'Sin configurar: pegá tu Client ID y guardalo primero.';
      statusEl.classList.remove('done');
      connectBtn.hidden = true;
      disconnectBtn.hidden = true;
      return;
    }
    if (TM6M.google.isConnected()) {
      statusEl.textContent = 'Conectado' + (TM6M.google.getConnectedEmail() ? (' como ' + TM6M.google.getConnectedEmail()) : '') + '.';
      statusEl.classList.add('done');
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
      return;
    }
    statusEl.textContent = 'Client ID guardado. Tocá «Conectar con Google» para poder enviar mails.';
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
        metrosPorVuelta: Number(el('s-metros-vuelta').value) || 15,
        googleClientId: TM6M.storage.loadSettings().googleClientId,
        remitenteNombre: TM6M.storage.loadSettings().remitenteNombre
      };
      TM6M.storage.saveSettings(s);
      TM6M.ui.toast('Ajustes guardados');
      TM6M.ui.goBack();
    });

    el('btn-google-save').addEventListener('click', function () {
      var s = TM6M.storage.loadSettings();
      s.googleClientId = el('s-google-client-id').value.trim();
      s.remitenteNombre = el('s-remitente').value.trim();
      TM6M.storage.saveSettings(s);
      TM6M.ui.toast('Guardado');
      renderGoogleStatus();
    });

    el('btn-google-connect').addEventListener('click', function () {
      var s = TM6M.storage.loadSettings();
      TM6M.google.connect(s.googleClientId).then(function () {
        TM6M.ui.toast('Conectado con Google');
        renderGoogleStatus();
      }).catch(function (err) {
        TM6M.ui.toast('No se pudo conectar: ' + (err && err.message ? err.message : 'error desconocido'), 4500);
        renderGoogleStatus();
      });
    });

    el('btn-google-disconnect').addEventListener('click', function () {
      TM6M.google.disconnect();
      renderGoogleStatus();
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
  }

  function todayCompact() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  return { init: init, render: render };
})();
