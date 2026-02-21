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

    const { data, error } = await supabaseAdmin
      .from("computi_history")
      .select("id, titolo, is_prezzario_mode, created_at, contenuto_json")
      .eq("clerk_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error fetching computi_history:", error);
      return NextResponse.json(
        { error: "Errore nel recupero della cronologia" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("computi-history GET error:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
