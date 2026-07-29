import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  SelectionMode,
  getNodesBounds,
  reconnectEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { MindNode, type MindNodeData } from "./MindNode";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { extractMindMapFromImage } from "@/lib/mindmap-ai.functions";
import { mapDataKey, touchMap, getMap, listMaps, createMap, deleteMap } from "@/lib/mindmap-storage";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

const initialNodes: Node[] = [
  {
    id: "root",
    type: "mind",
    position: { x: 0, y: 0 },
    data: { label: "A new idea", tone: "root" } as any,
  },
  {
    id: "b1",
    type: "mind",
    position: { x: 280, y: -140 },
    data: { label: "Structure", tone: "branch" } as any,
  },
  {
    id: "b2",
    type: "mind",
    position: { x: 280, y: 0 },
    data: { label: "Inspiration", tone: "branch" } as any,
  },
  {
    id: "b3",
    type: "mind",
    position: { x: 280, y: 140 },
    data: { label: "Action", tone: "branch" } as any,
  },
  {
    id: "l1",
    type: "mind",
    position: { x: 540, y: -180 },
    data: { label: "Outline the parts", tone: "leaf" } as any,
  },
  {
    id: "l2",
    type: "mind",
    position: { x: 540, y: -80 },
    data: { label: "Find the through-line", tone: "leaf" } as any,
  },
  {
    id: "l3",
    type: "mind",
    position: { x: 540, y: 20 },
    data: { label: "Collect references", tone: "leaf" } as any,
  },
  {
    id: "l4",
    type: "mind",
    position: { x: 540, y: 140 },
    data: { label: "First small step", tone: "leaf" } as any,
  },
  {
    id: "l5",
    type: "mind",
    position: { x: 540, y: 240 },
    data: { label: "Deadline", tone: "leaf" } as any,
  },
];

const initialEdges: Edge[] = [
  { id: "e-root-b1", source: "root", target: "b1" },
  { id: "e-root-b2", source: "root", target: "b2" },
  { id: "e-root-b3", source: "root", target: "b3" },
  { id: "e-b1-l1", source: "b1", target: "l1" },
  { id: "e-b1-l2", source: "b1", target: "l2" },
  { id: "e-b2-l3", source: "b2", target: "l3" },
  { id: "e-b3-l4", source: "b3", target: "l4" },
  { id: "e-b3-l5", source: "b3", target: "l5" },
];

const nodeTypes = { mind: MindNode };

type ViewMode = "mindmap" | "flowchart";

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);


