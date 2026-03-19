# 🔥 BurnLink — con Firebase

Links auto-destructivos que funcionan desde **cualquier dispositivo**.

## Estructura

```
burnlink/
├── index.html   ← HTML + config de Firebase
├── style.css    ← estilos
├── app.js       ← lógica + Firestore
└── README.md
```

---

## ✅ Paso 1 — Configurar Firebase

### 1.1 Obtener las credenciales

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com)
2. Seleccioná tu proyecto
3. ⚙️ **Project Settings** → pestaña **"Your apps"**
4. Si no tenés una Web App, hacé click en `</>` para crear una
5. Copiá el objeto `firebaseConfig`

### 1.2 Pegar las credenciales en index.html

Abrí `index.html` y reemplazá la sección marcada al final del archivo:

```js
const firebaseConfig = {
  apiKey:            "TU_API_KEY",           // ← reemplazar
  authDomain:        "TU_PROJECT_ID.firebaseapp.com",
  projectId:         "TU_PROJECT_ID",        // ← reemplazar
  storageBucket:     "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_SENDER_ID",         // ← reemplazar
  appId:             "TU_APP_ID"             // ← reemplazar
};
```

---

## ✅ Paso 2 — Configurar Firestore

1. En Firebase Console → **Firestore Database** → **Crear base de datos**
2. Elegí **"Modo de producción"**
3. Seleccioná la región más cercana (ej: `us-east1`)
4. Una vez creada, ir a la pestaña **"Reglas"** y pegar esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /burnlinks/{id} {
      allow read, write: true;
    }
  }
}
```

> ⚠️ Estas reglas permiten acceso público. Si querés proteger la app, luego podés agregar autenticación.

5. Click en **Publicar**

---

## ✅ Paso 3 — Subir a GitHub

```bash
git init
git add .
git commit -m "init: BurnLink con Firebase"
git remote add origin https://github.com/TU_USUARIO/burnlink.git
git push -u origin main
```

---

## ✅ Paso 4 — Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New Project**
2. Importá tu repositorio de GitHub
3. Dejá todo por defecto (es un sitio estático, sin build)
4. Click en **Deploy** ✅

---

## Funcionalidades

| Feature | Descripción |
|---|---|
| ☁️ Cloud | Links guardados en Firestore, visibles desde cualquier dispositivo |
| ⏱ Expiración | 5 min / 30 min / 1 hora / 1 día / 1 semana / Custom |
| 🔥 One-use | El link muere después de 1 visita (transacción atómica) |
| ⏳ Countdown | Timer de 3 segundos antes de redirigir |
| 🗑 Borrar | Eliminar links individualmente o limpiar todo |
| 🔄 Tiempo real | El historial se actualiza solo vía `onSnapshot` |
