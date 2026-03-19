/* ============================================================
   BurnLink — app.js  v3  (Storage + multi-content)
   ============================================================ */
'use strict';

const db       = firebase.firestore();
const storage  = firebase.storage();
const linksCol = db.collection('burnlinks');

/* ── State ── */
let selectedSeconds = 3600;
let currentType     = 'text';
let localLinks      = [];
let selectedFile    = null;   // File object para imagen/archivo/qr

const TYPE_LABELS = { text: '✉️ Mensaje', url: '🔗 Link', image: '🖼️ Imagen', file: '📎 Archivo', qr: '◼️ QR' };

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function generateId(len = 12) {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}
function formatDuration(s) {
  if (s < 60)     return s + ' seg';
  if (s < 3600)   return Math.round(s/60) + ' min';
  if (s < 86400)  return Math.round(s/3600) + ' h';
  if (s < 604800) return Math.round(s/86400) + ' día(s)';
  return Math.round(s/604800) + ' semana(s)';
}
function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms/1000));
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s/60) + 'm ' + (s%60) + 's';
  return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
}
function formatBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function getBaseUrl() { return window.location.origin + '/'; }
function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('active', on);
}
function showToast(msg, type='') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast '+type;
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════════
   TYPE SELECTOR
══════════════════════════════════════════════ */
const CONTENT_LABELS = {
  text:  '// mensaje secreto',
  url:   '// link de destino',
  image: '// subir imagen',
  file:  '// subir archivo',
  qr:    '// subir código QR',
};

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentType = this.dataset.type;
    document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + currentType).classList.add('active');
    document.getElementById('content-label').textContent = CONTENT_LABELS[currentType];
    selectedFile = null;
  });
});

/* ══════════════════════════════════════════════
   FILE UPLOAD ZONES
══════════════════════════════════════════════ */
function setupUploadZone(zoneId, inputId, type) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file, type);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) handleFileSelect(input.files[0], type);
  });
}

function handleFileSelect(file, type) {
  const maxMB = type === 'file' ? 50 : 10;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`El archivo supera los ${maxMB}MB.`, 'error'); return;
  }
  selectedFile = file;

  if (type === 'image' || type === 'qr') {
    const reader = new FileReader();
    reader.onload = e => {
      if (type === 'image') {
        document.getElementById('preview-img').src = e.target.result;
        document.getElementById('upload-zone-image').style.display = 'none';
        document.getElementById('preview-image').style.display = 'block';
      } else {
        document.getElementById('preview-qr-img').src = e.target.result;
        document.getElementById('upload-zone-qr').style.display = 'none';
        document.getElementById('preview-qr').style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('preview-filename').textContent = file.name;
    document.getElementById('preview-filesize').textContent = formatBytes(file.size);
    document.getElementById('upload-zone-file').style.display = 'none';
    document.getElementById('preview-file').style.display = 'block';
  }
}

function removeFile(type) {
  selectedFile = null;
  if (type === 'image') {
    document.getElementById('upload-zone-image').style.display = 'flex';
    document.getElementById('preview-image').style.display = 'none';
    document.getElementById('input-image').value = '';
  } else if (type === 'file') {
    document.getElementById('upload-zone-file').style.display = 'flex';
    document.getElementById('preview-file').style.display = 'none';
    document.getElementById('input-file').value = '';
  } else if (type === 'qr') {
    document.getElementById('upload-zone-qr').style.display = 'flex';
    document.getElementById('preview-qr').style.display = 'none';
    document.getElementById('input-qr').value = '';
  }
}

setupUploadZone('upload-zone-image', 'input-image', 'image');
setupUploadZone('upload-zone-file',  'input-file',  'file');
setupUploadZone('upload-zone-qr',    'input-qr',    'qr');

/* ══════════════════════════════════════════════
   DURATION SELECTOR
══════════════════════════════════════════════ */
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const val = this.dataset.seconds;
    document.getElementById('custom-duration').classList.toggle('visible', val === 'custom');
    selectedSeconds = val === 'custom' ? null : parseInt(val, 10);
  });
});

function getSelectedSeconds() {
  if (selectedSeconds !== null) return selectedSeconds;
  const val  = parseInt(document.getElementById('custom-value').value, 10);
  const unit = parseInt(document.getElementById('custom-unit').value, 10);
  if (isNaN(val) || val <= 0) return null;
  return val * unit;
}

