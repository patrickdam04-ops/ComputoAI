import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Credits fetch error:", error);
      return NextResponse.json(
        { error: "Errore nel recupero crediti" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      credits_balance: Number(row?.credits_balance ?? 0),
    });
  } catch (error) {
    console.error("credits GET error:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
