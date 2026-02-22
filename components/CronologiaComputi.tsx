"use client";

import { useState, useEffect } from "react";
import { Download, Clock, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { downloadComputoExcel, type ComputoRow } from "@/lib/downloadExcel";

type HistoryEntry = {
  id: string;
  titolo: string;
  created_at: string;
  contenuto_testo: string;
};

export default function CronologiaComputi({
  refreshTrigger,
}: {
  refreshTrigger: number;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!isOpen && refreshTrigger === 0) return;

    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch("/api/computi-history");
        if (res.ok) {
          const data = (await res.json()) as HistoryEntry[];
          setEntries(data);
        }
      } catch (err) {
        console.error("Errore caricamento cronologia:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [isOpen, refreshTrigger]);

  const startEditing = (entry: HistoryEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.titolo);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveTitle = async () => {
    if (!editingId || !editValue.trim()) return;
    try {
      const res = await fetch("/api/computi-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, titolo: editValue.trim() }),
      });
      if (res.ok) {
        setEntries((prev) =>
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

  const handleDownload = async (entry: HistoryEntry) => {
    try {
      const rows = JSON.parse(entry.contenuto_testo) as ComputoRow[];
      const isPrezzario = rows.length > 0 && "codice" in rows[0];
      await downloadComputoExcel(rows, isPrezzario);
    } catch (err) {
      console.error("Errore download Excel:", err);
      alert("Errore nel download del file.");
    }
  };

  const getRowCount = (entry: HistoryEntry): number => {
    try {
      return (JSON.parse(entry.contenuto_testo) as unknown[]).length;
    } catch {
      return 0;
    }
  };

  const getMode = (entry: HistoryEntry): string => {
    try {
      const rows = JSON.parse(entry.contenuto_testo) as ComputoRow[];
      return rows.length > 0 && "codice" in rows[0] ? "Prezzario" : "Libero";
    } catch {
      return "—";
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          I miei Computi
        </h3>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {entries.length}
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-600">
              Caricamento...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">
              Nessun computo salvato
            </p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 font-semibold text-slate-900">
                      Data
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-900">
                      Titolo
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-900">
                      Modalità
                    </th>
                    <th className="py-2 font-semibold text-slate-900">
                      Voci
                    </th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="max-w-[300px] py-2.5 pr-4">
                        {editingId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveTitle();
                                if (e.key === "Escape") cancelEditing();
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveTitle}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="group flex items-center gap-1.5">
                            <span
                              className="truncate text-slate-700"
                              title={entry.titolo}
                            >
                              {entry.titolo}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditing(entry)}
                              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            getMode(entry) === "Prezzario"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {getMode(entry)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {getRowCount(entry)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownload(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={2} />
                          Excel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
