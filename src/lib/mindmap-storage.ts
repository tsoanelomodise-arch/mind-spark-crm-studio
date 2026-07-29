// Client-side CRUD for mind maps stored in localStorage.

export type MindMapMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const INDEX_KEY = "mindweave.maps.index.v1";
const LEGACY_DATA_KEY = "mindweave.map.v1";

export const mapDataKey = (id: string) => `mindweave.map.${id}`;

const genId = () =>
  `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readIndex(): MindMapMeta[] {
  if (typeof window === "undefined") return [];
  return safeParse<MindMapMeta[]>(localStorage.getItem(INDEX_KEY), []);
}

function writeIndex(list: MindMapMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

function migrateLegacy() {
  if (typeof window === "undefined") return;
  const legacy = localStorage.getItem(LEGACY_DATA_KEY);
  if (!legacy) return;
  const list = readIndex();
  if (list.length > 0) {
    // Legacy already migrated (or explicitly ignored); remove to avoid re-run.
    localStorage.removeItem(LEGACY_DATA_KEY);
    return;
  }
  const now = new Date().toISOString();
  const id = genId();
  localStorage.setItem(mapDataKey(id), legacy);
  writeIndex([{ id, name: "My first map", createdAt: now, updatedAt: now }]);
  localStorage.removeItem(LEGACY_DATA_KEY);
}

export function listMaps(): MindMapMeta[] {
  migrateLegacy();
  return readIndex().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getMap(id: string): MindMapMeta | null {
  return readIndex().find((m) => m.id === id) ?? null;
}

export function createMap(name = "Untitled map"): MindMapMeta {
  const now = new Date().toISOString();
  const meta: MindMapMeta = {
    id: genId(),
    name: name.trim() || "Untitled map",
    createdAt: now,
    updatedAt: now,
  };
  writeIndex([meta, ...readIndex()]);
  return meta;
}

export function renameMap(id: string, name: string): MindMapMeta | null {
  const list = readIndex();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    name: name.trim() || "Untitled map",
    updatedAt: new Date().toISOString(),
  };
  writeIndex(list);
  return list[idx];
}

export function deleteMap(id: string) {
  writeIndex(readIndex().filter((m) => m.id !== id));
  localStorage.removeItem(mapDataKey(id));
}

export function duplicateMap(id: string): MindMapMeta | null {
  const src = getMap(id);
  if (!src) return null;
  const data = localStorage.getItem(mapDataKey(id));
  const copy = createMap(`${src.name} (copy)`);
  if (data) localStorage.setItem(mapDataKey(copy.id), data);
  return copy;
}

export function touchMap(id: string) {
  const list = readIndex();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], updatedAt: new Date().toISOString() };
  writeIndex(list);
}
