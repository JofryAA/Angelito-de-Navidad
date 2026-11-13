# 🎁 Angelito de Navidad: cómo ponerlo en línea (Firebase Hosting)

Archivos:
- `firebase.json` y `.firebaserc`: configuración para publicar con Firebase Hosting.
- `.github/workflows/deploy.yml`: publicación automática si usas GitHub (opcional).
- `sitio/`: **la página** (esto es lo que se publica). Adentro están:
- `index.html`: la página.
- `firebase-config.js`: aquí pegas los datos de tu Firebase.
- `firestore.rules` (fuera de `sitio/`): las reglas de seguridad. `firebase deploy` las publica solas.
- `LEEME.md` (fuera de `sitio/`): estas instrucciones.
- `manifest.webmanifest`, `sw.js`, `icons/`: hacen que funcione como app instalable.
- `version.json`: le dice a los teléfonos que hay una versión nueva para que se actualicen solos.

Toma unos 10 minutos.

---

## 1. Crear el proyecto en Firebase

1. Entra a https://console.firebase.google.com con tu cuenta de Google.
2. **Crear un proyecto**, ponle un nombre (por ejemplo `angelito-2026`) y desactiva Google Analytics (no hace falta).
3. En la pantalla principal del proyecto, toca el ícono **`</>` (Web)** para agregar una app web.
   Ponle un nombre y **no** marques Firebase Hosting.
4. Te mostrará un bloque `firebaseConfig = { ... }`. Copia esos valores en `firebase-config.js`.

## 2. Activar el inicio de sesión

1. Menú izquierdo: **Compilación → Authentication → Comenzar**.
2. En **Método de acceso**, elige **Correo electrónico/contraseña**, actívalo (solo el primer interruptor) y **Guardar**.
3. **De inmediato** (antes de compartir nada), ve a la pestaña **Usuarios → Agregar usuario**:
   - Correo: `admin@angelito.app`
   - Contraseña: **la contraseña del Admin** (mínimo 6 caracteres).

   Esa es la contraseña que vas a escribir en ⚙️ Admin.

> Si quieres usar otro correo para el organizador, cámbialo en **dos lugares**: `firebase-config.js` (ADMIN_EMAIL) y `firestore.rules` (función `isOwner`).

## 3. Crear la base de datos

1. Menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación (por ejemplo `nam5 (United States)`) y empieza en **modo de producción**.
3. Las reglas de seguridad se publican solas con `firebase deploy` (paso 4). Si prefieres, también puedes pegarlas a mano en la pestaña **Reglas**.

## 4. Publicar la página en Firebase Hosting (gratis, sin anuncios)

Se hace una sola vez la preparación y luego cada publicación es un comando.

**Preparación (una vez):**
1. Instala **Node.js** (versión LTS) desde https://nodejs.org
2. Abre la terminal (en Windows: *PowerShell*) y escribe:
   ```
   npm install -g firebase-tools
   firebase login
   ```
   Se abre el navegador para que entres con la misma cuenta de Google de tu proyecto.
3. Abre el archivo `.firebaserc` (está junto a este LEEME) y cambia `PON-AQUI-EL-ID-DE-TU-PROYECTO` por el **ID de tu proyecto**
   (Firebase → ⚙️ Configuración del proyecto → *ID del proyecto*, por ejemplo `angelito-2026`).

**Publicar (cada vez que haya cambios):**
1. En la terminal, entra a la carpeta del angelito (la que tiene `firebase.json`):
   ```
   cd ruta/a/angelito
   firebase deploy
   ```
2. Al final te muestra tu enlace: `https://TU-PROYECTO.web.app` 🎉

Este comando sube **la página y las reglas de seguridad juntas**, así que ya no hace falta pegar `firestore.rules` a mano.

> Los teléfonos detectan la versión nueva y se actualizan solos. Si publicas desde tu computadora, el archivo `sitio/version.json` ya viene marcado en cada zip nuevo que te paso.

### Publicar con GitHub (opcional, automático)
Si subes esta carpeta a un repositorio de GitHub, cada cambio en la rama `main` se publica solo:
1. En la terminal, dentro de la carpeta: `firebase init hosting:github` → elige tu repositorio y acepta.
   Eso crea el secreto `FIREBASE_SERVICE_ACCOUNT` en GitHub por ti.
   Si te pregunta si quiere sobrescribir `.github/workflows/deploy.yml`, responde **No** (ya viene listo).
2. Desde ahí: cada `git push` a `main` → se publica en unos 2 minutos.
   Las reglas de Firestore en ese caso publícalas con `firebase deploy --only firestore:rules` cuando cambien.

