import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export default async function CreditBadge() {
  const { userId } = await auth();

  let balance = 0;
  if (userId) {
    const { data: row, error } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    balance = error || !row ? 0 : Number(row.credits_balance ?? 0);
  }

  const isLow = balance <= 0;
  if (isLow) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-red-600 bg-red-100 shadow-sm border border-red-200">
        <span aria-hidden>⚡</span>
        <span>0 Crediti</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span aria-hidden>⚡</span>
      <span>Crediti: {balance}</span>
    </div>
  );
}
