// Flex Codes (static iOS-style)
const header = document.querySelector('.ios-header');
const listEl = document.getElementById('list');
const qEl = document.getElementById('q');
const countsEl = document.getElementById('counts');
const lastUpdatedEl = document.getElementById('lastUpdated');
const toastEl = document.getElementById('toast');

let DATA = [];
let currentFilter = 'Apartments';

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
}, { passive: true });

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

// Robust CSV splitting (supports quoted commas)
function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length);

  if (!lines.length) return [];

  const header = splitCSVLine(lines[0]).map((s) => s.trim().toLowerCase());
  const idx = {
    community: header.indexOf('community'),
    address: header.indexOf('address'),
    gate: header.indexOf('gate'),
    type: header.indexOf('type')
  };

  const get = (cols, key) => {
    const i = idx[key];
    return i >= 0 ? (cols[i] ?? '').trim() : '';
  };

  return lines.slice(1).map((line) => {
    const cols = splitCSVLine(line);
    return {
      community: get(cols, 'community') || 'Unspecified',
      address: get(cols, 'address'),
      gate: get(cols, 'gate'),
      type: get(cols, 'type') || 'Apartments'
    };
  }).filter((r) => r.community && r.address);
}

function escapeHTML(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function groupByCommunity(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.community || 'Unspecified';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function mapsLinks(address) {
  const q = encodeURIComponent(address);
  // Apple Maps (best on iPhone)
  const apple = `https://maps.apple.com/?q=${q}`;
  // Google Street View intent
  const street = `https://www.google.com/maps?q=${q}&layer=c&cbll=0,0`;
  return { apple, street };
}

function render() {
  const q = (qEl.value || '').toLowerCase().trim();

  const filtered = DATA.filter((r) => {
    const okType = currentFilter === 'All' || r.type === currentFilter;
    if (!okType) return false;
    if (!q) return true;
    return (
      r.community.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q) ||
      (r.gate || '').toLowerCase().includes(q)
    );
  });

  countsEl.textContent = `${filtered.length} locations`;
  const grouped = groupByCommunity(filtered);

  listEl.innerHTML =
    grouped.map(([community, items]) => {
      return `
      <section class="group" data-community="${escapeHTML(community)}">
        <div class="group-header" role="button" tabindex="0" aria-expanded="true">
          <div class="group-title">${escapeHTML(community)}</div>
          <div class="group-meta">
            <span>${items.length}</span>
            <span class="chev" aria-hidden="true"></span>
          </div>
        </div>
        <div class="items">
          ${items.map((it) => {
            const gate = it.gate ? it.gate : 'No Code';
            const links = mapsLinks(it.address);
            return `
              <div class="card">
                <div class="addr">${escapeHTML(it.address)}</div>
                <div class="sub">${escapeHTML(it.type)}</div>
                <div class="pills">
                  <span class="pill primary mono">${escapeHTML(gate)}</span>
                  <a class="pill" href="${links.apple}" target="_blank" rel="noopener">Maps</a>
                  <a class="pill" href="${links.street}" target="_blank" rel="noopener">Street View</a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
    }).join('') || `<div class="sub" style="padding: 14px 16px;">No matches.</div>`;

  wireGroupToggles();
}

function wireGroupToggles() {
  document.querySelectorAll('.group').forEach((group) => {
    const key = group.dataset.community || '';
    const headerEl = group.querySelector('.group-header');

    const collapsed = localStorage.getItem(`collapsed:${key}`) === '1';
    if (collapsed) group.classList.add('collapsed');

    const toggle = () => {
      group.classList.toggle('collapsed');
      const isCollapsed = group.classList.contains('collapsed');
      localStorage.setItem(`collapsed:${key}`, isCollapsed ? '1' : '0');
    };

    headerEl.onclick = toggle;
    headerEl.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    };
  });
}

qEl.addEventListener('input', render);

document.querySelectorAll('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

async function load() {
  try {
    lastUpdatedEl.textContent = 'Loading…';
    // Works for GitHub Pages project sites: /REPO/
    const url = new URL('codes.csv', window.location.href).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`codes.csv not found (${res.status})`);
    const lm = res.headers.get('last-modified');
    lastUpdatedEl.textContent = lm ? `Updated ${new Date(lm).toLocaleString()}` : 'Ready';
    const text = await res.text();
    DATA = parseCSV(text);
    render();
  } catch (e) {
    console.error(e);
    lastUpdatedEl.textContent = 'Load error';
    toast(e.message || String(e));
    listEl.innerHTML =
      `<div class="sub" style="padding: 14px 16px;">Couldn’t load <b>codes.csv</b>. Put it next to <b>index.html</b>.</div>`;
  }
}

load();

// Register service worker for install + offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      // If SW fails, app still works; avoid noisy alerts.
      console.warn('SW register failed', e);
    }
  });
}
