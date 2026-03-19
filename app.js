/* ============================================================
   BurnLink — app.js  (Firebase Firestore backend)
   ============================================================ */

'use strict';

/* ── Firestore reference ── */
const db = firebase.firestore();
const linksCol = db.collection('burnlinks');

/* ── State ── */
let selectedSeconds = 3600;
let localLinks = [];          // cache local para el historial
let unsubscribe = null;       // listener de Firestore

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */

function generateId(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function formatDuration(secs) {
  if (secs < 60)     return secs + ' seg';
  if (secs < 3600)   return Math.round(secs / 60) + ' min';
  if (secs < 86400)  return Math.round(secs / 3600) + ' h';
  if (secs < 604800) return Math.round(secs / 86400) + ' día(s)';
  return Math.round(secs / 604800) + ' semana(s)';
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function getBaseUrl() {
  return window.location.origin + window.location.pathname;
}

function showToast(msg, type = '') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  void toast.offsetWidth; // reflow
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('active', on);
}

/* ══════════════════════════════════════════════
   DURATION SELECTOR
══════════════════════════════════════════════ */

document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const val = this.dataset.seconds;
    const customEl = document.getElementById('custom-duration');
    if (val === 'custom') {
      customEl.classList.add('visible');
      selectedSeconds = null;
    } else {
      customEl.classList.remove('visible');
      selectedSeconds = parseInt(val, 10);
    }
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
   GENERATE LINK  →  guarda en Firestore
══════════════════════════════════════════════ */

async function generateLink() {
  const urlInput = document.getElementById('dest-url');
  const url = urlInput.value.trim();

  // Validar URL
  if (!url) {
    urlInput.focus();
    urlInput.style.borderColor = 'var(--accent)';
    urlInput.style.boxShadow   = '0 0 0 3px rgba(255,59,31,.25)';
    setTimeout(() => { urlInput.style.borderColor = ''; urlInput.style.boxShadow = ''; }, 1500);
    return;
  }
  try { new URL(url); } catch {
    urlInput.focus();
    urlInput.style.borderColor = 'var(--accent)';
    setTimeout(() => { urlInput.style.borderColor = ''; }, 1500);
    showToast('Ingresá una URL válida (ej: https://ejemplo.com)', 'error');
    return;
  }

  const secs = getSelectedSeconds();
  if (!secs) { showToast('Ingresá una duración válida.', 'error'); return; }

  const oneUse        = document.getElementById('toggle-oneuse').classList.contains('on');
  const showCountdown = document.getElementById('toggle-countdown').classList.contains('on');

  const id        = generateId();
  const expiresAt = Date.now() + secs * 1000;

  const linkData = {
    id,
    url,
    expiresAt,
    oneUse,
    showCountdown,
    used:     false,
    created:  Date.now(),
    duration: secs,
  };

  // Deshabilitar botón mientras guarda
  const btnGen = document.getElementById('btn-generate');
  btnGen.disabled = true;
  btnGen.textContent = 'Guardando...';

  try {
    await linksCol.doc(id).set(linkData);

    // Mostrar resultado
    const burnUrl = getBaseUrl() + '#burn:' + id;
    document.getElementById('generated-link').textContent = burnUrl;
    document.getElementById('expiry-label').textContent   = formatDuration(secs);
    document.getElementById('oneuse-chip').style.display  = oneUse ? 'flex' : 'none';

    const rc = document.getElementById('result-card');
    rc.classList.add('visible');
    rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('🔥 Link generado!', 'success');
    urlInput.value = '';

  } catch (err) {
    console.error('Error guardando link:', err);
    showToast('Error al guardar. Revisá la conexión.', 'error');
  } finally {
    btnGen.disabled = false;
    btnGen.textContent = '🔥 Generar BurnLink';
  }
}

/* ══════════════════════════════════════════════
   COPY LINK
══════════════════════════════════════════════ */

function copyLink() {
  const link = document.getElementById('generated-link').textContent;
  navigator.clipboard.writeText(link)
    .then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = '✓ Copiado';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
    })
    .catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copiado!', 'success');
    });
}

/* ══════════════════════════════════════════════
   DELETE LINK  →  borra de Firestore
══════════════════════════════════════════════ */

async function deleteLink(id) {
  try {
    await linksCol.doc(id).delete();
    showToast('Link eliminado.', 'success');
  } catch (err) {
    console.error('Error eliminando:', err);
    showToast('Error al eliminar.', 'error');
  }
}

/* ══════════════════════════════════════════════
   CLEAR ALL  →  borra todos de Firestore
══════════════════════════════════════════════ */

