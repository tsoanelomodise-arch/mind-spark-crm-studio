import { GoogleGenAI } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  content: z.string().min(1).max(50_000),
  mode: z.enum(["polish", "custom"]),
  instruction: z.string().max(1000).optional(),
});

const BASE_SYSTEM = `You are an expert editor improving markdown content for a knowledge/CRM app.

Rules you must follow without exception:
- Return ONLY the improved markdown. No preamble, no explanations, no code fences wrapping the whole output.
- Preserve all markdown image tokens exactly as written: ![alt](url) — never alter, drop, or rewrite URLs (including data: URLs).
- Preserve all reference links exactly: [Title](url) — keep URL intact.
- Preserve heading levels, lists, code blocks, and overall structure unless the user's instruction explicitly says to restructure.
- Do not invent new facts. Do not add meta commentary like "Here is the improved version".`;

const POLISH_PROMPT = `Polish and clarify the content: fix grammar, spelling, punctuation; improve clarity, flow, and tone; tighten wording. Do not change meaning. Do not significantly change length.`;

export const improveContent = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ improved: string }> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured.");

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const instruction =
      data.mode === "polish"
        ? POLISH_PROMPT
        : data.instruction?.trim() || POLISH_PROMPT;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            text: `${BASE_SYSTEM}\n\nInstruction: ${instruction}\n\nContent to improve:\n${data.content}`,
          },
        ],
      });

      let improved = (response.text || "").trim();
      // Strip an accidental wrapping code fence if the model added one.
      const fence = improved.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/);
      if (fence) improved = fence[1];

      return { improved };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429/.test(msg)) throw new Error("Rate limit reached. Please try again shortly.");
      throw new Error(`AI request failed: ${msg}`);
    }
  });
