/* ============================================================
   BurnLink — admin.js
   Google Auth + Firestore admin panel
   ============================================================ */

'use strict';

/* ── Cuentas autorizadas ── */
const ADMIN_EMAILS = [
  'bryanescobar00899@gmail.com',
  'yunik.arg@gmail.com',
];

/* ── Firebase refs ── */
const auth     = firebase.auth();
const db       = firebase.firestore();
const linksCol = db.collection('burnlinks');

/* ── State ── */
let allLinks    = [];
let currentFilter = 'all';
let unsubscribe   = null;

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */

function formatDuration(secs) {
  if (secs < 60)     return secs + 's';
  if (secs < 3600)   return Math.round(secs / 60) + 'min';
  if (secs < 86400)  return Math.round(secs / 3600) + 'h';
  if (secs < 604800) return Math.round(secs / 86400) + 'd';
  return Math.round(secs / 604800) + 'sem';
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function getBaseUrl() {
  return window.location.origin + '/';
}

function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('active', on);
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
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */

function showLogin() {
  setLoading(false);
  document.getElementById('login-screen').classList.add('active');
}

function showDenied(email) {
  setLoading(false);
  document.getElementById('denied-email').textContent = email;
  document.getElementById('denied-screen').classList.add('active');
}

function showAdmin(user) {
  setLoading(false);
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('denied-screen').classList.remove('active');

  // Topbar
  const topbar = document.getElementById('admin-topbar');
  topbar.style.display = 'flex';
  document.getElementById('admin-avatar').src         = user.photoURL || '';
  document.getElementById('admin-email-display').textContent = user.email;

  // Content
  document.getElementById('admin-content').classList.add('active');

  // Start listening
  startAdminListener();
}

document.getElementById('btn-google-login').addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error('Login error:', err);
    showToast('Error al iniciar sesión.', 'error');
  }
});

function adminLogout() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  auth.signOut().then(() => {
    document.getElementById('admin-content').classList.remove('active');
    document.getElementById('admin-topbar').style.display = 'none';
    document.getElementById('denied-screen').classList.remove('active');
    allLinks = [];
    showLogin();
  });
}

// Auth state observer
auth.onAuthStateChanged(user => {
  if (!user) {
    showLogin();
    return;
  }

  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    showDenied(user.email);
    return;
  }

  showAdmin(user);
});

/* ══════════════════════════════════════════════
   FIRESTORE LISTENER
══════════════════════════════════════════════ */

function startAdminListener() {
  if (unsubscribe) unsubscribe();

  unsubscribe = linksCol
    .orderBy('created', 'desc')
    .onSnapshot(snapshot => {
      allLinks = snapshot.docs.map(doc => doc.data());
      updateStats();
      renderLinks();
    }, err => {
      console.error('Listener error:', err);
      showToast('Error de conexión.', 'error');
    });
}

/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */

function updateStats() {
  const now     = Date.now();
  const total   = allLinks.length;
  const expired = allLinks.filter(l => now > l.expiresAt || (l.oneUse && l.used)).length;
  const active  = total - expired;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-expired').textContent = expired;
}

/* ══════════════════════════════════════════════
   RENDER LINKS
══════════════════════════════════════════════ */

function renderLinks() {
  const container = document.getElementById('admin-links-list');
  const now       = Date.now();

  let filtered = allLinks;
  if (currentFilter === 'active') {
    filtered = allLinks.filter(l => now <= l.expiresAt && !(l.oneUse && l.used));
  } else if (currentFilter === 'expired') {
    filtered = allLinks.filter(l => now > l.expiresAt || (l.oneUse && l.used));
  }

  if (!filtered.length) {
    container.innerHTML = '<div class="admin-empty">// sin links en esta categoría</div>';
    return;
  }

  container.innerHTML = filtered.map(link => {
    const expired   = now > link.expiresAt || (link.oneUse && link.used);
    const remaining = link.expiresAt - now;
    const burnUrl   = getBaseUrl() + '?id=' + link.id;
    const shortDest = link.url.length > 55 ? link.url.substring(0, 55) + '…' : link.url;
    const shortBurn = burnUrl.length > 50  ? burnUrl.substring(0, 50)  + '…' : burnUrl;

    const statusTag = expired
      ? (link.oneUse && link.used
          ? '<span class="tag tag-used">USADO</span>'
          : '<span class="tag tag-expired">EXPIRADO</span>')
      : '<span class="tag tag-active">ACTIVO</span>';

    const oneUseTag = link.oneUse
      ? '<span class="tag tag-oneuse">1 uso</span>'
      : '';

    const timeTag = `<span class="tag tag-time">${formatDuration(link.duration)} · ${formatDate(link.created)}</span>`;

    const rightContent = expired
      ? `<span class="expired-badge">DESTRUIDO</span>`
      : `<div class="admin-countdown" data-expires="${link.expiresAt}">${formatCountdown(remaining)}</div>`;

    return `
      <div class="admin-link-item${expired ? ' expired' : ''}" data-id="${link.id}">
        <div class="admin-link-main">
          <div class="admin-link-dest" title="${link.url}">→ ${shortDest}</div>
          <div class="admin-link-burn" title="${burnUrl}">🔗 ${shortBurn}</div>
          <div class="admin-link-tags">
            ${statusTag}
            ${oneUseTag}
            ${timeTag}
          </div>
        </div>
        <div class="admin-link-actions">
          ${rightContent}
          <button class="btn-admin-delete" onclick="adminDeleteLink('${link.id}')">🗑 Borrar</button>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════ */

async function adminDeleteLink(id) {
  if (!confirm('¿Borrar este link?')) return;
  try {
    await linksCol.doc(id).delete();
    showToast('Link eliminado.', 'success');
  } catch (err) {
    console.error('Error eliminando:', err);
    showToast('Error al eliminar.', 'error');
  }
}

document.getElementById('btn-delete-all').addEventListener('click', async () => {
  const now     = Date.now();
  const expired = allLinks.filter(l => now > l.expiresAt || (l.oneUse && l.used));
  if (!expired.length) { showToast('No hay links expirados.', ''); return; }
  if (!confirm(`¿Borrar ${expired.length} links expirados?`)) return;

  try {
    const batch = db.batch();
    expired.forEach(l => batch.delete(linksCol.doc(l.id)));
    await batch.commit();
    showToast(`${expired.length} links eliminados.`, 'success');
  } catch (err) {
    console.error('Error borrando:', err);
    showToast('Error al borrar.', 'error');
  }
});

/* ══════════════════════════════════════════════
   FILTERS
══════════════════════════════════════════════ */

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.filter;
    renderLinks();
  });
});

/* ══════════════════════════════════════════════
   COUNTDOWN TICKER
══════════════════════════════════════════════ */

setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.admin-countdown[data-expires]').forEach(el => {
    const exp = parseInt(el.dataset.expires, 10);
    const rem = exp - now;
    if (rem <= 0) {
      updateStats();
      renderLinks();
    } else {
      el.textContent = formatCountdown(rem);
    }
  });
}, 1000);
