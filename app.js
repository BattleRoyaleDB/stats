// app.js — leaderboard + search + NDJSON fallback
(() => {
  const DATA_URL = 'followers.json';
  let rawData = [];
  let viewMode = 'top10';
  let sortCol = 'vittorie';
  let sortDir = 'desc'; // desc or asc

  const tbody = document.querySelector('#leaderboard tbody');
  const searchInput = document.getElementById('searchInput');
  const viewSelect = document.getElementById('viewSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearSearch = document.getElementById('clearSearch');

  const detail = document.getElementById('detailPanel');
  const detailAvatar = document.getElementById('detailAvatar');
  const detailNick = document.getElementById('detailNick');
  const detailV = document.getElementById('detailVittorie');
  const detailK = document.getElementById('detailKill');
  const detailM = document.getElementById('detailMorti');
  const closeDetail = document.getElementById('closeDetail');

  async function fetchData() {
    try {
      const r = await fetch(DATA_URL + '?_=' + Date.now());
      const text = await r.text();
      const data = parseMaybeNdjson(text);
      rawData = data.map(normalizeRow);
      render();
    } catch (e) {
      console.error('Errore fetch data', e);
      tbody.innerHTML = '<tr><td colspan="5">Errore caricamento followers.json</td></tr>';
    }
  }

  function parseMaybeNdjson(text) {
    text = text.trim();
    if (!text) return [];
    // prima prova: JSON array
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch(_) {}
    // fallback: NDJSON (una riga = un oggetto)
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const l of lines) {
      try { out.push(JSON.parse(l)); } catch(e) { console.warn('skipping line', l); }
    }
    return out;
  }

  function normalizeRow(r) {
    return {
      nickname: r.nickname || r.nick || r.name || '',
      kill: Number(r.kill || r.kills || 0),
      morti: Number(r.morti || r.deaths || 0),
      vittorie: Number(r.vittorie || r.wins || 0),
      img: r.img_url || r.avatar || r.img || r.image || null
    };
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    let data = rawData.slice();

    // sort
    data.sort((a,b) => {
      let v = 0;
      if (sortCol === 'vittorie') v = b.vittorie - a.vittorie;
      else if (sortCol === 'kill') v = b.kill - a.kill;
      else if (sortCol === 'morti') v = a.morti - b.morti; // fewer morti is better? keep desc default is higher first
      if (sortDir === 'asc') v = -v;
      if (v !== 0) return v;
      // tie-break by nickname
      return a.nickname.localeCompare(b.nickname, undefined, {sensitivity:'base'});
    });

    if (q) data = data.filter(r => r.nickname.toLowerCase().includes(q));

    if (viewMode === 'top10' && !q) data = data.slice(0, 10);

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nessun risultato</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.nick = r.nickname;
      const rank = document.createElement('td');
      rank.className = 'rank';
      rank.textContent = (idx+1);
      const nickTd = document.createElement('td');
      nickTd.className = 'nicknameCell';
      const img = document.createElement('img');
      img.className = 'avatarSmall';
      img.alt = r.nickname;
      img.src = r.img || ('data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#1b1d20"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#9aa3ac" font-family="Arial" font-size="18">${(r.nickname||'')[0]||'?'}</text></svg>`));
      nickTd.appendChild(img);
      const nickSpan = document.createElement('span');
      nickSpan.textContent = r.nickname;
      nickTd.appendChild(nickSpan);

      const vtd = document.createElement('td'); vtd.textContent = r.vittorie;
      const ktd = document.createElement('td'); ktd.textContent = r.kill;
      const mtd = document.createElement('td'); mtd.textContent = r.morti;

      tr.appendChild(rank);
      tr.appendChild(nickTd);
      tr.appendChild(vtd);
      tr.appendChild(ktd);
      tr.appendChild(mtd);

      tr.addEventListener('click', () => openDetail(r, tr));

      tbody.appendChild(tr);
    });

    // highlight if query param nick present
    const urlNick = getUrlNick();
    if (urlNick) {
      highlightNick(urlNick);
    }
  }

  function openDetail(r, rowElem) {
    detail.classList.remove('hidden');
    detail.setAttribute('aria-hidden','false');
    detailAvatar.src = r.img || '';
    detailAvatar.alt = r.nickname;
    detailNick.textContent = r.nickname;
    detailV.textContent = r.vittorie;
    detailK.textContent = r.kill;
    detailM.textContent = r.morti;
    // scroll row into view and highlight
    clearHighlights();
    rowElem.classList.add('highlight');
    rowElem.scrollIntoView({behavior:'smooth', block:'center'});
    // update URL hash
    history.replaceState(null, '', '#'+encodeURIComponent(r.nickname));
  }

  function closeDetailPanel() {
    detail.classList.add('hidden');
    detail.setAttribute('aria-hidden','true');
    clearHighlights();
  }

  function clearHighlights() {
    document.querySelectorAll('tbody tr.highlight').forEach(t => t.classList.remove('highlight'));
  }

  function getUrlNick() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (hash) return hash;
    const params = new URLSearchParams(location.search);
    return params.get('nick') || '';
  }

  function highlightNick(nick) {
    if (!nick) return;
    nick = nick.toLowerCase();
    const row = Array.from(tbody.querySelectorAll('tr')).find(tr => (tr.dataset.nick||'').toLowerCase() === nick);
    if (row) {
      clearHighlights();
      row.classList.add('highlight');
      row.scrollIntoView({behavior:'smooth', block:'center'});
      // optionally open detail
      const r = rawData.find(x => x.nickname.toLowerCase() === nick);
      if (r) {
        detail.classList.remove('hidden');
        detail.setAttribute('aria-hidden','false');
        detailAvatar.src = r.img || '';
        detailAvatar.alt = r.nickname;
        detailNick.textContent = r.nickname;
        detailV.textContent = r.vittorie;
        detailK.textContent = r.kill;
        detailM.textContent = r.morti;
      }
    }
  }

  // UI: header sort clicks
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortDir = (sortDir === 'desc') ? 'asc' : 'desc';
      else { sortCol = col; sortDir = 'desc'; }
      document.querySelectorAll('th.sortable').forEach(t => t.classList.remove('asc','desc'));
      th.classList.add(sortDir);
      render();
    });
  });

  searchInput.addEventListener('input', () => {
    render();
  });
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    render();
    searchInput.focus();
  });

  viewSelect.addEventListener('change', (e) => {
    viewMode = e.target.value;
    render();
  });

  refreshBtn.addEventListener('click', () => fetchData());

  closeDetail.addEventListener('click', closeDetailPanel);
  document.addEventListener('keydown', (e) => { if (e.key==='Escape') closeDetailPanel(); });

  // init
  fetchData();
})();
