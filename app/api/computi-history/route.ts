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
      .select("id, titolo, created_at, contenuto_testo")
      .eq("user_id", userId)
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

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id, titolo } = (await req.json()) as {
      id: string;
      titolo: string;
    };

    if (!id || !titolo?.trim()) {
      return NextResponse.json(
        { error: "ID e titolo sono obbligatori" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("computi_history")
      .update({ titolo: titolo.trim() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating titolo:", error);
      return NextResponse.json(
        { error: "Errore nell'aggiornamento del titolo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("computi-history PATCH error:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
