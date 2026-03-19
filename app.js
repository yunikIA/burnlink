/* ============================================================
   BurnLink — app.js
   ============================================================ */

'use strict';

/* ── Constants ── */
const STORAGE_KEY = 'burnlinks_v1';

/* ── State ── */
let links = [];
let selectedSeconds = 3600; // default: 1 hora

/* ── Helpers ── */

function generateId(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function formatDuration(secs) {
  if (secs < 60)      return secs + ' seg';
  if (secs < 3600)    return Math.round(secs / 60) + ' min';
  if (secs < 86400)   return Math.round(secs / 3600) + ' h';
  if (secs < 604800)  return Math.round(secs / 86400) + ' día(s)';
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

/* ── Storage ── */

function loadLinks() {
  try {
    links = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    links = [];
  }
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

/* ── Duration selector ── */

function getSelectedSeconds() {
  if (selectedSeconds !== null) return selectedSeconds;

  const val  = parseInt(document.getElementById('custom-value').value, 10);
  const unit = parseInt(document.getElementById('custom-unit').value, 10);

  if (isNaN(val) || val <= 0) return null;
  return val * unit;
}

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

/* ── Generate link ── */

function generateLink() {
  const urlInput = document.getElementById('dest-url');
  const url = urlInput.value.trim();

  if (!url) {
    urlInput.focus();
    urlInput.style.borderColor = 'var(--accent)';
    urlInput.style.boxShadow   = '0 0 0 3px rgba(255,59,31,.25)';
    setTimeout(() => {
      urlInput.style.borderColor = '';
      urlInput.style.boxShadow   = '';
    }, 1500);
    return;
  }

  // Basic URL validation
  try { new URL(url); } catch {
    urlInput.focus();
    urlInput.style.borderColor = 'var(--accent)';
    setTimeout(() => { urlInput.style.borderColor = ''; }, 1500);
    alert('Ingresá una URL válida (ej: https://ejemplo.com)');
    return;
  }

  const secs = getSelectedSeconds();
  if (!secs) {
    alert('Ingresá una duración válida.');
    return;
  }

  const oneUse       = document.getElementById('toggle-oneuse').classList.contains('on');
  const showCountdown = document.getElementById('toggle-countdown').classList.contains('on');

  const id = generateId();
  const expiresAt = Date.now() + secs * 1000;

  const linkObj = {
    id,
    url,
    expiresAt,
    oneUse,
    showCountdown,
    used:     false,
    created:  Date.now(),
    duration: secs,
  };

  loadLinks();
  links.unshift(linkObj);
  saveLinks();

  // Show result
  const burnUrl = getBaseUrl() + '#burn:' + id;

  document.getElementById('generated-link').textContent = burnUrl;
  document.getElementById('expiry-label').textContent   = formatDuration(secs);
  document.getElementById('oneuse-chip').style.display  = oneUse ? 'flex' : 'none';

  const resultCard = document.getElementById('result-card');
  resultCard.classList.add('visible');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  renderHistory();
}

/* ── Copy link ── */

function copyLink() {
  const link = document.getElementById('generated-link').textContent;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

/* ── Render history ── */

function renderHistory() {
  loadLinks();
  const container = document.getElementById('links-list');
  const now = Date.now();

  if (links.length === 0) {
    container.innerHTML = '<div class="empty-state">// sin links generados aún</div>';
    return;
  }

  container.innerHTML = links.map(link => {
    const expired   = now > link.expiresAt || (link.oneUse && link.used);
    const remaining = link.expiresAt - now;
    const burnUrl   = getBaseUrl() + '#burn:' + link.id;
    const shortUrl  = burnUrl.length > 46
      ? burnUrl.substring(0, 46) + '…'
      : burnUrl;
    const shortDest = link.url.length > 42
      ? link.url.substring(0, 42) + '…'
      : link.url;

    const rightSide = expired
      ? '<span class="expired-badge">DESTRUIDO</span>'
      : `<div class="countdown" data-expires="${link.expiresAt}">${formatCountdown(remaining)}</div>`;

    return `
      <div class="link-item${expired ? ' expired' : ''}">
        <div class="link-item-info">
          <div class="link-item-url" title="${burnUrl}">${shortUrl}</div>
          <div class="link-item-meta">→ ${shortDest}</div>
        </div>
        ${rightSide}
      </div>`;
  }).join('');
}

/* ── Clear history ── */

function clearHistory() {
  links = [];
  saveLinks();
  renderHistory();
  document.getElementById('result-card').classList.remove('visible');
}

/* ── Countdown ticker ── */

setInterval(() => {
  const now = Date.now();

  document.querySelectorAll('.countdown[data-expires]').forEach(el => {
    const exp = parseInt(el.dataset.expires, 10);
    const rem = exp - now;

    if (rem <= 0) {
      const item = el.closest('.link-item');
      if (item) item.classList.add('expired');
      el.outerHTML = '<span class="expired-badge">DESTRUIDO</span>';
    } else {
      el.textContent = formatCountdown(rem);
    }
  });
}, 1000);

/* ── Handle incoming burn link ── */

function checkForBurnLink() {
  const hash = window.location.hash;
  if (!hash.startsWith('#burn:')) return;

  const id = hash.replace('#burn:', '');

  // Remove hash from URL immediately (clean address bar)
  history.replaceState(null, '', window.location.pathname);

  loadLinks();
  const linkIndex = links.findIndex(l => l.id === id);

  // Not found
  if (linkIndex === -1) {
    document.getElementById('expired-overlay').classList.add('active');
    return;
  }

  const link = links[linkIndex];
  const now  = Date.now();

  // Expired or already used
  if (now > link.expiresAt || (link.oneUse && link.used)) {
    document.getElementById('expired-overlay').classList.add('active');
    return;
  }

  // Mark as used if one-use
  if (link.oneUse) {
    links[linkIndex].used = true;
    saveLinks();
  }

  // Redirect with countdown
  if (link.showCountdown) {
    const overlay    = document.getElementById('redirect-overlay');
    const countEl    = document.getElementById('redirect-countdown');
    const destUrlEl  = document.getElementById('redirect-dest-url');

    destUrlEl.textContent = link.url;
    overlay.classList.add('active');

    let count = 3;
    countEl.textContent = count;

    const interval = setInterval(() => {
      count--;
      countEl.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        window.location.href = link.url;
      }
    }, 1000);
  } else {
    window.location.href = link.url;
  }
}

/* ── Event listeners ── */

document.getElementById('btn-generate').addEventListener('click', generateLink);
document.getElementById('copy-btn').addEventListener('click', copyLink);
document.getElementById('btn-clear').addEventListener('click', clearHistory);

// Allow Enter key on URL input
document.getElementById('dest-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') generateLink();
});

/* ── Init ── */

loadLinks();
renderHistory();
checkForBurnLink();
