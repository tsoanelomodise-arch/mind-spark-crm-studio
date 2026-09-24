import { GoogleGenAI, Type } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  location: z.string().default("Global"),
  industry: z.string().default("Local Services & Hospitality"),
  refresherFocus: z.string().optional(),
  manualWebsiteUrl: z.string().optional(),
  manualBusinessName: z.string().optional(),
  count: z.number().min(1).max(8).default(4),
});

export interface ResearchedBusiness {
  id: string;
  businessName: string;
  industry: string;
  location: string;
  websiteUrl: string;
  phone: string;
  email: string;
  currentIssues: string[];
  refresherUrgency: "Critical" | "High" | "Medium";
  opportunityScore: number; // 0-100
  estimatedValue: number; // in local currency / default rate
  pitchStrategy: string;
  proposedServices: string[];
}

export interface BusinessResearchResponse {
  areaAnalyzed: string;
  industryAnalyzed: string;
  summaryOverview: string;
  businesses: ResearchedBusiness[];
}

const SYSTEM_PROMPT = `You are an expert agency business development AI and web audit specialist.
Your goal is to research and identify local businesses in a specified location and industry that urgently need a website refresher, redesign, or digital upgrade.

For each business identified:
1. Provide realistic or real business names in that specific area/city.
2. Outline key web deficiencies (e.g., outdated 2010s design, poor mobile rendering, lack of HTTPS, missing online bookings, slow load speeds, unoptimized copy).
3. Assign a Refresher Urgency rating ('Critical', 'High', or 'Medium') and an Opportunity Lead Score (60 to 98).
4. Estimate a realistic web redesign contract value in ZAR / standard currency (e.g., 15000 to 45000).
5. Provide an actionable sales pitch strategy that an agency can use when contacting the business owner.

Return strictly valid JSON matching the specified schema.`;

