/* ============================================================
   BurnLink — viewer.js  (solo viewer, sin formulario)
   ============================================================ */
'use strict';

const db       = firebase.firestore();
const linksCol = db.collection('burnlinks');

function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('active', on);
}
function formatBytes(b) {
  if (b < 1024)    return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function getFileIcon(mime='') {
  if (mime.includes('pdf'))   return '📄';
  if (mime.includes('video')) return '🎥';
  if (mime.includes('audio')) return '🎵';
  if (mime.includes('zip') || mime.includes('rar')) return '📦';
  return '📎';
}

/* ── Iframe para URLs ── */
function openInIframe(url) {
  document.getElementById('viewer-overlay').classList.remove('active');
  const overlay  = document.getElementById('iframe-overlay');
  const frame    = document.getElementById('content-frame');
  const fallback = document.getElementById('iframe-fallback');
  overlay.classList.add('active');

  let loaded = false;
  const blockTimer = setTimeout(() => {
    if (!loaded) {
      frame.style.display = 'none';
      fallback.classList.add('active');
      let count = 3;
      document.getElementById('fallback-countdown').textContent = count;
      const iv = setInterval(() => {
        count--;
        document.getElementById('fallback-countdown').textContent = count;
        if (count <= 0) { clearInterval(iv); window.location.href = url; }
      }, 1000);
    }
  }, 3000);
  frame.src = url;
  frame.onload = () => { loaded = true; clearTimeout(blockTimer); };
}

/* ── Render contenido ── */
function renderContent(link) {
  const body = document.getElementById('viewer-body');
  const { type, content } = link;

  if (type === 'text') {
    body.innerHTML = `
      <div class="viewer-text-wrap">
        <p class="viewer-label">MENSAJE SECRETO</p>
        <div class="viewer-text">${content.text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
      </div>`;

  } else if (type === 'url') {
    openInIframe(content.url);
    return;

  } else if (type === 'image' || type === 'qr') {
    const label = type === 'qr' ? 'CÓDIGO QR' : 'IMAGEN SECRETA';
    const cls   = type === 'qr' ? 'viewer-qr' : 'viewer-image';
    const hint  = type === 'qr' ? '<p class="viewer-qr-hint">Escaneá el código con tu cámara</p>' : '';
    body.innerHTML = `
      <div class="viewer-image-wrap">
        <p class="viewer-label">${label}</p>
        <img src="${content.url}" alt="${label}" class="${cls}" />
        ${hint}
      </div>`;

  } else if (type === 'audio') {
    body.innerHTML = `
      <div class="viewer-media-wrap">
        <p class="viewer-label">AUDIO SECRETO 🎵</p>
        <div class="viewer-audio-card">
          <div class="audio-wave">
            <span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <p class="viewer-media-name">${content.name}</p>
          <audio id="secret-audio" controls style="width:100%;margin-top:16px;border-radius:8px;">
            <source src="${content.url}" type="${content.mimeType}">
          </audio>
        </div>
      </div>`;
    setTimeout(() => {
      const a = document.getElementById('secret-audio');
      if (a) a.play().catch(() => {});
    }, 400);

  } else if (type === 'video') {
    body.innerHTML = `
      <div class="viewer-media-wrap">
        <p class="viewer-label">VIDEO SECRETO 🎥</p>
        <video id="secret-video" controls playsinline
          style="max-width:100%;max-height:75vh;border-radius:12px;border:1px solid var(--border);display:block;margin:0 auto;">
          <source src="${content.url}" type="${content.mimeType}">
        </video>
        <p class="viewer-media-name" style="margin-top:12px;">${content.name}</p>
      </div>`;
    setTimeout(() => {
      const v = document.getElementById('secret-video');
      if (v) v.play().catch(() => {});
    }, 400);

  } else if (type === 'file') {
    const icon = getFileIcon(content.mimeType);
    body.innerHTML = `
      <div class="viewer-file-wrap">
        <p class="viewer-label">ARCHIVO SECRETO</p>
        <div class="viewer-file-card">
          <div class="viewer-file-icon">${icon}</div>
          <div class="viewer-file-info">
            <div class="viewer-file-name">${content.name}</div>
            <div class="viewer-file-size">${formatBytes(content.size)}</div>
          </div>
        </div>
        <a href="${content.url}" download="${content.name}" class="btn-download" target="_blank">
          ⬇ Descargar archivo
        </a>
        <p class="viewer-file-warn">⚠️ Descargá ahora — este link no funcionará de nuevo</p>
      </div>`;
  }
}

/* ── Mostrar pantalla genérica ── */
function showGeneric() {
  setLoading(false);
  const g = document.getElementById('generic-screen');
  if (g) { g.style.display = 'flex'; }
}

/* ── Main ── */
(async function init() {
  // Timeout de seguridad: si en 8 segundos no pasa nada, mostrar genérica
  const safetyTimer = setTimeout(() => {
    showGeneric();
  }, 8000);

  try {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');

    // Sin ?id= → página genérica
    if (!id) {
      clearTimeout(safetyTimer);
      showGeneric();
      return;
    }

    // Limpiar URL inmediatamente
    history.replaceState(null, '', '/');

    const docSnap = await linksCol.doc(id).get();
    clearTimeout(safetyTimer);

    if (!docSnap.exists) {
      setLoading(false);
      document.getElementById('expired-overlay').classList.add('active');
      return;
    }

    const link = docSnap.data();
    const now  = Date.now();

    if (now > link.expiresAt || (link.oneUse && link.used)) {
      setLoading(false);
      document.getElementById('expired-overlay').classList.add('active');
      return;
    }

    // Marcar como usado (atómico)
    if (link.oneUse) {
      try {
        await db.runTransaction(async tx => {
          const fresh = await tx.get(linksCol.doc(id));
          if (fresh.data().used) throw new Error('already_used');
          tx.update(linksCol.doc(id), { used: true });
        });
      } catch(err) {
        if (err.message === 'already_used') {
          setLoading(false);
          document.getElementById('expired-overlay').classList.add('active');
          return;
        }
        throw err;
      }
    }

    setLoading(false);

    // Countdown → contenido
    const viewerOverlay   = document.getElementById('viewer-overlay');
    const countdownScreen = document.getElementById('viewer-countdown-screen');
    const contentScreen   = document.getElementById('viewer-content-screen');
    viewerOverlay.classList.add('active');

    let count = 3;
    document.getElementById('viewer-counter').textContent = count;

    const interval = setInterval(() => {
      count--;
      document.getElementById('viewer-counter').textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        countdownScreen.style.display = 'none';
        renderContent(link);
        contentScreen.style.display = 'flex';
      }
    }, 1000);

  } catch(err) {
    clearTimeout(safetyTimer);
    console.error('Viewer error:', err);
    // En caso de error mostrar genérica, no quedarse trabado
    showGeneric();
  }
})();
