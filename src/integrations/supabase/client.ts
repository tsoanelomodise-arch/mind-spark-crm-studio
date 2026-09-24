import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db as firestoreDb, handleFirestoreError, OperationType } from "@/lib/firebase";

// Default seed data for local fallback when Supabase credentials are not provided
const INITIAL_MOCK_DB: Record<string, any[]> = {
  prompts: [],
  clients: [],
  projects: [],
  credentials: [],
  credential_secrets: {},
  wiki_spaces: [],
  wiki_pages: [],
  team_members: [],
  team_directory: [],
  project_credentials: [],
  recurring_projects: [],
  contacts: [],
  client_notes: [],
  client_conversations: [],
  project_stages: [],
  project_tasks: [],
  project_milestones: [],
  user_roles: [
    { user_id: "user-1", role: "admin" }
  ],
  system_changelog: []
};

let memoryMockCache: Record<string, any[]> | null = null;
let isFirestoreInitialized = false;
const FIRESTORE_STATE_PATH = "app_state/crm_db";

const DEMO_IDS = new Set([
  "prompt-1", "prompt-2", "prompt-3", "prompt-4", "prompt-5", "prompt-6",
  "client-1", "client-2", "proj-1", "proj-2", "proj-3", "proj-4", "proj-5",
  "proj-rec-1", "proj-rec-2", "cred-1", "cred-2", "cred-3", "space-1", "space-2",
  "page-1", "team-1", "dir-1", "task-101", "task-102", "task-103", "task-201",
  "task-202", "task-203", "task-301", "task-302", "task-303", "task-401", "task-402", "rec-1"
]);

const DEMO_NAMES = new Set([
  "Mindweave Labs", "Apex Design Co", "Mind Spark Studio Integration",
  "Prompt Taxonomy Engine", "AI Knowledge Graph Search", "Omnichannel Automated Workflow",
  "Monthly Architecture & Mind Map Review", "Weekly Security & Key Vault Audit",
  "Mind Map Concept Expansion", "Process Flow Spec Generator", "System Refactoring Assistant",
  "Client Onboarding Discovery Brief", "AI Project Quote & Scope Estimator",
  "Weekly CRM & Pipeline Summarizer", "Studio Architecture", "Prompt Playbooks",
  "System Architecture & Process Flow", "Studio Architect", "Studio Lead"
]);

function purgeDemoData(db: Record<string, any>): boolean {
  let changed = false;
  for (const key of Object.keys(db)) {
    if (Array.isArray(db[key])) {
      const origLen = db[key].length;
      db[key] = db[key].filter((item: any) => {
        if (!item || typeof item !== "object") return true;
        if (item.id && DEMO_IDS.has(item.id)) return false;
        if (item.name && DEMO_NAMES.has(item.name)) return false;
        if (item.title && DEMO_NAMES.has(item.title)) return false;
        if (item.label && DEMO_NAMES.has(item.label)) return false;
        if (item.client_id && DEMO_IDS.has(item.client_id)) return false;
        if (item.project_id && DEMO_IDS.has(item.project_id)) return false;
        return true;
      });
      if (db[key].length !== origLen) changed = true;
    } else if (key === "credential_secrets" && typeof db[key] === "object" && db[key] !== null) {
      for (const credId of ["cred-1", "cred-2", "cred-3"]) {
        if (credId in db[key]) {
          delete db[key][credId];
          changed = true;
        }
      }
    }
  }
  return changed;
}

let hasReceivedFirstSnapshot = false;
let firstSnapshotResolver: (() => void) | null = null;
const firstSnapshotPromise = new Promise<void>((resolve) => {
  firstSnapshotResolver = resolve;
});

function notifyFirstSnapshotReceived() {
  hasReceivedFirstSnapshot = true;
  if (firstSnapshotResolver) {
    firstSnapshotResolver();
    firstSnapshotResolver = null;
  }
}

