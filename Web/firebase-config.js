//    (Consola de Firebase → ⚙️ Configuración del proyecto → Tus apps → App web → firebaseConfig)
export const firebaseConfig = {
  apiKey: "AIzaSyD6BwRJqhbeDyEwAHHozzrIjOA-qxGNLu8",
  authDomain: "angelito-2026.firebaseapp.com",
  projectId: "angelito-2026",
  storageBucket: "angelito-2026.firebasestorage.app",
  messagingSenderId: "475904151458",
  appId: "1:475904151458:web:6b0204a817b468bbb2acfb"
};

// 2) Correo del organizador. Debe ser EXACTAMENTE el mismo que pongas en
//    Firebase → Authentication → Usuarios, y el mismo que está en firestore.rules.
//    Nadie lo escribe: en la página solo se pide la contraseña.
export const ADMIN_EMAIL = "admin@angelito.app";

// 3) (Opcional) Notificaciones push con la app cerrada.
//    Firebase → ⚙️ Configuración del proyecto → Cloud Messaging → Certificados push web → Generar par de claves.
//    Pega aquí la "clave pública". Si lo dejas vacío, igual hay avisos dentro de la app.
export const VAPID_KEY = "";

// 4) (Recomendado) Protección contra robots y ataques (App Check con reCAPTCHA v3).
//    Ver LEEME → "Protección extra". Si lo dejas vacío, la app funciona igual.
export const RECAPTCHA_KEY = "";
