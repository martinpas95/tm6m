# Test de Marcha de 6 Minutos (TM6M)

App personal para cargar y generar el informe del Test de Marcha de 6 Minutos, pensada para
reemplazar la planilla de Excel. Es una app web (PWA): no tiene build ni dependencias, son
archivos HTML/CSS/JS simples que se pueden editar directamente.

## Estructura

```
index.html      shell de la app (todas las pantallas)
css/styles.css  estilos + estilos de impresión del informe
js/storage.js   guardado en el celular (localStorage) + forma de los datos de un test
js/calc.js      fórmulas clínicas (metros predichos, FC máxima, conclusión, etc.)
js/ui.js        navegación entre pantallas y componentes de carga reutilizables
js/ble.js       conexión Bluetooth al oxímetro (experimental, ver más abajo)
js/home.js      pantalla de inicio / historial
js/patient.js   datos del paciente + basal
js/test.js      cronómetro de la caminata, vueltas, carga minuto a minuto
js/recovery.js  cronómetro de recuperación
js/review.js    revisión/edición de todo antes de generar el informe
js/report.js    informe final, impresión y guardado
js/settings.js  ajustes (datos del médico, metros por vuelta, backup, Bluetooth)
js/main.js      arranque de la app
manifest.json   configuración de instalación como app (PWA)
sw.js           permite que funcione sin internet
icons/          ícono de la app
```

## Cómo modificar cosas comunes

- **Nombre del médico / matrícula / técnico por defecto / metros por vuelta**: se editan
  directamente desde la app, en Ajustes (⚙️ arriba a la derecha). No hace falta tocar código.
- **Fórmulas clínicas**: todas están en `js/calc.js`, cada una con su fórmula de origen.
- **Texto o diseño del informe**: `js/report.js` arma el HTML del informe; `css/styles.css`
  (sección `.report-sheet` y `@media print`) define cómo se ve en pantalla y al imprimir.

## Datos y privacidad

Todo se guarda **solo en el celular** (localStorage del navegador), no hay servidor ni nube.
Si se borran los datos del navegador o se cambia de celular, se pierde el historial — por eso
en Ajustes hay un botón "Exportar copia (JSON)" para guardar un backup de tanto en tanto, y
"Importar copia" para restaurarlo.

## Oxímetro por Bluetooth (experimental)

La app puede intentar conectarse directo al oxímetro por Bluetooth (Ajustes → "Conectar
oxímetro") usando el perfil estándar de oximetría de Bluetooth. Esto **no pasa por la app
ViHealth** — conectarse a otra app instalada no es posible, así que la app habla directo con
el sensor por su cuenta.

El resultado depende del oxímetro: si el fabricante implementó el perfil Bluetooth estándar,
va a conectar y completar SpO2/FC solas minuto a minuto (siempre editable a mano si hace
falta corregir). Si el oxímetro usa un protocolo propio — algo común en sensores económicos
como el Vibeat PO6B, que es lo que parece usar ViHealth — la conexión va a fallar con un
aviso claro, y la app sigue funcionando 100% a mano como plan B. Esto solo se sabe probando
con el celular y el sensor real; no hay forma de confirmarlo de antemano sin documentación
pública del fabricante.

Requiere Chrome en Android y que la app esté instalada desde una URL https (no funciona
abriendo el archivo directo desde el celular).

## Instalar en el Android

Para que quede instalada como una app real (ícono en el inicio, funciona sin internet, y para
que el Bluetooth pueda funcionar) hace falta que estos archivos estén publicados en una URL
https. La opción más simple y sin costo es GitHub Pages. Una vez publicada:

1. Abrir la URL en Chrome del Android.
2. Menú (⋮) → "Instalar app" o "Agregar a pantalla de inicio".
3. Queda un ícono como cualquier otra app.

## Probar en la computadora

Como los archivos usan `fetch`/service worker, no se pueden abrir con doble clic
(`file://`). Hace falta levantarlos con cualquier servidor estático local y abrir esa URL
en el navegador, por ejemplo con la extensión "Live Server" de VS Code, o cualquier otro
servidor estático que ya tengas instalado.