/* ══════════════════════════════════════════════
   UPLOAD FILE TO STORAGE
══════════════════════════════════════════════ */
function uploadFile(file, id) {
  return new Promise((resolve, reject) => {
    const ext  = file.name.split('.').pop();
    const ref  = storage.ref(`burnlinks/${id}/${Date.now()}.${ext}`);
    const task = ref.put(file);

    const progressCard = document.getElementById('upload-progress-card');
    const fill         = document.getElementById('progress-bar-fill');
    const pct          = document.getElementById('progress-pct');
    progressCard.style.display = 'block';

    task.on('state_changed',
      snap => {
        const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        fill.style.width = p + '%';
        pct.textContent  = p + '%';
      },
      err => { progressCard.style.display = 'none'; reject(err); },
      async () => {
        progressCard.style.display = 'none';
        const url = await task.snapshot.ref.getDownloadURL();
        resolve({ url, name: file.name, size: file.size, mimeType: file.type });
      }
    );
  });
}

/* ══════════════════════════════════════════════
   GENERATE LINK
══════════════════════════════════════════════ */
async function generateLink() {
  const secs = getSelectedSeconds();
  if (!secs) { showToast('Ingresá una duración válida.', 'error'); return; }

  const oneUse = document.getElementById('toggle-oneuse').classList.contains('on');
  const id     = generateId();

  // Validar contenido según tipo
  let contentData = {};
  if (currentType === 'text') {
    const txt = document.getElementById('input-text').value.trim();
    if (!txt) { showToast('Escribí un mensaje.', 'error'); return; }
    contentData = { text: txt };

  } else if (currentType === 'url') {
    const url = document.getElementById('input-url').value.trim();
    if (!url) { showToast('Ingresá una URL.', 'error'); return; }
    try { new URL(url); } catch {
      showToast('Ingresá una URL válida (ej: https://ejemplo.com)', 'error'); return;
    }
    contentData = { url };

  } else if (currentType === 'image' || currentType === 'qr') {
    if (!selectedFile) { showToast('Seleccioná una imagen.', 'error'); return; }

  } else if (currentType === 'file') {
    if (!selectedFile) { showToast('Seleccioná un archivo.', 'error'); return; }
  }

  const btn = document.getElementById('btn-generate');
  btn.disabled = true; btn.textContent = 'Generando...';

  try {
    // Upload si hay archivo
    if (selectedFile) {
      btn.textContent = 'Subiendo archivo...';
      const uploaded = await uploadFile(selectedFile, id);
      contentData = { ...uploaded };
    }

    const linkData = {
      id,
      type: currentType,
      content: contentData,
      expiresAt: Date.now() + secs * 1000,
      oneUse,
      used:     false,
      created:  Date.now(),
      duration: secs,
    };

    await linksCol.doc(id).set(linkData);

    const burnUrl = getBaseUrl() + '?id=' + id;
    document.getElementById('generated-link').textContent = burnUrl;
    document.getElementById('expiry-label').textContent   = formatDuration(secs);
    document.getElementById('oneuse-chip').style.display  = oneUse ? 'flex' : 'none';
    document.getElementById('type-chip').textContent      = TYPE_LABELS[currentType];

    const rc = document.getElementById('result-card');
    rc.classList.add('visible');
    rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast('🔥 BurnLink generado!', 'success');

    // Reset form
    document.getElementById('input-text').value = '';
    document.getElementById('input-url').value  = '';
    selectedFile = null;
    ['image','file','qr'].forEach(t => removeFile(t));

  } catch(err) {
    console.error(err);
    showToast('Error al generar. Intentá de nuevo.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🔥 Generar BurnLink';
  }
}

/* ══════════════════════════════════════════════
   COPY
══════════════════════════════════════════════ */
function copyLink() {
  const link = document.getElementById('generated-link').textContent;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copiado'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
  });
}

