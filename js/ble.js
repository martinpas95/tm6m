window.TM6M = window.TM6M || {};

// Intenta conectarse directo al oxímetro por Bluetooth de bajo consumo (Web Bluetooth),
// usando el "Pulse Oximeter Service" estándar del Bluetooth SIG (UUID 0x1822 / medición
// continua 0x2A5F). Esto NO pasa por la app ViHealth (no es posible integrarse con otra
// app cerrada): si el sensor implementa ese servicio estándar, lo leemos directo. Si el
// fabricante usa un protocolo propietario (frecuente en oxímetros económicos), el
// dispositivo no va a exponer el servicio y la conexión va a fallar de forma prolija.
// En cualquier caso, la carga manual sigue funcionando igual.
TM6M.ble = (function () {
  var SERVICE_PULSE_OX = 0x1822;
  var CHAR_CONTINUOUS = 0x2A5F;
  var STALE_MS = 8000;

  var device = null;
  var characteristic = null;
  var connected = false;
  var connecting = false;
  var lastReading = null; // { spo2, pr, at }
  var readingListeners = [];
  var statusListeners = [];

  function isSupported() {
    return !!(navigator.bluetooth);
  }

  function onReading(fn) { readingListeners.push(fn); }
  function onStatusChange(fn) { statusListeners.push(fn); }

  function emitStatus() {
    var st = getStatus();
    statusListeners.forEach(function (fn) { try { fn(st); } catch (e) {} });
  }

  function getStatus() {
    return {
      supported: isSupported(),
      connected: connected,
      connecting: connecting,
      deviceName: device ? device.name : null,
      lastReading: lastReading
    };
  }

  function freshReading() {
    if (!lastReading) return null;
    if (Date.now() - lastReading.at > STALE_MS) return null;
    return lastReading;
  }

  // SFLOAT de IEEE 11073-20601: 4 bits de exponente + 12 bits de mantisa (ambos con signo).
  function parseSFloat(raw) {
    var mantissa = raw & 0x0FFF;
    var exponent = (raw >> 12) & 0x0F;
    if (mantissa === 0x07FF || mantissa === 0x0800 || mantissa === 0x0801 || mantissa === 0x0802) {
      return null; // +INFINITY / NaN / NRes / -INFINITY
    }
    if (exponent >= 0x08) exponent -= 0x10;
    if (mantissa >= 0x0800) mantissa -= 0x1000;
    return mantissa * Math.pow(10, exponent);
  }

  function handleNotification(event) {
    var value = event.target.value;
    if (!value || value.byteLength < 6) return;
    // Bytes 0-1: flags. Bytes 2-3: SpO2 (SFLOAT). Bytes 4-5: frecuencia de pulso (SFLOAT).
    var spo2Raw = value.getUint16(2, true);
    var prRaw = value.getUint16(4, true);
    var spo2 = parseSFloat(spo2Raw);
    var pr = parseSFloat(prRaw);
    lastReading = {
      spo2: (spo2 !== null && spo2 > 0 && spo2 <= 100) ? Math.round(spo2) : null,
      pr: (pr !== null && pr > 0 && pr < 300) ? Math.round(pr) : null,
      at: Date.now()
    };
    readingListeners.forEach(function (fn) { try { fn(lastReading); } catch (e) {} });
    emitStatus();
  }

  function onDisconnected() {
    connected = false;
    characteristic = null;
    emitStatus();
  }

  function connect() {
    if (!isSupported()) {
      return Promise.reject(new Error('Este navegador no soporta Bluetooth (Web Bluetooth). Probá con Chrome en Android.'));
    }
    connecting = true;
    emitStatus();
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_PULSE_OX]
    }).then(function (d) {
      device = d;
      device.addEventListener('gattserverdisconnected', onDisconnected);
      return device.gatt.connect();
    }).then(function (server) {
      return server.getPrimaryService(SERVICE_PULSE_OX);
    }).then(function (service) {
      return service.getCharacteristic(CHAR_CONTINUOUS);
    }).then(function (ch) {
      characteristic = ch;
      characteristic.addEventListener('characteristicvaluechanged', handleNotification);
      return characteristic.startNotifications();
    }).then(function () {
      connected = true;
      connecting = false;
      emitStatus();
      return getStatus();
    }).catch(function (err) {
      connecting = false;
      connected = false;
      if (device && device.gatt && device.gatt.connected) {
        try { device.gatt.disconnect(); } catch (e) {}
      }
      emitStatus();
      throw err;
    });
  }

  function disconnect() {
    if (device && device.gatt && device.gatt.connected) {
      try { device.gatt.disconnect(); } catch (e) {}
    }
    connected = false;
    emitStatus();
  }

  return {
    isSupported: isSupported,
    connect: connect,
    disconnect: disconnect,
    onReading: onReading,
    onStatusChange: onStatusChange,
    getStatus: getStatus,
    freshReading: freshReading
  };
})();
