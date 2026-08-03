# Test de Marcha de 6 Minutos (TM6M)

App personal para cargar y generar el informe del Test de Marcha de 6 Minutos, pensada para
reemplazar la planilla de Excel. Es una app web (PWA): no tiene build ni dependencias propias
(usa jsPDF y Google Identity Services desde CDN para el PDF y el envío por mail), son archivos
HTML/CSS/JS simples que se pueden editar directamente.

## Estructura

```
index.html      shell de la app (todas las pantallas)
css/styles.css  estilos + estilos de impresión del informe
js/storage.js   guardado en el celular (localStorage) + forma de los datos de un test
js/calc.js      fórmulas clínicas (metros predichos, FC máxima, TA, conclusión, validaciones)
js/ui.js        navegación entre pantallas, stepper, componentes de carga reutilizables
js/ble.js       conexión Bluetooth al oxímetro (experimental, ver más abajo)
js/logo.js      logo del Sanatorio Finochietto embebido (usado en informe y PDF)
js/pdf.js       genera el PDF real del informe (jsPDF)
js/google.js    login con Google, envío por Gmail y guardado en Drive
js/home.js      pantalla de inicio / historial
js/patient.js   datos del paciente + basal
js/test.js      cronómetro de la caminata, vueltas, paradas, carga minuto a minuto
js/recovery.js  cronómetro de recuperación
js/review.js    revisión/edición de todo antes de generar el informe
js/report.js    informe final, PDF, mail, impresión y guardado
js/settings.js  ajustes (datos del médico, metros por vuelta, Bluetooth, Google, backup)
js/main.js      arranque de la app
manifest.json   configuración de instalación como app (PWA)
sw.js           permite que funcione sin internet
icons/          ícono de la app
```

## Cómo modificar cosas comunes

- **Nombre del médico / matrícula / técnico por defecto / metros por vuelta**: se editan
  directamente desde la app, en Ajustes (⚙️ arriba a la derecha). No hace falta tocar código.
- **Fórmulas clínicas**: todas están en `js/calc.js`, cada una con su fórmula de origen.
  `computeReport(t)` centraliza todos los cálculos; tanto el informe en pantalla (`js/report.js`)
  como el PDF (`js/pdf.js`) parten de ahí, así que se mantienen siempre iguales.
- **Texto o diseño del informe**: `js/report.js` arma el informe en pantalla; `js/pdf.js` arma
  el PDF (hay que tocar los dos si se cambia el contenido); `css/styles.css` (sección
  `.report-sheet`) define cómo se ve en pantalla.
- **Rangos válidos de peso/talla/edad**: `TM6M.calc.LIMITES` en `js/calc.js`.
- **Logo del informe**: `assets/logo-sanatorio.jpg`, embebido como base64 en `js/logo.js` (se
  regenera con `base64 -w0 assets/logo-sanatorio.jpg`, ver el propio archivo `js/logo.js` como
  ejemplo del formato). Aparece en el informe en pantalla y en el PDF.

## Funciones nuevas

- **Parada del paciente**: en la pantalla de la prueba, el botón "El paciente se detiene"
  registra el momento (el cronómetro sigue corriendo, como indica el protocolo) y pide el Borg
  de disnea y de MMII en ese instante; "El paciente retoma la marcha" cierra esa parada. Se
  puede repetir varias veces y cada una queda en el informe: *"Detiene la caminata en el
  minuto X por disnea de Y y de MMII de Z. Retoma en el minuto W."*
- **Respuesta de TA automática**: se calcula sola comparando TA inicial y final (según el
  criterio de suba de la sistólica) y aparece en el informe como "Respuesta de TA adecuada" o
  "aplanada". Si falta alguna TA, no se informa nada.
- **Picos hipertensivos**: casillero manual en Revisión; si se marca, el informe agrega "Se
  registran registros hipertensivos, se sugiere su control."
