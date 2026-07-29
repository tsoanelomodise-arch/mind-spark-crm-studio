import { useState, useEffect } from "react";

export const DEFAULT_CREDENTIAL_SYSTEMS = [
  "AWS IAM",
  "Canva",
  "Facebook / Meta",
  "Figma",
  "Google Workspace",
  "Hubspot",
  "Instagram",
  "LinkedIn",
  "Mailchimp",
  "Shopify",
  "Stripe",
  "TikTok",
  "Vercel",
  "WordPress",
  "X / Twitter",
  "YouTube",
] as const;

const STORAGE_KEY = "mind_spark_custom_credential_systems";

export function getCredentialSystems(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_CREDENTIAL_SYSTEMS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom: string[] = raw ? JSON.parse(raw) : [];
    const combined = [...DEFAULT_CREDENTIAL_SYSTEMS] as string[];
    for (const item of custom) {
      if (item && !combined.some((c) => c.toLowerCase() === item.toLowerCase())) {
        combined.push(item);
      }
    }
    return combined.sort((a, b) => a.localeCompare(b));
  } catch {
    return [...DEFAULT_CREDENTIAL_SYSTEMS];
  }
}

export function saveCustomCredentialSystem(newSystem: string): string[] {
  const trimmed = newSystem.trim();
  if (!trimmed) return getCredentialSystems();

  const currentSystems = getCredentialSystems();
  const exists = currentSystems.some(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );

  if (!exists) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const custom: string[] = raw ? JSON.parse(raw) : [];
      custom.push(trimmed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
      window.dispatchEvent(new Event("credential_systems_updated"));
    } catch (e) {
      console.error(e);
    }
  }

  return getCredentialSystems();
}

export function useCredentialSystems(existingDbSystems?: string[]) {
  const [systems, setSystems] = useState<string[]>(() => {
    const base = getCredentialSystems();
    if (existingDbSystems && existingDbSystems.length) {
      const merged = [...base];
      for (const sys of existingDbSystems) {
        if (sys && !merged.some((m) => m.toLowerCase() === sys.toLowerCase())) {
          merged.push(sys);
        }
      }
      return merged.sort((a, b) => a.localeCompare(b));
    }
    return base;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const base = getCredentialSystems();
      if (existingDbSystems && existingDbSystems.length) {
        const merged = [...base];
        for (const sys of existingDbSystems) {
          if (sys && !merged.some((m) => m.toLowerCase() === sys.toLowerCase())) {
            merged.push(sys);
          }
        }
        setSystems(merged.sort((a, b) => a.localeCompare(b)));
      } else {
        setSystems(base);
      }
    };
    window.addEventListener("credential_systems_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("credential_systems_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [existingDbSystems]);

  const addSystem = (newSystem: string) => {
    const trimmed = newSystem.trim();
    if (!trimmed) return "";
    saveCustomCredentialSystem(trimmed);
    return trimmed;
  };

  return { systems, addSystem };
}