async function clearHistory() {
  if (!localLinks.length) return;
  if (!confirm('¿Borrar todos los links?')) return;

  try {
    const batch = db.batch();
    localLinks.forEach(l => batch.delete(linksCol.doc(l.id)));
    await batch.commit();
    document.getElementById('result-card').classList.remove('visible');
    showToast('Historial limpiado.', 'success');
  } catch (err) {
    console.error('Error limpiando:', err);
    showToast('Error al limpiar.', 'error');
  }
}

/* ══════════════════════════════════════════════
   RENDER HISTORY
══════════════════════════════════════════════ */

function renderHistory() {
  const container = document.getElementById('links-list');
  const now = Date.now();

  if (!localLinks.length) {
    container.innerHTML = '<div class="empty-state">// sin links generados aún</div>';
    return;
  }

  container.innerHTML = localLinks.map(link => {
    const expired   = now > link.expiresAt || (link.oneUse && link.used);
    const remaining = link.expiresAt - now;
    const burnUrl   = getBaseUrl() + '#burn:' + link.id;
    const shortUrl  = burnUrl.length > 46 ? burnUrl.substring(0, 46) + '…' : burnUrl;
    const shortDest = link.url.length > 42 ? link.url.substring(0, 42) + '…' : link.url;

    const rightSide = expired
      ? '<span class="expired-badge">DESTRUIDO</span>'
      : `<div class="countdown" data-expires="${link.expiresAt}">${formatCountdown(remaining)}</div>`;

    return `
      <div class="link-item${expired ? ' expired' : ''}" data-id="${link.id}">
        <div class="link-item-info">
          <div class="link-item-url" title="${burnUrl}">${shortUrl}</div>
          <div class="link-item-meta">→ ${shortDest}</div>
        </div>
        <div class="link-item-actions">
          ${rightSide}
          <button class="btn-delete" title="Eliminar" onclick="deleteLink('${link.id}')">✕</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   COUNTDOWN TICKER
══════════════════════════════════════════════ */

setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.countdown[data-expires]').forEach(el => {
    const exp = parseInt(el.dataset.expires, 10);
    const rem = exp - now;
    if (rem <= 0) {
      el.closest('.link-item')?.classList.add('expired');
      el.outerHTML = '<span class="expired-badge">DESTRUIDO</span>';
    } else {
      el.textContent = formatCountdown(rem);
    }
  });
}, 1000);

/* ══════════════════════════════════════════════
   REAL-TIME LISTENER  (Firestore onSnapshot)
══════════════════════════════════════════════ */

function startListener() {
  // Escucha cambios en tiempo real ordenados por fecha de creación
  unsubscribe = linksCol
    .orderBy('created', 'desc')
    .onSnapshot(snapshot => {
      localLinks = snapshot.docs.map(doc => doc.data());
      renderHistory();
    }, err => {
      console.error('Firestore listener error:', err);
      showToast('Error de conexión con la base de datos.', 'error');
    });
}

/* ══════════════════════════════════════════════
   HANDLE INCOMING BURN LINK
══════════════════════════════════════════════ */

async function checkForBurnLink() {
  const hash = window.location.hash;
  if (!hash.startsWith('#burn:')) return;

  const id = hash.replace('#burn:', '');
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

    // Marcar como usado si es one-use (transacción atómica)
    if (link.oneUse) {
      await db.runTransaction(async tx => {
        const fresh = await tx.get(linksCol.doc(id));
        if (fresh.data().used) throw new Error('already_used');
        tx.update(linksCol.doc(id), { used: true });
      }).catch(err => {
        if (err.message === 'already_used') {
          setLoading(false);
          document.getElementById('expired-overlay').classList.add('active');
          throw err;
        }
      });
    }

    setLoading(false);

    // Redirigir
    if (link.showCountdown) {
      document.getElementById('redirect-dest-url').textContent = link.url;
      document.getElementById('redirect-overlay').classList.add('active');

      let count = 3;
      document.getElementById('redirect-countdown').textContent = count;

      const interval = setInterval(() => {
        count--;
        document.getElementById('redirect-countdown').textContent = count;
        if (count <= 0) {
          clearInterval(interval);
          window.location.href = link.url;
        }
      }, 1000);
    } else {
      window.location.href = link.url;
    }

  } catch (err) {
    if (err.message !== 'already_used') {
      setLoading(false);
      console.error('Error al verificar link:', err);
      showToast('Error al verificar el link.', 'error');
    }
  }
}

/* ══════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════ */

document.getElementById('btn-generate').addEventListener('click', generateLink);
document.getElementById('copy-btn').addEventListener('click', copyLink);
document.getElementById('btn-clear').addEventListener('click', clearHistory);

document.getElementById('dest-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') generateLink();
});

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */

(async function init() {
  setLoading(true);

  // Primero chequear si hay un burn link en la URL
  await checkForBurnLink();

  // Luego iniciar el listener del historial
  startListener();

  setLoading(false);
})();
