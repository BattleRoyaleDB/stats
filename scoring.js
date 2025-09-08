// Pesi fissi e trasparenti
const W_WIN   = 100;
const W_KILL  = 55;
const W_LEVEL = 45;
const W_MORTI = 10;

const nz = v => Number.isFinite(+v) ? +v : 0;

export function computeScore(r) {
  const wins  = nz(r.vittorie);
  const kills = nz(r.kill);
  const lvl   = nz(r.livello);
  const morti = nz(r.morti); // partite giocate
  return wins*W_WIN + kills*W_KILL + lvl*W_LEVEL + morti*W_MORTI;
}

// Confronto deterministico con tie-break a cascata
export function comparePlayersByScore(a, b) {
  // a,b possono essere record puri oppure { r, S }
  const ra = a.r || a, rb = b.r || b;
  const Sa = 'S' in a ? a.S : computeScore(ra);
  const Sb = 'S' in b ? b.S : computeScore(rb);

  if (Sb !== Sa) return Sb - Sa;                           // 1) Score
  if (nz(rb.vittorie)   !== nz(ra.vittorie))   return nz(rb.vittorie)   - nz(ra.vittorie);   // 2) vittorie
  if (nz(rb.kill)       !== nz(ra.kill))       return nz(rb.kill)       - nz(ra.kill);       // 3) kill
  if (nz(rb.livello)    !== nz(ra.livello))    return nz(rb.livello)    - nz(ra.livello);    // 4) livello
  if (nz(rb.morti)      !== nz(ra.morti))      return nz(rb.morti)      - nz(ra.morti);      // 5) morti
  if (nz(rb.esperienza) !== nz(ra.esperienza)) return nz(rb.esperienza) - nz(ra.esperienza); // 6) esperienza (opz.)
  // 7) fallback stabile: nickname
  const na = String(ra.nickname || '').toLowerCase();
  const nb = String(rb.nickname || '').toLowerCase();
  return na.localeCompare(nb);
}

// Esempio d’uso:
/*
const scored = players.map(p => ({ r: p, S: computeScore(p) }));
scored.sort(comparePlayersByScore);
const rankMap = new Map(scored.map((e, i) => [e.r.nickname.toLowerCase(), { rank: i+1, S: e.S }]));
*/