// Web Worker: RAG keyword scoring for prezzario filtering.
// Runs off the main thread to prevent UI freezes on large datasets.
// Accepts expandedKeywords from LLM synonym expansion (Step 1).

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
  const { userText, rows, expandedKeywords } = e.data;

  // Original keywords from user text
  const rawKeywords = userText.toLowerCase().match(/[a-zàèìòù]{4,}/g) || [];
  const originalKw = rawKeywords.filter((kw) => !STOP_WORDS.has(kw));

  // Merge: original keywords + LLM-expanded synonyms (deduplicated)
  const expandedKw = Array.isArray(expandedKeywords)
    ? expandedKeywords
        .map((k) => String(k).toLowerCase().trim())
        .filter((k) => k.length >= 3 && !STOP_WORDS.has(k))
    : [];

  const allKeywordsSet = new Set([...originalKw, ...expandedKw]);
  const keywords = Array.from(allKeywordsSet);

  if (keywords.length === 0) {
    self.postMessage({ filteredCsv: null, filteredCount: 0, keywords: [] });
    return;
  }

  const descs = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    descs[i] = (rows[i].rawText || "").toLowerCase();
  }

  const scoreMap = new Map();
  const selectedIndices = new Set();

  for (const kw of keywords) {
    const stem = kw.slice(0, -1);
    const candidates = [];

    for (let i = 0; i < descs.length; i++) {
      const d = descs[i];
      let score = 0;
      if (d.includes(kw)) score = 2;
      else if (d.includes(stem)) score = 1;
      if (score > 0) {
        if (selectedIndices.has(i)) {
          scoreMap.set(i, (scoreMap.get(i) || 0) + score);
        } else {
          candidates.push({ idx: i, score });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const limit = Math.min(candidates.length, TOP_PER_KEYWORD);
    for (let j = 0; j < limit; j++) {
      const c = candidates[j];
      selectedIndices.add(c.idx);
      scoreMap.set(c.idx, (scoreMap.get(c.idx) || 0) + c.score);
    }

    if (selectedIndices.size >= MAX_ROWS) break;
  }

  const scored = [];
  for (const idx of selectedIndices) {
    scored.push({ idx, score: scoreMap.get(idx) || 0 });
  }
  scored.sort((a, b) => b.score - a.score);

  const sortedEntries = scored.slice(0, MAX_ROWS);
  const csvLines = sortedEntries.map((s) => rows[s.idx].rawText || "");
  const csvString = csvLines.join("\n");

  self.postMessage({
    filteredCsv: csvString,
    filteredCount: csvLines.length,
    keywords: keywords,
    originalCount: originalKw.length,
    expandedCount: expandedKw.length,
  });
};
