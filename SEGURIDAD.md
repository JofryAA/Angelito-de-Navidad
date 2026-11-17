# 🔐 Seguridad y privacidad del Angelito

Este documento explica, para cualquier persona que quiera **auditar el código**, cómo la app protege lo confidencial:
**quién le regala a quién** y **quién escribió cada mensaje anónimo**. La meta es que ni el organizador, ni quien sea
dueño del proyecto de Firebase, pueda ver esa información en la base de datos antes de la gran revelación.

## Qué se protege y cómo

| Dato | Dónde vive | Quién lo puede leer |
|---|---|---|
| A quién le regala cada persona | `assignments/{quien regala}.vault`: cifrado con AES-256-GCM | Solo el servidor (GitHub Actions) |
| Tu persona, en tu teléfono | `assignments/{tú}.boxes.{teléfono}`: «cajita» cifrada con la llave de **ese** teléfono | Solo ese teléfono |
| Autor de un mensaje anónimo o de una idea anónima | `questionAuthors`, `suggestionAuthors`: cifrado (primero con la llave pública del servidor, luego sellado por él) | El servidor; las preguntas se abren en la revelación, las ideas nunca |
| Pistas y estado del regalo | `hints`, `giftIncoming`: llevan un token `k`; la base solo guarda `sha256(k)` en `angelKey` | Las reglas comparan la huella sin saber quién es quién |
| «Lo compro yo» y el texto de las pistas que mandaste | Solo en tu teléfono (`localStorage`) | Solo tú |
| Las parejas en claro | `reveal/main`, solo **después** de que el organizador pide la revelación | Todos, en la fiesta |

### Las llaves
- **Llave del servidor**: se deriva (HKDF-SHA256, info `caja-fuerte-v2`) del secreto de GitHub `VAULT_KEY`, que no tiene
  nada que ver con Firebase: tener la cuenta de servicio o ser dueño del proyecto de Firebase **no** basta para abrir la caja.
  Un secreto de GitHub no se puede volver a leer una vez guardado (ni por el dueño del repositorio); solo lo recibe la
  tarea del servidor. Al activarla, la «migración 3» volvió a cifrar todo con ella y borró las copias de seguridad
  anteriores. (Antes de `VAULT_KEY`, la llave salía de la cuenta de servicio: versión 1.)
  ⚠️ Si `VAULT_KEY` se borra o se cambia, las parejas cifradas no se pueden recuperar.
  De ella salen una llave simétrica (para `vault`) y un par ECDH P-256 cuya parte pública está **fija en el código de la app**
  (`SERVER_PUB` en `00b-caja-fuerte.js`); el servidor la imprime en el registro de GitHub Actions («Caja fuerte: llave pública …») para que cualquiera la compare.
- **Llave de cada teléfono**: la crea el navegador con WebCrypto (ECDH P-256, `extractable: false`) y se guarda en IndexedDB.
  La parte privada no se puede exportar, ni siquiera desde la propia app. Solo la pública sube a `devkeys/`.
- **Formato de las cajitas** (igual en `push/vault.mjs` y en `Web/js/app/00b-caja-fuerte.js`):
  ECDH P-256 efímero → HKDF-SHA256 (sal = llave efímera, info `angelito-caja-v1`) → AES-256-GCM con IV de 12 bytes.

### El sorteo
Lo hace el **servidor** (`push/vault.mjs → doDraw`), no el teléfono del organizador. El organizador solo deja un pedido
en `vaultOps`. Las parejas en claro existen un instante en la memoria de la tarea de GitHub y se guardan ya cifradas.
Cada `vault` va atado a su dueño (`g`): copiar el `vault` de A en la ficha de B no le muestra a B la persona de A.
El organizador **no puede crear ni cambiar** documentos de `assignments` (solo borrarlos), ni `config/draw`, `config/vault`
ni `config/revealGate`.

**Restricciones («a X no le puede salir Y»).** Bien usadas evitan parejas incómodas; mal usadas podrían *forzar* una pareja
(dejar a alguien con un solo angelito posible). Por eso el servidor (`optsOK`) y la app exigen que cada persona pueda
**regalar a** y **recibir de** al menos un tercio del grupo (mínimo 2). Esto evita forzar una pareja de forma directa;
combinando restricciones todavía se puede *reducir* las opciones de alguien, así que lo ideal es usar pocas.

**El «switch»** (`push/send.mjs → runFix`): quienes ya giraron conservan su persona (si sigue siendo válida) y **todos los
demás se sortean de nuevo al azar**; si así no hay solución, se sortea todo de nuevo. El resultado no depende de las
parejas viejas de quienes no han girado, y siempre se aplica igual (recifra todo, reinicia el progreso de regalos y pistas
de todos y avisa a todos), así que no sirve para averiguar parejas. Si falla, es solo porque las restricciones lo impiden.