export const researchWebsiteRefresherLeads = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<BusinessResearchResponse> => {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.LOVABLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const isManual = Boolean(data.manualWebsiteUrl && data.manualWebsiteUrl.trim().length > 0);
    const cleanManualUrl = data.manualWebsiteUrl ? data.manualWebsiteUrl.trim() : "";
    const cleanManualName = data.manualBusinessName ? data.manualBusinessName.trim() : "";

    const userPrompt = isManual
      ? `Perform an in-depth website refresher audit for the specific website URL: "${cleanManualUrl}"${cleanManualName ? ` belonging to business "${cleanManualName}"` : ""}.
Analyze its probable visual design era, mobile responsiveness issues, user experience bottlenecks, conversion gaps, and page speed or SEO deficiencies.
Location context: "${data.location || "Global"}". Industry: "${data.industry}".
${data.refresherFocus ? `Specific audit focus requested: ${data.refresherFocus}` : ""}
Return an audit entry specifically for this target website and business with actionable pitch points.`
      : `Research and audit ${data.count} businesses in the area of "${data.location}" within the "${data.industry}" industry that are prime candidates for a website refresher or overhaul.
${data.refresherFocus ? `Focus especially on: ${data.refresherFocus}` : ""}

Provide a list of candidate businesses with specific website flaws, audit scores, estimated project values, and strategic outreach advice.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            text: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              areaAnalyzed: { type: Type.STRING },
              industryAnalyzed: { type: Type.STRING },
              summaryOverview: { type: Type.STRING },
              businesses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    businessName: { type: Type.STRING },
                    industry: { type: Type.STRING },
                    location: { type: Type.STRING },
                    websiteUrl: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    email: { type: Type.STRING },
                    currentIssues: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    refresherUrgency: {
                      type: Type.STRING,
                      enum: ["Critical", "High", "Medium"],
                    },
                    opportunityScore: { type: Type.NUMBER },
                    estimatedValue: { type: Type.NUMBER },
                    pitchStrategy: { type: Type.STRING },
                    proposedServices: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    "businessName",
                    "industry",
                    "currentIssues",
                    "refresherUrgency",
                    "opportunityScore",
                    "estimatedValue",
                    "pitchStrategy",
                  ],
                },
              },
            },
            required: ["areaAnalyzed", "industryAnalyzed", "summaryOverview", "businesses"],
          },
        },
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);

      const businesses: ResearchedBusiness[] = (parsed.businesses || []).map(
        (b: Record<string, unknown>, idx: number) => {
          let businessName = typeof b.businessName === "string" ? b.businessName : "Local Business";
          if (isManual && cleanManualName) {
            businessName = cleanManualName;
          } else if (isManual && (!b.businessName || b.businessName === "Local Business")) {
            // infer business name from website domain if default
            const domainMatch = cleanManualUrl.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./i, "");
            const inferred = domainMatch.split(".")[0];
            if (inferred) {
              businessName = inferred.charAt(0).toUpperCase() + inferred.slice(1);
            }
          }

          const bIndustry = typeof b.industry === "string" ? b.industry : data.industry;
          const bLocation = typeof b.location === "string" ? b.location : data.location;
          const websiteUrl = isManual && cleanManualUrl ? cleanManualUrl : (typeof b.websiteUrl === "string" ? b.websiteUrl : `www.${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.za`);
          const phone = typeof b.phone === "string" ? b.phone : "+27 11 555 " + Math.floor(1000 + Math.random() * 9000);
          const email = typeof b.email === "string" ? b.email : `info@${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.za`;
          const currentIssues = Array.isArray(b.currentIssues) && b.currentIssues.length > 0
            ? (b.currentIssues.filter((i): i is string => typeof i === "string"))
            : ["Outdated visual design", "Poor mobile responsiveness", "Slow load speeds"];
          const urgencyStr = typeof b.refresherUrgency === "string" ? b.refresherUrgency : "High";
          const refresherUrgency: "Critical" | "High" | "Medium" = ["Critical", "High", "Medium"].includes(urgencyStr) ? (urgencyStr as "Critical" | "High" | "Medium") : "High";
          const numScore = typeof b.opportunityScore === "number" ? b.opportunityScore : 80;
          const opportunityScore = Math.min(100, Math.max(50, Math.round(numScore)));
          const numVal = typeof b.estimatedValue === "number" ? b.estimatedValue : 25000;
          const estimatedValue = Math.max(8000, Math.round(numVal));
          const pitchStrategy = typeof b.pitchStrategy === "string" ? b.pitchStrategy : "Highlight modern responsive design and conversion speed improvements.";
          const proposedServices = Array.isArray(b.proposedServices) && b.proposedServices.length > 0
            ? (b.proposedServices.filter((s): i is string => typeof s === "string"))
            : ["UI/UX Web Redesign", "Mobile Optimization", "SEO & Performance"];

          return {
            id: `scout-${Date.now()}-${idx}`,
            businessName,
            industry: bIndustry,
            location: bLocation,
            websiteUrl,
            phone,
            email,
            currentIssues,
            refresherUrgency,
            opportunityScore,
            estimatedValue,
            pitchStrategy,
            proposedServices,
          };
        },
      );

      return {
        areaAnalyzed: parsed.areaAnalyzed || data.location,
        industryAnalyzed: parsed.industryAnalyzed || data.industry,
        summaryOverview:
          parsed.summaryOverview ||
          `Market scan complete for ${data.location}. Identified ${businesses.length} high-value opportunities for website updates.`,
        businesses,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429/.test(msg)) throw new Error("AI rate limit exceeded. Please try again shortly.");
      throw new Error(`AI Lead Research failed: ${msg}`);
    }
  });

const pitchInputSchema = z.object({
  businessName: z.string(),
  industry: z.string(),
  location: z.string(),
  websiteUrl: z.string(),
  currentIssues: z.array(z.string()),
  proposedServices: z.array(z.string()),
  estimatedValue: z.number(),
  pitchStrategy: z.string(),
  tone: z
    .enum(["professional", "bold_conversion", "friendly_consultative"])
    .default("professional"),
});

export interface PitchResponse {
  pitchMarkdown: string;
  subjectLine: string;
}

export const generateOnePagePitch = createServerFn({ method: "POST" })
  .validator((data: unknown) => pitchInputSchema.parse(data))
  .handler(async ({ data }): Promise<PitchResponse> => {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.LOVABLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const toneDescriptions = {
      professional: "formal, authoritative, structured, enterprise-grade",
      bold_conversion: "direct, ROI-focused, urgent, outcome-driven",
      friendly_consultative: "warm, collaborative, helpful, client-centric",
    };

    const prompt = `Write a high-converting, concise 1-page Client Pitch Proposal in Markdown for a website redesign/refresher project.

Target Business: ${data.businessName}
Industry: ${data.industry}
Location: ${data.location}
Website URL: ${data.websiteUrl}
Current Audit Issues: ${data.currentIssues.join("; ")}
Proposed Services: ${data.proposedServices.join("; ")}
Estimated Value: ZAR ${data.estimatedValue.toLocaleString()}
Strategic Angle: ${data.pitchStrategy}
Tone: ${toneDescriptions[data.tone] || "professional"}

Instructions:
1. Format as a complete, single-page professional pitch in Markdown with clear sections:
   - # [Title / Headline]
   - ## Executive Summary
   - ## Website Audit & Deficiencies
   - ## Modernization Roadmap & Scope
   - ## Investment & Return on Value
   - ## Next Steps
2. Tailor every detail directly to ${data.businessName} in ${data.industry}.
3. Create a catchy email/proposal Subject Line.

Return strictly valid JSON with keys:
- "subjectLine": "string"
- "pitchMarkdown": "string"`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjectLine: { type: Type.STRING },
              pitchMarkdown: { type: Type.STRING },
            },
            required: ["subjectLine", "pitchMarkdown"],
          },
        },
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);

      return {
        subjectLine: parsed.subjectLine || `Website Modernization Proposal for ${data.businessName}`,
        pitchMarkdown:
          parsed.pitchMarkdown ||
          `# Website Refresher Proposal for ${data.businessName}\n\n${data.pitchStrategy}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429/.test(msg)) throw new Error("AI rate limit exceeded. Please try again shortly.");
      throw new Error(`Pitch generation failed: ${msg}`);
    }
  });

