// Web Worker: RAG keyword scoring for prezzario filtering.
// Runs off the main thread to prevent UI freezes on large datasets.

const STOP_WORDS = new Set([
  "sono","circa","tutta","tutte","tutti","dalle","dalla","della","delle","dello",
  "degli","nella","nelle","nello","negli","come","fare","fatto","piano","zona",
  "anche","quindi","sopra","sotto","oltre","senza","hanno","abbiamo","quest",
  "quell","perche","dobbiamo","essere","sempre","allora","siamo","nell",
  "facciamo","guarda","ecco","dove","quando","quanto","quello","quella",
  "diciamo","partiamo","passiamo","invece","magari","forse","almeno","calcola",
  "aggiungi","metti","metri","quadri","cubi","lineari","centimetri","spessore",
  "altezza","lunghezza","larghezza","totali","totale","relativo","nuovo",
  "vecchio","esistente",
]);

const MAX_ROWS = 12000;
const TOP_PER_KEYWORD = 5;

self.onmessage = function (e) {
  const { userText, rows } = e.data;

  const rawKeywords = userText.toLowerCase().match(/[a-zàèìòù]{4,}/g) || [];
  const keywords = rawKeywords.filter((kw) => !STOP_WORDS.has(kw));

  if (keywords.length === 0) {
    self.postMessage({ filteredRows: null, keywords: [] });
    return;
  }

  // Pre-compute lowercase descriptions once
  const descs = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    descs[i] = (rows[i].rawText || "").toLowerCase();
  }

  const winnerSet = new Set();
  const winnerRows = [];

  for (const kw of keywords) {
    const stem = kw.slice(0, -1);
    const candidates = [];

    for (let i = 0; i < descs.length; i++) {
      if (winnerSet.has(i)) continue;
      const d = descs[i];
      let score = 0;
      if (d.includes(kw)) score = 2;
      else if (d.includes(stem)) score = 1;
      if (score > 0) candidates.push({ idx: i, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const limit = Math.min(candidates.length, TOP_PER_KEYWORD);
    for (let j = 0; j < limit; j++) {
      const c = candidates[j];
      winnerSet.add(c.idx);
      winnerRows.push(rows[c.idx]);
    }

    if (winnerRows.length >= MAX_ROWS) break;
  }

  const capped = winnerRows.slice(0, MAX_ROWS);

  self.postMessage({
    filteredRows: capped,
    keywords: keywords,
    totalFiltered: capped.length,
  });
};
