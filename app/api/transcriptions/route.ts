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
      .from("transcriptions")
      .select("id, content, created_at, project_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching transcriptions:", error);
      return NextResponse.json(
        { error: "Errore nel recupero delle trascrizioni" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("transcriptions GET error:", error);
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

    const { id, project_name } = (await req.json()) as {
      id: string;
      project_name: string;
    };

    if (!id || project_name == null) {
      return NextResponse.json(
        { error: "ID e titolo sono obbligatori" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("transcriptions")
      .update({ project_name: String(project_name).trim() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating transcription:", error);
      return NextResponse.json(
        { error: "Errore nell'aggiornamento del titolo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("transcriptions PATCH error:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
