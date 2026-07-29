import { GoogleGenAI, Type } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z
    .string()
    .min(20)
    .refine((s) => s.startsWith("data:image/"), "Must be a data:image/* URL"),
});

const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["root", "branch", "leaf"]),
  parentId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

const ResultSchema = z.object({
  nodes: z.array(NodeSchema).min(1),
});

export type ExtractedMap = z.infer<typeof ResultSchema>;

const SYSTEM = `You analyze mind map diagrams, process charts, whiteboards, or handwritten notes and extract their node structure and color scheme as JSON.
Rules:
- Identify every visible node (idea, box, bubble, main concept) and every parent->child connection.
- Exactly one node has tone "root" (the main central topic). Its parentId must be null.
- Direct children of the root have tone "branch". All deeper sub-nodes have tone "leaf".
- Use short clean ids like "root", "n1", "n2", "n3"...
- "label" is the concise text visible in or beside the node.
- "color": Analyze the visual color scheme of the map image (fill colors, node background, border accents, ink colors, or branch-specific coloring). Provide a representative 6-digit hex color code string beginning with "#" (e.g., "#3B59FF", "#E74C3C", "#2ECC71", "#F39C12", "#9B59B6", "#E67E22", "#87A878", "#121212") for each node. If a branch or sub-tree uses a specific color scheme in the image, assign that color to all nodes within that branch. If a node is plain white, uncolored, or transparent background, set "color" to null.
- Preserve hierarchy via parentId. Do not invent nodes that aren't in the image.
Return JSON matching: { "nodes": [ { "id", "label", "tone", "parentId", "color" } ] }`;

export const extractMindMapFromImage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. Please ensure GEMINI_API_KEY is available.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const match = data.imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid image format. Expected a base64 data URL.");
    }

    const mimeType = match[1];
    const base64Data = match[2];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: "Extract the mind map structure from this image as JSON.",
          },
        ],
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    tone: {
                      type: Type.STRING,
                      enum: ["root", "branch", "leaf"],
                    },
                    parentId: { type: Type.STRING, nullable: true },
                    color: {
                      type: Type.STRING,
                      nullable: true,
                      description: "Extracted hex color code (e.g. #3B59FF) matching the node's visual color or branch color scheme in the image, or null if neutral.",
                    },
                  },
                  required: ["id", "label", "tone"],
                },
              },
            },
            required: ["nodes"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response received from AI model.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI returned invalid JSON structure.");
        parsed = JSON.parse(jsonMatch[0]);
      }

      return ResultSchema.parse(parsed);
    } catch (err: any) {
      console.error("Image mind map extraction error:", err);
      throw new Error(err?.message || "Failed to extract mind map from image.");
    }
  });
