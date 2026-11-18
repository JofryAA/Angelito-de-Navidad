# Angelito de Navidad

Aplicación web (PWA) para organizar un intercambio de regalos navideño: inscripciones, sorteo secreto, ruleta, listas de
deseos, mensajes anónimos, actividades, asistencia, chat, juegos y avisos. Se publica en Firebase Hosting y se puede
instalar como app en el teléfono.

## 🔐 Privacidad: quién puede ver qué

Las parejas del sorteo, los autores de los mensajes anónimos, las pistas y lo que recibe cada persona van **cifrados**.
Nadie los puede leer en la base de datos, **ni el organizador ni el dueño del proyecto de Firebase**: solo el servidor
del sorteo tiene la llave (`VAULT_KEY`, un secreto de GitHub que nadie puede volver a leer). Cada teléfono recibe solo
lo que le toca a esa persona.

**Para auditar, empieza por [`SEGURIDAD.md`](./SEGURIDAD.md)**: explica el diseño, los riesgos que quedan, la historia
del proyecto y trae una guía para revisarlo en 10 minutos.

## Estructura

| Carpeta / archivo | Qué es |
|---|---|
| [`Web/`](./Web/) | La app que se publica. `Web/js/app/` y `Web/js/juegos/` son el código por temas; `tools/build-app.mjs` los une. |
| [`Web/js/app/00b-caja-fuerte.js`](./Web/js/app/00b-caja-fuerte.js) | Cifrado en el teléfono (llave del teléfono, cajitas, envío cifrado al servidor). |
| [`push/vault.mjs`](./push/vault.mjs) | La caja fuerte del servidor: sorteo, cifrado, cajitas, revelación y registro público. |
| [`push/send.mjs`](./push/send.mjs) | Tarea del servidor (cada ~2 min): avisos, ajuste del sorteo, limpieza, copias de seguridad. |
| [`firestore.rules`](./firestore.rules), [`database.rules.json`](./database.rules.json) | Quién puede leer y escribir cada cosa. |
| [`.github/workflows/`](./.github/workflows/) | Cómo se publica la app y cómo corre el servidor (todo a la vista en GitHub Actions). |
| [`LEEME.md`](./LEEME.md) | Guía para configurar y usar la app. |

## Cómo comprobar que lo publicado es este código

La app y las reglas se publican **solo** con GitHub Actions (`.github/workflows/deploy.yml`) a partir de este
repositorio; cada publicación queda registrada con su commit. Firebase Hosting guarda además su propio historial de
versiones con fecha, para compararlo.

## Tecnologías

- HTML, CSS y JavaScript en módulos (sin frameworks).
- Firebase Authentication, Cloud Firestore, Realtime Database (juegos) y Hosting.
- Web Crypto (ECDH P-256 + HKDF + AES-GCM) en el teléfono y Node.js en el servidor.
- Service worker y manifiesto web para instalarla como app.
