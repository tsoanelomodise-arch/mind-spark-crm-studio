import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_CREDENTIAL_SYSTEMS = [
  "Adobe Creative Cloud",
  "Airtable",
  "Apple Developer",
  "Asana",
  "AWS IAM",
  "Bitbucket",
  "Bluehost",
  "Canva",
  "ClickUp",
  "Cloudflare",
  "cloud.co.za",
  "cPanel",
  "DigitalOcean",
  "Discord",
  "Dropbox",
  "Facebook / Meta",
  "Figma",
  "Firebase",
  "GitHub",
  "GitLab",
  "GoDaddy",
  "Google Analytics",
  "Google Cloud Platform",
  "Google Workspace",
  "Hostinger",
  "Hubspot",
  "Instagram",
  "Klaviyo",
  "LinkedIn",
  "Mailchimp",
  "Monday.com",
  "Namecheap",
  "Netlify",
  "Notion",
  "PayPal",
  "Pinterest",
  "Plesk",
  "Salesforce",
  "Shopify",
  "SiteGround",
  "Slack",
  "Squarespace",
  "Stripe",
  "Supabase",
  "TikTok",
  "Trello",
  "Vercel",
  "Webflow",
  "Wix",
  "WooCommerce",
  "WordPress",
  "WP Engine",
  "X / Twitter",
  "YouTube",
  "Zapier",
  "Zendesk",
  "Zoho",
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
    return combined.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
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
  const [dbSystems, setDbSystems] = useState<string[]>([]);

  const mergeSystems = useCallback((extra: string[] = []) => {
    const base = getCredentialSystems();
    const merged = [...base];
    const candidateLists = [existingDbSystems || [], dbSystems, extra];
    for (const list of candidateLists) {
      for (const sys of list) {
        if (sys && sys.trim()) {
          const trimmed = sys.trim();
          if (!merged.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
            merged.push(trimmed);
          }
        }
      }
    }
    return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [existingDbSystems, dbSystems]);

  const [systems, setSystems] = useState<string[]>(() => mergeSystems());

  // Automatically fetch any systems stored across credentials in the database
  useEffect(() => {
    let isMounted = true;
    async function loadSystemsFromDb() {
      try {
        const { data } = await supabase.from("credentials").select("system");
        if (data && isMounted) {
          const fetched = (data as { system: string | null }[])
            .map((r) => r.system?.trim())
            .filter((s): s is string => Boolean(s));
          const uniqueFetched = Array.from(new Set(fetched));
          setDbSystems(uniqueFetched);
        }
      } catch (e) {
        console.warn("Could not load systems from credentials:", e);
      }
    }

    loadSystemsFromDb();

    const handleSync = () => {
      loadSystemsFromDb();
    };

    window.addEventListener("supabase_storage_sync", handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener("supabase_storage_sync", handleSync);
    };
  }, []);

  useEffect(() => {
    setSystems(mergeSystems());
  }, [mergeSystems]);

  useEffect(() => {
    const handleUpdate = () => {
      setSystems(mergeSystems());
    };
    window.addEventListener("credential_systems_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("credential_systems_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [mergeSystems]);

  const addSystem = (newSystem: string) => {
    const trimmed = newSystem.trim();
    if (!trimmed) return "";
    saveCustomCredentialSystem(trimmed);
    return trimmed;
  };

  return { systems, addSystem };
}