function initFirestoreSync() {
  if (isFirestoreInitialized || typeof window === "undefined") return;
  isFirestoreInitialized = true;

  try {
    const docRef = doc(firestoreDb, "app_state", "crm_db");
    onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.payload) {
            try {
              const parsed = JSON.parse(data.payload);
              const changed = purgeDemoData(parsed);
              memoryMockCache = parsed;
              if (changed) {
                saveMockStorage(parsed);
              } else if (typeof localStorage !== "undefined") {
                localStorage.setItem("mind_spark_studio_mock_db", data.payload);
              }
              notifyFirstSnapshotReceived();
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("supabase_storage_sync", { detail: { type: "firestore_sync", parsed } }));
              }
            } catch (e) {
              console.error("Failed to parse Firestore state payload:", e);
              notifyFirstSnapshotReceived();
            }
          } else {
            notifyFirstSnapshotReceived();
          }
        } else {
          // First boot on cloud project: Seed Firestore document with current state
          const current = memoryMockCache || INITIAL_MOCK_DB;
          purgeDemoData(current);
          const payloadStr = JSON.stringify(current);
          setDoc(docRef, {
            payload: payloadStr,
            updated_at: new Date().toISOString(),
          }).catch((err) => {
            console.warn("Firestore sync write fallback to local storage:", err?.message || err);
          });
          notifyFirstSnapshotReceived();
        }
      },
      (error) => {
        console.warn("Firestore sync notification:", error);
        notifyFirstSnapshotReceived();
      }
    );
  } catch (err) {
    console.error("Error setting up Firestore sync listener:", err);
    notifyFirstSnapshotReceived();
  }
}

function getMockStorage(): Record<string, any[]> {
  initFirestoreSync();
  if (memoryMockCache) {
    if (purgeDemoData(memoryMockCache)) {
      saveMockStorage(memoryMockCache);
    }
    return memoryMockCache;
  }
  if (typeof localStorage === "undefined") return INITIAL_MOCK_DB;
  const raw = localStorage.getItem("mind_spark_studio_mock_db");
  if (!raw) {
    localStorage.setItem("mind_spark_studio_mock_db", JSON.stringify(INITIAL_MOCK_DB));
    memoryMockCache = JSON.parse(JSON.stringify(INITIAL_MOCK_DB));
    return memoryMockCache!;
  }
  try {
    const parsed = JSON.parse(raw);
    let updated = purgeDemoData(parsed);

    // Ensure missing table keys that do not exist at all in parsed are initialized
    for (const key of Object.keys(INITIAL_MOCK_DB)) {
      if (parsed[key] === undefined) {
        if (Array.isArray(INITIAL_MOCK_DB[key])) {
          parsed[key] = [...INITIAL_MOCK_DB[key]];
        } else if (typeof INITIAL_MOCK_DB[key] === "object" && INITIAL_MOCK_DB[key] !== null) {
          parsed[key] = { ...INITIAL_MOCK_DB[key] };
        }
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem("mind_spark_studio_mock_db", JSON.stringify(parsed));
    }

    memoryMockCache = parsed;
    return memoryMockCache!;
  } catch {
    memoryMockCache = JSON.parse(JSON.stringify(INITIAL_MOCK_DB));
    return memoryMockCache!;
  }
}

let firestoreSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function saveMockStorage(db: Record<string, any[]>) {
  memoryMockCache = db;
  const payloadStr = JSON.stringify(db);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("mind_spark_studio_mock_db", payloadStr);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("supabase_storage_sync", { detail: { type: "local_mutation" } }));
  }

  // Persist asynchronously to Firestore with a debounce to prevent network congestion on rapid edits/drags
  if (typeof window !== "undefined") {
    if (firestoreSaveTimeout) clearTimeout(firestoreSaveTimeout);
    firestoreSaveTimeout = setTimeout(() => {
      const docRef = doc(firestoreDb, "app_state", "crm_db");
      setDoc(docRef, {
        payload: payloadStr,
        updated_at: new Date().toISOString(),
      }).catch((err) => {
        console.warn("Firestore save fallback to local storage:", err?.message || err);
      });
    }, 300);
  }
}