## 5. Protección extra (muy recomendada)

**Limitar tu clave de Firebase a tu sitio:**
Google Cloud Console (https://console.cloud.google.com) → elige tu proyecto → *APIs y servicios → Credenciales* → abre la "Browser key" →
*Restricciones de aplicaciones: Sitios web* → agrega `https://TU-PROYECTO.web.app/*` y `https://TU-PROYECTO.firebaseapp.com/*` → Guardar.

**App Check (bloquea robots que intenten adivinar PINs o llenar el chat de basura):**
1. Entra a https://www.google.com/recaptcha/admin → crea un sitio **reCAPTCHA v3** con el dominio `TU-PROYECTO.web.app` → copia la *clave del sitio*.
2. Pégala en `firebase-config.js` en `RECAPTCHA_KEY` y vuelve a publicar con `firebase deploy`.
3. Firebase → **App Check** → registra tu app web con *reCAPTCHA v3* y la *clave secreta* → espera un día viendo que todo funciona y luego toca **Aplicar (Enforce)** en Firestore y Authentication.

> Sobre el PIN: 4 números se pueden adivinar con muchos intentos. Firebase frena los intentos seguidos y App Check bloquea a los robots, pero pide a todos que **no usen PINs obvios** (1234, 0000, su año de nacimiento).

---

## 🎄 Cómo se usa

**Tú (organizador):**
1. Abre la página y toca **Entrar → 🛡️ Organizador**, usuario `admin` y tu contraseña. También puedes **tocar 5 veces el logo 🎁** (o entra al enlace con `#admin` al final, por ejemplo `https://TU-PROYECTO.web.app/#admin`). Escribe tu contraseña.
   Los demás no ven ningún botón de admin; a ti te aparece el ⚙️ arriba cuando ya entraste.
2. Llena los datos del evento: fecha, lugar, presupuesto, el **aporte para el compartir** (monto y cómo entregarlo), la fecha límite para confirmar y el día en que se abren los anónimos.
   En Admin → *Asistencia y aportes* ves quién va y marcas **✓ Recibido** cuando alguien te da su aporte.
3. Agrega las actividades. Cada una puede tener una dinámica:
   - 🎭 **Asignación al azar** (personajes bíblicos, villancicos, colores…): toca *Repartir* y a cada quien le toca algo, en secreto o a la vista de todos.
   - 🗳️ **Votación** (mejor vestido, mejor regalo): tú decides cuándo publicar los resultados.
   - 📝 **Apúntate**: una lista donde cada quien toma un puesto.
   Hay plantillas listas en Admin → Actividades.
4. Comparte el enlace. Cada persona se registra sola.
5. Cuando estén todos, toca **Generar sorteo**. Las inscripciones se cierran solas, y puedes reabrirlas.

**Cada participante:**
1. Toca **Registrarme** y pone su nombre, su apellido y un PIN de 4 números.
2. En Inicio confirma si va al angelito y marca cuando ya dio su aporte.
3. Con ese PIN entra, escribe su lista de deseos, confirma si va a cada actividad, ve lo que le tocó, vota, y deja preguntas anónimas o sugerencias.
4. Cuando haya sorteo, va a **Ruleta → Girar**. Ahí mismo actualiza cómo va con el regalo (🛍️ Ya lo compré, 🎀 Envuelto…). A quien lo recibe le llega el aviso sin saber de quién viene, y escribe su adivinanza 🔮 de qué cree que le van a regalar.
5. En **💬 Chat** se escriben ocurrencias con todo el grupo. El botón 🎲 sugiere ideas. Para volver a ver a quién le tocó, le pide su PIN otra vez.

**Si alguien olvida su PIN:** en Admin → Participantes toca **🔑** junto a su nombre → *Generar PIN temporal*. Cópialo (o copia el mensaje listo) y envíaselo.
Conserva su sorteo, sus deseos, su asistencia y todo lo suyo (no hay que volver a sortear). Cuando entre con ese PIN, la app le pedirá crear el suyo.

**Si alguien se registra con un nombre falso:** bórralo desde Admin.

---

## 🛡️ Organizadores ayudantes
En Admin → **Equipo organizador** (solo tú lo ves) creas cuentas con **nombre, usuario y contraseña** y marcas qué puede manejar cada ayudante:
- 🎄 Evento, reglas y secciones
- 📅 Actividades y dinámicas
- 👥 Participantes e inscripciones
- 💵 Asistencia y aportes
- 🧹 Moderar chat, deseos y sugerencias

Ellos entran con **Entrar → 🛡️ Organizador** y escriben su usuario y contraseña. Tú entras ahí con el usuario **admin**.
Un ayudante **nunca** puede: hacer el sorteo, ver las parejas, ver quién escribió los anónimos o las sugerencias, leer los anónimos antes de tiempo ni crear otros organizadores.
Las reglas de Firebase hacen que esto se cumpla aunque alguien sepa de programación.
> Nota: quien tenga permiso de *Actividades* técnicamente puede consultar lo que le tocó a cada quien en las asignaciones secretas (por ejemplo, los personajes bíblicos), porque es quien las reparte.

## 📲 App en el teléfono
- **Android (Chrome):** en Inicio aparece **"Instala el angelito"** → *Instalar*. O menú ⋮ → *Instalar app*.
- **iPhone (Safari):** botón **Compartir ⬆️ → "Agregar a inicio"**. En iPhone las notificaciones solo funcionan con la app instalada (iOS 16.4 o más nuevo).
- Cada quien puede tocar **🔔 Activar** para recibir avisos: ruleta habilitada, noticias de su angelito, mensajes del chat, buzón abierto, resultados y recordatorios de pago.

### 📣 Avisos y recordatorios
- En Admin → **Avisos** escribes un mensaje para todos, para los que no han pagado o para los que no han confirmado.
- En Admin → **Asistencia y aportes** tienes botones para recordar a los pendientes.
- Además, la app le recuerda una vez al día a cada uno si no ha confirmado o no ha dado su aporte.
- Estos avisos llegan al instante si la persona tiene la app abierta o en segundo plano, y si no, cuando la abra.

### 🔔 Notificaciones con la app cerrada (opcional)
1. Firebase → ⚙️ *Configuración del proyecto* → **Cloud Messaging** → *Certificados push web* → **Generar par de claves**.
2. Copia la clave y pégala en `firebase-config.js` en `VAPID_KEY`. Vuelve a publicar con `firebase deploy`.
3. Para enviar: Firebase → **Messaging** → *Nueva campaña* → *Notificaciones de Firebase* → escribe el mensaje → elige tu app web → **Publicar**.
   Les llega aunque tengan la app cerrada (a los que activaron 🔔).

### 🔕 Notificaciones sin molestar
- Los mensajes del chat avisan **máximo 1 vez cada 20 minutos**, agrupados ("💬 5 mensajes nuevos"). Las sugerencias y los deseos cada 30 min, las actividades cada 10 min.
- De **10 pm a 8 am** no suena nada (cada quien puede quitarlo).
- Cada persona elige qué recibir en **su menú (arriba a la derecha) → 🔔 Notificaciones**, y en el chat hay un botón 🔔/🔕 para silenciarlo.
- Un **puntito rojo** en la pestaña Buzón muestra cuántos mensajes y sugerencias no ha visto.
- Avisan de: chat, sugerencias nuevas, actividades nuevas, resultados, deseos nuevos de tu persona, cambios de fecha/lugar/reglas, pistas y noticias de tu angelito, sorteo, buzón, revelación y avisos del organizador.

## 📺 Modo fiesta
Admin → **📺 Modo fiesta → Abrir**. Conecta el teléfono o la computadora al TV y toca la pantalla (o las flechas del teclado) para avanzar:
portada → revelación de cada angelito (uno por uno, con suspenso) → quién adivinó → mensajes anónimos uno a uno → ganadores de las votaciones → adivinanzas de regalo y su ganador → ¡Feliz Navidad!
Después, si quieres que también quede en la app, toca **🎉 Revelar** en Admin → Sorteo.

## ✨ Más funciones
- **💛 Recibí mi regalo:** en Ruleta, cada quien avisa que recibió su regalo y le deja un mensaje a su angelito (solo él lo ve).
- **⭐ / 🛒 Deseos:** cada uno marca el deseo que más quiere. Quien te regala puede tocar "🛒 Este lo compro yo" en tu lista para acordarse (solo él lo ve).
- **💬 Chat:** toca un mensaje para reaccionar (❤️😂🔥👍😮🎄), responder citando o borrarlo.
- **📸 Fotos:** en Buzón → Fotos. Se guardan reducidas para que todo siga gratis.
- **🖼️ Invitación:** botón en Inicio. Crea una imagen lista para WhatsApp con la fecha, el lugar y la cuenta regresiva.
- **🔠 Letra grande:** botón **A+** arriba.
- **🎲 Trivia y 🕵️ ¿quién escribió el anónimo?:** van dentro del Modo fiesta. Los teléfonos muestran la pregunta en vivo y cada quien responde. Las preguntas de la trivia se editan en Admin → Modo fiesta → *Preguntas de la trivia* (o usa las de ejemplo).
- **📖 Recuerdos del año:** después de la fiesta, Admin → *Guardar recuerdos del año*. Queda en Inicio para siempre.
- **🔁 Nuevo año:** Admin → *Empezar nuevo año*. Borra lo del año y conserva participantes, perfiles, equipo, reglas y recuerdos.
- **⚡ Más rápida:** la app guarda una copia de los datos en el teléfono, abre al instante y funciona con poco internet.

## 🔄 Actualizaciones
Cada vez que publiques con `firebase deploy`, los teléfonos lo detectan en menos de un minuto (o al volver a abrir la app) y se refrescan solos.
Usa siempre la carpeta del zip más reciente (ya trae la versión marcada). Si cambias algo a mano, no toques `version.json`: los teléfonos se actualizarán la próxima vez que abran la app.

## 💌 Pistas, 🕵️ ¿quién es mi angelito? y 🎉 gran revelación
- Después de girar, en **Ruleta** cada quien puede mandarle hasta 10 **pistas** a su persona sin decir su nombre. Quien las recibe las ve en "Pistas de tu angelito".
- Cada uno elige **quién cree que es su angelito**. Nadie lo ve hasta la revelación.
- En la fiesta, en Admin → **Sorteo** tocas **🎉 Revelar**. Todos ven quién era el angelito de quién y quién adivinó.

## 😀 Ícono de perfil
Cada quien toca su avatar (arriba a la derecha) → **😀 Cambiar mi ícono** y elige uno de la galería o pega cualquier emoji. También desde Deseos → Mi lista.

## 👕 Perfil de gustos
En **Deseos → Mi lista → 👕 Mi perfil**, cada quien pone sus tallas, colores, gustos, alergias y lo que no quiere que le regalen. Su angelito lo ve junto a su lista.

## 📅 Calendario y 📍 cómo llegar
En Inicio hay botones para guardar el evento en el calendario (con recordatorio un día antes) y para abrir el lugar en Google Maps. En Admin → Evento puedes pegar el enlace exacto de Google Maps.

## ⏰ Recordatorios automáticos
La app avisa sola: "Faltan 3 días", "¡Mañana es el angelito!", "¡Hoy es el angelito!", "Hoy se abre el buzón" y "Mañana es el último día para confirmar".

## 📋 Exportar
En Admin → Asistencia y aportes: **Copiar para WhatsApp** (lista bonita) o **Copiar para Excel** (pégalo en una hoja).

## 🔮 Premio al que adivine
En Admin → *¿Qué crees que te van a regalar?* pones el premio. El día del intercambio tocas **Revelar adivinanzas**, cada quien anota lo que de verdad le regalaron, y eliges al ganador.

## 🔒 Seguridad (resumen)

- Las reglas de Firebase hacen que **solo cada persona (y tú) pueda leer a quién le tocó**. Ni siquiera otro participante que sepa de programación puede verlo.
- Nadie puede escribir ni borrar deseos en la lista de otro.
- En los mensajes anónimos, **ningún participante puede ver quién los escribió**, y la base de datos no los entrega hasta la fecha de apertura.
- 💡 En **Sugerencias**, cada quien decide si los demás ven su nombre. Tú, desde la misma pestaña, ves quién escribió cada una y puedes marcarlas como *En revisión*, *Aprobada*, *Hecho* o *No se hará*. Todos pueden votar 👍 por las que les gustan y se ordenan por votos; al final tú decides.
- 🕵️ **Solo tú**, desde Admin → Buzón anónimo → *Ver mensajes y autores*, puedes ver quién escribió cada uno. El autor se guarda aparte, en una colección que solo el organizador puede leer.
- Firebase frena a quien intente adivinar un PIN muchas veces seguidas (con App Check activado, mucho más).
- Solo los inscritos y el equipo organizador pueden leer los datos del grupo. Una persona que borres no puede volver a entrar con la misma cuenta.
- Al cerrar sesión se borra la copia local de esa persona en el teléfono (para teléfonos prestados).
- En el Modo fiesta, el autor de un anónimo **solo** se muestra si tocas *Revelar quién lo escribió*.
- Los recuerdos del año no incluyen las parejas hasta que hagas la gran revelación.
- Nadie puede ver el estado del regalo de otro (así nadie puede cruzar datos para adivinar quién es su angelito).
- Tú, como organizador, técnicamente podrías ver las parejas desde la consola de Firebase. La página no te las muestra.
