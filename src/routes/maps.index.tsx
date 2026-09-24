import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createMap,
  deleteMap,
  duplicateMap,
  listMaps,
  renameMap,
  type MindMapMeta,
} from "@/lib/mindmap-storage";
import {
  MindMapIcon,
  PlusIcon,
  BespokeBadge,
} from "@/components/ui/bespoke-icons";

export const Route = createFileRoute("/maps/")({
  head: () => ({
    meta: [
      { title: "Mindweave — your mind maps" },
      {
        name: "description",
        content:
          "Create, organize, and revisit your mind maps. A calm canvas for connecting ideas, structuring plans, and enhancing creativity.",
      },
      { property: "og:title", content: "Mindweave — your mind maps" },
      {
        property: "og:description",
        content:
          "Create, organize, and revisit your mind maps. A calm canvas for connecting ideas, structuring plans, and enhancing creativity.",
      },
    ],
  }),
  component: Dashboard,
});

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function Dashboard() {
  const [maps, setMaps] = useState<MindMapMeta[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingMap, setDeletingMap] = useState<{ id: string; name: string } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  const refresh = () => setMaps(listMaps());
  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const meta = createMap(newName || "Untitled map");
    setNewName("");
    navigate({ to: "/maps/$id", params: { id: meta.id } });
  };

  const confirmDelete = () => {
    if (!deletingMap) return;
    deleteMap(deletingMap.id);
    setDeletingMap(null);
    refresh();
  };

  const handleDuplicate = (id: string) => {
    duplicateMap(id);
    refresh();
  };

  const startRename = (m: MindMapMeta) => {
    setRenamingId(m.id);
    setDraftName(m.name);
  };

  const commitRename = (id: string) => {
    renameMap(id, draftName);
    setRenamingId(null);
    refresh();
  };

  return (
    <div className="flex min-h-screen w-screen flex-col overflow-x-hidden bg-background text-foreground">
      <main className="flex-1 px-6 md:px-10 py-10 max-w-[1400px] w-full mx-auto relative rounded-3xl my-4 sm:my-6 bg-gradient-to-br from-[#dbeafe] via-[#eef5ff] to-[#e2eeff] dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/60 border border-sky-200/60 shadow-sm backdrop-blur-sm">
        {/* Page Title Header matching Pipeline style */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
          <div>
            <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-[0.92] tracking-tighter text-foreground">
              Mind Maps.
            </h1>
            <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">
              Create, organize, and link concepts across interactive mind map canvases for strategic planning and clear execution.
            </p>
          </div>
        </div>

        {/* Create Map Form */}
        <div className="mb-8 p-6 md:p-8 rounded-2xl border border-sky-200/60 bg-gradient-to-r from-sky-100/80 via-slate-100/90 to-indigo-100/80 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-indigo-950/80 shadow-sm backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="flex flex-col sm:flex-row gap-3 items-stretch"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name your new mind map concept…"
              className="flex-1 border border-border/80 bg-white/80 dark:bg-black/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground transition"
            />
            <button
              type="submit"
              className="bg-black text-white hover:bg-neutral-800 px-6 py-3 rounded-xl text-xs uppercase tracking-[0.15em] font-bold transition-colors duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <PlusIcon size={14} />
              <span>Create Map</span>
            </button>
          </form>
        </div>

        {/* Maps Section */}
        <div className="flex items-center justify-between mb-6 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
              Saved Mind Maps ({maps.length})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline">Sorted by recent activity</span>
            <div className="flex items-center bg-secondary p-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "list"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List View"
              >
                <span className="text-sm leading-none">☰</span> List
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid View"
              >
                <span className="text-sm leading-none">⊞</span> Grid
              </button>
            </div>
          </div>
        </div>

        {maps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <h3 className="font-display text-2xl font-semibold text-foreground">
              No active mind maps.
            </h3>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Type a title above to start structuring your thoughts.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-secondary/50 border-b border-border text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
              <div className="col-span-5">Map Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Last Modified</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* List Rows */}
            <ul className="divide-y divide-border">
              {maps.map((m) => (
                <li
                  key={m.id}
                  className="group flex flex-col md:grid md:grid-cols-12 px-6 py-4 items-start md:items-center gap-3 hover:bg-secondary/40 transition-colors"
                >
                  {/* Name column */}
                  <div className="col-span-5 w-full pr-2">
                    {renamingId === m.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => commitRename(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(m.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded-lg border border-black bg-card px-2.5 py-1 text-base font-semibold text-foreground focus:outline-none"
                      />
                    ) : (
                      <Link
                        to="/maps/$id"
                        params={{ id: m.id }}
                        className="font-display text-lg font-semibold text-foreground hover:text-neutral-600 transition-colors flex items-center gap-3"
                      >
                        <BespokeBadge size="sm">
                          <MindMapIcon size={14} />
                        </BespokeBadge>
                        <span className="truncate">{m.name}</span>
                      </Link>
                    )}
                  </div>

                  {/* Type column */}
                  <div className="col-span-2 w-full flex items-center md:block">
                    <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-foreground bg-secondary px-3 py-1 rounded-full border border-border">
                      Concept Map
                    </span>
                  </div>

                  {/* Updated At column */}
                  <div className="col-span-2 w-full text-xs text-muted-foreground font-medium">
                    {formatDate(m.updatedAt)}
                  </div>

                  {/* Actions column */}
                  <div className="col-span-3 w-full flex items-center justify-start md:justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                    <Link
                      to="/maps/$id"
                      params={{ id: m.id }}
                      className="bg-black text-white hover:bg-neutral-800 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-bold transition-colors whitespace-nowrap shadow-2xs"
                    >
                      Open &rarr;
                    </Link>
                    <button
                      onClick={() => startRename(m)}
                      className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition cursor-pointer"
                      title="Rename Map"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDuplicate(m.id)}
                      className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition cursor-pointer"
                      title="Duplicate Map"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => setDeletingMap({ id: m.id, name: m.name })}
                      className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-destructive hover:bg-destructive/10 rounded-lg font-bold transition cursor-pointer"
                      title="Delete Map"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((m) => (
              <li
                key={m.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-black/30 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border">Concept Map</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(m.updatedAt)}</span>
                  </div>

                  {renamingId === m.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => commitRename(m.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(m.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full rounded-lg border border-black bg-background px-2 py-1 text-base font-semibold text-foreground focus:outline-none"
                    />
                  ) : (
                    <Link
                      to="/maps/$id"
                      params={{ id: m.id }}
                      className="font-display text-xl font-semibold text-foreground hover:text-neutral-600 transition-colors block mt-2"
                    >
                      {m.name}
                    </Link>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/maps/$id"
                    params={{ id: m.id }}
                    className="bg-black text-white hover:bg-neutral-800 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-bold transition-colors shadow-2xs"
                  >
                    Open Canvas &rarr;
                  </Link>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startRename(m)}
                      className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition cursor-pointer"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDuplicate(m.id)}
                      className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition cursor-pointer"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => setDeletingMap({ id: m.id, name: m.name })}
                      className="px-2 py-1 text-[10px] uppercase tracking-wider text-destructive hover:bg-destructive/10 rounded font-bold transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Delete Map Confirmation Modal */}
        {deletingMap && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setDeletingMap(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 text-foreground flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-destructive block mb-1">
                    Delete Mind Map
                  </span>
                  <h3 className="font-display text-xl font-bold leading-tight">
                    Delete "{deletingMap.name}"?
                  </h3>
                </div>
                <button
                  onClick={() => setDeletingMap(null)}
                  className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  ×
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                This mind map concept along with all its nodes, edges, color schemes, notes, and attachments will be permanently removed from your studio storage. This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => setDeletingMap(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-destructive text-white text-xs font-bold hover:bg-destructive/90 shadow-2xs transition cursor-pointer"
                >
                  Delete Map Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border px-6 py-6 bg-card flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Studio Status</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Canvas Online & Interactive
          </span>
        </div>
        <div className="font-display font-medium">Mind Spark Studio — Editorial Edition</div>
      </footer>
    </div>
  );
}