// Chainable builder for local storage mock query proxy
function createMockQuery(tableName: string) {
  let filterFn = (row: any) => true;
  let sortFn: ((a: any, b: any) => number) | null = null;
  let isSingle = false;
  let isMaybeSingle = false;
  let pendingMutation: { type: "insert" | "upsert" | "update" | "delete"; data?: any } | null = null;

  const getTable = () => {
    const db = getMockStorage();
    return db[tableName] || [];
  };

  const builder: any = {
    select: (fields?: string) => builder,
    order: (field: string, { ascending = true }: { ascending?: boolean } = {}) => {
      const prevSort = sortFn;
      sortFn = (a: any, b: any) => {
        const valA = a[field] ?? "";
        const valB = b[field] ?? "";
        const res =
          typeof valA === "string" && typeof valB === "string"
            ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" })
            : valA > valB
            ? 1
            : valA < valB
            ? -1
            : 0;
        return ascending ? res : -res;
      };
      return builder;
    },
    eq: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] === value;
      return builder;
    },
    neq: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => {
        if (!prev(row)) return false;
        const val = row[field];
        if (value === "none" && (val === undefined || val === null || val === "none")) return false;
        return val !== value;
      };
      return builder;
    },
    gte: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] >= value;
      return builder;
    },
    gt: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] > value;
      return builder;
    },
    lte: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] <= value;
      return builder;
    },
    lt: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] < value;
      return builder;
    },
    in: (field: string, values: any[]) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && Array.isArray(values) && values.includes(row[field]);
      return builder;
    },
    ilike: (field: string, pattern: string) => {
      const prev = filterFn;
      const cleanPattern = pattern.replace(/%/g, "").toLowerCase();
      filterFn = (row: any) => prev(row) && String(row[field] || "").toLowerCase().includes(cleanPattern);
      return builder;
    },
    or: (condition: string) => {
      const prev = filterFn;
      const parts = condition.split(",").map((p) => p.trim());
      filterFn = (row: any) => {
        if (!prev(row)) return false;
        return parts.some((part) => {
          if (part.includes(".ilike.")) {
            const [field, val] = part.split(".ilike.");
            const cleanPattern = (val || "").replace(/%/g, "").toLowerCase();
            return String(row[field] || "").toLowerCase().includes(cleanPattern);
          }
          if (part.includes(".eq.")) {
            const [field, val] = part.split(".eq.");
            return String(row[field] ?? "") === val;
          }
          if (part.includes(".neq.")) {
            const [field, val] = part.split(".neq.");
            return String(row[field] ?? "") !== val;
          }
          return true;
        });
      };
      return builder;
    },
    is: (field: string, val: any) => {
      const prev = filterFn;
      filterFn = (row: any) =>
        prev(row) &&
        (val === null ? row[field] === null || row[field] === undefined : row[field] === val);
      return builder;
    },
    limit: (n: number) => builder,
    single: () => {
      isSingle = true;
      return builder;
    },
    maybeSingle: () => {
      isMaybeSingle = true;
      return builder;
    },
    insert: (data: any | any[]) => {
      pendingMutation = { type: "insert", data };
      return builder;
    },
    upsert: (data: any | any[]) => {
      pendingMutation = { type: "upsert", data };
      return builder;
    },
    update: (data: any) => {
      pendingMutation = { type: "update", data };
      return builder;
    },
    delete: () => {
      pendingMutation = { type: "delete" };
      return builder;
    },
    then: async (resolve: Function, reject: Function) => {
      try {
        initFirestoreSync();
        if (!hasReceivedFirstSnapshot && typeof window !== "undefined") {
          await Promise.race([
            firstSnapshotPromise,
            new Promise((r) => setTimeout(r, 350)),
          ]);
        }
        const db = getMockStorage();
        const list = db[tableName] || [];

        if (pendingMutation?.type === "insert") {
          const data = pendingMutation.data;
          const newItems = Array.isArray(data) ? data : [data];
          const inserted = newItems.map((item) => ({
            id: item.id || `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          }));
          db[tableName] = [...list, ...inserted];
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (inserted[0] || null)
            : (Array.isArray(data) ? inserted : inserted[0]);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "upsert") {
          const data = pendingMutation.data;
          const items = Array.isArray(data) ? data : [data];
          const updatedList = [...list];
          const resItems: any[] = [];

          for (const item of items) {
            const id = item.id || `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const idx = updatedList.findIndex((r) => r.id === id);
            const merged = {
              id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...item,
            };
            if (idx >= 0) {
              updatedList[idx] = { ...updatedList[idx], ...merged };
              resItems.push(updatedList[idx]);
            } else {
              updatedList.push(merged);
              resItems.push(merged);
            }
          }
          db[tableName] = updatedList;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (resItems[0] || null)
            : (Array.isArray(data) ? resItems : resItems[0]);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "update") {
          const data = pendingMutation.data;
          const updatedRows: any[] = [];
          const updatedList = list.map((row) => {
            if (filterFn(row)) {
              const updated = { ...row, ...data, updated_at: new Date().toISOString() };
              updatedRows.push(updated);
              return updated;
            }
            return row;
          });
          db[tableName] = updatedList;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (updatedRows[0] || null)
            : (updatedRows.length === 1 ? updatedRows[0] : updatedRows);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "delete") {
          const deletedRows = list.filter(filterFn);
          const remaining = list.filter((row) => !filterFn(row));
          db[tableName] = remaining;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (deletedRows[0] || null)
            : deletedRows;

          resolve({ data: resultData, error: null });
          return;
        }

        let rows = getTable().filter(filterFn);
        if (tableName === "credentials") {
          const clientsList = db.clients || [];
          rows = rows.map((r: any) => {
            if (!r.clients && r.client_id) {
              const cl = clientsList.find((c: any) => c.id === r.client_id);
              return { ...r, clients: cl ? { id: cl.id, name: cl.name } : null };
            }
            return r;
          });
        }
        if (sortFn) {
          rows = rows.sort(sortFn);
        }
        if (isSingle || isMaybeSingle) {
          const singleItem = rows[0] || null;
          resolve({ data: singleItem, error: null });
        } else {
          resolve({ data: rows, error: null });
        }
      } catch (err) {
        resolve({ data: null, error: err });
      }
    },
  };

  return builder;
}

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_URL.includes("MY_SUPABASE")
  ) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: typeof window !== "undefined" ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  // Local storage mock proxy fallback when Supabase is not configured
  return {
    from: (table: string) => createMockQuery(table),
    rpc: async (fnName: string, args?: any) => {
      if (fnName === "has_role") return { data: true, error: null };
      if (fnName === "credential_set_secret") {
        const db = getMockStorage();
        db.credential_secrets = db.credential_secrets || {};
        if (args?._id) {
          const secretValue = args._plain ?? "";
          db.credential_secrets[args._id] = secretValue;
          if (Array.isArray(db.credentials)) {
            const idx = db.credentials.findIndex((c: any) => c.id === args._id);
            if (idx >= 0) {
              db.credentials[idx].last_rotated_at = new Date().toISOString();
              db.credentials[idx]._secret_plain = secretValue;
            }
          }
          saveMockStorage(db);
        }
        return { data: true, error: null };
      }
      if (fnName === "credential_reveal") {
        const db = getMockStorage();
        const secrets = db.credential_secrets || {};
        const credId = args?._id;

        if (credId && secrets[credId] && typeof secrets[credId] === "string" && secrets[credId].trim() !== "") {
          return { data: secrets[credId], error: null };
        }

        if (credId) {
          const creds = db.credentials || [];
          const found = creds.find((c: any) => c.id === credId);
          if (found && typeof found._secret_plain === "string" && found._secret_plain.trim() !== "") {
            secrets[credId] = found._secret_plain;
            db.credential_secrets = secrets;
            saveMockStorage(db);
            return { data: found._secret_plain, error: null };
          }
          const cleanLabel = found?.label ? found.label.replace(/[^a-zA-Z0-9]/g, "") : "Vault";
          const fallbackSecret = `P@ss_${cleanLabel || "Vault"}_2026!`;
          secrets[credId] = fallbackSecret;
          db.credential_secrets = secrets;
          saveMockStorage(db);
          return { data: fallbackSecret, error: null };
        }

        return { data: "P@ss_Vault_2026!", error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            email: "architect@mindspark.studio",
            user_metadata: { full_name: "Studio Engineer" },
          },
        },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: "user-1",
              email: "architect@mindspark.studio",
            },
          },
        },
        error: null,
      }),
      onAuthStateChange: (cb: Function) => {
        cb("SIGNED_IN", {
          user: { id: "user-1", email: "architect@mindspark.studio" },
        });
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "mock-image.png" }, error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
        }),
      }),
    },
  } as any;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
