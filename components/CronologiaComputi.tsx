"use client";

import { useState, useEffect } from "react";
import { Download, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { downloadComputoExcel, type ComputoRow } from "@/lib/downloadExcel";

type HistoryEntry = {
  id: string;
  titolo: string;
  is_prezzario_mode: boolean;
  created_at: string;
  contenuto_json: ComputoRow[];
};

export default function CronologiaComputi({
  refreshTrigger,
}: {
  refreshTrigger: number;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleDownload = async (entry: HistoryEntry) => {
    await downloadComputoExcel(
      entry.contenuto_json,
      entry.is_prezzario_mode
    );
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
    <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm max-md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-500" strokeWidth={2} />
          <h3 className="text-base font-semibold text-slate-800">
            I miei Computi
          </h3>
          {entries.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {entries.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-5 pb-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Caricamento...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nessun computo salvato
            </p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 font-semibold text-slate-600">
                      Data
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-600">
                      Titolo
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-600">
                      Modalità
                    </th>
                    <th className="py-2 font-semibold text-slate-600">
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
                      <td
                        className="max-w-[300px] truncate py-2.5 pr-4 text-slate-700"
                        title={entry.titolo}
                      >
                        {entry.titolo}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.is_prezzario_mode
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {entry.is_prezzario_mode
                            ? "Prezzario"
                            : "Libero"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {entry.contenuto_json?.length ?? 0}
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
