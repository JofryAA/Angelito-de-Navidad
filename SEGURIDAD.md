# 🔐 Seguridad y privacidad del Angelito

Este documento explica, para cualquier persona que quiera **auditar el código**, cómo la app protege lo confidencial:
**quién le regala a quién** y **quién escribió cada mensaje anónimo**. La meta es que ni el organizador, ni quien sea
dueño del proyecto de Firebase, pueda ver esa información en la base de datos antes de la gran revelación.

## Qué se protege y cómo

| Dato | Dónde vive | Quién lo puede leer |
|---|---|---|
| A quién le regala cada persona | `assignments/{quien regala}.vault`: cifrado con AES-256-GCM | Solo el servidor (GitHub Actions) |
| Tu persona, en tu teléfono | `assignments/{tú}.boxes.{teléfono}`: «cajita» cifrada con la llave de **ese** teléfono | Solo ese teléfono |
| Autor de un mensaje anónimo o de una idea anónima | `questionAuthors`, `suggestionAuthors`: cifrado con la llave pública del servidor | El servidor, y solo en la revelación |
| Pistas y estado del regalo | `hints`, `giftIncoming`: llevan un token `k`; la base solo guarda `sha256(k)` en `angelKey` | Las reglas comparan la huella sin saber quién es quién |
| «Lo compro yo» y el texto de las pistas que mandaste | Solo en tu teléfono (`localStorage`) | Solo tú |
| Las parejas en claro | `reveal/main`, solo **después** de que el organizador pide la revelación | Todos, en la fiesta |

### Las llaves
- **Llave del servidor**: se deriva (HKDF-SHA256) de la cuenta de servicio de Firebase, que existe **solo** como secreto
  cifrado de GitHub (`FIREBASE_ADMIN_KEY`). No está en la base de datos ni en el código.
  De ella salen una llave simétrica (para `vault`) y un par ECDH P-256 cuya parte pública se publica en `config/vault`.
- **Llave de cada teléfono**: la crea el navegador con WebCrypto (ECDH P-256, `extractable: false`) y se guarda en IndexedDB.
  La parte privada no se puede exportar, ni siquiera desde la propia app. Solo la pública sube a `devkeys/`.
- **Formato de las cajitas** (igual en `push/vault.mjs` y en `Web/js/app/00b-caja-fuerte.js`):
  ECDH P-256 efímero → HKDF-SHA256 (sal = llave efímera, info `angelito-caja-v1`) → AES-256-GCM con IV de 12 bytes.

### El sorteo
Lo hace el **servidor** (`push/vault.mjs → doDraw`), no el teléfono del organizador. El organizador solo deja un pedido
en `vaultOps`. Las parejas en claro existen un instante en la memoria de la tarea de GitHub y se guardan ya cifradas.
El «switch» (ajuste del sorteo) también corre en el servidor (`push/send.mjs → runFix`).

### La revelación
El organizador pide la revelación (`reveal/main` con `want: true`). El servidor abre las parejas y las publica.
Los autores de los anónimos se abren cuando llega la fecha de revelación (`config/event.revealAt` o `revealNow`).

## Qué NO puede hacer el organizador (ni el dueño del proyecto)
- Ver en la app o en la consola de Firebase a quién le tocó cada persona: solo hay texto cifrado.
- Leer `angelKey`, `vaultOps`, `devkeys`, `thanksFor`, ni los autores cifrados: las reglas (`firestore.rules`) lo prohíben
  incluso al organizador principal.

## Lo que sí podría hacer (y cómo se detectaría)
Ningún sistema puede impedir esto del todo a quien controla el código; por eso el código es abierto y auditable:
1. **Cambiar el código del servidor** para que imprima las parejas. → Queda en el historial de Git (fecha, autor, cambio)
   y en los registros de GitHub Actions. Revisa los cambios a `push/vault.mjs`, `push/send.mjs` y `.github/workflows/`.
2. **Cambiar la app** para mandar tu persona a otro lado cuando giras. → Queda en el historial de `Web/js/`.
3. **Usar la cuenta de servicio** fuera de GitHub. → La llave solo está en los secretos de GitHub; se puede rotar
   y Google registra su uso (Cloud Audit Logs).
4. **Correlacionar tiempos**: si alguien mira la base en vivo, podría ver que `giftStatus/{A}` y `giftIncoming/{B}` cambian
   en el mismo instante. Es un riesgo menor que se acepta a cambio de que el organizador vea cuántos ya compraron.

Para quitar también estas posibilidades, la propiedad de Firebase y GitHub puede pasarse a un **custodio** que no participe.

## Cómo auditar en 10 minutos
1. Lee `push/vault.mjs` completo: es corto y comentado. Busca cualquier `console.log` que imprima `r`, `pairs` o `uid`:
   solo se imprimen conteos.
2. Lee `Web/js/app/00b-caja-fuerte.js`: comprueba `extractable: false` y que lo descifrado no se guarda en ninguna parte.
3. En `firestore.rules`, busca `angelKey`, `vaultOps`, `devkeys`, `thanksFor`, `questionAuthors`, `suggestionAuthors`
   y la regla general del organizador (`match /{col}/{rest=**}`), que excluye esas colecciones.
4. Revisa el historial de Git de esos archivos (`git log -p -- push/vault.mjs`).
5. Las copias de seguridad nocturnas (`push/backup.mjs`) van cifradas; las anteriores a la caja fuerte se borraron.
