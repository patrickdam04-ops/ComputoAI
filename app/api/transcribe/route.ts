import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Errore Whisper:", error);
    return NextResponse.json(
      { error: "Errore durante la trascrizione" },
      { status: 500 }
    );
  }
}