- **Oxígeno suplementario**: por defecto el informe dice "aire ambiente (FiO₂ 0,21%)"; si se
  tilda "oxígeno suplementario" en Revisión y se completa el detalle (ej. "2 L/min por cánula
  nasal"), el informe usa esa frase en su lugar.
- **Validación de peso/talla/edad**: no deja avanzar con valores fuera de rango clínico
  razonable (peso 20–300 kg, talla 100–250 cm, edad 1–120 años).

## Datos y privacidad

Todo se guarda **solo en el celular** (localStorage del navegador); no hay servidor propio ni
nube, salvo que uses a propósito "Enviar por mail" (ver abajo), que sí sale a internet hacia tu
propia cuenta de Google. Si se borran los datos del navegador o se cambia de celular, se pierde
el historial — por eso en Ajustes hay un botón "Exportar copia (JSON)" para guardar un backup
de tanto en tanto, y "Importar copia" para restaurarlo.

## Oxímetro por Bluetooth (experimental)

La app puede intentar conectarse directo al oxímetro por Bluetooth (Ajustes → "Conectar
oxímetro") usando el perfil estándar de oximetría de Bluetooth (BLE). Esto **no pasa por la
app ViHealth** — conectarse a otra app instalada no es posible, así que la app habla directo
con el sensor por su cuenta.

**Con el Vibeat PO6B esto probablemente no va a funcionar.** Al probarlo no aparece en la
lista ni con "mostrar todos los dispositivos" activado, lo que indica que el sensor usa
Bluetooth clásico (SPP) y no Bluetooth de baja energía (BLE). Web Bluetooth —lo único que un
navegador puede usar— **solo ve dispositivos BLE**, nunca Bluetooth clásico; esto no es algo
que se pueda arreglar con código, es una limitación de la plataforma web en general (no solo
de esta app). Antes de descartarlo del todo, vale la pena cerrar ViHealth y desemparejar el
oxímetro en los ajustes de Bluetooth del Android, después reintentar — pero si sigue sin
aparecer, la carga manual (rápida, con botones grandes) es el camino, y es la que usa la app
por defecto siempre.

## Enviar por mail y guardar en Drive

Para poder tocar "Enviar por mail" en el informe (manda el PDF a la casilla del paciente con
asunto "Test de caminata", sin cuerpo de texto, y guarda una copia en tu Google Drive) hace
falta un paso único de configuración que **solo vos podés hacer**, porque necesita tu login de
Google — no es algo que se pueda automatizar desde acá. Es gratis y se hace una sola vez:

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com/) con tu cuenta
   `Dr.neumonologia@gmail.com` y creá un proyecto nuevo (cualquier nombre, ej. "TM6M").
2. Buscador de arriba → buscá **"Gmail API"** → **Habilitar**. Repetí la búsqueda con
   **"Google Drive API"** → **Habilitar**.
3. Menú → **APIs & Services → OAuth consent screen**. Tipo **External**. Completá el nombre de
   la app y tu email. En **"Test users"** agregá tu propio mail
   (`Dr.neumonologia@gmail.com`). Guardar. (No hace falta publicarla ni que Google la verifique
   para uso personal.)
4. Menú → **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Tipo
   **Web application**. En **"Authorized JavaScript origins"** agregá la URL de tu GitHub
   Pages sin barra al final, por ejemplo `https://martinpas95.github.io`. Crear.
5. Copiá el **Client ID** (termina en `.apps.googleusercontent.com`).
6. En la app: **Ajustes → pegá el Client ID → Guardar Client ID → Conectar con Google** →
   iniciá sesión con `Dr.neumonologia@gmail.com` y aceptá los permisos.

La primera vez Google puede mostrar una pantalla de aviso ("Google no verificó esta app") —
es normal para una app personal sin publicar; tocá **"Avanzado" → "Ir a (nombre de la app)
(no seguro)"** para continuar. Solo vos vas a poder usarla, porque solo tu mail está agregado
como "test user".

La conexión con Google dura alrededor de una hora; si pasó más tiempo, hay que volver a tocar
"Conectar con Google" en Ajustes antes de mandar otro mail.

### Que el paciente no vea tu mail personal

En Ajustes hay un campo **"Nombre del remitente"** (por defecto "Test de Caminata - Sanatorio
Finochietto") que cambia el nombre que ve el paciente en la bandeja de entrada, en vez de tu
nombre propio. Ojo: eso solo cambia el *nombre para mostrar* — la dirección de mail real
(la cuenta de Google que conectaste) sigue siendo visible si el paciente mira el detalle del
mensaje. Si además querés que la dirección en sí tampoco sea tu Gmail personal, la solución es
crear una cuenta de Gmail nueva y gratuita dedicada solo a esto (por ejemplo,
`testcaminata.sanatoriofinochietto@gmail.com`) y conectar *esa* cuenta en Ajustes en vez de la
tuya — no hace falta tocar nada de código, es solo elegir esa cuenta en la pantalla de login de
Google al tocar "Conectar con Google".

## Instalar en el Android

Para que quede instalada como una app real (ícono en el inicio, funciona sin internet, y para
que el Bluetooth pueda funcionar) hace falta que estos archivos estén publicados en una URL
https. La opción más simple y sin costo es GitHub Pages. Una vez publicada:

1. Abrir la URL en Chrome del Android.
2. Menú (⋮) → "Instalar app" o "Agregar a pantalla de inicio".
3. Queda un ícono como cualquier otra app.

Cada vez que se suben cambios nuevos a GitHub, conviene cerrar del todo la app en el Android
(no solo minimizarla) y volver a abrirla, para que el service worker traiga la versión nueva.

## Probar en la computadora

Como los archivos usan `fetch`/service worker, no se pueden abrir con doble clic
(`file://`). Hace falta levantarlos con cualquier servidor estático local y abrir esa URL
en el navegador, por ejemplo con la extensión "Live Server" de VS Code, o cualquier otro
servidor estático que ya tengas instalado.
