import { useState, useEffect } from "react";

export const DEFAULT_PROJECT_TYPES = [
  "AV",
  "Design",
  "Design Hours",
  "Electricity",
  "Fridge",
  "Gas Stove",
  "HARD",
  "Headingly_415",
  "Headingly_Store_room",
  "HOST",
  "MED",
  "Packwood_Room_1",
  "Referrals",
  "Solar",
  "Water",
  "WEB",
  "Web Security",
] as const;

export const PROJECT_TYPES = DEFAULT_PROJECT_TYPES;

export type ProjectType = string;

const STORAGE_KEY = "mind_spark_custom_project_types";

export function getProjectTypes(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_PROJECT_TYPES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom: string[] = raw ? JSON.parse(raw) : [];
    const combined = [...DEFAULT_PROJECT_TYPES] as string[];
    for (const item of custom) {
      if (item && !combined.includes(item)) {
        combined.push(item);
      }
    }
    return combined;
  } catch {
    return [...DEFAULT_PROJECT_TYPES];
  }
}

export function saveCustomProjectType(newType: string): string[] {
  const trimmed = newType.trim();
  if (!trimmed) return getProjectTypes();

  const currentTypes = getProjectTypes();
  const exists = currentTypes.some(
    (t) => t.toLowerCase() === trimmed.toLowerCase()
  );

  if (!exists) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const custom: string[] = raw ? JSON.parse(raw) : [];
      custom.push(trimmed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
      window.dispatchEvent(new Event("project_types_updated"));
    } catch (e) {
      console.error(e);
    }
  }

  return getProjectTypes();
}

export function useProjectTypes() {
  const [projectTypes, setProjectTypes] = useState<string[]>(getProjectTypes);

  useEffect(() => {
    const handleUpdate = () => {
      setProjectTypes(getProjectTypes());
    };
    window.addEventListener("project_types_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("project_types_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const addType = (newType: string) => {
    const updated = saveCustomProjectType(newType);
    setProjectTypes(updated);
    return newType.trim();
  };

  return { projectTypes, addType };
}

export const isProjectType = (v: string | null | undefined): boolean =>
  !!v && getProjectTypes().includes(v);

