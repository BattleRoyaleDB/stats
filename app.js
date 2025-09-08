(() => {
  const DATA_URL = 'followers.json';

  // Placeholder: prova in ordine .jpg, .jpeg, .webp, .png
  const PLACEHOLDER_CANDIDATES = ['placeholder.jpg', 'placeholder.jpeg', 'placeholder.webp', 'placeholder.png'];

  function sanitizeBase(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!url.endsWith('/')) url += '/';
    return url;
  }
  function getAvatarBase() {
    return sanitizeBase(window.AVATAR_BASE || '');
  }
  function buildAvatarURL(file) {
    if (!file) return '';
    const f = String(file);
    if (/^https?:\/\//i.test(f)) return f; // già completo
    const base = getAvatarBase();
    if (!base) return '';
    return base + encodeURIComponent(f);
  }
  function buildPlaceholderURLs() {
    const base = getAvatarBase();
    if (!base) return [];
    return PLACEHOLDER_CANDIDATES.map(name => base + encodeURIComponent(name));
  }

  const els = {
    podiumTop: document.getElementById('podiumTop'),
    listV: document.getElementById('listVittorie'),
    listK: document.getElementById('listKill'),
    listM: document.getElementById('listMorti'),
    lensBtn: document.querySelector('.icon-btn'),
    overlay: document.getElementById('searchOverlay'),
    overlayInput: document.getElementById('overlaySearchInput'),
    suggestions: document.getElementById('suggestions'),
    footerSmall: document.querySelector('.footer small'),
  };

  let allPlayers = [];

  async function fetchData() {
    try {
      const r = await fetch(DATA_URL + '?_=' + Date.now());
      const text = await r.text();
      const rowsRaw = parseSuperFlexible(text);
      const rows = rowsRaw.map(normalizeRow);

      // dedupe per nickname (tieni più vittorie)
      const map = new Map();
      for (const rec of rows) {
        const key = (rec.nickname || '').toLowerCase();
        if (!key) continue;
        const prev = map.get(key);
        if (!prev || (rec.vittorie || 0) > (prev.vittorie || 0)) map.set(key, rec);
      }
      allPlayers = [...map.values()];

      if (els.footerSmall) {
        els.footerSmall.textContent = `Giocatori caricati: ${rows.length} • Unici: ${allPlayers.length}`;
      }

      renderAll(rows);
      setupOverlaySearch();
    } catch (e) {
      console.error('Errore fetch/parsing followers.json:', e);
      showError('Errore caricamento followers.json');
    }
  }

  function showError(msg) {
    [els.listV, els.listK, els.listM].forEach(el => {
      if (el) el.innerHTML = `<li class="muted" style="padding:10px;text-align:center;list-style:none">${msg}</li>`;
    });
    if (els.podiumTop) els.podiumTop.innerHTML = '';
  }

  // Parser super flessibile (array con [ ], NDJSON e varianti)
  function parseSuperFlexible(text) {
    if (!text) return [];
    let t = String(text).replace(/^\uFEFF/, '').trim();
    if (!t) return [];

    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}

    const i0 = t.indexOf('[');
    const i1 = t.lastIndexOf(']');
    if (i0 !== -1 && i1 !== -1 && i1 > i0) {
      const arrText = t.slice(i0, i1 + 1).trim();
      try {
        const parsed = JSON.parse(arrText);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
      const items = extractObjectsFromArray(arrText);
      if (items.length) return items;
    }

    const out = [];
    for (let raw of t.split(/\r?\n/)) {
      let s = raw.trim();
      if (!s || s === '[' || s === ']') continue;
      if (s.endsWith(',')) s = s.slice(0, -1).trim();
      if (s.startsWith('{') && s.endsWith('}')) {
        try { out.push(JSON.parse(s)); } catch {}
      }
    }
    return out;
  }

  function extractObjectsFromArray(arrText) {
    let s = arrText.trim();
    if (s.startsWith('[')) s = s.slice(1);
    if (s.endsWith(']')) s = s.slice(0, -1);

    const out = [];
    let i = 0, n = s.length;
    let depth = 0, start = -1, inStr = false, quote = '"';

    while (i < n) {
      const ch = s[i];
      if (inStr) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) inStr = false;
        i++; continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; quote = ch; i++; continue; }
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const objText = s.slice(start, i + 1);
          try { out.push(JSON.parse(objText)); } catch {}
          start = -1;
        }
      }
      i++;
    }
    return out;
  }

  function normalizeRow(r) {
    return {
      nickname: String(r.nickname || r.nick || r.name || '').trim(),
      img_url: String(r.img_url || r.image || r.photo || r.pic || r.avatar || r.img || '').trim(),
      img_url_original: String(r.img_url_original || r.image_url || r.photo_url || r.pic_url || '').trim(),
      livello: Number(r.livello ?? 1),
      esperienza: Number(r.esperienza ?? 0),
      kill: Number(r.kill ?? r.kills ?? 0),
      morti: Number(r.morti ?? r.deaths ?? 0),
      vittorie: Number(r.vittorie ?? r.wins ?? 0),
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // Costruisce l'URL dell'immagine:
  // - se img_url_original è un URL assoluto, usa quello;
  // - altrimenti combina AVATAR_BASE con img_url (nome file).
  function photoUrl(r) {
    const orig = r.img_url_original ? String(r.img_url_original) : '';
    if (/^https?:\/\//i.test(orig)) return orig;
    const file = r.img_url ? String(r.img_url) : (orig || '');
    return buildAvatarURL(file);
  }

  // Visuals per badge/chip livello
  function levelVisuals(lvl) {
    const L = Math.max(1, Math.min(150, Number(lvl) || 1));
    let bg, border = '#ffffff', color = '#111827', title = `Livello ${L}`;
    if (L >= 150)      { bg = 'linear-gradient(135deg,#7f0000,#b30000)'; border = '#000000'; title += ' (MAX)'; color = '#fff'; }
    else if (L >= 140) { bg = 'linear-gradient(135deg,#7a0000,#d10000)'; border = '#4a0000'; color = '#fff'; }
    else if (L >= 121) { bg = 'linear-gradient(135deg,#b91c1c,#dc2626)'; border = '#7f1d1d'; color = '#fff'; }
    else if (L >= 101) { bg = 'linear-gradient(135deg,#6d28d9,#7c3aed)'; border = '#5b21b6'; color = '#fff'; }
    else if (L >= 81)  { bg = 'linear-gradient(135deg,#06b6d4,#3b82f6)'; border = '#075985'; color = '#fff'; }
    else if (L >= 61)  { bg = 'linear-gradient(135deg,#16a34a,#22c55e)'; border = '#166534'; color = '#fff'; }
    else if (L >= 41)  { bg = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; border = '#b45309'; color = '#3b2a00'; }
    else if (L >= 21)  { bg = 'linear-gradient(135deg,#ec4899,#a855f7)'; border = '#7e22ce'; color = '#fff'; }
    else if (L >= 6)   { bg = 'linear-gradient(135deg,#4f46e5,#8b5cf6)'; border = '#4338ca'; color = '#fff'; }
    else               { bg = 'linear-gradient(135deg,#00c2ff,#ff6bd6)'; border = '#3b82f6'; color = '#111827'; }
    return { bg, border, color, title };
  }

  function levelBadgeMarkup(lvl) {
    const v = levelVisuals(lvl);
    return `<span class="lvl-badge" style="--lv-bg:${v.bg};--lv-border:${v.border};--lv-color:${v.color}" title="${escapeHtml(v.title)}"><span class="pfx">LVL</span> ${Number(lvl) || 1}</span>`;
  }
  function levelChipMarkup(lvl) {
    const v = levelVisuals(lvl);
    return `<span class="lvl-chip" style="--lv-bg:${v.bg};--lv-color:${v.color}" title="${escapeHtml(v.title)}"><span class="pfx">LVL</span> ${Number(lvl) || 1}</span>`;
  }

  // Avatar per il podio: immagine + iniziale + badge livello
  function avatarMarkup(r) {
    const url = photoUrl(r);
    const fallbacks = buildPlaceholderURLs(); // array di URL placeholder
    const initial = (r.nickname || '?').match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() || '?';

    // Se non c'è URL, prova direttamente il primo placeholder (se disponibile)
    let imgSrc = '';
    let fbIdx = 0;
    if (url) {
      imgSrc = url;
    } else if (fallbacks.length) {
      imgSrc = fallbacks[0];
      fbIdx = 1;
    }

    const dataFallbacks = fallbacks.join('|');
    const img = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" alt="" data-fallbacks="${escapeHtml(dataFallbacks)}" data-fb-idx="${fbIdx}">`
      : '';

    return `
      <span class="avatar lg">
        ${img}
        <span class="initial">${escapeHtml(initial)}</span>
        ${levelBadgeMarkup(r.livello)}
      </span>
    `;
  }

  function renderAll(data) {
    const vNonZero = data.filter(d => (d.vittorie || 0) > 0);
    const kNonZero = data.filter(d => (d.kill || 0) > 0);
    const mNonZero = data.filter(d => (d.morti || 0) > 0);

    // VITTORIE
    const vSorted = [...vNonZero].sort((a,b) => (b.vittorie - a.vittorie) || a.nickname.localeCompare(b.nickname));
    const vRanked = vSorted.map((r, i) => ({ r, pos: i + 1 }));
    renderPodium(vRanked.slice(0, 3));

    const restV = vRanked.slice(3, 10);
    if (restV.length) {
      els.listV.setAttribute('start', '4');
      els.listV.innerHTML = listRowsMarkup(restV, 'vittorie');
    } else {
      els.listV.removeAttribute('start');
      els.listV.innerHTML = '';
    }

    // KILL Top 5
    const kRanked = [...kNonZero]
      .sort((a,b) => (b.kill - a.kill) || a.nickname.localeCompare(b.nickname))
      .slice(0, 5)
      .map((r, i) => ({ r, pos: i + 1 }));
    els.listK.removeAttribute('start');
    els.listK.innerHTML = listRowsMarkup(kRanked, 'kill');

    // MORTI Top 5
    const mRanked = [...mNonZero]
      .sort((a,b) => (b.morti - a.morti) || a.nickname.localeCompare(b.nickname))
      .slice(0, 5)
      .map((r, i) => ({ r, pos: i + 1 }));
    els.listM.removeAttribute('start');
    els.listM.innerHTML = listRowsMarkup(mRanked, 'morti');

    // Dopo aver scritto l'HTML, aggancia handler immagini
    wireAvatarHandlers();
  }

  // Podio: avatar con badge livello + nickname pulito sotto
  function renderPodium(entries) {
    const [one, two, three] = [entries[0], entries[1], entries[2]];
    const card = (entry) => {
      if (!entry) return '';
      const { r, pos } = entry;
      return `
        <div class="card place-${pos}" data-nick="${escapeHtml((r.nickname || '').toLowerCase())}">
          <div class="big">${pos}</div>
          <div class="col">
            ${avatarMarkup(r)}
            <span class="name" title="${escapeHtml(r.nickname)}">${escapeHtml(r.nickname)}</span>
          </div>
          <div class="win-badge" title="${r.vittorie}">${r.vittorie}</div>
        </div>
      `;
    };
    const html = `${card(two)}${card(one)}${card(three)}`;
    els.podiumTop.innerHTML = html;
  }

  // Liste: nickname + chip livello + metrica
  function listRowsMarkup(items, metric) {
    if (!items.length) return '';
    return items.map(({ r }) => {
      const value = r[metric] ?? 0;
      return `
        <li data-nick="${escapeHtml((r.nickname || '').toLowerCase())}">
          <div class="row">
            <span class="nick">
              <span class="name-line">
                <span class="name" title="${escapeHtml(r.nickname)}">${escapeHtml(r.nickname)}</span>
                ${levelChipMarkup(r.livello)}
              </span>
            </span>
            <span class="metric" title="${value}">${value}</span>
          </div>
        </li>
      `;
    }).join('');
  }

  // Gestione immagini: nasconde l'iniziale quando carica, prova più placeholder su errore
  function wireAvatarHandlers() {
    document.querySelectorAll('.avatar img').forEach(img => {
      const av = img.closest('.avatar');
      const initialEl = av?.querySelector('.initial');
      const listStr = img.getAttribute('data-fallbacks') || '';
      const list = listStr ? listStr.split('|').filter(Boolean) : [];
      const nextIdxFromAttr = parseInt(img.getAttribute('data-fb-idx') || '0', 10);
      let nextIdx = isNaN(nextIdxFromAttr) ? 0 : nextIdxFromAttr;

      function onOk() {
        if (img.naturalWidth > 1) {
          av?.classList.add('has-img');
          if (initialEl) initialEl.style.opacity = '0';
        }
      }
      function onFail() {
        if (nextIdx < list.length) {
          const candidate = list[nextIdx++];
          img.setAttribute('data-fb-idx', String(nextIdx));
          if (candidate && img.src !== candidate) {
            img.src = candidate; // prova prossimo placeholder
            return;
          }
        }
        // esauriti i placeholder
        av?.classList.remove('has-img');
        if (initialEl) initialEl.style.opacity = '';
      }

      img.addEventListener('load', onOk);
      img.addEventListener('error', onFail);

      if (img.complete) {
        if (img.naturalWidth > 1) onOk();
        else onFail();
      }
    });
  }

  /* ====== Overlay Ricerca ====== */

  function setupOverlaySearch() {
    if (!els.overlay || !els.lensBtn || !els.overlayInput) return;

    els.lensBtn.addEventListener('click', openOverlay);
    els.overlay.addEventListener('click', (e) => { if (e.target.dataset.close) closeOverlay(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOverlayOpen()) closeOverlay(); });

    els.overlayInput.addEventListener('input', onQueryChange);
    els.overlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = els.suggestions.querySelector('li');
        if (first) {
          chooseSuggestion(first.dataset.nick);
        } else {
          const q = normalizeQuery(els.overlayInput.value);
          if (q) chooseSuggestion(q);
        }
      }
    });
  }

  function openOverlay() {
    els.overlay.classList.add('is-open');
    els.overlay.setAttribute('aria-hidden', 'false');
    els.overlayInput.value = '';
    els.suggestions.innerHTML = '';
    setTimeout(() => els.overlayInput.focus({ preventScroll:true }), 0);
  }
  function closeOverlay() {
    els.overlay.classList.remove('is-open');
    els.overlay.setAttribute('aria-hidden', 'true');
    els.suggestions.innerHTML = '';
    els.overlayInput.blur();
  }
  function isOverlayOpen(){ return els.overlay.classList.contains('is-open'); }

  function normalizeQuery(v){ return String(v || '').trim().toLowerCase(); }

  function onQueryChange() {
    const q = normalizeQuery(els.overlayInput.value);
    renderSuggestions(getSuggestions(q, 5));
  }

  function getSuggestions(q, limit = 5) {
    if (!q) return [];
    const scored = [];
    for (const p of allPlayers) {
      const nickL = (p.nickname || '').toLowerCase();
      const idx = nickL.indexOf(q);
      if (idx === -1) continue;
      const score = (idx === 0 ? 2 : 1);
      scored.push({ p, score });
    }
    scored.sort((a,b) =>
      (b.score - a.score) ||
      ((b.p.vittorie || 0) - (a.p.vittorie || 0)) ||
      (a.p.nickname || '').localeCompare(b.p.nickname || '')
    );
    return scored.slice(0, limit).map(s => s.p);
  }

  function renderSuggestions(list) {
    if (!list.length) { els.suggestions.innerHTML = ''; return; }
    els.suggestions.innerHTML = list.map(p => `
      <li role="option" tabindex="0" data-nick="${escapeHtml(p.nickname)}">
        <span class="s-nick name">${escapeHtml(p.nickname)}</span>
      </li>
    `).join('');

    els.suggestions.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => chooseSuggestion(li.dataset.nick));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') chooseSuggestion(li.dataset.nick); });
    });
  }

  function clearMatches() {
    document.querySelectorAll('.match').forEach(el => el.classList.remove('match'));
  }

  function chooseSuggestion(nickname) {
    const target = String(nickname || '').toLowerCase();
    if (!target) return;
    closeOverlay();
    clearMatches();
    const podiumHit = document.querySelector(`.podium .card[data-nick="${cssEscape(target)}"]`);
    const listHits = document.querySelectorAll(`.ranking li[data-nick="${cssEscape(target)}"]`);
    if (podiumHit) podiumHit.classList.add('match');
    listHits.forEach(li => li.classList.add('match'));
    const first = podiumHit || listHits[0];
    if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function cssEscape(s){ return s.replace(/["\\]/g, '\\$&'); }

  fetchData();
})();
