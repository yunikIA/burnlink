# 🔥 BurnLink

Links que se autodestruyen — generá URLs con tiempo de expiración y/o un solo uso.

## Estructura del proyecto

```
burnlink/
├── index.html   ← estructura HTML
├── style.css    ← estilos
├── app.js       ← lógica JS
└── README.md
```

## Deploy en Vercel (paso a paso)

### 1. Subir a GitHub

1. Creá un repositorio nuevo en [github.com](https://github.com)
2. Subí los 3 archivos (`index.html`, `style.css`, `app.js`)

```bash
git init
git add .
git commit -m "init: BurnLink"
git remote add origin https://github.com/TU_USUARIO/burnlink.git
git push -u origin main
```

### 2. Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) e iniciá sesión con GitHub
2. Click en **"Add New Project"**
3. Importá tu repositorio `burnlink`
4. En la configuración dejá todo como está (no necesita build)
5. Click en **Deploy** ✅

Vercel detecta automáticamente que es un sitio estático y lo publica al instante.

---

## ⚠️ Limitación importante

Como es **100% frontend**, los links se guardan en el `localStorage` del navegador.
Esto significa que los links **solo funcionan en el mismo dispositivo** donde fueron creados.

Para links que funcionen entre distintos dispositivos necesitarías un backend (Node.js + base de datos).

## Funcionalidades

- ⏱ Duración configurable: 5 min, 30 min, 1 hora, 1 día, 1 semana o custom
- 🔥 Destruir al primer click (one-use)
- ⏳ Cuenta regresiva visible antes de redirigir
- 📋 Historial de links con countdown en tiempo real
- 💀 Pantalla de "Link Destruido" cuando el link expiró
