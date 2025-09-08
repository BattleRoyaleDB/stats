(() => {
  const DATA_URL = 'followers.json';
  const PLACEHOLDER_CANDIDATES = ['placeholder.jpg', 'placeholder.jpeg', 'placeholder.webp', 'placeholder.png'];

  // ---------- Scoring per Rank (coerente con la home) ----------
  const W_WIN   = 100;
  const W_KILL  = 55;
  const W_LEVEL = 45;
  const W_MORTI = 10;
  const nz = v => Number.isFinite(+v) ? +v : 0;

  function computeScore(r) {
    const wins  = nz(r.vittorie);
    const kills = nz(r.kill);
    const lvl   = nz(r.livello);
    const morti = nz(r.morti);
    return wins*W_WIN + kills*W_KILL + lvl*W_LEVEL + morti*W_MORTI;
  }

  function comparePlayersByScore(a, b) {
    const ra = a.r || a, rb = b.r || b;
    const Sa = 'S' in a ? a.S : computeScore(ra);
    const Sb = 'S' in b ? b.S : computeScore(rb);
    if (Sb !== Sa) return Sb - Sa; // 1) Score
    if (nz(rb.vittorie)   !== nz(ra.vittorie))   return nz(rb.vittorie)   - nz(ra.vittorie);   // 2) vittorie
    if (nz(rb.kill)       !== nz(ra.kill))       return nz(rb.kill)       - nz(ra.kill);       // 3) kill
    if (nz(rb.livello)    !== nz(ra.livello))    return nz(rb.livello)    - nz(ra.livello);    // 4) livello
    if (nz(rb.morti)      !== nz(ra.morti))      return nz(rb.morti)      - nz(ra.morti);      // 5) morti
    if (nz(rb.esperienza) !== nz(ra.esperienza)) return nz(rb.esperienza) - nz(ra.esperienza); // 6) esperienza
    const na = String(ra.nickname || '').toLowerCase();
    const nb = String(rb.nickname || '').toLowerCase();
    return na.localeCompare(nb); // 7) nickname
  }

  // ---------- Helpers ----------
  const qs = (s,el=document) => el.querySelector(s);

  function sanitizeBase(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!url.endsWith('/')) url += '/';
    return url;
  }
  function getAvatarBase() { return sanitizeBase(window.AVATAR_BASE || ''); }
  function buildAvatarURL(file) {
    if (!file) return '';
    const f = String(file);
    if (/^https?:\/\//i.test(f)) return f;
    const base = getAvatarBase();
    if (!base) return '';
    return base + encodeURIComponent(f);
  }
  function buildPlaceholderURLs() {
    const base = getAvatarBase();
    if (!base) return [];
    return PLACEHOLDER_CANDIDATES.map(name => base + encodeURIComponent(name));
  }
  function escapeHtml(s) {
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
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

  function getParamNick() {
    const sp = new URLSearchParams(location.search);
    return (sp.get('nick') || '').trim();
  }

  function wireImg(imgEl, initialEl) {
    const fallbacks = buildPlaceholderURLs();
    let idx = 0;
    function ok() {
      if (imgEl.naturalWidth > 1) {
        initialEl.style.opacity = '0';
      }
    }
    function fail() {
      if (idx < fallbacks.length) {
        imgEl.src = fallbacks[idx++];
      } else {
        initialEl.style.opacity = '';
      }
    }
    imgEl.addEventListener('load', ok);
    imgEl.addEventListener('error', fail);
    if (imgEl.complete) {
      if (imgEl.naturalWidth > 1) ok(); else fail();
    }
  }

  function levelBadgeApply(container, lvl) {
    const v = Number(lvl) || 1;
    container.querySelector('.lvl-val').textContent = String(v);
  }

  function buildStatsGrid(rec, rank, total) {
    const stats = [
      { lab:'Vittorie', val: rec.vittorie || 0 },
      { lab:'Morti',    val: rec.morti || 0 },
      { lab:'Kill',     val: rec.kill || 0 },
      { lab:'Rank',     val: `#${rank}`, title:`Posizione #${rank} su ${total}` },
    ];
    return stats.map(s => `
      <div class="stat" title="${escapeHtml(s.title || '')}">
        <div class="val">${s.val}</div>
        <div class="lab">${s.lab}</div>
      </div>
    `).join('');
  }

  // ---------- Achievements (categorie espandibili) ----------
  function buildAchievementsGroups(rec) {
    const wins = nz(rec.vittorie);
    const kills = nz(rec.kill);
    const lvl = nz(rec.livello);
    const games = nz(rec.morti); // morti = partite giocate

    // Definizioni categorie e soglie
    const cats = [
      {
        key: 'wins',
        icon: '🏆',
        name: 'Vittorie',
        items: [
          { name:'Prima Vittoria',  sub:'Ottieni 1 vittoria',    ok: wins >= 1 },
          { name:'Doppietta',       sub:'Ottieni 2 vittorie',    ok: wins >= 2 },
          { name:'Tris',            sub:'Ottieni 3 vittorie',    ok: wins >= 3 },
          { name:'Poker',           sub:'Ottieni 4 vittorie',    ok: wins >= 4 },
          { name:'Cinquina',        sub:'Ottieni 5 vittorie',    ok: wins >= 5 },
        ],
      },
      {
        key: 'kills',
        icon: '⚔️',
        name: 'Kill',
        items: [
          { name:'Primo Sangue',     sub:'Totalizza 1 kill',    ok: kills >= 1 },
          { name:'Cacciatore',       sub:'Totalizza 3 kill',    ok: kills >= 3 },
          { name:'Cacciatore Alfa',  sub:'Totalizza 7 kill',    ok: kills >= 7 },
          { name:'Predatore',        sub:'Totalizza 15 kill',   ok: kills >= 15 },
          { name:'Macchina da Guerra', sub:'Totalizza 20 kill', ok: kills >= 20 },
        ],
      },
      {
        key: 'progress',
        icon: '🚀',
        name: 'Progressione',
        items: [
          { name:'Secondo Gradino', sub:'Raggiungi il livello 2',   ok: lvl >= 2 },
          { name:'Apprendista',     sub:'Raggiungi il livello 10',  ok: lvl >= 10 },
          { name:'Veterano',        sub:'Raggiungi il livello 30',  ok: lvl >= 30 },
          { name:'Maestro',         sub:'Raggiungi il livello 50',  ok: lvl >= 50 },
          { name:'Gran Maestro',    sub:'Raggiungi il livello 80',  ok: lvl >= 80 },
          { name:'Leggendario',     sub:'Raggiungi il livello 100', ok: lvl >= 100 },
          { name:'Apice',           sub:'Raggiungi il livello 150', ok: lvl >= 150 },
        ],
      },
      {
        key: 'presence',
        icon: '⏱️',
        name: 'Partecipazione',
        items: [
          { name:'Riscaldamento',      sub:'Gioca 2 partite',    ok: games >= 2 },
          { name:'Presenza Costante',  sub:'Gioca 10 partite',   ok: games >= 10 },
          { name:'Tenace',             sub:'Gioca 30 partite',   ok: games >= 30 },
          { name:'Instancabile',       sub:'Gioca 50 partite',   ok: games >= 50 },
          { name:'Maratoneta',         sub:'Gioca 100 partite',  ok: games >= 100 },
        ],
      },
    ];

    // Render categorie
    return cats.map(cat => {
      const total = cat.items.length;
      const unlocked = cat.items.filter(i => i.ok).length;
      return `
        <details class="ach-cat"${unlocked>0 ? ' open' : ''}>
          <summary>
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${escapeHtml(cat.name)}</span>
            <span class="cat-count">${unlocked}/${total} sbloccati</span>
          </summary>
          <ul class="ach-list">
            ${cat.items.map(it => `
              <li class="ach" aria-checked="${it.ok ? 'true' : 'false'}">
                <div class="ico">${cat.icon}</div>
                <div class="meta">
                  <div class="name">${escapeHtml(it.name)}</div>
                  <div class="sub">${escapeHtml(it.sub)}</div>
                </div>
                <div class="lock" title="${it.ok ? 'Sbloccato' : 'Bloccato'}">${it.ok ? '✓' : '🔒'}</div>
              </li>
            `).join('')}
          </ul>
        </details>
      `;
    }).join('');
  }

  // ---------- Main ----------
  async function main() {
    const nickParam = getParamNick();
    if (!nickParam) {
      renderNotFound('(nessun nick)');
      return;
    }

    let rows = [];
    try {
      const r = await fetch(DATA_URL + '?_=' + Date.now());
      const text = await r.text();
      const arr = parseSuperFlexible(text);
      rows = arr.map(normalizeRow);
    } catch (e) {
      console.error('Errore caricamento followers.json', e);
      renderNotFound(nickParam);
      return;
    }

    // Dedupe + ranking globale
    const dedupMap = new Map();
    for (const rec of rows) {
      const key = (rec.nickname || '').toLowerCase();
      if (!key) continue;
      const prev = dedupMap.get(key);
      if (!prev || (rec.vittorie || 0) > (prev.vittorie || 0)) dedupMap.set(key, rec);
    }
    const players = [...dedupMap.values()];
    const scored = players.map(p => ({ r: p, S: computeScore(p) }));
    scored.sort(comparePlayersByScore);
    const total = scored.length;

    const rec = (() => {
      const lc = nickParam.toLowerCase();
      return players.find(p => (p.nickname || '').toLowerCase() === lc) || null;
    })();

    if (!rec) {
      renderNotFound(nickParam);
      return;
    }

    // Trova rank del giocatore
    let rank = scored.findIndex(e => (e.r.nickname || '').toLowerCase() === (rec.nickname || '').toLowerCase()) + 1;
    if (rank < 1) rank = total;

    // Render profile card
    const card = qs('#profileCard');
    const tpl = qs('#tplProfile').content.cloneNode(true);

    const nickEl = tpl.querySelector('#nick');
    const subIdEl = tpl.querySelector('#subId');
    const lvlTextEl = tpl.querySelector('#lvlText');
    const xpNowEl = tpl.querySelector('#xpNow');
    const xpMaxEl = tpl.querySelector('#xpMax');
    const xpFillEl = tpl.querySelector('#xpFill');

    nickEl.textContent = rec.nickname || 'Sconosciuto';
    subIdEl.textContent = `@${(rec.nickname || '').toLowerCase()}`;

    // Avatar
    const avatar = tpl.querySelector('.avatar');
    const img = tpl.querySelector('.avatar img');
    const initial = tpl.querySelector('.avatar .initial');
    const initialChar = (rec.nickname || '?').match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() || '?';
    initial.textContent = initialChar;

    // Sorgente immagine
    const imgUrl = (() => {
      const orig = rec.img_url_original ? String(rec.img_url_original) : '';
      if (/^https?:\/\//i.test(orig)) return orig;
      const file = rec.img_url ? String(rec.img_url) : (orig || '');
      return buildAvatarURL(file);
    })();
    if (imgUrl) img.src = imgUrl;
    levelBadgeApply(tpl, rec.livello);

    // XP progress (rimane)
    const lvl = Number(rec.livello || 1);
    const xpNow = Math.max(0, Math.min(100, Number(rec.esperienza || 0)));
    const xpMax = 100;
    lvlTextEl.textContent = String(lvl);
    xpNowEl.textContent = String(xpNow);
    xpMaxEl.textContent = String(xpMax);
    xpFillEl.style.width = `${(xpNow/xpMax)*100}%`;

    card.appendChild(tpl);
    wireImg(img, initial);

    // Stats
    qs('#statsGrid').innerHTML = buildStatsGrid(rec, rank, total);

    // Achievements (categorie espandibili)
    const achRoot = qs('#achRoot');
    achRoot.innerHTML = buildAchievementsGroups(rec);
  }

  function renderNotFound(nick) {
    const el = qs('#profileCard');
    el.innerHTML = `
      <div class="card" style="text-align:center">
        <p style="margin:10px 0 6px">Profilo non trovato</p>
        <p class="muted" style="margin:0;color:#9ca3af">"${escapeHtml(nick)}"</p>
        <p style="margin:12px 0 0"><a href="index.html" style="color:#93c5fd;text-decoration:none;font-weight:700">Torna alla classifica</a></p>
      </div>
    `;
    const sg = qs('#statsGrid'); if (sg) sg.innerHTML = '';
    const ar = qs('#achRoot'); if (ar) ar.innerHTML = '';
  }

  // Parser flessibile (come in home)
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

  main();
})();