### La revelación
El organizador pide la revelación (`reveal/main` con `want: true`; las reglas no le dejan escribir parejas). El servidor
solo la acepta el día del evento (desde 3 h antes de `eventAt`) o pasada `revealAt`; si no, la rechaza y lo anota.
Los autores de **preguntas** anónimas solo se abren después de una revelación anotada en `revealLog`. Los autores de las
**ideas** anónimas no se abren nunca.

### Autores de anónimos
El teléfono cifra para el servidor: quién es, en qué mensaje (`col`/`id`) y su credencial de Firebase (vale 1 hora).
El servidor comprueba la credencial y lo guarda sellado. Así nadie puede escribir un anónimo «a nombre de» otra persona.

### Registro público y avisos
`vaultLog` (lo escribe solo el servidor; todos lo ven en la app: tu cuenta → 🔐 Caja fuerte) anota sorteos, ajustes,
cambios de PIN, revelaciones (y las rechazadas) y teléfonos agregados. Ahí mismo cada persona ve **cuántos teléfonos pueden
abrir su persona** y si la cajita de su teléfono es de verdad para él. Un cambio de PIN avisa a todo el grupo; un teléfono
nuevo (o el mismo con otra llave) avisa a la persona.

## Qué NO puede hacer nadie (ni el organizador ni el dueño del proyecto)
- **Leer** las parejas o los autores en la base de datos o la consola: solo hay texto cifrado, y la llave (`VAULT_KEY`)
  no está en Firebase.
- Como organizador, leer `angelKey`, `vaultOps`, `devkeys`, `thanksFor`, `giftIncoming`, `hints` ni los autores cifrados.

## El límite honesto: hacerse pasar por alguien
La caja fuerte le da a cada persona **su** cajita según quién inició sesión. Por eso, quien logre entrar **como otra
persona** puede ver lo que vería esa persona (solo su pareja, no las demás). Formas de lograrlo y cómo se notan:
1. **Adivinar el PIN** (4 números). Firebase frena los intentos repetidos, pero no es imposible. → A la víctima le llega
   el aviso de teléfono nuevo y lo ve en 🔐 Caja fuerte. Mejora posible: activar App Check / reCAPTCHA en Firebase.
2. **Organizador: restablecer el PIN de alguien** (o mover su cuenta) y entrar con el PIN nuevo. → Avisa a todo el grupo
   y queda en el registro; la persona deja de poder entrar con su PIN.
3. **Dueño del proyecto de Firebase o de la cuenta de servicio**: puede crear sesiones o llaves de teléfono a nombre de
   otra persona. → Aviso de teléfono nuevo a la víctima y anotación en el registro (salvo que además cambie el código).
4. **Cambiar el código** del servidor o de la app (por ejemplo, para imprimir `VAULT_KEY` o las parejas). → Queda en el
   historial de Git y en los registros de GitHub Actions. Revisa `push/`, `Web/js/` y `.github/workflows/`.
5. **Desplegar fuera de Git** (`firebase deploy` desde una computadora). → Firebase Hosting guarda el historial de
   versiones con fecha; compáralo con los despliegues de GitHub Actions.
6. **Adelantar la revelación** cambiando la fecha del evento. → Queda en el registro y todos reciben el aviso.
7. **Correlacionar tiempos**: mirando la base en vivo se podría relacionar, por la hora, `giftStatus/{A}` con
   `giftIncoming/{B}`, o un mensaje anónimo con quién estaba en línea. Riesgo menor que se acepta.

Para quitar también estas posibilidades, la propiedad de Firebase y GitHub puede pasarse a un **custodio** que no participe.

## Cómo auditar en 10 minutos
1. Lee `push/vault.mjs` completo: es corto y comentado. Busca cualquier `console.log` que imprima `r`, `pairs` o `uid`:
   solo se imprimen conteos.
2. Lee `Web/js/app/00b-caja-fuerte.js`: comprueba `extractable: false` y que lo descifrado no se guarda en ninguna parte.
3. En `firestore.rules`, busca `assignments`, `giftIncoming`, `hints`, `angelKey`, `vaultOps`, `devkeys`, `thanksFor`, `questionAuthors`, `suggestionAuthors`
   y la regla general del organizador (`match /{col}/{rest=**}`), que excluye esas colecciones (y `config`, `reveal`, `vaultLog`, `revealLog`, que tienen sus propias reglas).
4. Revisa el historial de Git de esos archivos (`git log -p -- push/vault.mjs`).
5. Las copias de seguridad nocturnas (`push/backup.mjs`) van cifradas con una clave que sale de `VAULT_KEY`; guardan 7
   días (incluido lo borrado en ese tiempo). Las anteriores a la caja fuerte se borraron.
6. Corre `node --check` y lee los avisos que manda `push/send.mjs` (solo cuentan cosas, nunca nombres de parejas).
