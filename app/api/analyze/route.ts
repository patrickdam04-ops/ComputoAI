import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { text, isPrezzarioMode, prezzario } = await req.json();
    const creditCost = isPrezzarioMode ? 10 : 1;

    const { data: creditRow, error: creditError } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (creditError) {
      console.error("Credits lookup error:", creditError);
      return NextResponse.json(
        { error: "Impossibile verificare i crediti" },
        { status: 500 }
      );
    }

    const creditsBalance = Number(creditRow?.credits_balance ?? 0);
    if (creditsBalance < creditCost) {
      const msg = isPrezzarioMode
        ? "Crediti insufficienti. La modalità Bonus e Prezzari richiede 10 crediti. Ricarica per continuare."
        : "Crediti esauriti per generare il computo.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prezzarioStr = prezzario ?? "";
    if (isPrezzarioMode && prezzarioStr) {
      console.log(
        `[PAYLOAD GEMINI] Prezzario: ${prezzarioStr.length} caratteri (~${Math.round(prezzarioStr.length / 4)} token stimati)`
      );
    }

    let prompt = "";
    if (isPrezzarioMode) {
      prompt = `Sei un Computista Senior. Il tuo compito è estrarre TUTTE le lavorazioni dal testo, nessuna esclusa.

ESTRATTO LISTINO (formato: Codice - Descrizione - U.M. - Prezzo, una voce per riga):
${prezzarioStr}

REGOLE DI FERRO:
1. COMPLETEZZA: Estrai ogni singola lavorazione richiesta.
2. CODICI E DESCRIZIONI: Cerca la voce corrispondente (o sinonimo) nel listino. Copia ESATTAMENTE il codice ufficiale, la descrizione e l'U.M.
3. QUANTITÀ (ATTENZIONE MASSIMA): Calcola o estrai la quantità ESATTA dal testo dell'utente (es. se dice "120 metri quadri", scrivi 120. Se dice "4 metri per 3", fai la moltiplicazione e scrivi 12). NON inserire mai 1 di default se nel testo c'è una misura!
4. IL PREZZO (FORMATO ITALIANO): Il prezzo si trova solitamente alla fine della riga del listino. Spesso è scritto con la virgola (es. "15,50" o "€ 15,50"). Individualo e trasformalo in un numero decimale con il punto (es. 15.50). SOLO SE il prezzo è totalmente assente, scrivi "DA CERCARE".
5. CATEGORIA: Assegna una categoria logica (es. "Scavi", "Finiture").
6. DIVIETO DI SINTESI ASSOLUTO: È severamente vietato raggruppare lavorazioni diverse in una sola riga, riassumere o saltarne alcune per brevità. Il file JSON in uscita non ha limiti di lunghezza. Devi generare un oggetto separato per OGNI singola voce presente nel testo fornito dall'utente, anche se l'array finale dovesse contenere centinaia di elementi. Non fermarti MAI fino alla fine esatta del testo.

REGOLA FONDAMENTALE SULLA QUANTITÀ: È assolutamente vietato sintetizzare, riassumere o raggruppare le voci per fare prima. Devi analizzare il testo dall'inizio alla fine senza saltare nemmeno una riga. Devi estrarre e generare un oggetto JSON separato per OGNI SINGOLA lavorazione, fornitura o voce descritta nel testo originale del sopralluogo. Se il testo detta 50 lavorazioni diverse, il tuo array finale DEVE contenere 50 elementi esatti, uno per ciascuna. Presta la massima attenzione a non trascurare nulla.

Restituisci ESCLUSIVAMENTE un array JSON. Esempio di formato:
[{"codice": "...", "categoria": "...", "descrizione": "...", "um": "...", "quantita": 120.5, "prezzo_unitario": 15.50}]

Testo del sopralluogo: ${text}`;
    } else {
      prompt = `Sei un Geometra che prepara un preventivo privato (no gare d'appalto). 
  Estrai le lavorazioni dal testo e crea una tabella chiara e professionale.
  Per ogni voce estrai:
  1. "categoria": (es. Opere Murarie).
  2. "descrizione": (Linguaggio professionale ma comprensibile al cliente privato).
  3. "um": (Unità di misura).
  4. "quantita": (Estrapola il numero, di default 1).

  Restituisci ESCLUSIVAMENTE un array JSON in questo formato:
  [{"categoria": "...", "descrizione": "...", "um": "...", "quantita": 1}]

  Testo da analizzare: ${text}`;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode("__HEARTBEAT__\n")
        );

        try {
          const geminiStream = await model.generateContentStream(prompt);
          let fullText = "";

          for await (const chunk of geminiStream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullText += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
          }

          const { error: updateError } = await supabaseAdmin
            .from("user_credits")
            .update({ credits_balance: creditsBalance - creditCost })
            .eq("clerk_user_id", userId);

          if (updateError) {
            console.error("Credits debit error:", updateError);
          }

          try {
            const cleanJson = fullText
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            JSON.parse(cleanJson);
            const titolo =
              text.substring(0, 80).trim() +
              (text.length > 80 ? "..." : "");

            await supabaseAdmin.from("computi_history").insert({
              user_id: userId,
              titolo,
              contenuto_testo: cleanJson,
            });
          } catch (saveErr) {
            console.error("Error saving to computi_history:", saveErr);
          }
        } catch (err) {
          console.error("Errore Gemini:", err);
          controller.enqueue(
            encoder.encode(
              "\n\nSi è verificato un errore durante la generazione."
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Errore Analisi Gemini:", error);
    return NextResponse.json(
      { error: "Errore durante l'analisi con Gemini" },
      { status: 500 }
    );
  }
}
