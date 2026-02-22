import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Testo mancante" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Sei un esperto di computi metrici italiani e prezzari regionali.

Analizza il seguente testo di sopralluogo ed estrai tutte le lavorazioni e i materiali richiesti.
Per ognuno, fornisci 3-4 sinonimi tecnici e termini burocratici usati nei prezzari regionali italiani.

Esempi di espansione:
- persiane → oscuranti, avvolgibili, schermature solari
- tinteggiatura → pitturazione, verniciatura, imbiancatura
- scavo → sbancamento, sterro, movimento terra
- pavimento → pavimentazione, rivestimento a pavimento, massetto
- intonaco → rinzaffo, arriccio, stabilitura
- cartongesso → lastre in gesso rivestito, controsoffitto, controparete

Restituisci ESCLUSIVAMENTE un array JSON di stringhe con tutte le parole chiave originali e i sinonimi uniti in un unico array piatto. Nessun altro testo, nessuna spiegazione.

Esempio di output: ["persiane","oscuranti","avvolgibili","tinteggiatura","pitturazione","verniciatura"]

Testo del sopralluogo:
${text.substring(0, 3000)}`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode("__HEARTBEAT__\n"));

        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text().trim();

          let keywords: string[] = [];
          try {
            const cleaned = raw
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
              keywords = parsed
                .filter((k): k is string => typeof k === "string")
                .map((k) => k.toLowerCase().trim())
                .filter((k) => k.length >= 3);
            }
          } catch {
            console.error("[EXPAND-KEYWORDS] JSON parse error:", raw);
          }

          console.log(
            `[EXPAND-KEYWORDS] ${keywords.length} keyword espanse generate`
          );

          controller.enqueue(
            encoder.encode(JSON.stringify({ keywords }))
          );
        } catch (err) {
          console.error("Errore Gemini Flash:", err);
          controller.enqueue(
            encoder.encode(JSON.stringify({ keywords: [] }))
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
    console.error("Errore expand-keywords:", error);
    return new Response(
      JSON.stringify({ error: "Errore nell'espansione sinonimi" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
