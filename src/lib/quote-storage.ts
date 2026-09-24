import type { ProjectQuoteResult } from "./quote.functions";

export interface StoredQuoteRecord {
  projectId: string;
  scopeText: string;
  pdfFileName?: string;
  result: ProjectQuoteResult;
  originalResult?: ProjectQuoteResult;
  isCustomized: boolean;
  savedAt: string;
}

const STORAGE_PREFIX = "agency_quote_record_";

export function getSavedQuoteRecord(projectId: string): StoredQuoteRecord | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredQuoteRecord;
  } catch (err) {
    console.error("Failed to parse saved quote record:", err);
    return null;
  }
}

export function saveQuoteRecord(
  projectId: string,
  scopeText: string,
  result: ProjectQuoteResult,
  originalResult?: ProjectQuoteResult,
  isCustomized: boolean = false,
  pdfFileName?: string,
): StoredQuoteRecord | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const record: StoredQuoteRecord = {
      projectId,
      scopeText,
      pdfFileName,
      result,
      originalResult: originalResult || result,
      isCustomized,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(record));
    return record;
  } catch (err) {
    console.error("Failed to save quote record:", err);
    return null;
  }
}

export function clearQuoteRecord(projectId: string): void {
  if (typeof window === "undefined" || !projectId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
  } catch (err) {
    console.error("Failed to clear quote record:", err);
  }
}

export function hasSavedQuoteRecord(projectId: string): boolean {
  return !!getSavedQuoteRecord(projectId);
}
