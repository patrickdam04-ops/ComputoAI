import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { text, isPrezzarioMode, prezzario } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    let prompt = "";
    if (isPrezzarioMode) {
      prompt = `Sei un Computista Senior. Il tuo compito è estrarre TUTTE le lavorazioni dal testo, nessuna esclusa.

ESTRATTO LISTINO:
${prezzario ?? "[]"}

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text();
    textResponse = textResponse
      .replace(/\`\`\`json/g, "")
      .replace(/\`\`\`/g, "")
      .trim();
    return NextResponse.json(JSON.parse(textResponse));
  } catch (error) {
    console.error("Errore Analisi Gemini:", error);
    return NextResponse.json(
      { error: "Errore durante l'analisi con Gemini" },
      { status: 500 }
    );
  }
}
