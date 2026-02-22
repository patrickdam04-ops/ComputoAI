// Web Worker: RAG keyword scoring for prezzario filtering.
// Runs off the main thread to prevent UI freezes on large datasets.
// Returns rows sorted by cumulative relevance score (most useful first)
// in compact CSV format to minimize token usage.

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
const MAX_DESC_CHARS = 300;

function cleanText(s) {
  return s
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function rowToCompactLine(rawText) {
  const parts = rawText.split("|").map((p) => cleanText(p));
  if (parts.length <= 1) return cleanText(rawText).substring(0, MAX_DESC_CHARS);

  // Heuristic: typically Codice | Descrizione... | UM | Prezzo
  // Keep all parts but truncate long description fields
  const cleaned = parts.map((p) =>
    p.length > MAX_DESC_CHARS ? p.substring(0, MAX_DESC_CHARS) : p
  );
  return cleaned.join(";");
}

self.onmessage = function (e) {
  const { userText, rows } = e.data;

  const rawKeywords = userText.toLowerCase().match(/[a-zàèìòù]{4,}/g) || [];
  const keywords = rawKeywords.filter((kw) => !STOP_WORDS.has(kw));

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

  // Build compact CSV: one line per row, semicolon-separated, cleaned
  const csvLines = sortedEntries.map((s) =>
    rowToCompactLine(rows[s.idx].rawText || "")
  );
  const csvString = csvLines.join("\n");

  self.postMessage({
    filteredCsv: csvString,
    filteredCount: csvLines.length,
    keywords: keywords,
  });
};
