"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Download, FileUp, Square, Wand2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

export default function Home() {
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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore durante la trascrizione");
      }
      const data = (await res.json()) as { text: string };
      setTranscription(data.text ?? "");
      setAudioBlob(null);
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
          const scoredRows = parsed.map((row) => {
            const desc = (row.rawText ?? "").toLowerCase();
            let score = 0;
            keywords.forEach((kw) => {
              if (
                desc.includes(kw) ||
                desc.includes(kw.slice(0, -1))
              ) {
                score++;
              }
            });
            return { row, score };
          });
          const sortedRows = scoredRows
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.row);
          // SERBATOIO MASSIMO: Inviamo 10000 righe per coprire tutti i sinonimi e i materiali richiesti.
          const finalRows = sortedRows.slice(0, 10000);
          prezzarioToSend = JSON.stringify(finalRows);
          console.log(
            `[MOTORE DI RICERCA] Parole chiave 'pulite': ${keywords.join(", ")}`
          );
          console.log(
            `[MOTORE DI RICERCA] Inviate le ${finalRows.length} righe più pertinenti a Gemini.`
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
        throw new Error(
          `Errore Server: ${res.status} - Riduci la grandezza del file o del testo.`
        );
      }

      const data = (await res.json()) as
        | ComputoRow[]
        | { error?: string }
        | Record<string, unknown>;
      console.log("[RISPOSTA GEMINI]:", data);
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(data.error as string);
      }

      let finalArray: ComputoRow[] = [];
      if (Array.isArray(data)) {
        finalArray = data as ComputoRow[];
      } else if (data && typeof data === "object") {
        const key = Object.keys(data).find((k) =>
          Array.isArray((data as Record<string, unknown>)[k])
        );
        if (key) {
          finalArray = (data as Record<string, unknown>)[key] as ComputoRow[];
        }
      }

      if (finalArray.length === 0) {
        alert(
          "Attenzione: Gemini non ha trovato voci corrispondenti o ha restituito un formato errato."
        );
      }

      setComputoData(finalArray);
    } catch (error) {
      console.error("Errore chiamata API:", error);
      alert(
        "Si è verificato un errore durante l'analisi. Controlla la Console."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (computoData.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Computo");

    if (isPrezzarioMode) {
      worksheet.columns = [
        { header: "Codice Ufficiale", key: "codice", width: 18 },
        { header: "Categoria", key: "categoria", width: 25 },
        { header: "Descrizione Tecnica", key: "descrizione", width: 80 },
        { header: "U.M.", key: "um", width: 8 },
        { header: "Quantità", key: "quantita", width: 12 },
        { header: "Prezzo Unitario (€)", key: "prezzo", width: 18 },
        { header: "Totale (€)", key: "totale", width: 18 },
      ];
    } else {
      worksheet.columns = [
        { header: "Categoria", key: "categoria", width: 25 },
        { header: "Descrizione Tecnica", key: "descrizione", width: 80 },
        { header: "U.M.", key: "um", width: 8 },
        { header: "Quantità", key: "quantita", width: 12 },
      ];
    }

    computoData.forEach((item) => {
      if (isPrezzarioMode) {
        const isDaCercare =
          String(item.prezzo_unitario ?? "").toUpperCase() === "DA CERCARE";
        const prezzo =
          parseFloat(String(item.prezzo_unitario ?? "")) || 0;
        const quantita = parseFloat(String(item.quantita ?? 0)) || 0;
        const totale = (prezzo * quantita).toFixed(2);
        worksheet.addRow({
          codice: item.codice || "",
          categoria: item.categoria || "",
          descrizione: item.descrizione || "",
          um: item.um || "",
          quantita,
          prezzo: includePrices
            ? isDaCercare
              ? "DA CERCARE"
              : prezzo > 0
                ? prezzo
                : ""
            : "",
          totale: includePrices
            ? isDaCercare
              ? "DA CERCARE"
              : prezzo > 0
                ? parseFloat(totale)
                : ""
            : "",
        });
      } else {
        worksheet.addRow({
          categoria: item.categoria || "",
          descrizione: item.descrizione || "",
          um: item.um || "",
          quantita: item.quantita ?? 1,
        });
      }
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: "top" as const };
        if (rowNumber === 1) {
          cell.font = { bold: true };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "Computo_Metrico_Professionale.xlsx");
  };

  // Cleanup timer on unmount or when recording stops
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 max-md:overflow-hidden">
      <div className="hidden md:flex w-full justify-end mb-4">
        <UserButton />
      </div>
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
        <div className="flex flex-col gap-4 min-h-0 overflow-auto">
          <h2 className="text-lg font-semibold text-slate-800">Input Dati</h2>

          {isPrezzarioMode && (
            <>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 transition-colors hover:bg-slate-50">
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
            className="min-h-[180px] w-full flex-1 resize-none rounded-xl border border-slate-200 bg-white p-4 shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            placeholder="Oppure incolla qui gli appunti testuali del sopralluogo..."
            rows={6}
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
          />
        </div>

        {/* Colonna destra: Anteprima Computo */}
        <div className="flex flex-col gap-4 min-h-0">
          <h2 className="text-lg font-semibold text-slate-800">
            Anteprima Computo
          </h2>
          <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {computoData.length === 0 ? (
              <p className="flex h-full items-center justify-center p-6 text-slate-500">
                Nessun dato analizzato
              </p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-3 font-semibold text-slate-700">
                      Categoria
                    </th>
                    <th className="p-3 font-semibold text-slate-700">
                      Descrizione
                    </th>
                    <th className="p-3 font-semibold text-slate-700">U.M.</th>
                    <th className="p-3 font-semibold text-slate-700">Q.tà</th>
                  </tr>
                </thead>
                <tbody>
                  {computoData.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="p-3 text-slate-700">{row.categoria}</td>
                      <td className="p-3 text-slate-700">{row.descrizione}</td>
                      <td className="p-3 text-slate-600">{row.um}</td>
                      <td className="p-3 text-slate-600">{row.quantita}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-3 font-medium text-white shadow transition hover:bg-blue-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Wand2 className="h-5 w-5" strokeWidth={2} />
            {isAnalyzing ? "Analisi in corso..." : "Analizza Dati"}
          </button>
        </div>
      </section>
    </div>
  );
}
