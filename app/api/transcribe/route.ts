import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { data: creditRow, error: creditError } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (creditError) {
      console.error("Credits lookup error (transcribe):", creditError);
      return NextResponse.json(
        { error: "Impossibile verificare i crediti" },
        { status: 500 }
      );
    }

    const creditsBalance = Number(creditRow?.credits_balance ?? 0);
    if (creditsBalance <= 0) {
      return NextResponse.json(
        { error: "Crediti esauriti. Ricarica per trascrivere l'audio." },
        { status: 403 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nessun file audio ricevuto" },
        { status: 400 }
      );
    }
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "it",
      // Prompt riduce le allucinazioni: ancoraggio in italiano, contesto sopralluogo
      prompt:
        "Trascrizione di appunti vocali di un sopralluogo. L'utente parla in italiano descrivendo lavorazioni, misure e note. Niente sottotitoli o frasi fuori contesto.",
    });

    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .update({ credits_balance: creditsBalance - 1 })
      .eq("clerk_user_id", userId);

    if (updateError) {
      console.error("Credits debit error (transcribe):", updateError);
      return NextResponse.json(
        { error: "Trascrizione completata ma addebito crediti fallito" },
        { status: 500 }
      );
    }

    try {
      await supabaseAdmin.from("transcriptions").insert({
        user_id: userId,
        content: transcription.text,
      });
    } catch (saveErr) {
      console.error("Error saving transcription:", saveErr);
    }

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Errore Whisper:", error);
    return NextResponse.json(
      { error: "Errore durante la trascrizione" },
      { status: 500 }
    );
  }
}
