export interface ServiceRateItem {
  id: string;
  name: string;
  category: string;
  hourlyRate: number;
  description: string;
  isDefault?: boolean;
}

export const DEFAULT_RATE_CARD: ServiceRateItem[] = [
  {
    id: "rate-eng",
    name: "Senior Software Engineering",
    category: "Engineering",
    hourlyRate: 950,
    description: "Full-stack development, API design, system integration, and database architecture.",
    isDefault: true,
  },
  {
    id: "rate-design",
    name: "UI/UX & Product Design",
    category: "Design",
    hourlyRate: 800,
    description: "User research, wireframing, interactive prototyping, and design systems.",
    isDefault: false,
  },
  {
    id: "rate-devops",
    name: "DevOps & Cloud Infrastructure",
    category: "Infrastructure",
    hourlyRate: 1050,
    description: "CI/CD pipelines, Docker/K8s setup, cloud deployment, and security hardening.",
    isDefault: false,
  },
  {
    id: "rate-ai",
    name: "AI & Data Engineering",
    category: "AI & Analytics",
    hourlyRate: 1200,
    description: "LLM integration, prompt engineering, vector search, RAG, and data pipelines.",
    isDefault: false,
  },
  {
    id: "rate-pm",
    name: "Project Management & Strategy",
    category: "Management",
    hourlyRate: 700,
    description: "Sprint planning, stakeholder communications, risk mitigation, and deliverables tracking.",
    isDefault: false,
  },
  {
    id: "rate-qa",
    name: "QA & Quality Engineering",
    category: "Quality Assurance",
    hourlyRate: 550,
    description: "Automated testing, end-to-end user flows, regression tests, and security audits.",
    isDefault: false,
  },
];

const STORAGE_KEY = "agency_rate_card_v2";

export function getStoredRateCard(): ServiceRateItem[] {
  if (typeof window === "undefined") return DEFAULT_RATE_CARD;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RATE_CARD));
      return DEFAULT_RATE_CARD;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_RATE_CARD;
  } catch {
    return DEFAULT_RATE_CARD;
  }
}

export function saveStoredRateCard(items: ServiceRateItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("rate-card-updated"));
  } catch (err) {
    console.error("Failed to save rate card", err);
  }
}

export function resetRateCardToDefaults(): ServiceRateItem[] {
  saveStoredRateCard(DEFAULT_RATE_CARD);
  return DEFAULT_RATE_CARD;
}

export function calculateBlendedRate(items: ServiceRateItem[]): number {
  if (!items || items.length === 0) return 750;
  const total = items.reduce((acc, item) => acc + (Number(item.hourlyRate) || 0), 0);
  return Math.round(total / items.length);
}
