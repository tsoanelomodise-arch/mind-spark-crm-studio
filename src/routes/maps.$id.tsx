import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MindMap } from "@/components/mindmap/MindMap";
import { getMap, renameMap, deleteMap, type MindMapMeta } from "@/lib/mindmap-storage";

export const Route = createFileRoute("/maps/$id")({
  head: () => ({
    meta: [
      { title: "Mindweave — editor" },
      { name: "description", content: "Edit your mind map on the Mindweave canvas." },
    ],
  }),
  component: MapEditor,
});

function MapEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [meta, setMeta] = useState<MindMapMeta | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    const m = getMap(id);
    if (!m) {
      navigate({ to: "/" });
    } else {
      setMeta(m);
    }
  }, [id, navigate]);

  if (!mounted || !meta) return null;

  const commit = () => {
    const updated = renameMap(meta.id, draft);
    if (updated) setMeta(updated);
    setRenaming(false);
  };

  const handleConfirmDelete = () => {
    deleteMap(meta.id);
    setShowDeleteModal(false);
    navigate({ to: "/" });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card/90 backdrop-blur-md px-6 py-3.5 z-20 shadow-2xs">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 text-[10px] uppercase tracking-widest font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            &larr; Studio Maps
          </Link>
          <div className="h-4 w-[1px] bg-border hidden sm:block"></div>
          {renaming ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="rounded-xl border border-black bg-card px-3 py-1 text-base font-display font-bold text-foreground focus:outline-none shadow-2xs"
            />
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground shrink-0 hidden md:inline-block">Concept ·</span>
              <button
                onClick={() => {
                  setDraft(meta.name);
                  setRenaming(true);
                }}
                className="font-display text-xl md:text-2xl font-semibold tracking-tight text-foreground truncate hover:text-neutral-600 transition-colors cursor-pointer"
                title="Click to rename"
              >
                {meta.name}.
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[10px] uppercase tracking-widest font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            title="Delete this mind map"
          >
            <span>🗑️</span>
            <span>Delete Map</span>
          </button>
        </div>
      </header>
      <main className="flex-1 relative">
        <MindMap mapId={meta.id} />
      </main>

      {/* Delete Map Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 text-foreground flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-red-600 block mb-1">
                  Delete Active Mind Map
                </span>
                <h3 className="font-display text-xl font-bold leading-tight">
                  Delete "{meta.name}"?
                </h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are currently viewing this mind map. Deleting it will permanently remove all nodes, edges, color schemes, and attachments, and return you to the studio library.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-2xs transition cursor-pointer"
              >
                Delete Map Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
