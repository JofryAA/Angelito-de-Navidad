# Angelito de Navidad

Aplicación web para organizar un intercambio de regalos navideño: inscripciones, sorteo secreto, listas de deseos, actividades, asistencia, chat y avisos. Se puede instalar como app en teléfonos compatibles.

## Estructura

- [`Web/`](./Web/): archivos de la aplicación; esta es la carpeta que se publica en Netlify.
- [`firestore.rules`](./firestore.rules): reglas de acceso para Firebase Firestore.
- [`LEEME.md`](./LEEME.md): guía detallada para configurar Firebase, publicar la página y usar la aplicación.

## Puesta en marcha

1. Crea un proyecto de Firebase y una app web.
2. Copia la configuración de Firebase en `Web/firebase-config.js`.
3. Configura Authentication y Firestore, y publica las reglas de `firestore.rules`.
4. Publica el contenido de la carpeta `Web/` en Netlify.

Sigue [`LEEME.md`](./LEEME.md) para ver los pasos completos, incluidas las opciones de seguridad y notificaciones. No abras `index.html` directamente como archivo local; publica la carpeta o sírvela desde un servidor web.

## Tecnologías

- HTML, CSS y JavaScript en módulos, sin proceso de compilación.
- Firebase Authentication y Cloud Firestore.
- Service worker y manifiesto web para instalación y funcionamiento como app.
