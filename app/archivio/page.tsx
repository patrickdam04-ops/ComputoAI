"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Copy, Check, FileText } from "lucide-react";
import Link from "next/link";

type Transcription = {
  id: string;
  content: string;
  created_at: string;
  project_name: string;
};

export default function ArchivioPage() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/transcriptions");
        if (res.ok) {
          const data = (await res.json()) as Transcription[];
          setTranscriptions(data);
        }
      } catch (err) {
        console.error("Errore caricamento archivio:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Dashboard
          </Link>
          <h1 className="text-lg font-bold text-slate-800">
            Archivio Trascrizioni
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Caricamento...</p>
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText
              className="mb-4 h-12 w-12 text-slate-300"
              strokeWidth={1.5}
            />
            <p className="text-sm text-slate-400">
              Nessuna trascrizione salvata
            </p>
            <Link
              href="/"
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Torna alla dashboard per registrare
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {transcriptions.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatDate(t.created_at)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatTime(t.created_at)}
                    </span>
                    {t.project_name &&
                      t.project_name !== "Sopralluogo senza nome" && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {t.project_name}
                        </span>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(t.content, t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      copiedId === t.id
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {t.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
