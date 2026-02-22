"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Download, FileUp, Square, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import CronologiaComputi from "@/components/CronologiaComputi";
import { downloadComputoExcel } from "@/lib/downloadExcel";
import { useCredits } from "@/providers/CreditsContext";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type ComputoRow = {
  codice?: string;
  categoria: string;
  descrizione: string;
  um: string;
  quantita: number;
  prezzo_unitario?: string | number;
};

function extractJsonObjects(text: string, startFrom: number) {
  const extracted: ComputoRow[] = [];
  let i = startFrom;

  while (i < text.length) {
    if (text[i] === "{") {
      let depth = 0;
      let inString = false;
      let j = i;

      while (j < text.length) {
        const ch = text[j];
        if (inString) {
          if (ch === "\\" && j + 1 < text.length) {
            j++;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') inString = true;
          else if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) {
              try {
                const obj = JSON.parse(text.substring(i, j + 1));
                extracted.push(obj as ComputoRow);
              } catch {
                /* incomplete or malformed */
              }
              i = j + 1;
              break;
            }
          }
        }
        j++;
      }
      if (depth !== 0) break;
    } else {
      i++;
    }
  }

  return { extracted, newOffset: i };
}

export default function ComputoApp() {
  const { deductCredits } = useCredits();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [computoData, setComputoData] = useState<ComputoRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPrezzarioMode, setIsPrezzarioMode] = useState(false);
  const [prezzarioData, setPrezzarioData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [includePrices, setIncludePrices] = useState<boolean>(true);
  const [streamingRows, setStreamingRows] = useState<ComputoRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const previewScrollRef = useRef<HTMLDivElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setRecordingTime(0);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Errore accesso microfono:", err);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;

    mr.onstop = () => {
      const chunks = chunksRef.current;
      const mimeType = mr.mimeType || "audio/webm";
      if (chunks.length > 0) {
        setAudioBlob(new Blob(chunks, { type: mimeType }));
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
    };

    mr.stop();
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          alert(
            errBody.error ?? "Crediti esauriti. Ricarica per trascrivere l'audio."
          );
          return;
        }
        throw new Error(errBody.error ?? "Errore durante la trascrizione");
      }
      const data = (await res.json()) as { text: string };
      setTranscription(data.text ?? "");
      setAudioBlob(null);
      deductCredits(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore durante la trascrizione");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscription = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
      alert("Testo copiato negli appunti");
    } catch {
      alert("Impossibile copiare negli appunti");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawData = XLSX.utils.sheet_to_json(ws, {
          header: 1,
        }) as unknown[][];

        const cleanListino: { rawText: string }[] = [];

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          const filledCells = row
            ? (row as unknown[]).filter(
                (cell) =>
                  cell !== null &&
                  cell !== undefined &&
                  String(cell).trim() !== ""
              )
            : [];

          if (filledCells.length >= 2) {
            cleanListino.push({
              rawText: filledCells.map((c) => String(c).trim()).join(" | "),
            });
          }
        }

        if (cleanListino.length === 0) {
          alert(
            "Il file sembra vuoto o non contiene dati formattati a tabella."
          );
          setFileName("");
          setPrezzarioData(null);
          return;
        }

        setPrezzarioData(JSON.stringify(cleanListino));
        console.log(
          `Prezzario caricato (Modalità Agnostica): ${cleanListino.length} righe valide trovate.`
        );
      } catch (error) {
        console.error("Errore nella lettura:", error);
        alert("Errore nella lettura del file. Prova con un formato standard.");
        setFileName("");
        setPrezzarioData(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAnalyze = async () => {
    const text = transcription?.trim() ?? "";
    if (!text) {
      alert("Inserisci o registra prima un testo da analizzare!");
      return;
    }

    setIsAnalyzing(true);
    let prezzarioToSend: string | null = prezzarioData;

    if (isPrezzarioMode && prezzarioData) {
      try {
        const parsed = JSON.parse(prezzarioData) as { rawText?: string }[];
        const userText = text.toLowerCase();
        // 1. Estrazione parole e rimozione Stop Words avanzate
        const rawKeywords = userText.match(/[a-zàèìòù]{4,}/g) || [];
        const stopWords = [
          // Verbi e parole comuni del parlato
          "sono",
          "circa",
          "tutta",
          "tutte",
          "tutti",
          "dalle",
          "dalla",
          "della",
          "delle",
          "dello",
          "degli",
          "nella",
          "nelle",
          "nello",
          "negli",
          "come",
          "fare",
          "fatto",
          "piano",
          "zona",
          "anche",
          "quindi",
          "sopra",
          "sotto",
          "oltre",
          "senza",
          "hanno",
          "abbiamo",
          "quest",
          "quell",
          "perche",
          "dobbiamo",
          "essere",
          "sempre",
          "allora",
          "siamo",
          "nell",
          "facciamo",
          "guarda",
          "ecco",
          "dove",
          "quando",
          "quanto",
          "quello",
          "quella",
          "diciamo",
          "partiamo",
          "passiamo",
          "invece",
          "magari",
          "forse",
          "almeno",
          "calcola",
          "aggiungi",
          "metti",
          // Unità di misura e parole generiche da cantiere che 'inquinano' la ricerca
          "metri",
          "quadri",
          "cubi",
          "lineari",
          "centimetri",
          "spessore",
          "altezza",
          "lunghezza",
          "larghezza",
          "totali",
          "totale",
          "relativo",
          "nuovo",
          "vecchio",
          "esistente",
        ];
        const keywords = rawKeywords.filter((kw) => !stopWords.includes(kw));

        if (keywords.length > 0) {
          const winnerSet = new Set<number>();
          const winnerRows: { rawText?: string }[] = [];

          for (const kw of keywords) {
            const stem = kw.slice(0, -1);
            const scored = parsed.map((row, idx) => {
              const desc = (row.rawText ?? "").toLowerCase();
              let score = 0;
              if (desc.includes(kw)) score += 2;
              else if (desc.includes(stem)) score += 1;
              return { idx, row, score };
            });

            scored
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .forEach((r) => {
                if (!winnerSet.has(r.idx)) {
                  winnerSet.add(r.idx);
                  winnerRows.push(r.row);
                }
              });
          }

          const cappedRows = winnerRows.slice(0, 12000);
          prezzarioToSend = JSON.stringify(cappedRows);
          console.log(
            `[MOTORE DI RICERCA] Parole chiave 'pulite': ${keywords.join(", ")}`
          );
          console.log(
            `[MOTORE DI RICERCA] Righe dinamiche inviate a Gemini: ${cappedRows.length} (cap 12000)`
          );
        }
      } catch (e) {
        console.error("Errore nel filtraggio:", e);
      }
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          isPrezzarioMode,
          prezzario: prezzarioToSend,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          alert(
            errBody.error ?? "Crediti esauriti per generare il computo."
          );
          return;
        }
        throw new Error(
          errBody.error ??
            `Errore Server: ${res.status} - Riduci la grandezza del file o del testo.`
        );
      }

      setComputoData([]);
      setStreamingRows([]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let generatedText = "";
      let parsedUpTo = 0;
      let heartbeatStripped = false;
      const allRows: ComputoRow[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        generatedText += chunk;

        if (!heartbeatStripped && generatedText.includes("__HEARTBEAT__\n")) {
          generatedText = generatedText.replace("__HEARTBEAT__\n", "");
          heartbeatStripped = true;
          parsedUpTo = 0;
        }

        const { extracted, newOffset } = extractJsonObjects(
          generatedText,
          parsedUpTo
        );
        if (extracted.length > 0) {
          parsedUpTo = newOffset;
          allRows.push(...extracted);
          setStreamingRows([...allRows]);
        }
      }

      console.log("[RISPOSTA GEMINI STREAM]:", allRows.length, "righe");

      if (allRows.length === 0) {
        const cleanText = generatedText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        try {
          const data = JSON.parse(cleanText);
          const arr = Array.isArray(data) ? data : [];
          if (arr.length > 0) {
            allRows.push(...(arr as ComputoRow[]));
          }
        } catch {
          console.error("JSON parse error, raw:", cleanText);
        }
      }

      if (allRows.length === 0) {
        alert(
          "Attenzione: Gemini non ha trovato voci corrispondenti o ha restituito un formato errato."
        );
      }

      setComputoData(allRows);

      if (allRows.length > 0) {
        deductCredits(isPrezzarioMode ? 10 : 1);
        setHistoryRefresh((n) => n + 1);
        setToast("Computo salvato automaticamente nella tua cronologia");
        setTimeout(() => setToast(null), 4000);
      }
    } catch (error) {
      console.error("Errore chiamata API:", error);
      alert(
        "Si è verificato un errore durante l'analisi. Controlla la Console."
      );
    } finally {
      setStreamingRows([]);
      setIsAnalyzing(false);
    }
  };

  const handleDownloadExcel = async () => {
    await downloadComputoExcel(computoData, isPrezzarioMode, includePrices);
  };

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop =
        previewScrollRef.current.scrollHeight;
    }
  }, [streamingRows]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 md:p-8 max-md:overflow-hidden">
      {/* Toggle modalità IA: valido per Mobile e Desktop */}
      <div className="hidden md:flex mb-8 w-fit mx-auto rounded-xl bg-slate-200 p-1">
        <button
          type="button"
          onClick={() => setIsPrezzarioMode(false)}
          className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
            !isPrezzarioMode
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Preventivo Libero
        </button>
        <button
          type="button"
          onClick={() => setIsPrezzarioMode(true)}
          className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
            isPrezzarioMode
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Bonus e Prezzari
        </button>
      </div>

      {/* Vista Mobile: solo su schermi piccoli - fixed a tutto schermo, niente scroll */}
      <div className="md:hidden fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-4">
        <h1 className="text-2xl font-semibold text-slate-800">
          Vocale Sopralluogo
        </h1>

        {isRecording ? (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-32 w-32 animate-pulse items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95"
              aria-label="Ferma registrazione"
            >
              <Square className="h-12 w-12" strokeWidth={2} fill="currentColor" />
            </button>
            <p className="text-2xl font-mono font-semibold tabular-nums text-slate-700">
              {formatTime(recordingTime)}
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
              aria-label="Avvia sopralluogo vocale"
            >
              <Mic className="h-12 w-12" strokeWidth={2} />
            </button>
            <p className="text-center text-sm text-slate-500">
              Tocca per registrare
            </p>
          </>
        )}

        {audioBlob !== null && !isRecording && (
          <div className="flex w-full max-w-xs flex-col items-center gap-4">
            <p className="text-center text-sm font-medium text-slate-600">
              Audio registrato pronto
            </p>
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white shadow transition hover:bg-green-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isTranscribing ? "Trascrizione in corso..." : "Trascrivi Audio"}
            </button>
          </div>
        )}

        {/* Su mobile NON si mostra mai il testo/trascrizione: resta solo registrazione e Trascrivi Audio. Il testo si vede e si gestisce solo su desktop. */}
      </div>

      {/* Vista Desktop: da md in su. Su telefono nascosta così il testo/analisi non appare mai. */}
      <section className="max-md:!hidden md:grid md:grid-cols-2 gap-8 h-[85vh]">
        {/* Colonna sinistra: Input Dati */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Input Dati
          </h2>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          {isPrezzarioMode && (
            <>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 transition-colors hover:bg-slate-50">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="mb-4 block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  aria-label="Carica Prezzario o Listino"
                />
                <FileUp className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
                <p className="mt-2 text-center text-sm text-slate-600">
                  Trascina qui il Prezzario Regionale o Listino (PDF, Excel)
                </p>
                {fileName && (
                  <span className="mt-3 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    ✅ Listino caricato: {fileName}
                  </span>
                )}
              </div>
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-4 flex-shrink-0 text-sm text-slate-400">
                  OPPURE
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </>
          )}

          {/* Textarea appunti */}
          <textarea
            className="min-h-[180px] w-full flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            placeholder="Oppure incolla qui gli appunti testuali del sopralluogo..."
            rows={6}
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
          />
          </div>
        </div>

        {/* Colonna destra: Anteprima Computo */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-0">
            Anteprima Computo
          </h2>
          <div
            ref={previewScrollRef}
            className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-slate-50"
          >
            {(() => {
              const displayRows = isAnalyzing ? streamingRows : computoData;
              if (displayRows.length === 0) {
                return (
                  <p className="flex h-full items-center justify-center p-6 text-slate-600">
                    {isAnalyzing
                      ? "Connessione a Gemini in corso..."
                      : "Nessun dato analizzato"}
                  </p>
                );
              }
              return (
                <>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 bg-slate-100">
                        <th className="p-3 font-semibold text-slate-900">
                          Categoria
                        </th>
                        <th className="p-3 font-semibold text-slate-900">
                          Descrizione
                        </th>
                        <th className="p-3 font-semibold text-slate-900">
                          U.M.
                        </th>
                        <th className="p-3 font-semibold text-slate-900">
                          Q.tà
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-100 transition-colors duration-300 ${
                            isAnalyzing && i === displayRows.length - 1
                              ? "bg-blue-50/60"
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="p-3 text-slate-900">
                            {row.categoria}
                          </td>
                          <td className="p-3 text-slate-600">
                            {row.descrizione}
                          </td>
                          <td className="p-3 text-slate-600">{row.um}</td>
                          <td className="p-3 text-slate-600">{row.quantita}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {isAnalyzing && (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-blue-600">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      Generazione in corso... ({displayRows.length} voci)
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {isPrezzarioMode && computoData.length > 0 && (
            <div className="mb-4 flex items-center justify-center">
              <input
                type="checkbox"
                id="includePrices"
                checked={includePrices}
                onChange={(e) => setIncludePrices(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="includePrices"
                className="ml-2 cursor-pointer text-sm font-medium text-gray-700"
              >
                Includi i prezzi del Prezzario Regionale
              </label>
            </div>
          )}
          {computoData.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white shadow transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              <Download className="h-5 w-5" strokeWidth={2} />
              Scarica File Excel (.xlsx)
            </button>
          )}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Wand2 className="h-5 w-5" strokeWidth={2} />
            {isAnalyzing ? "Analisi in corso..." : "Analizza Dati"}
          </button>
        </div>
      </section>

      <CronologiaComputi refreshTrigger={historyRefresh} />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-opacity">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
