"use client";

import { useCredits } from "@/providers/CreditsContext";

export default function CreditBadge() {
  const { credits, loading } = useCredits();

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm bg-slate-100 text-slate-400">
        <span aria-hidden>⚡</span>
        <span>...</span>
      </div>
    );
  }

  if (credits <= 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-red-600 bg-red-100 shadow-sm border border-red-200">
        <span aria-hidden>⚡</span>
        <span>0 Crediti</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm bg-emerald-100 text-emerald-800">
      <span aria-hidden>⚡</span>
      <span>Crediti: {credits}</span>
    </div>
  );
}