/* ══════════════════════════════════════════════
   VIEWER — muestra el contenido según tipo
══════════════════════════════════════════════ */
function renderContent(link) {
  const body = document.getElementById('viewer-body');
  const { type, content } = link;

  if (type === 'text') {
    body.innerHTML = `
      <div class="viewer-text-wrap">
        <p class="viewer-label">MENSAJE SECRETO</p>
        <div class="viewer-text">${content.text.replace(/\n/g,'<br>')}</div>
      </div>`;

  } else if (type === 'url') {
    // Para URLs usamos iframe con fallback igual que antes
    openInIframe(content.url);
    return;

  } else if (type === 'image') {
    body.innerHTML = `
      <div class="viewer-image-wrap">
        <p class="viewer-label">IMAGEN SECRETA</p>
        <img src="${content.url}" alt="Imagen secreta" class="viewer-image" />
      </div>`;

  } else if (type === 'qr') {
    body.innerHTML = `
      <div class="viewer-image-wrap">
        <p class="viewer-label">CÓDIGO QR</p>
        <img src="${content.url}" alt="QR" class="viewer-qr" />
        <p class="viewer-qr-hint">Escaneá el código con tu cámara</p>
      </div>`;

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
        <p class="viewer-file-warn">⚠️ Este link ya no funcionará después de descargarlo</p>
      </div>`;
  }
}

function getFileIcon(mime='') {
  if (mime.includes('pdf'))   return '📄';
  if (mime.includes('video')) return '🎥';
  if (mime.includes('audio')) return '🎵';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '📦';
  return '📎';
}

/* ══════════════════════════════════════════════
   IFRAME VIEWER (para tipo URL)
══════════════════════════════════════════════ */
function openInIframe(url) {
  // Ocultar viewer overlay normal y mostrar iframe
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
      const interval = setInterval(() => {
        count--;
        document.getElementById('fallback-countdown').textContent = count;
        if (count <= 0) { clearInterval(interval); window.location.href = url; }
      }, 1000);
    }
  }, 3000);

  frame.src = url;
  frame.onload = () => { loaded = true; clearTimeout(blockTimer); };
}

/* ══════════════════════════════════════════════
   HANDLE INCOMING LINK
══════════════════════════════════════════════ */
async function checkForBurnLink() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  if (!id) return;

  history.replaceState(null, '', window.location.pathname);
  setLoading(true);

  try {
    const docSnap = await linksCol.doc(id).get();

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

    // Marcar como usado (transacción atómica)
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

    // Mostrar viewer con countdown
    const viewerOverlay      = document.getElementById('viewer-overlay');
    const countdownScreen    = document.getElementById('viewer-countdown-screen');
    const contentScreen      = document.getElementById('viewer-content-screen');
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
        contentScreen.style.display   = 'flex';
      }
    }, 1000);

  } catch(err) {
    setLoading(false);
    console.error(err);
    showToast('Error al verificar el link.', 'error');
  }
}

/* ══════════════════════════════════════════════
   HISTORY (solo lectura)
══════════════════════════════════════════════ */
function renderHistory() {
  const container = document.getElementById('links-list');
  const now       = Date.now();
  if (!localLinks.length) {
    container.innerHTML = '<div class="empty-state">// tus links generados aparecen acá</div>';
    return;
  }
  container.innerHTML = localLinks.slice(0,10).map(link => {
    const expired   = now > link.expiresAt || (link.oneUse && link.used);
    const remaining = link.expiresAt - now;
    const burnUrl   = getBaseUrl() + '?id=' + link.id;
    const shortUrl  = burnUrl.length > 44 ? burnUrl.substring(0,44)+'…' : burnUrl;
    const typeLabel = TYPE_LABELS[link.type] || '🔗';
    const right     = expired
      ? '<span class="expired-badge">DESTRUIDO</span>'
      : `<div class="countdown" data-expires="${link.expiresAt}">${formatCountdown(remaining)}</div>`;
    return `
      <div class="link-item${expired?' expired':''}" data-id="${link.id}">
        <div class="link-item-info">
          <div class="link-item-url" title="${burnUrl}">${shortUrl}</div>
          <div class="link-item-meta">${typeLabel}</div>
        </div>
        <div class="link-item-actions">${right}</div>
      </div>`;
  }).join('');
}

setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.countdown[data-expires]').forEach(el => {
    const rem = parseInt(el.dataset.expires,10) - now;
    if (rem <= 0) { el.closest('.link-item')?.classList.add('expired'); el.outerHTML='<span class="expired-badge">DESTRUIDO</span>'; }
    else el.textContent = formatCountdown(rem);
  });
}, 1000);

function startListener() {
  linksCol.orderBy('created','desc').limit(10).onSnapshot(snap => {
    localLinks = snap.docs.map(d => d.data());
    renderHistory();
  });
}

/* ══════════════════════════════════════════════
   EVENTS + INIT
══════════════════════════════════════════════ */
document.getElementById('btn-generate').addEventListener('click', generateLink);
document.getElementById('copy-btn').addEventListener('click', copyLink);

(async function init() {
  setLoading(true);
  await checkForBurnLink();
  startListener();
  setLoading(false);
})();
