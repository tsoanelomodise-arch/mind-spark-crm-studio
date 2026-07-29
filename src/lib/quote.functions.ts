import { GoogleGenAI, Type } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const serviceRateSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  category: z.string().optional(),
  hourlyRate: z.number(),
  description: z.string().optional(),
});

const inputSchema = z.object({
  projectName: z.string().optional(),
  projectType: z.string().optional(),
  scopeText: z.string().min(1, "Scope description is required").max(50_000),
  hourlyRate: z.number().min(1).max(100_000).default(750),
  currency: z.string().default("ZAR"),
  serviceRates: z.array(serviceRateSchema).optional(),
});

export interface QuoteBreakdownItem {
  deliverable: string;
  description: string;
  hours: number;
  serviceName?: string;
  serviceRate?: number;
  estimatedCost: number;
}

export interface ServiceSummaryBreakdown {
  serviceName: string;
  hours: number;
  rate: number;
  totalCost: number;
}

export interface ProjectQuoteResult {
  summary: string;
  complexity: "Low" | "Medium" | "High" | "Enterprise";
  hourlyRate: number;
  recommendedHours: number;
  minHours: number;
  maxHours: number;
  recommendedQuote: number;
  minQuote: number;
  maxQuote: number;
  currency: string;
  lineItems: QuoteBreakdownItem[];
  serviceBreakdown?: ServiceSummaryBreakdown[];
  assumptions: string[];
  risksAndNotes: string[];
  suggestedTimeline: string;
}

const BASE_SYSTEM = `You are a senior technical project manager and software estimator for an elite agency/consultancy.
Your task is to analyze a project scope description provided by the user and produce a realistic, professional, itemized price quote & effort estimate.

Guidelines:
- Carefully break down the requirements into clear deliverable line items with estimated hours.
- If a Service Rate Card is provided, assign the most appropriate Service Role from the rate card to each deliverable and use that service's specific hourly rate.
- Calculate realistic minimum, maximum, and recommended total hours and total cost quotes.
- Provide a clear summary explanation of the rationale, complexity tier, key assumptions, potential risks/caveats, and estimated timeline.
- Return output strictly adhering to the requested JSON structure.`;

export const generateProjectQuote = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ProjectQuoteResult> => {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.LOVABLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured.");

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const serviceCardText = data.serviceRates && data.serviceRates.length > 0
      ? `\n\nAgency Service Rate Card:\n` +
        data.serviceRates
          .map((s) => `- ${s.name} (${s.category || "General"}): ${data.currency} ${s.hourlyRate}/hr — ${s.description || ""}`)
          .join("\n")
      : "";

    const userPrompt = `Project Name: ${data.projectName || "Unnamed Project"}
Project Type/Category: ${data.projectType || "General Software/Agency Project"}
Base Default Hourly Rate: ${data.currency} ${data.hourlyRate}/hour${serviceCardText}

User Scope & Requirements Description:
"""
${data.scopeText}
"""

Please analyze the scope text and calculate a comprehensive price quote and effort estimation. Assign appropriate service roles from the rate card if available.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            text: `${BASE_SYSTEM}\n\n${userPrompt}`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "Executive summary of the quote and scope evaluation" },
              complexity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Enterprise"] },
              recommendedHours: { type: Type.NUMBER, description: "Recommended total hours" },
              minHours: { type: Type.NUMBER, description: "Optimistic/minimum total hours" },
              maxHours: { type: Type.NUMBER, description: "Conservative/maximum total hours" },
              suggestedTimeline: { type: Type.STRING, description: "Estimated completion timeline (e.g. 2-3 weeks)" },
              lineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    deliverable: { type: Type.STRING, description: "Name of milestone or deliverable" },
                    description: { type: Type.STRING, description: "Brief details of what is included" },
                    hours: { type: Type.NUMBER, description: "Hours estimated for this deliverable" },
                    serviceName: { type: Type.STRING, description: "Assigned service name from rate card" },
                    serviceRate: { type: Type.NUMBER, description: "Specific hourly rate for assigned service" },
                  },
                  required: ["deliverable", "description", "hours"],
                },
              },
              assumptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              risksAndNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "summary",
              "complexity",
              "recommendedHours",
              "minHours",
              "maxHours",
              "suggestedTimeline",
              "lineItems",
              "assumptions",
              "risksAndNotes",
            ],
          },
        },
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);

      const defaultRate = data.hourlyRate;
      const rateMap = new Map<string, number>();
      if (data.serviceRates) {
        data.serviceRates.forEach((s) => rateMap.set(s.name.toLowerCase().trim(), s.hourlyRate));
      }

      let computedTotalCost = 0;
      const serviceSummaryMap = new Map<string, { hours: number; rate: number; totalCost: number }>();

      const lineItems: QuoteBreakdownItem[] = (parsed.lineItems || []).map((item: any) => {
        const hrs = Math.max(1, Math.round(item.hours || 2));
        let sName = item.serviceName || "General Development";
        let sRate = item.serviceRate || defaultRate;

        // Verify if matched in rate map
        if (data.serviceRates && data.serviceRates.length > 0) {
          const matchedKey = Array.from(rateMap.keys()).find((k) => k.includes(sName.toLowerCase().trim()) || sName.toLowerCase().trim().includes(k));
          if (matchedKey) {
            sRate = rateMap.get(matchedKey)!;
          }
        }

        const cost = hrs * sRate;
        computedTotalCost += cost;

        // Group into service summary
        const existing = serviceSummaryMap.get(sName) || { hours: 0, rate: sRate, totalCost: 0 };
        existing.hours += hrs;
        existing.totalCost += cost;
        serviceSummaryMap.set(sName, existing);

        return {
          deliverable: item.deliverable || "Deliverable",
          description: item.description || "",
          hours: hrs,
          serviceName: sName,
          serviceRate: sRate,
          estimatedCost: cost,
        };
      });

      const totalHours = lineItems.reduce((acc, i) => acc + i.hours, 0);
      const recHours = Math.max(1, totalHours || Math.round(parsed.recommendedHours || 10));
      const minHours = Math.max(1, Math.round(parsed.minHours || Math.round(recHours * 0.8)));
      const maxHours = Math.max(recHours, Math.round(parsed.maxHours || Math.round(recHours * 1.3)));

      const finalQuote = computedTotalCost > 0 ? computedTotalCost : recHours * defaultRate;
      const effectiveBlendedRate = recHours > 0 ? Math.round(finalQuote / recHours) : defaultRate;

      const serviceBreakdown: ServiceSummaryBreakdown[] = Array.from(serviceSummaryMap.entries()).map(([name, val]) => ({
        serviceName: name,
        hours: val.hours,
        rate: val.rate,
        totalCost: val.totalCost,
      }));

      return {
        summary: parsed.summary || "Project scope analysis and quote estimation.",
        complexity: parsed.complexity || "Medium",
        hourlyRate: effectiveBlendedRate,
        recommendedHours: recHours,
        minHours,
        maxHours,
        recommendedQuote: finalQuote,
        minQuote: Math.round(finalQuote * 0.82),
        maxQuote: Math.round(finalQuote * 1.25),
        currency: data.currency,
        lineItems,
        serviceBreakdown,
        assumptions: parsed.assumptions || ["Client provides required branding assets and feedback promptly."],
        risksAndNotes: parsed.risksAndNotes || ["Scope changes during development may affect final timeline and cost."],
        suggestedTimeline: parsed.suggestedTimeline || "2-3 weeks",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429/.test(msg)) throw new Error("AI rate limit reached. Please try again in a moment.");
      throw new Error(`Quote generation failed: ${msg}`);
    }
  });

