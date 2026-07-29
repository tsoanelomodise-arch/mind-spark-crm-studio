import { memo, useState, useEffect, useRef } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

export type NoteImage = {
  id: string;
  dataUrl: string;
  name?: string;
  width?: number;
  height?: number;
};

export type MindNodeData = {
  label: string;
  tone: "root" | "branch" | "leaf";
  color?: string | null;
  note?: string;
  images?: NoteImage[];
  linkedMapId?: string | null;
  linkedMapName?: string | null;
  collapsed?: boolean;
  hasChildren?: boolean;
  hiddenCount?: number;
  number?: string;
  width?: number;
  height?: number;
  onChange: (id: string, label: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetNote: (id: string, note: string) => void;
  onSetImages: (id: string, images: NoteImage[]) => void;
  onSetLinkedMap?: (id: string, mapId: string | null, mapName?: string | null) => void;
  onOpenLinkPicker?: (id: string) => void;
  onOpenLinkedMap?: (mapId: string) => void;
  onSelectSubtree?: (id: string) => void;
  onExtractSubtree?: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
};

export const NODE_COLORS: { name: string; value: string | null; swatch: string }[] = [
  { name: "Default", value: null, swatch: "transparent" },
  { name: "Ochre", value: "#e8b84a", swatch: "#e8b84a" },
  { name: "Clay", value: "#c4654a", swatch: "#c4654a" },
  { name: "Moss", value: "#87a878", swatch: "#87a878" },
  { name: "Sky", value: "#7dd3fc", swatch: "#7dd3fc" },
  { name: "Lavender", value: "#c9a0dc", swatch: "#c9a0dc" },
  { name: "Ink", value: "#2d2d2d", swatch: "#2d2d2d" },
];

// Perceived luminance → pick readable text color
const isDark = (hex: string) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;
};

const toneStyles: Record<MindNodeData["tone"], string> = {
  root: "bg-black text-white border-black shadow-md px-6 py-3.5 text-base font-bold tracking-tight rounded-2xl",
  branch:
    "bg-card text-foreground border-border shadow-2xs px-4 py-2.5 text-xs font-bold rounded-xl hover:border-black/40",
  leaf: "bg-secondary text-foreground border-border/80 shadow-none px-3.5 py-2 text-xs font-semibold rounded-lg hover:border-black/30",
};

const tonePadding: Record<MindNodeData["tone"], string> = {
  root: "px-6 py-4 text-lg font-serif font-bold",
  branch: "px-4 py-3 text-sm font-semibold",
  leaf: "px-3.5 py-2.5 text-sm",
};

function MindNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as MindNodeData;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(d.label);
  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(d.note ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [cropping, setCropping] = useState<string | null>(null);
  const [dragImgId, setDragImgId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const moveImage = (imgId: string, dir: -1 | 1) => {
    const arr = [...(d.images ?? [])];
    const i = arr.findIndex((x) => x.id === imgId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    d.onSetImages(id, arr);
  };

  const reorderImage = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const arr = [...(d.images ?? [])];
    const from = arr.findIndex((x) => x.id === sourceId);
    const to = arr.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    d.onSetImages(id, arr);
  };

  const applyCrop = async (
    imgId: string,
    src: string,
    rect: { x: number; y: number; w: number; h: number },
  ) => {
    const im = new Image();
    im.src = src;
    await new Promise<void>((resolve) => {
      im.onload = () => resolve();
      im.onerror = () => resolve();
    });
    const natW = im.naturalWidth || 1;
    const natH = im.naturalHeight || 1;
    const sx = Math.max(0, rect.x * natW);
    const sy = Math.max(0, rect.y * natH);
    const sw = Math.max(1, rect.w * natW);
    const sh = Math.max(1, rect.h * natH);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const next = (d.images ?? []).map((x) =>
      x.id === imgId
        ? { ...x, dataUrl, width: canvas.width, height: canvas.height }
        : x,
    );
    d.onSetImages(id, next);
  };


  const readImageFiles = async (files: File[]): Promise<NoteImage[]> => {
    const readOne = (file: File) =>
      new Promise<NoteImage | null>((resolve) => {
        if (!file.type.startsWith("image/")) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          if (!dataUrl.startsWith("data:image/")) {
            resolve(null);
            return;
          }
          const im = new Image();
          const makeId = () =>
            `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          im.onload = () =>
            resolve({
              id: makeId(),
              dataUrl,
              name: file.name,
              width: im.naturalWidth,
              height: im.naturalHeight,
            });
          im.onerror = () => resolve({ id: makeId(), dataUrl, name: file.name });
          im.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    const results = await Promise.all(files.map(readOne));
    return results.filter((r): r is NoteImage => !!r);
  };

  const addImageFiles = async (files: File[]) => {
    if (!files.length) return;
    const additions = await readImageFiles(files);
    if (!additions.length) return;
    d.onSetImages(id, [...(d.images ?? []), ...additions]);
  };

  const getClipboardImageFiles = (clipboardData: DataTransfer | null): File[] => {
    if (!clipboardData) return [];
    const fromItems = Array.from(clipboardData.items ?? [])
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((file): file is File => !!file);

    // Some browsers expose the same pasted image through both items and files.
    // Prefer items when present so one paste gesture creates one attachment.
    const candidates = fromItems.length
      ? fromItems
      : Array.from(clipboardData.files ?? []).filter((f) => f.type.startsWith("image/"));

    const seen = new Set<string>();
    return candidates.filter((file) => {
      const key = `${file.name}|${file.type}|${file.size}|${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };


  useEffect(() => setValue(d.label), [d.label]);
  useEffect(() => setNoteDraft(d.note ?? ""), [d.note]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  useEffect(() => {
    if (showNote) noteRef.current?.focus();
  }, [showNote]);
  useEffect(() => {
    if (!selected) setShowNote(false);
  }, [selected]);
  // Paste-to-attach is handled by scoped onPaste handlers on the note panel
  // and its textarea only. We intentionally do NOT listen at document level,
  // because that hijacks clipboard pastes elsewhere (e.g. Ctrl+V to duplicate
  // a node) and can attach unintended images from the system clipboard.


  const commitNote = () => {
    const next = noteDraft;
    if ((d.note ?? "") !== next) d.onSetNote(id, next);
  };

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== d.label) d.onChange(id, value.trim());
    else setValue(d.label);
  };

  const customColor = d.color ?? null;
  const useCustom = !!customColor;
  const customText = useCustom && isDark(customColor!) ? "#faf7f0" : "#2a2a2a";

  const handleBase =
    "!w-2.5 !h-2.5 !bg-black/40 !border !border-white hover:!bg-black transition-colors";

  const hasCustomSize = !!(d.width && d.height);

  // Auto font scaling based on content length so long text fits without manual resize.
  const labelLen = (d.label ?? "").length;
  const noteBadge = d.note && d.note.trim() ? 2 : 0;
  const numBadge = d.number ? d.number.length + 1 : 0;
  const effLen = labelLen + noteBadge + numBadge;
  let fontScale = 1;
  if (hasCustomSize) {
    const area = (d.width || 160) * (d.height || 60);
    const density = effLen / Math.max(area / 220, 1);
    if (density > 1.4) fontScale = 0.72;
    else if (density > 1.1) fontScale = 0.82;
    else if (density > 0.85) fontScale = 0.92;
  } else {
    if (effLen > 220) fontScale = 0.7;
    else if (effLen > 140) fontScale = 0.78;
    else if (effLen > 80) fontScale = 0.87;
    else if (effLen > 45) fontScale = 0.94;
  }

  return (
    <div
      className="group relative"
      style={hasCustomSize ? { width: d.width, height: d.height } : undefined}
    >
      {d.linkedMapId && !editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (d.linkedMapId && d.onOpenLinkedMap) {
              d.onOpenLinkedMap(d.linkedMapId);
            }
          }}
          className="absolute -top-3.5 -left-2 z-30 flex items-center gap-1 rounded-full bg-black text-white px-2.5 py-1 text-[10px] font-bold shadow-md border-2 border-white hover:bg-neutral-800 hover:scale-105 transition-all cursor-pointer group/linkbadge nodrag"
          title={`Jump to linked map "${d.linkedMapName || 'Map'}"`}
        >
          <span className="text-[11px] leading-none">🗺️</span>
          <span className="max-w-[100px] truncate leading-none">{d.linkedMapName || "Linked Map"}</span>
          <span className="text-[9px] leading-none group-hover/linkbadge:translate-x-0.5 transition-transform">&rarr;</span>
        </button>
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={90}
        minHeight={44}
        lineClassName="!border-black"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border !border-black rounded-sm"
        onResizeEnd={(_, params) => d.onResize?.(id, params.width, params.height)}
      />
      {/* Four-sided handles: source+target on each side so connections can be made from/to any side */}
      <Handle id="t-top" type="target" position={Position.Top} className={handleBase} />
      <Handle id="s-top" type="source" position={Position.Top} className={handleBase} />
      <Handle id="t-right" type="target" position={Position.Right} className={handleBase} />
      <Handle id="s-right" type="source" position={Position.Right} className={handleBase} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} className={handleBase} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} className={handleBase} />
      <Handle id="t-left" type="target" position={Position.Left} className={handleBase} />
      <Handle id="s-left" type="source" position={Position.Left} className={handleBase} />
      <div
        onDoubleClick={() => setEditing(true)}
        style={{
          ...(useCustom
            ? {
                backgroundColor: customColor!,
                color: customText,
                borderColor: isDark(customColor!) ? customColor! : "rgba(18,18,18,0.25)",
              }
            : {}),
          ...(hasCustomSize ? { width: "100%", height: "100%", maxWidth: "none" } : {}),
          fontSize: fontScale !== 1 ? `${fontScale}em` : undefined,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          hyphens: "auto",
        }}
        className={`rounded-xl border-[1.5px] ${hasCustomSize ? "overflow-auto" : effLen > 45 ? "max-w-[300px]" : "max-w-[220px]"} min-w-[80px] cursor-grab active:cursor-grabbing transition-all ${
          useCustom
            ? `${tonePadding[d.tone]} shadow-sm`
            : toneStyles[d.tone]
        } ${selected ? "ring-2 ring-black ring-offset-2 ring-offset-background" : d.linkedMapId ? "ring-2 ring-black/80 ring-offset-2 ring-offset-background shadow-xs !border-black" : ""}`}
      >
        {editing ? (
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setValue(d.label);
                setEditing(false);
              }
            }}
            rows={1}
            className="w-full bg-transparent outline-none resize-none text-inherit font-inherit"
          />
        ) : (
          <div className="whitespace-pre-wrap break-words leading-snug flex items-center gap-2">
            {d.number ? (
              <span
                className={`shrink-0 font-mono text-[10px] tracking-tight px-1.5 py-0.5 rounded ${
                  useCustom
                    ? isDark(customColor!)
                      ? "bg-white/20"
                      : "bg-black/10"
                    : d.tone === "root"
                      ? "bg-[var(--cream)]/20 text-[var(--cream)]"
                      : "bg-[var(--ink)]/10 text-[var(--ink)]/70"
                }`}
                title={`Node ${d.number}`}
              >
                {d.number}
              </span>
            ) : null}
            <span className="flex-1">{d.label}</span>
            {d.note && d.note.trim() ? (
              <span
                className={`shrink-0 text-[11px] leading-none ${
                  useCustom
                    ? isDark(customColor!)
                      ? "opacity-90"
                      : "opacity-70"
                    : d.tone === "root"
                      ? "text-[var(--cream)]/80"
                      : "text-[var(--ink)]/60"
                }`}
                title="Has a note"
                aria-label="Has a note"
              >
                💬
              </span>
            ) : null}
            {d.images && d.images.length ? (
              <span
                className={`shrink-0 text-[11px] leading-none ${
                  useCustom
                    ? isDark(customColor!)
                      ? "opacity-90"
                      : "opacity-70"
                    : d.tone === "root"
                      ? "text-[var(--cream)]/80"
                      : "text-[var(--ink)]/60"
                }`}
                title={`${d.images.length} image${d.images.length > 1 ? "s" : ""} attached`}
                aria-label="Has attached images"
              >
                🖼️
              </span>
            ) : null}
            {d.collapsed && d.hiddenCount ? (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  useCustom
                    ? isDark(customColor!)
                      ? "bg-white/20"
                      : "bg-black/10"
                    : d.tone === "root"
                      ? "bg-[var(--cream)]/20 text-[var(--cream)]"
                      : "bg-[var(--ink)]/10 text-[var(--ink)]"
                }`}
                title={`${d.hiddenCount} hidden`}
              >
                +{d.hiddenCount}
              </span>
            ) : null}
          </div>
        )}


      </div>
      

      {/* Collapse/expand toggle on the source side */}
      {d.hasChildren && !editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            d.onToggleCollapse?.(id);
          }}
          title={d.collapsed ? "Expand branch" : "Collapse branch"}
          className="absolute top-1/2 -translate-y-1/2 -right-3 w-5 h-5 rounded-full bg-[var(--ink)] text-[var(--cream)] text-[10px] font-bold shadow-md hover:scale-110 transition flex items-center justify-center leading-none"
        >
          {d.collapsed ? "+" : "−"}
        </button>
      )}

      {selected && !editing && (
        <>
          <div className="absolute -top-15 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/95 backdrop-blur-md px-2 py-1 shadow-md nodrag whitespace-nowrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                d.onAddChild?.(id);
              }}
              title="Add child (Tab)"
              className="w-7 h-7 rounded-full bg-black text-white text-sm font-bold shadow-2xs hover:bg-neutral-800 hover:scale-105 transition flex items-center justify-center cursor-pointer"
            >
              +
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNote((s) => !s);
              }}
              title={showNote ? "Hide note" : d.note || (d.images && d.images.length) ? "Edit note & images" : "Add note or images"}
              className={`w-7 h-7 rounded-full text-xs font-bold shadow-2xs hover:scale-105 transition flex items-center justify-center cursor-pointer ${
                (d.note && d.note.trim()) || (d.images && d.images.length)
                  ? "bg-black text-white"
                  : "bg-card text-foreground border border-border hover:bg-secondary"
              }`}
            >
              💬
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                d.onOpenLinkPicker?.(id);
              }}
              title={
                d.linkedMapId
                  ? `Linked to "${d.linkedMapName || "Map"}" (Click to manage)`
                  : "Link node to another map"
              }
              className={`w-7 h-7 rounded-full text-xs font-bold shadow-2xs hover:scale-105 transition flex items-center justify-center cursor-pointer ${
                d.linkedMapId
                  ? "bg-black text-white"
                  : "bg-card text-foreground border border-border hover:bg-secondary"
              }`}
            >
              🔗
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                d.onExtractSubtree?.(id);
              }}
              title="Generate new map from this node & branch subtree"
              className="w-7 h-7 rounded-full bg-black text-white text-xs font-bold shadow-2xs hover:bg-neutral-800 hover:scale-105 transition flex items-center justify-center cursor-pointer"
            >
              🌱
            </button>
            {d.tone !== "root" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  d.onDelete?.(id);
                }}
                title="Delete (Del)"
                className="w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow-2xs hover:bg-red-700 hover:scale-105 transition flex items-center justify-center cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Color swatches */}
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 translate-y-full flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-1.5 py-1 shadow-md nodrag"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {NODE_COLORS.map((c) => {
              const active = (customColor ?? null) === c.value;
              return (
                <button
                  key={c.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    d.onSetColor?.(id, c.value);
                  }}
                  title={c.name}
                  aria-label={`Set color: ${c.name}`}
                  className={`w-4 h-4 rounded-full border transition ${
                    active
                      ? "border-[var(--ink)] ring-2 ring-[var(--clay)]"
                      : "border-[var(--ink)]/40 hover:scale-110"
                  }`}
                  style={{
                    background:
                      c.value === null
                        ? "repeating-linear-gradient(45deg,#faf7f0 0 3px,#e8e0cf 3px 6px)"
                        : c.swatch,
                  }}
                />
              );
            })}
          </div>

          {/* Comment / note panel */}
          {showNote && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 top-full mt-10 w-64 rounded-xl border bg-[var(--card)] shadow-lg p-2 nodrag transition-colors ${
                dragOver
                  ? "border-[var(--moss)] ring-2 ring-[var(--moss)]/50 bg-[color-mix(in_oklab,var(--moss)_10%,var(--card))]"
                  : "border-[var(--border)]"
              }`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onDragEnter={(e) => {
                if (Array.from(e.dataTransfer.types).includes("Files")) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }
              }}
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.types).includes("Files")) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                  setDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDragOver(false);
              }}
              onDrop={(e) => {
                if (Array.from(e.dataTransfer.types).includes("Files")) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter((f) =>
                    f.type.startsWith("image/"),
                  );
                  if (files.length) void addImageFiles(files);
                }
              }}
              onPaste={(e) => {
                const files = getClipboardImageFiles(e.clipboardData);
                if (files.length) {
                  e.preventDefault();
                  e.stopPropagation();
                  void addImageFiles(files);
                }
              }}
            >
              <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Note {dragOver ? "· drop to attach" : ""}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    commitNote();
                    setShowNote(false);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--muted)]"
                  title="Hide note"
                >
                  Hide
                </button>
              </div>
              <textarea
                ref={noteRef}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={commitNote}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    commitNote();
                    setShowNote(false);
                  }
                }}
                placeholder="Add a comment for this node… (drop or paste images)"
                rows={4}
                className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--ink)]/40"
              />
              {/* Attached images */}
              {d.images && d.images.length ? (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {d.images.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/x-img-id", img.id);
                        setDragImgId(img.id);
                      }}
                      onDragOver={(e) => {
                        if (dragImgId) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(e) => {
                        const src =
                          e.dataTransfer.getData("text/x-img-id") || dragImgId;
                        if (src) {
                          e.preventDefault();
                          e.stopPropagation();
                          reorderImage(src, img.id);
                        }
                        setDragImgId(null);
                      }}
                      onDragEnd={() => setDragImgId(null)}
                      className={`relative group/thumb rounded-md overflow-hidden border bg-[var(--background)] cursor-grab active:cursor-grabbing ${
                        dragImgId === img.id
                          ? "opacity-50 border-[var(--moss)]"
                          : "border-[var(--border)]"
                      }`}
                      title="Drag to reorder"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name ?? "attachment"}
                        className="w-full h-16 object-cover pointer-events-none"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1 py-0.5 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveImage(img.id, -1);
                          }}
                          disabled={idx === 0}
                          title="Move left"
                          className="text-white text-[10px] leading-none disabled:opacity-30"
                        >
                          ◀
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCropping(img.id);
                          }}
                          title="Crop"
                          className="text-white text-[10px] leading-none"
                        >
                          ✂
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveImage(img.id, 1);
                          }}
                          disabled={idx === (d.images?.length ?? 0) - 1}
                          title="Move right"
                          className="text-white text-[10px] leading-none disabled:opacity-30"
                        >
                          ▶
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = (d.images ?? []).filter((x) => x.id !== img.id);
                          d.onSetImages(id, next);
                        }}
                        title="Remove image"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[var(--clay)] text-[var(--cream)] text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}


              <div className="flex items-center justify-between gap-2 pt-2">
                <label
                  className="cursor-pointer text-[10px] px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] transition"
                  title="Attach image or mockup (or drag & drop / paste)"
                >
                  📎 Add image
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.currentTarget.value = "";
                      await addImageFiles(files);
                    }}
                  />
                </label>

                {d.note && d.note.trim() ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteDraft("");
                      d.onSetNote(id, "");
                    }}
                    className="text-[10px] text-[var(--clay)] hover:underline"
                  >
                    Clear note
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {cropping ? (
            <CropOverlay
              image={(d.images ?? []).find((x) => x.id === cropping)!}
              onCancel={() => setCropping(null)}
              onApply={async (rect) => {
                const img = (d.images ?? []).find((x) => x.id === cropping);
                if (img) await applyCrop(img.id, img.dataUrl, rect);
                setCropping(null);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

type CropRect = { x: number; y: number; w: number; h: number };

function CropOverlay({
  image,
  onCancel,
  onApply,
}: {
  image: NoteImage;
  onCancel: () => void;
  onApply: (rect: CropRect) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [dragMode, setDragMode] = useState<"new" | "move" | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const startRef = useRef<{ x: number; y: number; rect: CropRect } | null>(null);

  const natW = image.width ?? 0;
  const natH = image.height ?? 0;
  const pxW = natW ? Math.round(rect.w * natW) : 0;
  const pxH = natH ? Math.round(rect.h * natH) : 0;

  const applyAspect = (ratio: number | null) => {
    setAspect(ratio);
    if (!ratio || !natW || !natH) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const normRatio = (ratio * natH) / natW;
    let w = rect.w;
    let h = w / normRatio;
    if (h > 1) { h = 1; w = h * normRatio; }
    if (w > 1) { w = 1; h = w / normRatio; }
    const x = Math.min(Math.max(0, cx - w / 2), 1 - w);
    const y = Math.min(Math.max(0, cy - h / 2), 1 - h);
    setRect({ x, y, w, h });
  };

  const setPixelSize = (newPxW: number, newPxH: number) => {
    if (!natW || !natH) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const w = Math.min(1, Math.max(0.01, newPxW / natW));
    const h = Math.min(1, Math.max(0.01, newPxH / natH));
    const x = Math.min(Math.max(0, cx - w / 2), 1 - w);
    const y = Math.min(Math.max(0, cy - h / 2), 1 - h);
    setRect({ x, y, w, h });
  };

  const pt = (e: React.MouseEvent) => {
    const el = boxRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const fitAspect = (raw: CropRect): CropRect => {
    if (!aspect || !natW || !natH) return raw;
    const normRatio = (aspect * natH) / natW;
    let w = raw.w;
    let h = w / normRatio;
    if (h > raw.h) { h = raw.h; w = h * normRatio; }
    return { x: raw.x, y: raw.y, w, h };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 nodrag"
      onClick={onCancel}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[var(--card)] rounded-xl p-3 shadow-2xl max-w-[90vw] max-h-[90vh] flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-[var(--ink)]/70">
          Drag on the image to select crop area
        </div>
        <div
          ref={boxRef}
          className="relative select-none"
          style={{ maxWidth: "70vw", maxHeight: "70vh" }}
          onMouseDown={(e) => {
            const p = pt(e);
            const inside =
              p.x >= rect.x &&
              p.x <= rect.x + rect.w &&
              p.y >= rect.y &&
              p.y <= rect.y + rect.h;
            if (inside) {
              setDragMode("move");
              startRef.current = { x: p.x, y: p.y, rect };
            } else {
              setDragMode("new");
              setRect({ x: p.x, y: p.y, w: 0, h: 0 });
              startRef.current = { x: p.x, y: p.y, rect };
            }
          }}
          onMouseMove={(e) => {
            if (!dragMode || !startRef.current) return;
            const p = pt(e);
            if (dragMode === "new") {
              const x = Math.min(startRef.current.x, p.x);
              const y = Math.min(startRef.current.y, p.y);
              const w = Math.abs(p.x - startRef.current.x);
              const h = Math.abs(p.y - startRef.current.y);
              setRect(fitAspect({ x, y, w, h }));
            } else {
              const dx = p.x - startRef.current.x;
              const dy = p.y - startRef.current.y;
              const s = startRef.current.rect;
              const nx = Math.min(Math.max(0, s.x + dx), 1 - s.w);
              const ny = Math.min(Math.max(0, s.y + dy), 1 - s.h);
              setRect({ ...s, x: nx, y: ny });
            }
          }}
          onMouseUp={() => {
            setDragMode(null);
            startRef.current = null;
          }}
          onMouseLeave={() => {
            setDragMode(null);
            startRef.current = null;
          }}
        >
          <img
            src={image.dataUrl}
            alt={image.name ?? "crop"}
            draggable={false}
            className="block max-w-[70vw] max-h-[70vh] pointer-events-none"
          />
          {rect.w > 0.01 && rect.h > 0.01 ? (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55) inset",
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${rect.y * 100}%, ${(rect.x) * 100}% ${rect.y * 100}%, ${(rect.x) * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${rect.y * 100}%, 0 ${rect.y * 100}%)`,
                }}
              />
              <div
                className="absolute border-2 border-[var(--cream)] pointer-events-none"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
                }}
              />
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1 pt-1 text-xs">
          <span className="text-[var(--ink)]/60 mr-1">Ratio:</span>
          {([
            ["Free", null],
            ["1:1", 1],
            ["4:3", 4 / 3],
            ["3:2", 3 / 2],
            ["16:9", 16 / 9],
            ["3:4", 3 / 4],
            ["9:16", 9 / 16],
          ] as [string, number | null][]).map(([label, r]) => (
            <button
              key={label}
              onClick={() => applyAspect(r)}
              className={`px-2 py-0.5 rounded border ${
                aspect === r
                  ? "bg-[var(--ink)] text-[var(--cream)] border-[var(--ink)]"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--ink)]/60">Size (px):</span>
          <label className="flex items-center gap-1">
            W
            <input
              type="number"
              min={1}
              max={natW || undefined}
              value={pxW}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 1;
                if (aspect && natW && natH) {
                  const normRatio = (aspect * natH) / natW;
                  const wN = v / natW;
                  setPixelSize(v, Math.round((wN / normRatio) * natH));
                } else {
                  setPixelSize(v, pxH);
                }
              }}
              className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1">
            H
            <input
              type="number"
              min={1}
              max={natH || undefined}
              value={pxH}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 1;
                if (aspect && natW && natH) {
                  const normRatio = (aspect * natH) / natW;
                  const hN = v / natH;
                  setPixelSize(Math.round(hN * normRatio * natW), v);
                } else {
                  setPixelSize(pxW, v);
                }
              }}
              className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-transparent"
            />
          </label>
          {natW && natH ? (
            <span className="text-[var(--ink)]/50">
              of {natW}×{natH}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)]"
          >
            Reset
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (rect.w > 0.01 && rect.h > 0.01) onApply(rect);
            }}
            className="text-xs px-3 py-1 rounded bg-[var(--ink)] text-[var(--cream)] hover:opacity-90"
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}


export const MindNode = memo(MindNodeComponent);
