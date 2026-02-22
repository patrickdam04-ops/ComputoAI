"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  FileText,
  FolderOpen,
  Download,
  Pencil,
  Check as CheckIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { downloadComputoExcel, type ComputoRow } from "@/lib/downloadExcel";

type Transcription = {
  id: string;
  content: string;
  created_at: string;
  project_name: string;
};

type ComputoEntry = {
  id: string;
  titolo: string;
  created_at: string;
  contenuto_testo: string;
};

type Tab = "trascrizioni" | "computi";

export default function ArchivioPage() {
  const [tab, setTab] = useState<Tab>("trascrizioni");
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [computi, setComputi] = useState<ComputoEntry[]>([]);
  const [loadingTr, setLoadingTr] = useState(true);
  const [loadingCp, setLoadingCp] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingTrId, setEditingTrId] = useState<string | null>(null);
  const [editTrValue, setEditTrValue] = useState("");

  useEffect(() => {
    async function fetchTr() {
      setLoadingTr(true);
      try {
        const res = await fetch("/api/transcriptions");
        if (res.ok) setTranscriptions((await res.json()) as Transcription[]);
      } catch (err) {
        console.error("Errore caricamento trascrizioni:", err);
      } finally {
        setLoadingTr(false);
      }
    }
    fetchTr();
  }, []);

  useEffect(() => {
    if (tab !== "computi") return;
    async function fetchCp() {
      setLoadingCp(true);
      try {
        const res = await fetch("/api/computi-history");
        if (res.ok) setComputi((await res.json()) as ComputoEntry[]);
      } catch (err) {
        console.error("Errore caricamento computi:", err);
      } finally {
        setLoadingCp(false);
      }
    }
    fetchCp();
  }, [tab]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Errore durante la copia:", err);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateLong = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getComputoMode = (entry: ComputoEntry) => {
    try {
      const rows = JSON.parse(entry.contenuto_testo) as ComputoRow[];
      return rows.length > 0 && "codice" in rows[0] ? "Prezzario" : "Libero";
    } catch {
      return "—";
    }
  };

  const getRowCount = (entry: ComputoEntry) => {
    try {
      return (JSON.parse(entry.contenuto_testo) as unknown[]).length;
    } catch {
      return 0;
    }
  };

  const saveComputoTitle = async () => {
    if (!editingId || !editValue.trim()) return;
    try {
      const res = await fetch("/api/computi-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, titolo: editValue.trim() }),
      });
      if (res.ok) {
        setComputi((prev) =>
          prev.map((e) =>
            e.id === editingId ? { ...e, titolo: editValue.trim() } : e
          )
        );
      }
    } catch (err) {
      console.error("Errore salvataggio titolo:", err);
    } finally {
      setEditingId(null);
      setEditValue("");
    }
  };

  const saveTranscriptionTitle = async () => {
    if (!editingTrId) return;
    const value = editTrValue.trim();
    try {
      const res = await fetch("/api/transcriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTrId, project_name: value || "Sopralluogo senza nome" }),
      });
      if (res.ok) {
        setTranscriptions((prev) =>
          prev.map((t) =>
            t.id === editingTrId
              ? { ...t, project_name: value || "Sopralluogo senza nome" }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Errore salvataggio titolo trascrizione:", err);
    } finally {
      setEditingTrId(null);
      setEditTrValue("");
    }
  };

  const handleDownloadComputo = async (entry: ComputoEntry) => {
    try {
      const rows = JSON.parse(entry.contenuto_testo) as ComputoRow[];
      const isPrezzario = rows.length > 0 && "codice" in rows[0];
      await downloadComputoExcel(rows, isPrezzario);
    } catch (err) {
      console.error("Errore download Excel:", err);
      alert("Errore nel download del file.");
    }
  };

  const loading = tab === "trascrizioni" ? loadingTr : loadingCp;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Dashboard
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight text-indigo-900">
            Archivio
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex rounded-xl bg-slate-200 p-1">
          <button
            type="button"
            onClick={() => setTab("trascrizioni")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === "trascrizioni"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <FileText className="h-4 w-4" strokeWidth={2} />
            Trascrizioni
          </button>
          <button
            type="button"
            onClick={() => setTab("computi")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === "computi"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <FolderOpen className="h-4 w-4" strokeWidth={2} />
            Computi
          </button>
        </div>

        {tab === "trascrizioni" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Trascrizioni vocali
            </h2>
            {loading ? (
              <p className="py-12 text-center text-sm text-slate-600">
                Caricamento...
              </p>
            ) : transcriptions.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <FileText
                  className="mb-3 h-10 w-10 text-slate-300"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-slate-600">
                  Nessuna trascrizione salvata
                </p>
                <Link
                  href="/"
                  className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Torna alla dashboard per registrare
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {transcriptions.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {editingTrId === t.id ? (
                          <div className="flex flex-1 items-center gap-1">
                            <input
                              type="text"
                              value={editTrValue}
                              onChange={(e) => setEditTrValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveTranscriptionTitle();
                                if (e.key === "Escape") {
                                  setEditingTrId(null);
                                  setEditTrValue("");
                                }
                              }}
                              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              placeholder="Titolo trascrizione"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveTranscriptionTitle}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTrId(null);
                                setEditTrValue("");
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200"
                            >
                              <X className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              className="truncate text-sm font-semibold text-slate-900"
                              title={
                                t.project_name &&
                                t.project_name !== "Sopralluogo senza nome"
                                  ? t.project_name
                                  : `Trascrizione ${formatDate(t.created_at)}`
                              }
                            >
                              {t.project_name &&
                              t.project_name !== "Sopralluogo senza nome"
                                ? t.project_name
                                : `Trascrizione ${formatDate(t.created_at)}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTrId(t.id);
                                setEditTrValue(
                                  t.project_name !== "Sopralluogo senza nome"
                                    ? t.project_name
                                    : ""
                                );
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(t.content, t.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          copiedId === t.id
                            ? "bg-emerald-100 text-emerald-700"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {copiedId === t.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Copiato!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                            Copia Testo
                          </>
                        )}
                      </button>
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatDate(t.created_at)}</span>
                      <span>{formatTime(t.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {t.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "computi" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              I miei computi
            </h2>
            {loading ? (
              <p className="py-12 text-center text-sm text-slate-600">
                Caricamento...
              </p>
            ) : computi.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <FolderOpen
                  className="mb-3 h-10 w-10 text-slate-300"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-slate-600">Nessun computo salvato</p>
                <Link
                  href="/"
                  className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Torna alla dashboard per analizzare
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {computi.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {editingId === entry.id ? (
                          <div className="flex flex-1 items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveComputoTitle();
                                if (e.key === "Escape") {
                                  setEditingId(null);
                                  setEditValue("");
                                }
                              }}
                              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveComputoTitle}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditValue("");
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200"
                            >
                              <X className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              className="truncate text-sm font-semibold text-slate-900"
                              title={entry.titolo}
                            >
                              {entry.titolo}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditValue(entry.titolo);
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadComputo(entry)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={2} />
                        Excel
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDateLong(entry.created_at)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          getComputoMode(entry) === "Prezzario"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {getComputoMode(entry)}
                      </span>
                      <span>{getRowCount(entry)} voci</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
