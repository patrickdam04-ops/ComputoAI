import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export default async function CreditBadge() {
  const { userId } = await auth();
  if (!userId) return null;

  const { data: row, error } = await supabaseAdmin
    .from("user_credits")
    .select("credits_balance")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const balance = error || !row ? 0 : Number(row.credits_balance ?? 0);
  const isLow = balance <= 0;

  return (
    <div
      className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${
        isLow
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      }`}
    >
      <span aria-hidden>⚡</span>
      <span>Crediti: {balance}</span>
    </div>
  );
}