function InnerMap({ mapId }: { mapId: string }) {
  const STORAGE_KEY = mapDataKey(mapId);
  const loaded = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes)) {
        const seenN = new Set<string>();
        const cleanNodes: Node[] = parsed.nodes.filter((n: any) => {
          if (!n || !n.id || seenN.has(n.id)) return false;
          seenN.add(n.id);
          return true;
        });
        const seenE = new Set<string>();
        const cleanEdges: Edge[] = (Array.isArray(parsed.edges) ? parsed.edges : []).filter((e: any) => {
          if (!e || !e.id || seenE.has(e.id)) return false;
          seenE.add(e.id);
          return true;
        });
        return {
          nodes: cleanNodes,
          edges: cleanEdges,
          viewMode: parsed.viewMode as ViewMode | undefined,
          mindmapSnapshot: parsed.mindmapSnapshot as { nodes: Node[]; edges: Edge[] } | null | undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [STORAGE_KEY]);

  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(loaded?.nodes ?? initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(loaded?.edges ?? initialEdges);
  const [viewMode, setViewMode] = useState<ViewMode>(loaded?.viewMode ?? "mindmap");
  const [mindmapSnapshot, setMindmapSnapshot] = useState<
    { nodes: Node[]; edges: Edge[] } | null
  >(loaded?.mindmapSnapshot ?? null);
  const [selectedId, setSelectedId] = useState<string | null>("root");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [canvasDragMode, setCanvasDragMode] = useState<"select" | "pan">("select");
  const [linkingNodeId, setLinkingNodeId] = useState<string | null>(null);
  const [mapSearch, setMapSearch] = useState("");
  const [newMapName, setNewMapName] = useState("");
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractMapTitle, setExtractMapTitle] = useState("");
  const [linkExtractToParent, setLinkExtractToParent] = useState(true);
  const idCounter = useRef(1000);

  // Compute outgoing map links from current nodes
  const outgoingLinkedMaps = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    const allMaps = listMaps();
    const mapNameLookup = new Map(allMaps.map((m) => [m.id, m.name]));
    for (const n of nodes) {
      const d = n.data as any;
      if (d.linkedMapId) {
        const currentName = mapNameLookup.get(d.linkedMapId) || d.linkedMapName || "Linked Map";
        const existing = map.get(d.linkedMapId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(d.linkedMapId, {
            id: d.linkedMapId,
            name: currentName,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [nodes]);

  // Compute incoming maps linking to this map
  const incomingLinkedMaps = useMemo(() => {
    if (!mapId) return [];
    const allMaps = listMaps();
    const results: { id: string; name: string; nodeLabel: string }[] = [];
    for (const m of allMaps) {
      if (m.id === mapId) continue;
      const raw = localStorage.getItem(mapDataKey(m.id));
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.nodes && Array.isArray(parsed.nodes)) {
            const linkingNode = parsed.nodes.find((n: any) => n.data?.linkedMapId === mapId);
            if (linkingNode) {
              results.push({
                id: m.id,
                name: m.name,
                nodeLabel: linkingNode.data?.label || "Node",
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }
    return results;
  }, [mapId, nodes]);

  // Global Cmd/Ctrl+K shortcut listener to toggle map switcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowQuickSwitcher((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep idCounter above all existing numeric node IDs
  useEffect(() => {
    let max = 1000;
    for (const n of nodes) {
      const match = /\d+/.exec(n.id);
      if (match) {
        const val = parseInt(match[0], 10);
        if (val > max) max = val;
      }
    }
    if (idCounter.current <= max) {
      idCounter.current = max;
    }
  }, [nodes]);

  const nextId = useCallback(() => {
    while (true) {
      idCounter.current += 1;
      const candidate = `n${idCounter.current}`;
      if (!nodes.some((n) => n.id === candidate)) {
        return candidate;
      }
    }
  }, [nodes]);

  const updateLabel = useCallback(
    (id: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
      );
    },
    [setNodes],
  );

  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of edges) {
      const arr = m.get(e.source) ?? [];
      arr.push(e.target);
      m.set(e.source, arr);
    }
    return m;
  }, [edges]);

  const collectDescendants = useCallback(
    (rootIds: string[]): Set<string> => {
      const out = new Set<string>();
      const stack = [...rootIds];
      while (stack.length) {
        const id = stack.pop()!;
        const kids = childrenMap.get(id) ?? [];
        for (const k of kids) {
          if (!out.has(k)) {
            out.add(k);
            stack.push(k);
          }
        }
      }
      return out;
    },
    [childrenMap],
  );

  const setNodeLinkedMap = useCallback(
    (id: string, linkedMapId: string | null, linkedMapName?: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  linkedMapId,
                  linkedMapName: linkedMapName || null,
                },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const setNodeColor = useCallback(
    (id: string, color: string | null) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)),
      );
    },
    [setNodes],
  );

  const setNodeNote = useCallback(
    (id: string, note: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, note } } : n)),
      );
    },
    [setNodes],
  );

  const setNodeImages = useCallback(
    (id: string, images: import("./MindNode").NoteImage[]) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, images } } : n)),
      );
    },
    [setNodes],
  );

  const setNodeSize = useCallback(
    (id: string, width: number, height: number) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, width, height }, width, height, style: { ...(n.style ?? {}), width, height } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, collapsed: !(n.data as any).collapsed } } : n,
        ),
      );
    },
    [setNodes],
  );

  const expandAll = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ((n.data as any).collapsed ? { ...n, data: { ...n.data, collapsed: false } } : n)),
    );
  }, [setNodes]);

  const collapseAll = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const hasKids = (childrenMap.get(n.id) ?? []).length > 0;
        return hasKids && n.id !== "root" && !(n.data as any).collapsed
          ? { ...n, data: { ...n.data, collapsed: true } }
          : n;
      }),
    );
  }, [setNodes, childrenMap]);

  const deleteNode = useCallback(
    (id: string) => {
      if (id === "root") return;
      const toRemove = collectDescendants([id]);
      toRemove.add(id);
      setNodes((nds) => nds.filter((n) => !toRemove.has(n.id)));
      setEdges((eds) => eds.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
    },
    [setNodes, setEdges, collectDescendants],
  );

  const deleteMany = useCallback(
    (ids: string[]) => {
      const roots = ids.filter((id) => id !== "root");
      if (roots.length === 0) return;
      const toRemove = collectDescendants(roots);
      roots.forEach((r) => toRemove.add(r));
      setNodes((nds) => nds.filter((n) => !toRemove.has(n.id)));
      setEdges((eds) => eds.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
      setSelectedIds([]);
      setSelectedEdgeIds([]);
      setSelectedId("root");
    },
    [setNodes, setEdges, collectDescendants],
  );

  const deleteSelected = useCallback(() => {
    const nodeRoots = selectedIds.filter((id) => id !== "root");
    const toRemoveNodes = collectDescendants(nodeRoots);
    nodeRoots.forEach((r) => toRemoveNodes.add(r));
    const toRemoveEdges = new Set(selectedEdgeIds);

    if (toRemoveNodes.size === 0 && toRemoveEdges.size === 0) return;

    setNodes((nds) => nds.filter((n) => !toRemoveNodes.has(n.id)));
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !toRemoveNodes.has(e.source) &&
          !toRemoveNodes.has(e.target) &&
          !toRemoveEdges.has(e.id),
      ),
    );
    setSelectedIds([]);
    setSelectedEdgeIds([]);
    setSelectedId("root");
  }, [selectedIds, selectedEdgeIds, collectDescendants, setNodes, setEdges]);

  // Global Delete / Backspace shortcut to delete selected nodes & lines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        if (selectedIds.length > 0 || selectedEdgeIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, selectedEdgeIds, deleteSelected]);

  const selectSubtree = useCallback(
    (rootId: string) => {
      const descendants = collectDescendants([rootId]);
      descendants.add(rootId);
      const arr = Array.from(descendants);
      setSelectedIds(arr);
      setSelectedId(rootId);
    },
    [collectDescendants],
  );

  const openExtractModalForSelection = useCallback(
    (defaultRootId?: string) => {
      let activeIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      if (defaultRootId && !activeIds.includes(defaultRootId)) {
        const descendants = collectDescendants([defaultRootId]);
        descendants.add(defaultRootId);
        activeIds = Array.from(descendants);
        setSelectedIds(activeIds);
        setSelectedId(defaultRootId);
      }

      if (activeIds.length === 0) {
        alert("Please select one or more nodes first using Shift+Click, dragging a selection box, or clicking 'Select Branch'.");
        return;
      }

      // Propose map title based on primary selected node
      const primaryId = defaultRootId || (selectedId && activeIds.includes(selectedId) ? selectedId : activeIds[0]);
      const primaryNode = nodes.find((n) => n.id === primaryId);
      const rawLabel = (primaryNode?.data as any)?.label?.trim() || "Concept";
      const proposedTitle = `${rawLabel} Sub-Map`;

      setExtractMapTitle(proposedTitle);
      setLinkExtractToParent(true);
      setShowExtractModal(true);
    },
    [selectedIds, selectedId, collectDescendants, nodes],
  );

  const performExtractToNewMap = useCallback(
    (openNewMapImmediately: boolean) => {
      const activeIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      if (activeIds.length === 0) return;

      const selectedNodeSet = new Set(activeIds);
      const selectedNodesList = nodes.filter((n) => selectedNodeSet.has(n.id));
      if (selectedNodesList.length === 0) return;

      const selectedEdgesList = edges.filter(
        (e) => selectedNodeSet.has(e.source) && selectedNodeSet.has(e.target),
      );

      // Find top candidate root in selection (no incoming edge inside selection)
      const incomingTargetsInSelection = new Set(selectedEdgesList.map((e) => e.target));
      const candidateRoots = selectedNodesList.filter((n) => !incomingTargetsInSelection.has(n.id));

      let primaryRootId = candidateRoots.length > 0 ? candidateRoots[0].id : selectedNodesList[0].id;
      if (selectedId && selectedNodeSet.has(selectedId)) {
        primaryRootId = selectedId;
      }

      const idMap = new Map<string, string>();
      idMap.set(primaryRootId, "root");

      let counter = 1001;
      for (const n of selectedNodesList) {
        if (n.id !== primaryRootId) {
          idMap.set(n.id, `n${counter++}`);
        }
      }

      const rootOrigPos = selectedNodesList.find((n) => n.id === primaryRootId)?.position || { x: 0, y: 0 };

      const newNodes: Node[] = selectedNodesList.map((n) => {
        const newId = idMap.get(n.id)!;
        const isRoot = newId === "root";
        const origData = { ...(n.data as any) };

        const tone: MindNodeData["tone"] = isRoot ? "root" : origData.tone === "root" ? "branch" : origData.tone || "leaf";

        return {
          id: newId,
          type: "mind",
          position: isRoot
            ? { x: 0, y: 0 }
            : { x: n.position.x - rootOrigPos.x, y: n.position.y - rootOrigPos.y },
          width: n.width,
          height: n.height,
          style: n.style,
          data: {
            label: origData.label || "Untitled",
            tone,
            collapsed: false,
            color: origData.color ?? null,
            note: origData.note ?? "",
            images: Array.isArray(origData.images) ? origData.images : [],
            linkedMapId: isRoot ? null : origData.linkedMapId ?? null,
            linkedMapName: isRoot ? null : origData.linkedMapName ?? null,
            width: origData.width,
            height: origData.height,
          } as any,
        };
      });

      const newEdges: Edge[] = selectedEdgesList.map((e) => {
        const newSource = idMap.get(e.source)!;
        const newTarget = idMap.get(e.target)!;
        return {
          ...e,
          id: `e-${newSource}-${newTarget}`,
          source: newSource,
          target: newTarget,
        };
      });

      const finalName = extractMapTitle.trim() || "Extracted Concept Map";
      const newMapMeta = createMap(finalName);
      localStorage.setItem(
        mapDataKey(newMapMeta.id),
        JSON.stringify({
          nodes: newNodes,
          edges: newEdges,
          viewMode: "mindmap",
          updatedAt: new Date().toISOString(),
        }),
      );

      // Link node on current canvas if option is active
      if (linkExtractToParent && primaryRootId) {
        setNodeLinkedMap(primaryRootId, newMapMeta.id, newMapMeta.name);
      }

      setShowExtractModal(false);

      if (openNewMapImmediately) {
        navigate({ to: "/maps/$id", params: { id: newMapMeta.id } });
      }
    },
    [selectedIds, selectedId, nodes, edges, extractMapTitle, linkExtractToParent, setNodeLinkedMap, navigate],
  );

  const addChild = useCallback(
    (parentId: string) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const parentTone = (parent.data as any).tone as MindNodeData["tone"];
      const childTone: MindNodeData["tone"] = parentTone === "root" ? "branch" : "leaf";
      const siblings = edges.filter((e) => e.source === parentId).length;
      const id = nextId();
      const newNode: Node = {
        id,
        type: "mind",
        position: {
          x: parent.position.x + 260,
          y: parent.position.y + (siblings - 1) * 90,
        },
        data: { label: "New idea", tone: childTone } as any,
      };
      setNodes((nds) => [
        ...nds.map((n) =>
          n.id === parentId && (n.data as any).collapsed
            ? { ...n, data: { ...n.data, collapsed: false } }
            : n,
        ),
        newNode,
      ]);
      setEdges((eds) => [...eds, { id: `e-${parentId}-${id}`, source: parentId, target: id }]);
      setSelectedId(id);
    },
    [nodes, edges, setNodes, setEdges],
  );

  // Append a "next step" at the end of the flowchart chain.
  const addNextStep = useCallback(() => {
    const hasIncoming = new Set(edges.map((e) => e.target));
    const hasOutgoing = new Set(edges.map((e) => e.source));
    // Prefer chaining from the selected node when it's the current tail; otherwise from the last node without outgoing edges.
    const tail =
      selectedId && !hasOutgoing.has(selectedId)
        ? nodes.find((n) => n.id === selectedId)
        : nodes.find((n) => !hasOutgoing.has(n.id) && hasIncoming.has(n.id)) ??
          nodes[nodes.length - 1];
    if (!tail) return;
    const id = nextId();
    const newNode: Node = {
      id,
      type: "mind",
      position: { x: tail.position.x, y: tail.position.y + 130 },
      data: { label: "Next step", tone: "branch" } as any,
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds,
      {
        id: `e-${tail.id}-${id}`,
        source: tail.id,
        sourceHandle: "s-bottom",
        target: id,
        targetHandle: "t-top",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
    setSelectedId(id);
  }, [nodes, edges, selectedId, setNodes, setEdges]);

  // Arrange the map as a chronological flowchart, ordered by hierarchical
  // node numbers (1, 1.1, 1.1.1, 1.2, 2, …). Nodes wrap into rows (serpentine)
  // and are connected with arrowed smoothstep edges for a clean flow.
  const arrangeAsFlowchart = useCallback(() => {
    // Snapshot the current mind-map layout so we can restore it when the user
    // switches back (only if currently in mindmap mode so we don't overwrite with flowchart state).
    if (viewMode === "mindmap") {
      setMindmapSnapshot({
        nodes: nodes.map((n) => ({
          ...n,
          position: { ...n.position },
          data: { ...(n.data as any) },
        })),
        edges: edges.map((e) => ({ ...e })),
      });
    }
    const hasIncoming = new Set(edges.map((e) => e.target));
    const rootIds = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
    const childMap = new Map<string, string[]>();
    for (const e of edges) {
      const arr = childMap.get(e.source) ?? [];
      arr.push(e.target);
      childMap.set(e.source, arr);
    }
    const numbering = new Map<string, number[]>();
    const seenNum = new Set<string>();
    const numberWalk = (id: string, prefix: number[]) => {
      if (seenNum.has(id)) return;
      seenNum.add(id);
      numbering.set(id, prefix);
      (childMap.get(id) ?? []).forEach((kid, i) =>
        numberWalk(kid, [...prefix, i + 1]),
      );
    };
    (rootIds.length ? rootIds : nodes.map((n) => n.id)).forEach((rid, i) =>
      numberWalk(rid, [i + 1]),
    );
    nodes.forEach((n, i) => {
      if (!numbering.has(n.id)) numbering.set(n.id, [9999 + i]);
    });

    // (Ordering is applied per-parent below when sorting children.)

    // Sort each parent's children by their hierarchical number so placement
    // reliably follows 1, 1.1, 1.1.1, 1.2, 2, … from left to right.
    const sortedChildMap = new Map<string, string[]>();
    for (const [pid, kids] of childMap) {
      const sortedKids = [...kids].sort((a, b) => {
        const na = numbering.get(a)!;
        const nb = numbering.get(b)!;
        const len = Math.max(na.length, nb.length);
        for (let i = 0; i < len; i++) {
          const av = na[i] ?? -1;
          const bv = nb[i] ?? -1;
          if (av !== bv) return av - bv;
        }
        return 0;
      });
      sortedChildMap.set(pid, sortedKids);
    }
    const sortedRoots = [...(rootIds.length ? rootIds : nodes.map((n) => n.id))].sort(
      (a, b) => (numbering.get(a)?.[0] ?? 0) - (numbering.get(b)?.[0] ?? 0),
    );

    // Top-down tree layout: recursively measure subtree widths in "leaf slots",
    // then place each node centered above its children.
    const HSPACING = 240; // horizontal distance between adjacent leaf slots
    const VSPACING = 140; // vertical distance between depth levels
    // (byId not needed — we map over the original nodes array below.)
    const placed = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();

    const measure = (id: string, seen: Set<string>): number => {
      if (seen.has(id)) return 1;
      seen.add(id);
      const kids = sortedChildMap.get(id) ?? [];
      if (kids.length === 0) return 1;
      return kids.reduce((sum, k) => sum + measure(k, seen), 0);
    };

    const place = (id: string, depth: number, xStart: number, seen: Set<string>) => {
      if (seen.has(id)) return;
      seen.add(id);
      const kids = sortedChildMap.get(id) ?? [];
      const width = kids.length === 0 ? 1 : kids.reduce((s, k) => s + measure(k, new Set()), 0);
      const centerX = (xStart + width / 2 - 0.5) * HSPACING;
      positions.set(id, { x: centerX, y: depth * VSPACING });
      placed.add(id);
      let cursor = xStart;
      for (const k of kids) {
        const w = measure(k, new Set());
        place(k, depth + 1, cursor, seen);
        cursor += w;
      }
    };

    let rootCursor = 0;
    const placementSeen = new Set<string>();
    for (const rid of sortedRoots) {
      const w = measure(rid, new Set());
      place(rid, 0, rootCursor, placementSeen);
      rootCursor += w;
    }
    // Any orphan (cycle-only) nodes: append at bottom.
    nodes.forEach((n, i) => {
      if (!placed.has(n.id)) {
        positions.set(n.id, { x: i * HSPACING, y: (rootCursor + 2) * VSPACING });
      }
    });

    const nextNodes: Node[] = nodes.map((n) => {
      const isRoot = sortedRoots.includes(n.id);
      const hasKids = (sortedChildMap.get(n.id)?.length ?? 0) > 0;
      const tone: MindNodeData["tone"] = isRoot ? "root" : hasKids ? "branch" : "leaf";
      return {
        ...n,
        position: positions.get(n.id) ?? n.position,
        data: { ...(n.data as any), tone, collapsed: false },
      };
    });

    // Preserve hierarchical edges but restyle for flowchart with top→bottom handles.
    const nextEdges: Edge[] = edges.map((e) => ({
      ...e,
      sourceHandle: "s-bottom",
      targetHandle: "t-top",
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    setNodes(nextNodes);
    setEdges(nextEdges);
    setViewMode("flowchart");
  }, [nodes, edges, viewMode, setNodes, setEdges]);

  // Restore the previously-saved mind-map layout when switching back so the
  // canvas doesn't stay in flowchart positions.
  const restoreAsMindmap = useCallback(() => {
    if (mindmapSnapshot) {
      const snapshotNodeIds = new Set(mindmapSnapshot.nodes.map((n) => n.id));
      const newNodes = nodes.filter((n) => !snapshotNodeIds.has(n.id));
      const snapshotEdgeIds = new Set(mindmapSnapshot.edges.map((e) => e.id));
      const newEdges = edges.filter((e) => !snapshotEdgeIds.has(e.id));

      setNodes([...mindmapSnapshot.nodes, ...newNodes]);
      setEdges([
        ...mindmapSnapshot.edges,
        ...newEdges.map((e) => ({
          ...e,
          sourceHandle: undefined,
          targetHandle: undefined,
        })),
      ]);
      setMindmapSnapshot(null);
    } else {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          sourceHandle: undefined,
          targetHandle: undefined,
        })),
      );
    }
    setViewMode("mindmap");
  }, [mindmapSnapshot, nodes, edges, setNodes, setEdges]);



  const { hiddenNodeIds, hiddenCountByCollapsed } = useMemo(() => {
    const collapsedIds = nodes.filter((n) => (n.data as any).collapsed).map((n) => n.id);
    const hidden = new Set<string>();
    const counts = new Map<string, number>();
    for (const cid of collapsedIds) {
      const desc = collectDescendants([cid]);
      counts.set(cid, desc.size);
      desc.forEach((d) => hidden.add(d));
    }
    return { hiddenNodeIds: hidden, hiddenCountByCollapsed: counts };
  }, [nodes, collectDescendants]);

  // Sequential numbering: 1, 1.1, 1.1.2, etc. Children ordered by edge order.
  const numberByIdMap = useMemo(() => {
    const numbering = new Map<string, string>();
    const hasIncoming = new Set(edges.map((e) => e.target));
    const roots = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
    const walk = (id: string, prefix: string, seen: Set<string>) => {
      if (seen.has(id)) return;
      seen.add(id);
      numbering.set(id, prefix);
      const kids = childrenMap.get(id) ?? [];
      kids.forEach((kid, i) => walk(kid, `${prefix}.${i + 1}`, seen));
    };
    const seen = new Set<string>();
    roots.forEach((rid, i) => walk(rid, `${i + 1}`, seen));
    return numbering;
  }, [nodes, edges, childrenMap]);

  const handleOpenLinkPicker = useCallback((nodeId: string) => {
    setLinkingNodeId(nodeId);
  }, []);

  const handleOpenLinkedMap = useCallback(
    (targetMapId: string) => {
      navigate({ to: "/maps/$id", params: { id: targetMapId } });
    },
    [navigate],
  );

  const handleExtractSubtree = useCallback(
    (nodeId: string) => {
      openExtractModalForSelection(nodeId);
    },
    [openExtractModalForSelection],
  );

  const nodesWithHandlers = useMemo(
    () => {
      const seen = new Set<string>();
      const uniqueNodes = nodes.filter((n) => {
        if (!n || !n.id || seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
      const allMaps = listMaps();
      const mapNameLookup = new Map(allMaps.map((m) => [m.id, m.name]));

      return uniqueNodes.map((n) => {
        const kids = childrenMap.get(n.id) ?? [];
        const collapsed = !!(n.data as any).collapsed;
        const targetMapId = (n.data as any).linkedMapId;
        const resolvedLinkedMapName = targetMapId
          ? mapNameLookup.get(targetMapId) || (n.data as any).linkedMapName || "Linked Map"
          : (n.data as any).linkedMapName || null;

        return {
          ...n,
          hidden: hiddenNodeIds.has(n.id),
          data: {
            ...n.data,
            linkedMapName: resolvedLinkedMapName,
            number: numberByIdMap.get(n.id) ?? "",
            hasChildren: kids.length > 0,
            hiddenCount: collapsed ? hiddenCountByCollapsed.get(n.id) ?? 0 : 0,
            onChange: updateLabel,
            onAddChild: addChild,
            onDelete: deleteNode,
            onToggleCollapse: toggleCollapse,
            onSetColor: setNodeColor,
            onSetNote: setNodeNote,
            onSetImages: setNodeImages,
            onSetLinkedMap: setNodeLinkedMap,
            onOpenLinkPicker: handleOpenLinkPicker,
            onOpenLinkedMap: handleOpenLinkedMap,
            onSelectSubtree: selectSubtree,
            onExtractSubtree: handleExtractSubtree,
            onResize: setNodeSize,
          },
        };
      });
    },
    [nodes, childrenMap, hiddenNodeIds, hiddenCountByCollapsed, numberByIdMap, updateLabel, addChild, deleteNode, toggleCollapse, setNodeColor, setNodeNote, setNodeImages, setNodeLinkedMap, setNodeSize, selectSubtree, handleOpenLinkPicker, handleOpenLinkedMap, handleExtractSubtree],
  );

  const edgesWithHidden = useMemo(
    () => {
      const seen = new Set<string>();
      const uniqueEdges = edges.filter((e) => {
        if (!e || !e.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      return uniqueEdges.map((e) => {
        const isSelected = selectedEdgeIds.includes(e.id);
        return {
          ...e,
          hidden: hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target),
          selected: isSelected,
          style: isSelected
            ? {
                stroke: "#3B59FF",
                strokeWidth: 3.5,
                filter: "drop-shadow(0 0 4px rgba(59, 89, 255, 0.6))",
              }
            : e.style,
        };
      });
    },
    [edges, hiddenNodeIds, selectedEdgeIds],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      // Expand the source if it's collapsed so the newly connected pill is visible.
      if (c.source) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === c.source && (n.data as any).collapsed
              ? { ...n, data: { ...n.data, collapsed: false } }
              : n,
          ),
        );
      }
      setEdges((eds) =>
        addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      );
    },
    [setNodes, setEdges],
  );


  const edgeReconnectSuccessful = useRef(true);
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges],
  );
  const onReconnectEnd = useCallback(() => {
    // Keep the original edge if the drop missed a handle — allows moving/retrying
    // without losing the connection.
    edgeReconnectSuccessful.current = true;
  }, []);

  // Autosave (debounced) with status indicator.
  // We keep a ref to the latest serialisable payload so pending saves can be
  // flushed synchronously on unmount / page hide — otherwise the debounce
  // timer is cleared before it fires and the user's most recent edits never
  // reach localStorage, which shows up as the map "resetting" on reload.
  type SaveStatus = "idle" | "saving" | "saved";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const firstSaveRef = useRef(true);
  const pendingPayloadRef = useRef<string | null>(null);

  const writePayload = useCallback(
    (payload: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, payload);
        touchMap(mapId);
        pendingPayloadRef.current = null;
        return true;
      } catch {
        return false;
      }
    },
    [STORAGE_KEY, mapId],
  );

  useEffect(() => {
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        const cleanNodes = nodes.map(({ id, position, type, data, width, height, style }) => ({
          id,
          position,
          type,
          width,
          height,
          style,
          data: {
            label: (data as any).label,
            tone: (data as any).tone,
            collapsed: !!(data as any).collapsed,
            color: (data as any).color ?? null,
            note: (data as any).note ?? "",
            images: Array.isArray((data as any).images) ? (data as any).images : [],
            linkedMapId: (data as any).linkedMapId ?? null,
            linkedMapName: (data as any).linkedMapName ?? null,
            width: (data as any).width,
            height: (data as any).height,
          },
        }));
        const payload = JSON.stringify({ nodes: cleanNodes, edges, viewMode, mindmapSnapshot });
        writePayload(payload);
      }
      return;
    }
    const cleanNodes = nodes.map(({ id, position, type, data, width, height, style }) => ({
      id,
      position,
      type,
      width,
      height,
      style,
      data: {
        label: (data as any).label,
        tone: (data as any).tone,
        collapsed: !!(data as any).collapsed,
        color: (data as any).color ?? null,
        note: (data as any).note ?? "",
        images: Array.isArray((data as any).images) ? (data as any).images : [],
        linkedMapId: (data as any).linkedMapId ?? null,
        linkedMapName: (data as any).linkedMapName ?? null,
        width: (data as any).width,
        height: (data as any).height,
      },
    }));
    const payload = JSON.stringify({ nodes: cleanNodes, edges, viewMode, mindmapSnapshot });
    pendingPayloadRef.current = payload;
    setSaveStatus("saving");
    const t = window.setTimeout(() => {
      if (writePayload(payload)) {
        setLastSavedAt(new Date());
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
      }
    }, 500);

    return () => {
      window.clearTimeout(t);
      // Flush pending payload synchronously so navigation / unmount doesn't
      // discard the user's most recent edits.
      if (pendingPayloadRef.current) {
        writePayload(pendingPayloadRef.current);
      }
    };
  }, [nodes, edges, viewMode, mindmapSnapshot, writePayload]);

  // Flush pending saves when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => {
      if (pendingPayloadRef.current) writePayload(pendingPayloadRef.current);
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [writePayload]);

  // Tick to keep "saved X ago" fresh
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => setNowTick((n) => n + 1), 15000);
    return () => window.clearInterval(i);
  }, []);

  const savedAgo = (() => {
    if (!lastSavedAt) return "";
    const s = Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return `${h}h ago`;
  })();

  // Undo / redo history (nodes + edges snapshots)
  type Snapshot = { nodes: Node[]; edges: Edge[] };
  const historyPast = useRef<Snapshot[]>([]);
  const historyFuture = useRef<Snapshot[]>([]);
  const lastSnapshot = useRef<Snapshot | null>(null);
  const skipHistory = useRef(false);
  const cloneSnapshot = (ns: Node[], es: Edge[]): Snapshot => ({
    nodes: ns.map((n) => ({ ...n, position: { ...n.position }, data: { ...(n.data as any) } })),
    edges: es.map((e) => ({ ...e })),
  });

  useEffect(() => {
    if (lastSnapshot.current === null) {
      lastSnapshot.current = cloneSnapshot(nodes, edges);
      return;
    }
    const t = window.setTimeout(() => {
      if (skipHistory.current) {
        skipHistory.current = false;
        lastSnapshot.current = cloneSnapshot(nodes, edges);
        return;
      }
      if (lastSnapshot.current) {
        historyPast.current.push(lastSnapshot.current);
        if (historyPast.current.length > 100) historyPast.current.shift();
        historyFuture.current = [];
      }
      lastSnapshot.current = cloneSnapshot(nodes, edges);
    }, 250);
    return () => window.clearTimeout(t);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (!historyPast.current.length) return;
    const prev = historyPast.current.pop()!;
    if (lastSnapshot.current) historyFuture.current.push(lastSnapshot.current);
    skipHistory.current = true;
    lastSnapshot.current = prev;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!historyFuture.current.length) return;
    const next = historyFuture.current.pop()!;
    if (lastSnapshot.current) historyPast.current.push(lastSnapshot.current);
    skipHistory.current = true;
    lastSnapshot.current = next;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  // Copy / paste clipboard (in-memory)
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const pasteOffsetRef = useRef(0);

  const copySelection = useCallback(() => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    // Include descendants so copying a pill copies its subtree.
    const include = new Set<string>(ids);
    collectDescendants(ids).forEach((d) => include.add(d));
    const copiedNodes = nodes
      .filter((n) => include.has(n.id))
      .map((n) => ({ ...n, position: { ...n.position }, data: { ...(n.data as any) } }));
    const copiedEdges = edges
      .filter((e) => include.has(e.source) && include.has(e.target))
      .map((e) => ({ ...e }));
    if (copiedNodes.length === 0) return;
    clipboardRef.current = { nodes: copiedNodes, edges: copiedEdges };
    pasteOffsetRef.current = 0;
  }, [selectedIds, selectedId, nodes, edges, collectDescendants]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.nodes.length === 0) return;
    pasteOffsetRef.current += 40;
    const dx = pasteOffsetRef.current;
    const dy = pasteOffsetRef.current;
    const idMap = new Map<string, string>();
    const newNodes: Node[] = clip.nodes.map((n) => {
      const newId = nextId();
      idMap.set(n.id, newId);
      // Root of a pasted subtree becomes a branch when it lands loose.
      const tone = (n.data as any).tone === "root" ? "branch" : (n.data as any).tone;
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + dx, y: n.position.y + dy },
        selected: true,
        data: { ...(n.data as any), tone },
      };
    });
    const newEdges: Edge[] = clip.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => {
        const s = idMap.get(e.source)!;
        const t = idMap.get(e.target)!;
        return { ...e, id: `e-${s}-${t}-${Math.random().toString(36).slice(2, 7)}`, source: s, target: t };
      });
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    const newIds = newNodes.map((n) => n.id);
    setSelectedIds(newIds);
    setSelectedId(newIds[0] ?? null);
  }, [setNodes, setEdges]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    // Ensure a fresh offset for this immediate paste.
    pasteOffsetRef.current = 0;
    // Defer paste to next tick so clipboard is set.
    setTimeout(() => pasteClipboard(), 0);
  }, [copySelection, pasteClipboard]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (e.key === "c" || e.key === "C")) {
        // Don't hijack if the user is trying to copy actual selected text.
        const sel = window.getSelection?.();
        if (sel && sel.toString().length > 0) return;
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && e.shiftKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        const anyExpandedWithKids = nodes.some(
          (n) => (childrenMap.get(n.id) ?? []).length > 0 && !(n.data as any).collapsed && n.id !== "root",
        );
        if (anyExpandedWithKids) collapseAll();
        else expandAll();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = selectedIds.length > 0
          ? selectedIds
          : selectedId
            ? [selectedId]
            : [];
        const deletableNodes = ids.filter((id) => id !== "root");
        const selectedEdgeIds = edges.filter((ed) => ed.selected).map((ed) => ed.id);
        if (deletableNodes.length > 0) {
          e.preventDefault();
          deleteMany(deletableNodes);
          return;
        }
        if (selectedEdgeIds.length > 0) {
          e.preventDefault();
          setEdges((eds) => eds.filter((ed) => !selectedEdgeIds.includes(ed.id)));
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (viewMode === "flowchart") addNextStep();
        else if (selectedId) addChild(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedIds, addChild, addNextStep, viewMode, deleteMany, edges, setEdges, undo, redo, copySelection, pasteClipboard, duplicateSelection, nodes, childrenMap, expandAll, collapseAll]);


  const reset = () => {
    if (!confirm("Reset the canvas to a blank starter map?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setViewMode("mindmap");
    setMindmapSnapshot(null);
    setSelectedId("root");
  };


  const cleanNodesFor = (ns: Node[]) =>
    ns.map(({ id, position, type, data, width, height, style }) => ({
      id,
      position,
      type,
      width,
      height,
      style,
      data: {
        label: (data as any).label,
        tone: (data as any).tone,
        collapsed: !!(data as any).collapsed,
        color: (data as any).color ?? null,
        note: (data as any).note ?? "",
        images: Array.isArray((data as any).images) ? (data as any).images : [],
        linkedMapId: (data as any).linkedMapId ?? null,
        linkedMapName: (data as any).linkedMapName ?? null,
        width: (data as any).width,
        height: (data as any).height,
      },
    }));

  const exportJSON = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: cleanNodesFor(nodes),
      edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindweave-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const [pdfBusy, setPdfBusy] = useState(false);

  const exportPDF = async () => {
    setPdfBusy(true);
    const inlinedPaths: Array<{ el: SVGPathElement; prev: string | null }> = [];
    try {
      const viewport = document.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement | null;
      if (!viewport) throw new Error("Canvas not ready.");
      const padding = 60;
      const bounds = getNodesBounds(nodes);
      const width = Math.max(bounds.width + padding * 2, 400);
      const height = Math.max(bounds.height + padding * 2, 300);
      const rootStyle = getComputedStyle(document.documentElement);
      const bg = rootStyle.getPropertyValue("--background").trim() || "#faf7f0";
      const inkRaw = rootStyle.getPropertyValue("--ink").trim() || "#2a2a2a";
      const clayRaw = rootStyle.getPropertyValue("--clay").trim() || "#b5651d";
      // CSS custom props may be raw HSL tuples (e.g. "30 40% 20%"); wrap them.
      const resolveColor = (v: string) =>
        /^[\d.\s%]+$/.test(v) ? `hsl(${v})` : v;
      const inkColor = resolveColor(inkRaw);
      const clayColor = resolveColor(clayRaw);

      // Inline edge stroke colors so html-to-image doesn't drop var()-based strokes.
      document
        .querySelectorAll<SVGPathElement>(".react-flow__edge-path")
        .forEach((el) => {
          const selected = el.closest(".react-flow__edge")?.classList.contains("selected");
          inlinedPaths.push({ el, prev: el.getAttribute("style") });
          el.style.stroke = selected ? clayColor : inkColor;
          if (!el.style.strokeWidth) el.style.strokeWidth = selected ? "2.25" : "1.75";
          el.style.fill = "none";
        });

      const dataUrl = await toPng(viewport, {
        backgroundColor: bg,
        width,
        height,
        pixelRatio: 2,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
          transformOrigin: "0 0",
        },
        filter: (node) => {
          const cls = (node as HTMLElement).classList;
          if (!cls) return true;
          // Strip interactive-only chrome from the export
          return !cls.contains("react-flow__minimap") &&
            !cls.contains("react-flow__controls") &&
            !cls.contains("react-flow__panel");
        },
      });

      const orientation = width >= height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const scale = Math.min(availW / width, availH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH);
      pdf.save(`mindweave-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(`PDF export failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      // Restore original inline styles on edge paths.
      inlinedPaths.forEach(({ el, prev }) => {
        if (prev === null) el.removeAttribute("style");
        else el.setAttribute("style", prev);
      });
      setPdfBusy(false);
    }
  };

  const exportDOCX = async () => {
    // Convert a data: URL to raw bytes + docx image type.
    const parseDataUrl = (
      url: string,
    ): { bytes: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" | "svg" } | null => {
      const m = /^data:image\/([a-zA-Z+.-]+);base64,(.+)$/.exec(url);
      if (!m) return null;
      let ext = m[1].toLowerCase();
      if (ext === "jpeg") ext = "jpg";
      if (ext === "svg+xml") ext = "svg";
      const allowed = new Set(["png", "jpg", "gif", "bmp", "svg"]);
      if (!allowed.has(ext)) return null;
      try {
        const bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { bytes, type: ext as any };
      } catch {
        return null;
      }
    };

    // Build hierarchical WBS-style outline sorted by node numbers (1, 1.1, 1.1.1, 1.2, 2…)
    const meta = getMap(mapId);
    const title = meta?.name?.trim() || "Mind map";

    const entries = nodes
      .map((n) => ({
        id: n.id,
        label: ((n.data as any).label ?? "").toString().trim() || "Untitled",
        note: ((n.data as any).note ?? "").toString(),
        images: (Array.isArray((n.data as any).images)
          ? (n.data as any).images
          : []) as import("./MindNode").NoteImage[],
        number: numberByIdMap.get(n.id) ?? "",
      }))
      .filter((e) => e.number)
      .map((e) => ({
        ...e,
        tuple: e.number.split(".").map((s) => parseInt(s, 10) || 0),
      }))
      .sort((a, b) => {
        const len = Math.max(a.tuple.length, b.tuple.length);
        for (let i = 0; i < len; i++) {
          const av = a.tuple[i] ?? -1;
          const bv = b.tuple[i] ?? -1;
          if (av !== bv) return av - bv;
        }
        return 0;
      });

    // Display format: top-level "1" → "1.0"; others keep as-is (e.g. "1.1.1").
    const displayNumber = (num: string) =>
      num.includes(".") ? num : `${num}.0`;

    // Indent proportional to depth (dots + 1). Root depth = 1.
    const INDENT_PER_LEVEL = 360; // twips (0.25")
    const NUMBER_TAB_WIDTH = 100; // extra space for wider labels at deeper levels

    const children: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, size: 40 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: `Work Breakdown Structure  ·  ${new Date().toLocaleDateString()}`,
            italics: true,
            size: 20,
            color: "666666",
          }),
        ],
      }),
    ];

    for (const e of entries) {
      const depth = e.tuple.length; // 1, 2, 3, …
      const num = displayNumber(e.number);
      const leftIndent = (depth - 1) * INDENT_PER_LEVEL;
      const numColWidth = 900 + (depth - 1) * NUMBER_TAB_WIDTH;

      children.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: leftIndent, hanging: numColWidth },
          tabStops: [{ type: "left" as any, position: leftIndent + numColWidth }],
          children: [
            new TextRun({
              text: num,
              bold: depth <= 2,
              size: depth === 1 ? 24 : 22,
            }),
            new TextRun({ text: "\t" }),
            new TextRun({
              text: e.label,
              bold: depth <= 2,
              size: depth === 1 ? 24 : 22,
            }),
          ],
        }),
      );

      if (e.note && e.note.trim()) {
        const noteLines = e.note.split(/\r?\n/);
        for (const line of noteLines) {
          children.push(
            new Paragraph({
              spacing: { before: 20, after: 20 },
              indent: { left: leftIndent + numColWidth + 120 },
              children: [
                new TextRun({
                  text: line || " ",
                  italics: true,
                  size: 20,
                  color: "555555",
                }),
              ],
            }),
          );
        }
      }

      if (e.images && e.images.length) {
        const imgIndent = leftIndent + numColWidth + 120;
        const MAX_W_PX = 420; // ~4.4"
        const MAX_H_PX = 320;
        for (const img of e.images) {
          const parsed = parseDataUrl(img.dataUrl);
          if (!parsed) continue;
          let w = img.width && img.width > 0 ? img.width : MAX_W_PX;
          let h = img.height && img.height > 0 ? img.height : Math.round(MAX_W_PX * 0.66);
          const rW = MAX_W_PX / w;
          const rH = MAX_H_PX / h;
          const r = Math.min(1, rW, rH);
          w = Math.max(40, Math.round(w * r));
          h = Math.max(30, Math.round(h * r));
          children.push(
            new Paragraph({
              spacing: { before: 60, after: 20 },
              indent: { left: imgIndent },
              children: [
                new ImageRun({
                  type: parsed.type as any,
                  data: parsed.bytes,
                  transformation: { width: w, height: h },
                }),
              ],
            }),
          );
          if (img.name) {
            children.push(
              new Paragraph({
                spacing: { before: 0, after: 40 },
                indent: { left: imgIndent },
                children: [
                  new TextRun({
                    text: img.name,
                    italics: true,
                    size: 16,
                    color: "888888",
                  }),
                ],
              }),
            );
          }
        }
      }
    }


    const doc = new DocxDocument({
      creator: "Mindweave",
      title,
      styles: {
        default: {
          document: { run: { font: "Times New Roman", size: 22 } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
            },
          },
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "mindweave";
    a.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };


  const fileInputRef = useRef<HTMLInputElement>(null);

  const importJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid file: missing nodes or edges.");
      }
      const validNodes: Node[] = parsed.nodes
        .filter((n: any) => n && typeof n.id === "string" && n.position)
        .map((n: any) => {
          const w = Number(n.data?.width ?? n.width) || undefined;
          const h = Number(n.data?.height ?? n.height) || undefined;
          return {
            id: n.id,
            type: n.type ?? "mind",
            position: { x: Number(n.position.x) || 0, y: Number(n.position.y) || 0 },
            ...(w && h ? { width: w, height: h, style: { width: w, height: h } } : {}),
            data: {
              label: String(n.data?.label ?? "Untitled"),
              tone: (n.data?.tone as MindNodeData["tone"]) ?? "leaf",
              collapsed: !!n.data?.collapsed,
              color: n.data?.color ?? null,
              note: typeof n.data?.note === "string" ? n.data.note : "",
              images: Array.isArray(n.data?.images) ? n.data.images : [],
              width: w,
              height: h,
            } as any,
          };
        });
      const nodeIds = new Set(validNodes.map((n) => n.id));
      const validEdges: Edge[] = parsed.edges
        .filter(
          (e: any) =>
            e && typeof e.id === "string" && nodeIds.has(e.source) && nodeIds.has(e.target),
        )
        .map((e: any) => ({ id: e.id, source: e.source, target: e.target }));
      if (validNodes.length === 0) throw new Error("No valid nodes found.");
      setNodes(validNodes);
      setEdges(validEdges);
      setSelectedId(validNodes[0].id);
      const maxN = validNodes.reduce((m, n) => {
        const match = /^n(\d+)$/.exec(n.id);
        return match ? Math.max(m, parseInt(match[1], 10)) : m;
      }, 1000);
      idCounter.current = maxN;
    } catch (err: any) {
      alert(`Import failed: ${err?.message ?? "Unknown error"}`);
    }
  };

  // ── AI: import from image ───────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const extract = useServerFn(extractMindMapFromImage);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const layoutFromExtracted = (
    extracted: {
      id: string;
      label: string;
      tone: MindNodeData["tone"];
      parentId?: string | null;
      color?: string | null;
    }[],
  ): { nodes: Node[]; edges: Edge[] } => {
    // Build parent → children map
    const byId = new Map(extracted.map((n) => [n.id, n]));
    const children = new Map<string, string[]>();
    let rootId = extracted.find((n) => n.tone === "root")?.id;
    if (!rootId) rootId = extracted.find((n) => !n.parentId)?.id ?? extracted[0].id;
    for (const n of extracted) {
      const pid = n.id === rootId ? null : n.parentId ?? rootId;
      if (!pid || pid === n.id) continue;
      if (!byId.has(pid)) continue;
      const arr = children.get(pid) ?? [];
      arr.push(n.id);
      children.set(pid, arr);
    }

    // Compute leaf counts for vertical spacing
    const leafCount = new Map<string, number>();
    const countLeaves = (id: string): number => {
      const kids = children.get(id) ?? [];
      if (kids.length === 0) {
        leafCount.set(id, 1);
        return 1;
      }
      const total = kids.reduce((s, k) => s + countLeaves(k), 0);
      leafCount.set(id, total);
      return total;
    };
    countLeaves(rootId);

    // Resolve color (node explicit color or inherited branch color)
    const resolveColor = (id: string): string | null => {
      const node = byId.get(id);
      if (node?.color && typeof node.color === "string" && node.color.trim() !== "") {
        let c = node.color.trim();
        if (!c.startsWith("#") && /^[0-9A-Fa-f]{3,6}$/.test(c)) {
          c = `#${c}`;
        }
        return c;
      }
      let pid = node?.parentId;
      while (pid && byId.has(pid)) {
        const pnode = byId.get(pid);
        if (pnode?.color && typeof pnode.color === "string" && pnode.color.trim() !== "") {
          let c = pnode.color.trim();
          if (!c.startsWith("#") && /^[0-9A-Fa-f]{3,6}$/.test(c)) {
            c = `#${c}`;
          }
          return c;
        }
        pid = pnode?.parentId;
      }
      return null;
    };

    const V_GAP = 90;
    const H_GAP = 260;
    const nodesOut: Node[] = [];
    const edgesOut: Edge[] = [];

    const place = (id: string, depth: number, centerY: number) => {
      const src = byId.get(id)!;
      const resolvedColor = resolveColor(id);
      nodesOut.push({
        id,
        type: "mind",
        position: { x: depth * H_GAP, y: centerY },
        data: {
          label: src.label || "Untitled",
          tone: src.tone,
          color: resolvedColor,
        } as any,
      });
      const kids = children.get(id) ?? [];
      const totalHeight = (leafCount.get(id) ?? 1) * V_GAP;
      let cursor = centerY - totalHeight / 2;
      for (const kid of kids) {
        const h = (leafCount.get(kid) ?? 1) * V_GAP;
        const kidCenter = cursor + h / 2;
        place(kid, depth + 1, kidCenter);
        edgesOut.push({ id: `e-${id}-${kid}`, source: id, target: kid });
        cursor += h;
      }
    };
    place(rootId, 0, 0);
    return { nodes: nodesOut, edges: edgesOut };
  };

  const importFromImage = async (file: File) => {
    setAiBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB.");
      const dataUrl = await fileToDataUrl(file);
      const result = await extract({ data: { imageDataUrl: dataUrl } });
      const { nodes: laidOut, edges: laidEdges } = layoutFromExtracted(result.nodes);
      if (laidOut.length === 0) throw new Error("No nodes detected in the image.");
      setNodes(laidOut);
      setEdges(laidEdges);
      setSelectedId(laidOut[0].id);
      idCounter.current = 1000 + laidOut.length;
    } catch (err: any) {
      alert(`AI import failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setAiBusy(false);
    }
  };


  const stats = {
    ideas: nodes.length,
    links: edges.length,
  };

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHidden}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        edgesReconnectable
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => {
          setSelectedId(null);
          setSelectedIds((current) => (current.length === 0 ? current : []));
          setSelectedEdgeIds((current) => (current.length === 0 ? current : []));
        }}
        onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
          const nIds = selNodes.map((n) => n.id);
          const eIds = selEdges.map((e) => e.id);
          setSelectedIds((current) => (sameIds(current, nIds) ? current : nIds));
          setSelectedEdgeIds((current) => (sameIds(current, eIds) ? current : eIds));
          setSelectedId((current) => {
            const next = nIds.length === 1 ? nIds[0] : nIds.length === 0 ? null : current;
            return current === next ? current : next;
          });
        }}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        panOnDrag={canvasDragMode === "pan" ? true : [1, 2]}
        selectionOnDrag={canvasDragMode === "select"}
        selectionMode={SelectionMode.Partial}
        elementsSelectable={true}
        zoomOnScroll={true}
        panOnScroll={false}
        selectionKeyCode={["Shift"]}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        deleteKeyCode={null}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#121212" },
        }}
        connectionRadius={40}
        snapToGrid={true}
        snapGrid={[16, 16]}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1.2} color="rgba(18, 18, 18, 0.15)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(249, 249, 247, 0.75)"
          nodeColor={(n) => {
            const tone = (n.data as any).tone;
            if (tone === "root") return "#000000";
            if (tone === "branch") return "#18181B";
            return "#71717A";
          }}
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            borderRadius: 12,
          }}
        />
      </ReactFlow>

      {/* Floating toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-sm max-w-fit">
        <div className="flex items-center rounded-xl bg-secondary p-0.5 text-xs">
          <button
            onClick={() => setCanvasDragMode("select")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
              canvasDragMode === "select"
                ? "bg-black text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Box select nodes & lines by clicking and dragging the mouse"
          >
            <span>🔲</span>
            <span>Box Select</span>
          </button>
          <button
            onClick={() => setCanvasDragMode("pan")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
              canvasDragMode === "pan"
                ? "bg-black text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Pan canvas view by dragging"
          >
            <span>✋</span>
            <span>Pan</span>
          </button>
        </div>

        <div className="flex items-center rounded-xl bg-secondary p-0.5 text-xs">
          <button
            onClick={() => {
              if (viewMode === "flowchart") {
                restoreAsMindmap();
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "mindmap"
                ? "bg-black text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mind map
          </button>
          <button
            onClick={() => {
              if (viewMode === "mindmap") {
                arrangeAsFlowchart();
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "flowchart"
                ? "bg-black text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Flowchart
          </button>
        </div>

        <button
          onClick={() => {
            if (viewMode === "flowchart") addNextStep();
            else addChild(selectedId ?? "root");
          }}
          className="flex items-center gap-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <span className="text-base leading-none">+</span>{" "}
          {viewMode === "flowchart" ? "Next step" : "Add idea"}
        </button>

        {selectedId && (
          <button
            onClick={() => selectSubtree(selectedId)}
            className="rounded-xl text-xs px-3 py-1.5 text-foreground hover:bg-secondary border border-border transition font-semibold flex items-center gap-1 cursor-pointer"
            title="Select this node and all of its descendant branch nodes"
          >
            <span>🌿</span>
            <span>Select Branch</span>
          </button>
        )}

        <button
          onClick={() => openExtractModalForSelection()}
          className="rounded-xl text-xs px-3.5 py-1.5 text-white bg-black hover:bg-neutral-800 transition font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
          title="Generate a new standalone map from selected nodes"
        >
          <span>🌱</span>
          <span>
            {selectedIds.length > 1
              ? `Extract Map (${selectedIds.length})`
              : "Extract Map"}
          </span>
        </button>

        <button
          onClick={() => {
            const ids = (selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []).filter((id) => id !== "root");
            if (ids.length > 0) deleteMany(ids);
          }}
          disabled={(selectedIds.filter((id) => id !== "root").length === 0) && (!selectedId || selectedId === "root")}
          className="rounded-xl text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-30 disabled:hover:bg-transparent transition font-semibold cursor-pointer"
          title="Delete selected (Del)"
        >
          Delete{selectedIds.filter((id) => id !== "root").length > 1 ? ` (${selectedIds.filter((id) => id !== "root").length})` : ""}
        </button>

        <button
          onClick={() => {
            const anyExpandedWithKids = nodes.some(
              (n) => (childrenMap.get(n.id) ?? []).length > 0 && !(n.data as any).collapsed && n.id !== "root",
            );
            if (anyExpandedWithKids) collapseAll();
            else expandAll();
          }}
          className="rounded-xl text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition font-medium cursor-pointer"
          title="Collapse or expand all branches"
        >
          {nodes.some((n) => (childrenMap.get(n.id) ?? []).length > 0 && !(n.data as any).collapsed && n.id !== "root") ? "Collapse all" : "Expand all"}
        </button>

        <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

        <div className="flex items-center gap-1">
          <button
            onClick={exportJSON}
            className="rounded-xl text-xs px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition font-medium cursor-pointer"
            title="Download map as JSON"
          >
            Export
          </button>
          <button
            onClick={exportPDF}
            disabled={pdfBusy}
            className="rounded-xl text-xs px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition disabled:opacity-50 font-medium cursor-pointer"
            title="Download map as PDF"
          >
            {pdfBusy ? "Rendering…" : "PDF"}
          </button>
          <button
            onClick={exportDOCX}
            className="rounded-xl text-xs px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition font-medium cursor-pointer"
            title="Download as Word outline"
          >
            Word
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl text-xs px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition font-medium cursor-pointer"
            title="Load map from JSON"
          >
            Import
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJSON(f);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={aiBusy}
          className="rounded-xl text-xs px-3 py-1.5 text-white bg-black hover:bg-neutral-800 disabled:opacity-50 transition font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
          title="Extract a mind map from an image using AI"
        >
          {aiBusy ? "Reading image…" : "✨ From Image"}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFromImage(f);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => setShowQuickSwitcher(true)}
          className="rounded-xl text-xs px-3 py-1.5 text-foreground bg-secondary hover:bg-black hover:text-white transition font-bold flex items-center gap-1.5 border border-border cursor-pointer"
          title="Toggle linked maps quick switcher (Cmd+K / Ctrl+K)"
        >
          <span>🗺️</span>
          <span>Switch Map</span>
          <span className="text-[9px] font-mono opacity-70 hidden sm:inline">(⌘K)</span>
        </button>

        <button
          onClick={reset}
          className="rounded-xl text-xs px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* Connected Maps Quick Switcher Bar */}
      {(outgoingLinkedMaps.length > 0 || incomingLinkedMaps.length > 0) && (
        <div className="absolute top-16 left-4 z-10 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-2xs text-xs max-w-[calc(100vw-2rem)]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 mr-1">
            <span>🔗</span> Connected Maps:
          </span>

          {/* Backlinks (Parent Maps) */}
          {incomingLinkedMaps.map((parent) => (
            <button
              key={`in-${parent.id}`}
              onClick={() => navigate({ to: "/maps/$id", params: { id: parent.id } })}
              className="flex items-center gap-1.5 rounded-xl bg-secondary hover:bg-black hover:text-white text-foreground px-3 py-1 text-xs font-bold border border-border transition cursor-pointer"
              title={`Return to parent map "${parent.name}"`}
            >
              <span className="text-[10px]">&larr;</span>
              <span className="truncate max-w-[120px]">{parent.name}</span>
            </button>
          ))}

          {/* Outgoing Sub-Maps */}
          {outgoingLinkedMaps.map((outMap) => (
            <button
              key={`out-${outMap.id}`}
              onClick={() => navigate({ to: "/maps/$id", params: { id: outMap.id } })}
              className="flex items-center gap-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 px-3 py-1 text-xs font-bold shadow-2xs transition cursor-pointer"
              title={`Switch to sub-map "${outMap.name}" (${outMap.count} linked node${outMap.count > 1 ? 's' : ''})`}
            >
              <span className="truncate max-w-[120px]">{outMap.name}</span>
              <span className="bg-white/20 px-1 py-0.2 rounded text-[9px] font-mono">{outMap.count}</span>
              <span className="text-[10px]">&rarr;</span>
            </button>
          ))}

          <button
            onClick={() => setShowQuickSwitcher(true)}
            className="rounded-xl border border-border hover:bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition ml-1 cursor-pointer"
            title="Open Map Switcher (Cmd+K)"
          >
            All Maps ▾
          </button>
        </div>
      )}

      {/* Quick Map Switcher Modal (Cmd+K) */}
      {showQuickSwitcher && (() => {
        const allSaved = listMaps();
        const filtered = allSaved.filter((m) =>
          m.name.toLowerCase().includes(quickSearch.toLowerCase()),
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={() => setShowQuickSwitcher(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 text-foreground flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-foreground">
                      🗺️ Map Switcher
                    </span>
                    <span className="text-[9px] font-mono bg-secondary text-foreground border border-border px-1.5 py-0.5 rounded font-bold">
                      ⌘K / Ctrl+K
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold leading-tight mt-0.5">
                    Toggle Concept Maps
                  </h3>
                </div>
                <button
                  onClick={() => setShowQuickSwitcher(false)}
                  className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Quick Filter Search */}
              <input
                autoFocus
                type="text"
                placeholder="Search map title or connected concepts..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-black transition"
              />

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                {/* Connected Maps Section */}
                {(outgoingLinkedMaps.length > 0 || incomingLinkedMaps.length > 0) && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
                      <span>🔗</span> Directly Connected Maps ({outgoingLinkedMaps.length + incomingLinkedMaps.length})
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {incomingLinkedMaps.map((parent) => (
                        <div
                          key={`p-${parent.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary transition"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground bg-card border border-border px-1.5 py-0.5 rounded">
                                &larr; Parent
                              </span>
                              <span className="font-display font-bold text-sm truncate">{parent.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Linked from node "{parent.nodeLabel}"
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setShowQuickSwitcher(false);
                              navigate({ to: "/maps/$id", params: { id: parent.id } });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open</span>
                            <span>&rarr;</span>
                          </button>
                        </div>
                      ))}

                      {outgoingLinkedMaps.map((outMap) => (
                        <div
                          key={`out-${outMap.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary transition"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground bg-card border border-border px-1.5 py-0.5 rounded">
                                Sub-Map &rarr;
                              </span>
                              <span className="font-display font-bold text-sm truncate">{outMap.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              {outMap.count} linked node{outMap.count > 1 ? "s" : ""} on this canvas
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setShowQuickSwitcher(false);
                              navigate({ to: "/maps/$id", params: { id: outMap.id } });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open</span>
                            <span>&rarr;</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Studio Maps */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                    All Studio Maps ({filtered.length})
                  </span>
                  {filtered.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl">
                      No maps found matching "{quickSearch}"
                    </div>
                  ) : (
                    filtered.map((m) => {
                      const isCurrent = m.id === mapId;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition ${
                            isCurrent
                              ? "border-black bg-secondary"
                              : "border-border bg-card hover:border-black/30"
                          }`}
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-foreground truncate">
                                {m.name}
                              </span>
                              {isCurrent && (
                                <span className="text-[8px] uppercase font-bold text-foreground bg-card border border-border px-1.5 py-0.5 rounded">
                                  Active Canvas
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Updated {new Date(m.updatedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCurrent ? (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                                Viewing
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowQuickSwitcher(false);
                                  navigate({ to: "/maps/$id", params: { id: m.id } });
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <span>Switch</span>
                                <span>&rarr;</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer / Create New Map */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    const newMap = createMap("Untitled Concept Map");
                    setShowQuickSwitcher(false);
                    navigate({ to: "/maps/$id", params: { id: newMap.id } });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <span>+</span> New Blank Map
                </button>
                <button
                  onClick={() => setShowQuickSwitcher(false)}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Multi-Selection Floating Bar */}
      {(selectedIds.length > 1 || selectedEdgeIds.length > 0 || (selectedIds.length === 1 && selectedEdgeIds.length > 0)) && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span>
              {selectedIds.length > 0 && `${selectedIds.length} Node${selectedIds.length > 1 ? "s" : ""}`}
              {selectedIds.length > 0 && selectedEdgeIds.length > 0 && ", "}
              {selectedEdgeIds.length > 0 && `${selectedEdgeIds.length} Line${selectedEdgeIds.length > 1 ? "s" : ""}`}
              {" Selected"}
            </span>
          </div>

          <div className="w-px h-4 bg-border" />

          {selectedIds.length > 0 && (
            <button
              onClick={() => openExtractModalForSelection()}
              className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>🌱</span>
              <span>Generate New Map</span>
            </button>
          )}

          <button
            onClick={() => deleteSelected()}
            className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white text-xs font-bold transition cursor-pointer"
          >
            Delete Selected
          </button>

          <button
            onClick={() => {
              setSelectedIds([]);
              setSelectedEdgeIds([]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Extract Map Modal */}
      {showExtractModal && (() => {
        const activeIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
        const count = activeIds.length;
        const primaryId = selectedId && activeIds.includes(selectedId) ? selectedId : activeIds[0];
        const primaryNode = nodes.find((n) => n.id === primaryId);
        const primaryLabel = (primaryNode?.data as any)?.label || "Selected Node";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={() => setShowExtractModal(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 text-foreground flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-foreground block">
                    🌱 Map Extraction Engine
                  </span>
                  <h3 className="font-display text-xl font-bold leading-tight">
                    Generate New Concept Map
                  </h3>
                </div>
                <button
                  onClick={() => setShowExtractModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="bg-secondary/60 border border-border rounded-xl p-3 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span>Selection Scope:</span>
                  <span>{count} node{count > 1 ? "s" : ""} selected</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Extracts <strong>"{primaryLabel}"</strong> and its selected branch connections into a standalone concept map with preserved hierarchy, notes, and layout.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
                  New Map Title
                </label>
                <input
                  type="text"
                  value={extractMapTitle}
                  onChange={(e) => setExtractMapTitle(e.target.value)}
                  placeholder="e.g. Sub-Map: Core Features"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-black transition"
                  autoFocus
                />
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkExtractToParent}
                  onChange={(e) => setLinkExtractToParent(e.target.checked)}
                  className="mt-0.5 rounded text-black focus:ring-black"
                />
                <div className="text-xs">
                  <span className="font-bold text-foreground block">
                    Link parent node on this canvas to generated map
                  </span>
                  <span className="text-[11px] text-muted-foreground block leading-tight mt-0.5">
                    Adds a 🗺️ jump badge on "{primaryLabel}" for instant 1-click map navigation.
                  </span>
                </div>
              </label>

              <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2">
                <button
                  onClick={() => setShowExtractModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performExtractToNewMap(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-black hover:text-white transition cursor-pointer"
                >
                  Generate & Stay
                </button>
                <button
                  onClick={() => performExtractToNewMap(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🌱 Generate & Open</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-4 py-2 text-xs shadow-2xs">
        <div>
          <span className="font-display font-bold text-base text-foreground">{stats.ideas}</span>{" "}
          <span className="text-muted-foreground">ideas</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div>
          <span className="font-display font-bold text-base text-foreground">{stats.links}</span>{" "}
          <span className="text-muted-foreground">connections</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 text-muted-foreground" title={lastSavedAt ? `Last saved ${lastSavedAt.toLocaleString()}` : "Autosave on"}>
          <span
            className={`w-2 h-2 rounded-full ${
              saveStatus === "saving"
                ? "bg-amber-500 animate-pulse"
                : saveStatus === "saved"
                  ? "bg-emerald-500"
                  : "bg-gray-300"
            }`}
          />
          {saveStatus === "saving"
            ? "Saving…"
            : lastSavedAt
              ? `Saved ${savedAgo}`
              : "Autosave on"}
        </div>
      </div>

      {/* Map Link Modal */}
      {(() => {
        if (!linkingNodeId) return null;
        const targetNode = nodes.find((n) => n.id === linkingNodeId);
        if (!targetNode) return null;
        const savedMaps = listMaps();
        const filteredMaps = savedMaps.filter((m) =>
          m.name.toLowerCase().includes(mapSearch.toLowerCase())
        );
        const nodeLabel = (targetNode.data as any).label || "Node";
        const linkedMapId = (targetNode.data as any).linkedMapId;
        const linkedMapName = (targetNode.data as any).linkedMapName;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={() => {
              setLinkingNodeId(null);
              setMapSearch("");
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 text-foreground overflow-y-auto max-h-[85vh] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-foreground block">
                    Map Library Link
                  </span>
                  <h3 className="font-display text-xl font-bold leading-tight">
                    Link "{nodeLabel}" to Map
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setLinkingNodeId(null);
                    setMapSearch("");
                  }}
                  className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  ×
                </button>
              </div>

              {linkedMapId ? (
                <div className="flex items-center justify-between rounded-xl bg-secondary border border-border p-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <span className="text-base shrink-0">🔗</span>
                    <div className="min-w-0">
                      <span className="font-bold text-foreground text-[10px] uppercase tracking-widest block">Currently Linked</span>
                      <span className="font-display font-bold text-sm text-foreground truncate block">
                        {linkedMapName || "Linked Map"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setNodeLinkedMap(targetNode.id, null, null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold text-xs hover:bg-red-600 hover:text-white transition shrink-0 cursor-pointer"
                  >
                    Unlink Map
                  </button>
                </div>
              ) : null}

              {/* Inline Create & Link New Map */}
              <div className="rounded-xl border border-border bg-secondary/50 p-3 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  Create & Link New Map
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder="New concept map name…"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:border-black"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newMapName.trim()) {
                        const newMeta = createMap(newMapName.trim());
                        setNodeLinkedMap(targetNode.id, newMeta.id, newMeta.name);
                        setNewMapName("");
                        setLinkingNodeId(null);
                        setMapSearch("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!newMapName.trim()) return;
                      const newMeta = createMap(newMapName.trim());
                      setNodeLinkedMap(targetNode.id, newMeta.id, newMeta.name);
                      setNewMapName("");
                      setLinkingNodeId(null);
                      setMapSearch("");
                    }}
                    className="rounded-xl bg-black text-white px-3 py-1.5 text-xs font-bold hover:bg-neutral-800 transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    + Create & Link
                  </button>
                </div>
              </div>

              {/* Library Filter */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Select Saved Map
                  </span>
                  <span className="text-[10px] text-muted-foreground">{filteredMaps.length} maps</span>
                </div>
                <input
                  type="text"
                  value={mapSearch}
                  onChange={(e) => setMapSearch(e.target.value)}
                  placeholder="Search map title…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:border-black"
                />
              </div>

              {/* Maps List */}
              <div className="max-h-52 overflow-y-auto flex flex-col gap-2 pr-1">
                {filteredMaps.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-xl">
                    No maps found matching "{mapSearch}".
                  </div>
                ) : (
                  filteredMaps.map((m) => {
                    const isCurrent = m.id === mapId;
                    const isLinkedToThis = linkedMapId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition ${
                          isLinkedToThis
                            ? "border-black bg-secondary"
                            : "border-border bg-card hover:border-black/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-xs text-foreground truncate">
                              {m.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] uppercase font-bold text-foreground bg-card border border-border px-1 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Updated {new Date(m.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setNodeLinkedMap(targetNode.id, m.id, m.name);
                              setLinkingNodeId(null);
                              setMapSearch("");
                            }}
                            disabled={isLinkedToThis}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isLinkedToThis
                                ? "bg-emerald-700 text-white cursor-default"
                                : "bg-black text-white hover:bg-neutral-800 shadow-2xs"
                            }`}
                          >
                            {isLinkedToThis ? "Linked ✓" : "Link Map"}
                          </button>
                          <button
                            onClick={() => {
                              navigate({ to: "/maps/$id", params: { id: m.id } });
                            }}
                            title="Open map canvas"
                            className="p-1 text-xs text-muted-foreground hover:text-foreground transition font-bold cursor-pointer"
                          >
                            &rarr;
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                if (isLinkedToThis) {
                                  setNodeLinkedMap(targetNode.id, null, null);
                                }
                                deleteMap(m.id);
                              }}
                              title="Delete map"
                              className="p-1 text-xs text-red-500 hover:text-red-700 transition font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-2 border-t border-border flex justify-end">
                <button
                  onClick={() => {
                    setLinkingNodeId(null);
                    setMapSearch("");
                  }}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function MindMap({ mapId }: { mapId: string }) {
  return (
    <ReactFlowProvider>
      <InnerMap key={mapId} mapId={mapId} />
    </ReactFlowProvider>
  );
}
