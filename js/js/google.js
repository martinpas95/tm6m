window.TM6M = window.TM6M || {};

// Envío por Gmail y guardado en Drive usando la cuenta de Google del propio médico
// (Google Identity Services, OAuth en el navegador). Requiere que el médico configure
// un Client ID propio en Ajustes (ver README) — eso es algo que solo él puede crear,
// porque necesita su login de Google.
TM6M.google = (function () {
  var SCOPES = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file';
  var tokenClient = null;
  var accessToken = null;
  var tokenExpiry = 0;
  var connectedEmail = null;

  function isReady() {
    return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
  }

  function isConnected() {
    return !!accessToken && Date.now() < tokenExpiry;
  }

  function getConnectedEmail() { return connectedEmail; }

  // Solo debe llamarse directo desde un click del usuario (Ajustes → Conectar), para
  // que el navegador no bloquee la ventana de login de Google como si fuera un popup no pedido.
  function connect(clientId) {
    if (!isReady()) return Promise.reject(new Error('Google todavía no cargó. Revisá tu conexión a internet y volvé a intentar.'));
    if (!clientId) return Promise.reject(new Error('Falta pegar el Client ID de Google en Ajustes.'));

    return new Promise(function (resolve, reject) {
      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: function (resp) {
            if (resp.error) { reject(new Error(resp.error)); return; }
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
            fetchProfileEmail(accessToken).then(function (email) {
              connectedEmail = email;
              resolve({ email: email });
            }).catch(function () {
              connectedEmail = null;
              resolve({ email: null });
            });
          }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  function fetchProfileEmail(token) {
    return fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) { return r.json(); }).then(function (data) { return data.email || null; });
  }

  function disconnect() {
    if (accessToken && isReady()) {
      window.google.accounts.oauth2.revoke(accessToken, function () {});
    }
    accessToken = null;
    tokenExpiry = 0;
    connectedEmail = null;
  }

  function requireToken() {
    if (!isConnected()) {
      return Promise.reject(new Error('No hay conexión activa con Google. Andá a Ajustes y tocá "Conectar con Google" (la conexión dura ~1 hora).'));
    }
    return Promise.resolve(accessToken);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function buildMimeMessage(opts, pdfBase64) {
    var boundary = 'tm6m_boundary_' + Date.now();
    var settings = TM6M.storage.loadSettings();
    var displayName = (settings.remitenteNombre || '').replace(/["\r\n]/g, '').trim();
    var fromHeader = displayName && connectedEmail ? ('"' + displayName + '" <' + connectedEmail + '>') : connectedEmail;
    var lines = [
      'To: ' + opts.to,
      'Subject: ' + opts.subject,
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="' + boundary + '"'
    ];
    if (fromHeader) lines.splice(1, 0, 'From: ' + fromHeader);
    lines = lines.concat([
      '',
      '--' + boundary,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      opts.body || '',
      '',
      '--' + boundary,
      'Content-Type: application/pdf; name="' + opts.filename + '"',
      'Content-Disposition: attachment; filename="' + opts.filename + '"',
      'Content-Transfer-Encoding: base64',
      '',
      pdfBase64,
      '--' + boundary + '--'
    ]);
    return lines.join('\r\n');
  }

  function apiError(resp) {
    return resp.json().then(function (data) {
      throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
    });
  }

  function sendMailWithAttachment(opts) {
    return requireToken().then(function (token) {
      return blobToBase64(opts.blob).then(function (base64) {
        var raw = base64UrlEncode(buildMimeMessage(opts, base64));
        return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: raw })
        });
      });
    }).then(function (resp) { return resp.ok ? resp.json() : apiError(resp); });
  }

  function uploadToDrive(opts) {
    return requireToken().then(function (token) {
      var metadata = { name: opts.filename, mimeType: 'application/pdf' };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', opts.blob);
      return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: form
      });
    }).then(function (resp) { return resp.ok ? resp.json() : apiError(resp); });
  }

  return {
    isReady: isReady,
    isConnected: isConnected,
    getConnectedEmail: getConnectedEmail,
    connect: connect,
    disconnect: disconnect,
    sendMailWithAttachment: sendMailWithAttachment,
    uploadToDrive: uploadToDrive
  };
})();
