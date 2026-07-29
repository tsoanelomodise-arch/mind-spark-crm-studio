import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { IMPL_STAGES, TASK_STATUSES, type ImplStage, type TaskStatus } from "@/lib/implementation";
import { daysUntil, formatShortDate } from "@/lib/pipeline";
import { PipelineTabs } from "./recurring";
import { ImplementationSubNav } from "@/components/ImplementationSubNav";
import { listTeamDirectory } from "@/lib/team-directory.functions";
import {
  Briefcase,
  CalendarClock,
  ArrowRight,
  ArrowUpRight,
  Users,
  Layers,
  Hourglass,
  CheckCircle2,
  Plus,
  X,
  CheckSquare,
  ListTodo,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  Sparkles,
  Filter,
  ExternalLink,
  Trash2,
  FolderKanban,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectClientPopover } from "@/components/ProjectClientPopover";
import { toast } from "sonner";

export const Route = createFileRoute("/implementation/")({
  component: ImplementationPage,
});

type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  status: string;
  impl_stage: string | null;
  due_date: string | null;
  updated_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
};

type ClientLite = { id: string; name: string };
type Member = { id: string; email: string };

function ImplementationPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<ImplStage | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [overTaskStatus, setOverTaskStatus] = useState<TaskStatus | null>(null);

  const [viewMode, setViewMode] = useState<"stage" | "task">("stage");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects", "implementation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,client_id,status,impl_stage,due_date,updated_at")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data as ClientLite[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("id,project_id,title,status,assignee_id,due_date,position")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const teamFn = useServerFn(listTeamDirectory);
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team", "directory"],
    queryFn: () => teamFn(),
  });

  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const memberLabel = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.email.split("@")[0]));
    return m;
  }, [members]);

  const [selectKey, setSelectKey] = useState(0);
  const [selectedStageModal, setSelectedStageModal] = useState<ImplStage | null>(null);
  const [selectedTaskFilterModal, setSelectedTaskFilterModal] = useState<"overdue" | "week" | "open" | "completed" | null>(null);
  const [selectedAssigneeModal, setSelectedAssigneeModal] = useState<{ id: string | null; label: string } | null>(null);
  const [selectedClientModal, setSelectedClientModal] = useState<{ id: string; name: string } | null>(null);

  const [activeFilter, setActiveFilter] = useState<{
    type: "stage" | "assignee" | "taskGroup" | "client";
    id: string;
    label: string;
  } | null>(null);

  const implProjects = useMemo(
    () => projects.filter((p) => Boolean(p.impl_stage)),
    [projects],
  );
  const candidateProjects = useMemo(
    () => projects.filter((p) => !p.impl_stage),
    [projects],
  );

  const projectMap = useMemo(() => {
    const m = new Map<string, ProjectRow>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const grouped = useMemo(() => {
    const map: Record<ImplStage, ProjectRow[]> = {
      kickoff: [], build: [], qa: [], launch: [], done: [],
    };
    for (const p of implProjects) {
      if (p.impl_stage && p.impl_stage in map) {
        map[p.impl_stage as ImplStage].push(p);
      }
    }
    return map;
  }, [implProjects]);

  const tasksByProject = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      const arr = m.get(t.project_id) ?? [];
      arr.push(t);
      m.set(t.project_id, arr);
    }
    return m;
  }, [tasks]);

  // Only surface tasks that live under an implementing project
  const implProjectIds = useMemo(() => new Set(implProjects.map((p) => p.id)), [implProjects]);
  const implTasks = useMemo(
    () => tasks.filter((t) => implProjectIds.has(t.project_id)),
    [tasks, implProjectIds],
  );

  const openTasks = useMemo(() => implTasks.filter((t) => t.status !== "done"), [implTasks]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => (daysUntil(t.due_date) ?? 0) < 0), [openTasks]);
  const weekTasks = useMemo(() => openTasks.filter((t) => {
    const d = daysUntil(t.due_date);
    return d !== null && d >= 0 && d <= 7;
  }), [openTasks]);

  // Active filter computation for the main board
  const displayProjects = useMemo(() => {
    if (!activeFilter) return implProjects;
    if (activeFilter.type === "stage") {
      return implProjects.filter((p) => p.impl_stage === activeFilter.id);
    }
    if (activeFilter.type === "client") {
      return implProjects.filter((p) => p.client_id === activeFilter.id);
    }
    if (activeFilter.type === "assignee") {
      const targetAssignee = activeFilter.id === "unassigned" ? null : activeFilter.id;
      const matchingProjIds = new Set(
        implTasks.filter((t) => t.assignee_id === targetAssignee).map((t) => t.project_id)
      );
      return implProjects.filter((p) => matchingProjIds.has(p.id));
    }
    if (activeFilter.type === "taskGroup") {
      let targetTasks = openTasks;
      if (activeFilter.id === "overdue") targetTasks = overdueTasks;
      else if (activeFilter.id === "week") targetTasks = weekTasks;
      else if (activeFilter.id === "completed") targetTasks = implTasks.filter((t) => t.status === "done");
      const matchingProjIds = new Set(targetTasks.map((t) => t.project_id));
      return implProjects.filter((p) => matchingProjIds.has(p.id));
    }
    return implProjects;
  }, [implProjects, activeFilter, implTasks, openTasks, overdueTasks, weekTasks]);

  const displayTasks = useMemo(() => {
    if (!activeFilter) return implTasks;
    if (activeFilter.type === "stage") {
      return implTasks.filter((t) => {
        const p = projectMap.get(t.project_id);
        return p?.impl_stage === activeFilter.id;
      });
    }
    if (activeFilter.type === "client") {
      return implTasks.filter((t) => {
        const p = projectMap.get(t.project_id);
        return p?.client_id === activeFilter.id;
      });
    }
    if (activeFilter.type === "assignee") {
      const targetAssignee = activeFilter.id === "unassigned" ? null : activeFilter.id;
      return implTasks.filter((t) => t.assignee_id === targetAssignee);
    }
    if (activeFilter.type === "taskGroup") {
      if (activeFilter.id === "overdue") return overdueTasks;
      if (activeFilter.id === "week") return weekTasks;
      if (activeFilter.id === "open") return openTasks;
      if (activeFilter.id === "completed") return implTasks.filter((t) => t.status === "done");
    }
    return implTasks;
  }, [implTasks, activeFilter, projectMap, overdueTasks, weekTasks, openTasks]);

  const displayGrouped = useMemo(() => {
    const map: Record<ImplStage, ProjectRow[]> = {
      kickoff: [], build: [], qa: [], launch: [], done: [],
    };
    for (const p of displayProjects) {
      if (p.impl_stage && p.impl_stage in map) {
        map[p.impl_stage as ImplStage].push(p);
      }
    }
    return map;
  }, [displayProjects]);

  const displayTasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = {
      todo: [], doing: [], blocked: [], done: [],
    };
    for (const t of displayTasks) {
      const st = (t.status as TaskStatus) in map ? (t.status as TaskStatus) : "todo";
      map[st].push(t);
    }
    return map;
  }, [displayTasks]);

  // Stage throughput task breakdown calculations
  const stageThroughput = useMemo(() => {
    return IMPL_STAGES.map((s) => {
      const projs = grouped[s.id];
      const projIds = new Set(projs.map((p) => p.id));
      const sTasks = implTasks.filter((t) => projIds.has(t.project_id));
      const doneCount = sTasks.filter((t) => t.status === "done").length;
      const openCount = sTasks.length - doneCount;
      const completionRate = sTasks.length > 0 ? Math.round((doneCount / sTasks.length) * 100) : 0;

      return {
        stage: s,
        projectCount: projs.length,
        taskCount: sTasks.length,
        openTasks: openCount,
        doneTasks: doneCount,
        completionRate,
      };
    });
  }, [grouped, implTasks]);

  // Group tasks by task status for Task Kanban view
  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = {
      todo: [], doing: [], blocked: [], done: [],
    };
    for (const t of implTasks) {
      const st = (t.status as TaskStatus) in map ? (t.status as TaskStatus) : "todo";
      map[st].push(t);
    }
    return map;
  }, [implTasks]);

  // Dashboard rollups
  const workloadByAssignee = useMemo(() => {
    const m = new Map<string | null, { doing: number; todo: number; blocked: number }>();
    for (const t of openTasks) {
      const key = t.assignee_id;
      const cur = m.get(key) ?? { doing: 0, todo: 0, blocked: 0 };
      if (t.status === "doing") cur.doing++;
      else if (t.status === "blocked") cur.blocked++;
      else if (t.status === "todo") cur.todo++;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        label: id ? memberLabel.get(id) ?? "member" : "Unassigned",
        ...v,
        total: v.doing + v.todo + v.blocked,
      }))
      .sort((a, b) => b.total - a.total);
  }, [openTasks, memberLabel]);

  const byClient = useMemo(() => {
    const m = new Map<string, { projects: number; open: number; overdue: number }>();
    for (const p of implProjects) {
      const cur = m.get(p.client_id) ?? { projects: 0, open: 0, overdue: 0 };
      cur.projects++;
      const ts = tasksByProject.get(p.id) ?? [];
      for (const t of ts) {
        if (t.status !== "done") {
          cur.open++;
          if ((daysUntil(t.due_date) ?? 0) < 0) cur.overdue++;
        }
      }
      m.set(p.client_id, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, name: clientName.get(id) ?? "—", ...v }))
      .sort((a, b) => b.open - a.open || b.projects - a.projects);
  }, [implProjects, tasksByProject, clientName]);

  const setStage = async (projectId: string, stage: ImplStage | null) => {
    const prev = projects.find((p) => p.id === projectId);
    const nextStatus = stage
      ? prev?.status === "work_in_progress" || prev?.status === "delivered" ? prev.status : "work_in_progress"
      : prev?.status === "work_in_progress" ? "lead" : prev?.status ?? "lead";

    qc.setQueryData<ProjectRow[]>(["projects", "implementation"], (old) =>
      (old ?? []).map((p) => (p.id === projectId ? { ...p, impl_stage: stage, status: nextStatus } : p)),
    );

    const updates: { impl_stage: ImplStage | null; status?: string } = { impl_stage: stage };
    if (stage && prev?.status !== "work_in_progress" && prev?.status !== "delivered") {
      updates.status = "work_in_progress";
    } else if (!stage && prev?.status === "work_in_progress") {
      updates.status = "lead";
    }

    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId);
    if (error) {
      toast.error("Could not update stage");
      qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
    qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    if (prev?.client_id) {
      qc.invalidateQueries({ queryKey: ["projects", prev.client_id] });
    }
    toast.success(stage ? `Moved to ${stage}` : `Removed from implementation`);
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    qc.setQueryData<TaskRow[]>(["project_tasks", "all"], (old) =>
      (old ?? []).map((t) => (t.id === taskId ? { ...t, status } : t)),
    );

    const { error } = await supabase
      .from("project_tasks")
      .update({ status })
      .eq("id", taskId);

    if (error) {
      toast.error("Could not update task status");
    } else {
      toast.success(`Task status updated`);
    }
    qc.invalidateQueries({ queryKey: ["project_tasks"] });
  };

  const deleteTask = async (taskId: string) => {
    qc.setQueryData<TaskRow[]>(["project_tasks", "all"], (old) =>
      (old ?? []).filter((t) => t.id !== taskId),
    );
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Failed to delete task");
    } else {
      toast.success("Task deleted");
    }
    qc.invalidateQueries({ queryKey: ["project_tasks"] });
  };

  const handleQuickAddTask = async (projectId: string) => {
    if (!quickTaskTitle.trim()) return;
    const title = quickTaskTitle.trim();
    setQuickTaskTitle("");
    setQuickTaskProjectId(null);

    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title,
        status: "todo",
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create task");
    } else if (data) {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["project_tasks"] });
    }
  };

  const addToImplementation = async (projectId: string) => {
    await setStage(projectId, "kickoff");
  };

  const seedSampleImplementationData = async () => {
    try {
      const { data: existingClients } = await supabase.from("clients").select("id");
      let client1Id = existingClients?.[0]?.id;
      let client2Id = existingClients?.[1]?.id || client1Id;

      if (!client1Id) {
        const { data: c1 } = await supabase
          .from("clients")
          .insert({ name: "Mindweave Labs", email: "contact@mindweave.io", industry: "Software & AI" })
          .select()
          .single();
        client1Id = c1?.id;
      }
      if (!client2Id) {
        const { data: c2 } = await supabase
          .from("clients")
          .insert({ name: "Apex Design Co", email: "hello@apexdesign.com", industry: "Visual & Motion Design" })
          .select()
          .single();
        client2Id = c2?.id || client1Id;
      }

      const sampleProjects = [
        {
          name: "Mind Spark Studio Integration",
          client_id: client1Id,
          status: "work_in_progress",
          impl_stage: "kickoff",
          stage: "active",
          project_type: "WEB",
          opportunity_value: 25000,
          due_date: "2026-08-15",
          notes: "Integrating Prompt Palace Pro with Mindweave canvas",
        },
        {
          name: "Prompt Taxonomy Engine",
          client_id: client2Id,
          status: "work_in_progress",
          impl_stage: "build",
          stage: "active",
          project_type: "Design",
          opportunity_value: 12000,
          due_date: "2026-08-20",
          notes: "Designing custom prompt categorizers and tags",
        },
        {
          name: "AI Knowledge Graph Search",
          client_id: client1Id,
          status: "work_in_progress",
          impl_stage: "qa",
          stage: "active",
          project_type: "AI & ML",
          opportunity_value: 38000,
          due_date: "2026-07-30",
          notes: "Indexing multi-tenant vector databases for real-time query retrieval",
        },
        {
          name: "Omnichannel Automated Workflow",
          client_id: client2Id,
          status: "work_in_progress",
          impl_stage: "launch",
          stage: "active",
          project_type: "Automation",
          opportunity_value: 18500,
          due_date: "2026-08-05",
          notes: "Webhook automation across Slack, HubSpot, and Google Workspace",
        },
      ];

      const { data: insertedProjects, error: pErr } = await supabase
        .from("projects")
        .insert(sampleProjects)
        .select();

      if (pErr) throw pErr;

      if (insertedProjects && insertedProjects.length > 0) {
        const sampleTasks = [];
        const p1 = insertedProjects[0]?.id;
        const p2 = insertedProjects[1]?.id || p1;
        const p3 = insertedProjects[2]?.id || p1;
        const p4 = insertedProjects[3]?.id || p1;
        const p5 = insertedProjects[4]?.id || p1;

        if (p1) {
          sampleTasks.push(
            { project_id: p1, title: "Kickoff call & technical architecture review", status: "done", position: 1, due_date: "2026-07-10" },
            { project_id: p1, title: "Design mind map API request schemas", status: "doing", position: 2, due_date: "2026-07-28" },
            { project_id: p1, title: "Set up staging sandbox environment", status: "todo", position: 3, due_date: "2026-08-02" },
          );
        }
        if (p2) {
          sampleTasks.push(
            { project_id: p2, title: "Draft taxonomy classification hierarchy", status: "doing", position: 1, due_date: "2026-07-29" },
            { project_id: p2, title: "Fix tag collision on prompt clone", status: "blocked", position: 2, due_date: "2026-07-24" },
            { project_id: p2, title: "Build bulk tag editor component", status: "todo", position: 3, due_date: "2026-08-05" },
          );
        }
        if (p3) {
          sampleTasks.push(
            { project_id: p3, title: "Execute vector query recall benchmarking", status: "doing", position: 1, due_date: "2026-07-27" },
            { project_id: p3, title: "Set up automated index refresh cron job", status: "todo", position: 2, due_date: "2026-07-29" },
            { project_id: p3, title: "Ingest sample documentation knowledge base", status: "done", position: 3, due_date: "2026-07-20" },
          );
        }
        if (p4) {
          sampleTasks.push(
            { project_id: p4, title: "Deploy production webhook listener cluster", status: "doing", position: 1, due_date: "2026-07-28" },
            { project_id: p4, title: "Run security audit & penetration test", status: "done", position: 2, due_date: "2026-07-22" },
          );
        }
        if (p5) {
          sampleTasks.push(
            { project_id: p5, title: "SAML 2.0 identity provider integration", status: "done", position: 1, due_date: "2026-07-10" },
            { project_id: p5, title: "User sign-off and production rollout", status: "done", position: 2, due_date: "2026-07-14" },
          );
        }

        await supabase.from("project_tasks").insert(sampleTasks);
      }

      toast.success("Sample implementation projects & tasks created!");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_tasks"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to seed sample data";
      toast.error(msg);
    }
  };

  const toggleProjectTasks = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Modal Data Derivations
  const stageModalProjects = selectedStageModal
    ? implProjects.filter((p) => p.impl_stage === selectedStageModal)
    : [];

  const taskFilterModalTasks =
    selectedTaskFilterModal === "overdue"
      ? overdueTasks
      : selectedTaskFilterModal === "week"
        ? weekTasks
        : selectedTaskFilterModal === "completed"
          ? implTasks.filter((t) => t.status === "done")
          : selectedTaskFilterModal === "open"
            ? openTasks
            : [];

  const assigneeModalTasks = selectedAssigneeModal
    ? implTasks.filter((t) =>
        selectedAssigneeModal.id === null || selectedAssigneeModal.id === "unassigned"
          ? t.assignee_id === null
          : t.assignee_id === selectedAssigneeModal.id,
      )
    : [];

  const clientModalProjects = selectedClientModal
    ? implProjects.filter((p) => p.client_id === selectedClientModal.id)
    : [];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            {implProjects.length} implementing · {implTasks.length} total tasks ({openTasks.length} open
            {overdueTasks.length > 0 && (
              <> · <span className="text-destructive font-bold">{overdueTasks.length} overdue</span></>
            )})
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl font-extrabold leading-[0.92] tracking-tighter text-foreground">
            Implementation.
          </h1>
          <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">
            Track stage throughput and manage delivery tasks across your active projects.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={seedSampleImplementationData}
            className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Seed Demo Data
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <ImplementationSubNav current="board" />
          <div className="h-4 w-px bg-border hidden sm:block" />
          <PipelineTabs current="implementation" />
        </div>
      </div>

      {/* Add existing project & View mode toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg font-semibold">Add project to implementation</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-paper-soft px-2 py-0.5 rounded-full border border-border">
              {candidateProjects.length} available
            </span>
          </div>
          {candidateProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All active projects are already on the board. Create one from{" "}
              <Link to="/pipeline" className="underline">Pipeline</Link>.
            </p>
          ) : (
            <div className="flex items-center gap-2 max-w-md">
              <Select
                key={selectKey}
                onValueChange={(v) => {
                  if (v) {
                    addToImplementation(v);
                    setSelectKey((k) => k + 1);
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Pick a project to start implementing…" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {candidateProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {clientName.get(p.client_id) ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-paper-soft rounded-lg border border-border self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("stage")}
            className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              viewMode === "stage"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KanbanSquare className="h-3.5 w-3.5" /> Stage Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("task")}
            className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              viewMode === "task"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Task Kanban
          </button>
        </div>
      </div>

      {/* Dashboard Rollups */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Layers className="h-4 w-4" />} label="Stage & Task Throughput">
          <div className="mt-3 space-y-2">
            {stageThroughput.map((st) => (
              <button
                key={st.stage.id}
                type="button"
                onClick={() => {
                  setSelectedStageModal(st.stage.id);
                  setActiveFilter({ type: "stage", id: st.stage.id, label: `Stage: ${st.stage.label}` });
                }}
                className="w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-md hover:bg-paper-soft transition cursor-pointer group"
                title={`Click to filter board and view ${st.stage.label} details`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground group-hover:text-primary transition flex items-center gap-1">
                    {st.stage.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground text-[11px]">
                    {st.projectCount} proj · {st.taskCount} tasks ({st.completionRate}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-paper-soft rounded-full overflow-hidden border border-border/50">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${st.completionRate}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </StatCard>

        <StatCard icon={<Hourglass className="h-4 w-4" />} label="Upcoming & Overdue Tasks">
          <div className="mt-3 space-y-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setSelectedTaskFilterModal("overdue");
                setActiveFilter({ type: "taskGroup", id: "overdue", label: "Overdue Tasks" });
              }}
              className="w-full text-left p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group flex items-center justify-between"
              title="Click to view all overdue tasks"
            >
              <span className="text-destructive font-medium group-hover:underline flex items-center gap-1">
                Overdue tasks
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="font-mono text-xs tabular-nums text-destructive font-bold">{overdueTasks.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTaskFilterModal("week");
                setActiveFilter({ type: "taskGroup", id: "week", label: "Tasks Due This Week" });
              }}
              className="w-full text-left p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group flex items-center justify-between"
              title="Click to view tasks due this week"
            >
              <span className="text-muted-foreground group-hover:text-foreground group-hover:underline transition flex items-center gap-1">
                Due this week
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="font-mono text-xs tabular-nums text-foreground">{weekTasks.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTaskFilterModal("open");
                setActiveFilter({ type: "taskGroup", id: "open", label: "All Open Tasks" });
              }}
              className="w-full text-left p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group flex items-center justify-between"
              title="Click to view all open tasks"
            >
              <span className="text-muted-foreground group-hover:text-foreground group-hover:underline transition flex items-center gap-1">
                Open total
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="font-mono text-xs tabular-nums text-foreground">{openTasks.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTaskFilterModal("completed");
                setActiveFilter({ type: "taskGroup", id: "completed", label: "Completed Tasks" });
              }}
              className="w-full text-left p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group flex items-center justify-between"
              title="Click to view completed tasks"
            >
              <span className="text-muted-foreground/70 group-hover:text-foreground group-hover:underline transition flex items-center gap-1">
                Completed tasks
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{implTasks.length - openTasks.length}</span>
            </button>
          </div>
        </StatCard>

        <StatCard icon={<Users className="h-4 w-4" />} label="Workload by Assignee">
          {workloadByAssignee.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No open tasks yet.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm max-h-[9rem] overflow-y-auto pr-1">
              {workloadByAssignee.slice(0, 8).map((w) => (
                <button
                  key={w.id ?? "unassigned"}
                  type="button"
                  onClick={() => {
                    setSelectedAssigneeModal({ id: w.id, label: w.label });
                    setActiveFilter({ type: "assignee", id: w.id ?? "unassigned", label: `Assignee: ${w.label}` });
                  }}
                  className="w-full text-left flex items-center justify-between gap-2 p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group"
                  title={`Click to filter board for ${w.label}`}
                >
                  <span className="truncate text-muted-foreground group-hover:text-foreground group-hover:underline transition flex items-center gap-1">
                    {w.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums flex items-center gap-1 shrink-0">
                    {w.doing > 0 && <Pill tone="active">{w.doing} doing</Pill>}
                    {w.blocked > 0 && <Pill tone="danger">{w.blocked} blk</Pill>}
                    {w.todo > 0 && <Pill>{w.todo} todo</Pill>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </StatCard>

        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Per-Client Rollup">
          {byClient.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No implementing projects yet.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm max-h-[9rem] overflow-y-auto pr-1">
              {byClient.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClientModal({ id: c.id, name: c.name });
                    setActiveFilter({ type: "client", id: c.id, label: `Client: ${c.name}` });
                  }}
                  className="w-full text-left flex items-center justify-between gap-2 p-1.5 -mx-1.5 rounded hover:bg-paper-soft transition cursor-pointer group"
                  title={`Click to filter board for ${c.name}`}
                >
                  <span className="truncate group-hover:text-primary group-hover:underline transition font-medium flex items-center gap-1">
                    {c.name}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground flex items-center gap-1.5 shrink-0">
                    {c.projects}p · {c.open} open
                    {c.overdue > 0 && <Pill tone="danger">{c.overdue}</Pill>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </StatCard>
      </div>

      {/* Active Filter Banner */}
      {activeFilter && (
        <div className="mb-6 p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between gap-3 animate-in fade-in-50">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Filtered by:
            </span>
            <span className="text-sm font-semibold text-foreground">
              {activeFilter.label}
            </span>
            <span className="font-mono text-xs bg-background border border-border px-2.5 py-0.5 rounded-full text-muted-foreground">
              {displayProjects.length} matching projects · {displayTasks.length} tasks
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveFilter(null)}
            className="h-7 text-xs font-mono uppercase tracking-wider hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 shrink-0"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear Filter
          </Button>
        </div>
      )}

      {/* Main Board View */}
      {isLoadingProjects ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Loading implementation data…</div>
      ) : viewMode === "stage" ? (
        /* Stage Kanban View with Embedded Tasks */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {IMPL_STAGES.map((stage) => {
            const items = displayGrouped[stage.id];
            const isOver = overStage === stage.id;
            const stageTasksCount = items.reduce(
              (sum, p) => sum + (tasksByProject.get(p.id)?.length ?? 0),
              0,
            );

            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  if (dragId) setStage(dragId, stage.id);
                  setDragId(null);
                }}
                className={`rounded-lg border bg-card flex flex-col min-h-[350px] transition ${
                  isOver ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {stage.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground/70">{stage.hint}</div>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground bg-paper-soft border border-border/60 rounded-full px-2 py-0.5">
                    {items.length} p · {stageTasksCount} t
                  </span>
                </div>

                <div className="p-2 flex-1 flex flex-col gap-3">
                  {items.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 px-2 py-8 text-center border border-dashed border-border rounded-md">
                      Drop project here
                    </div>
                  ) : (
                    items.map((p) => {
                      const ts = tasksByProject.get(p.id) ?? [];
                      const open = ts.filter((t) => t.status !== "done").length;
                      const done = ts.length - open;
                      const overdue = ts.filter(
                        (t) => t.status !== "done" && (daysUntil(t.due_date) ?? 0) < 0,
                      ).length;
                      const projDue = daysUntil(p.due_date);
                      const projOverdue = projDue !== null && projDue < 0;
                      const isExpanded = expandedProjects[p.id] ?? true;

                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => { setDragId(null); setOverStage(null); }}
                          className="group rounded-md border border-border bg-paper hover:border-foreground/50 transition p-3 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.navigate({
                                  to: "/implementation/$projectId",
                                  params: { projectId: p.id },
                                })
                              }
                              className="text-left flex-1"
                            >
                              <div className="font-display font-semibold text-sm leading-snug group-hover:underline underline-offset-4">
                                {p.name}
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate mt-0.5">
                                {clientName.get(p.client_id) ?? "—"}
                              </div>
                            </button>
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                              <ProjectClientPopover
                                projectId={p.id}
                                currentClientId={p.client_id}
                                trigger={
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground p-1"
                                    title="Reassign client"
                                    aria-label="Reassign client"
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </button>
                                }
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStage(p.id, null);
                                }}
                                title="Remove from implementation"
                                aria-label="Remove from implementation"
                                className="text-muted-foreground hover:text-destructive p-1"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <Pill tone={open > 0 ? "active" : "muted"}>{open} open</Pill>
                            {done > 0 && <Pill tone="muted">{done} done</Pill>}
                            {overdue > 0 && <Pill tone="danger">{overdue} overdue</Pill>}
                            {p.due_date && (
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                                  projOverdue
                                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                                    : "border-border bg-paper-soft text-muted-foreground"
                                }`}
                              >
                                <CalendarClock className="h-2.5 w-2.5" />
                                {formatShortDate(p.due_date)}
                              </span>
                            )}
                          </div>

                          {/* Task List Header & Toggle */}
                          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => toggleProjectTasks(p.id)}
                              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              Tasks ({ts.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickTaskProjectId(p.id);
                                setQuickTaskTitle("");
                              }}
                              className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add task
                            </button>
                          </div>

                          {/* Embedded Task List */}
                          {isExpanded && (
                            <div className="mt-2 space-y-1.5">
                              {ts.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic py-1">No tasks created yet.</p>
                              ) : (
                                ts.map((t) => {
                                  const isDone = t.status === "done";
                                  const isBlocked = t.status === "blocked";
                                  const isDoing = t.status === "doing";

                                  return (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between gap-1.5 text-xs p-1.5 rounded bg-paper-soft border border-border/50 hover:border-border transition"
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateTaskStatus(
                                            t.id,
                                            isDone ? "todo" : "done",
                                          )
                                        }
                                        className="text-left flex items-start gap-1.5 flex-1 min-w-0"
                                      >
                                        <CheckCircle2
                                          className={`h-3.5 w-3.5 shrink-0 mt-0.5 transition ${
                                            isDone
                                              ? "text-emerald-500 fill-emerald-500/20"
                                              : "text-muted-foreground/50 hover:text-foreground"
                                          }`}
                                        />
                                        <span
                                          className={`truncate text-[12px] leading-tight ${
                                            isDone ? "line-through text-muted-foreground/70" : "text-foreground"
                                          }`}
                                        >
                                          {t.title}
                                        </span>
                                      </button>
                                      <span className="shrink-0 flex items-center gap-1">
                                        {isDoing && <Pill tone="active">Doing</Pill>}
                                        {isBlocked && <Pill tone="danger">Blocked</Pill>}
                                        {t.assignee_id && (
                                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground bg-card px-1 rounded border border-border">
                                            {memberLabel.get(t.assignee_id)}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })
                              )}

                              {/* Quick Add Form */}
                              {quickTaskProjectId === p.id && (
                                <div className="mt-2 flex items-center gap-1">
                                  <Input
                                    value={quickTaskTitle}
                                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                                    placeholder="New task title…"
                                    className="h-7 text-xs flex-1"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleQuickAddTask(p.id);
                                      if (e.key === "Escape") setQuickTaskProjectId(null);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleQuickAddTask(p.id)}
                                  >
                                    Add
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-1 text-xs"
                                    onClick={() => setQuickTaskProjectId(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Task Status Kanban View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_STATUSES.map((statusCol) => {
            const statusTasks = displayTasksByStatus[statusCol.id];
            const isOver = overTaskStatus === statusCol.id;

            return (
              <div
                key={statusCol.id}
                onDragOver={(e) => { e.preventDefault(); setOverTaskStatus(statusCol.id); }}
                onDragLeave={() => setOverTaskStatus((s) => (s === statusCol.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverTaskStatus(null);
                  if (dragTaskId) updateTaskStatus(dragTaskId, statusCol.id);
                  setDragTaskId(null);
                }}
                className={`rounded-lg border bg-card flex flex-col min-h-[400px] transition ${
                  isOver ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {statusCol.label}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground bg-paper-soft border border-border/60 rounded-full px-2 py-0.5">
                    {statusTasks.length} tasks
                  </span>
                </div>

                <div className="p-2 flex-1 flex flex-col gap-2.5">
                  {statusTasks.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 px-2 py-8 text-center border border-dashed border-border rounded-md">
                      Drop task here
                    </div>
                  ) : (
                    statusTasks.map((t) => {
                      const parentProj = projectMap.get(t.project_id);
                      const isOverdue = (daysUntil(t.due_date) ?? 0) < 0 && t.status !== "done";

                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragTaskId(t.id)}
                          onDragEnd={() => { setDragTaskId(null); setOverTaskStatus(null); }}
                          className="rounded-md border border-border bg-paper hover:border-foreground/50 transition p-3 shadow-2xs space-y-2 cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm leading-snug text-foreground">
                              {t.title}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                            {parentProj && (
                              <Link
                                to="/implementation/$projectId"
                                params={{ projectId: parentProj.id }}
                                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:underline truncate max-w-[150px]"
                              >
                                {parentProj.name}
                              </Link>
                            )}

                            <div className="flex items-center gap-1 ml-auto">
                              {t.assignee_id && (
                                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground bg-paper-soft px-1.5 py-0.5 rounded border border-border">
                                  {memberLabel.get(t.assignee_id)}
                                </span>
                              )}
                              {t.due_date && (
                                <span
                                  className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    isOverdue
                                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                                      : "border-border text-muted-foreground"
                                  }`}
                                >
                                  {formatShortDate(t.due_date)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                            <Select
                              value={t.status}
                              onValueChange={(val) => updateTaskStatus(t.id, val as TaskStatus)}
                            >
                              <SelectTrigger className="h-6 text-[10px] font-mono uppercase tracking-widest w-[110px] px-2 py-0 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TASK_STATUSES.map((st) => (
                                  <SelectItem key={st.id} value={st.id} className="text-xs">
                                    {st.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1.5 ml-auto">
                              {parentProj?.impl_stage && (
                                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground bg-paper-soft px-1.5 py-0.5 rounded border border-border/60">
                                  {parentProj.impl_stage}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-destructive"
                                title="Delete task"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Stage Detail Modal */}
      <Dialog open={selectedStageModal !== null} onOpenChange={(o) => !o && setSelectedStageModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Stage: {IMPL_STAGES.find((s) => s.id === selectedStageModal)?.label} Throughput
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {IMPL_STAGES.find((s) => s.id === selectedStageModal)?.hint}
            </p>
            {stageModalProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No projects currently in this stage.
              </div>
            ) : (
              <div className="space-y-3">
                {stageModalProjects.map((p) => {
                  const pTasks = tasksByProject.get(p.id) ?? [];
                  const doneCount = pTasks.filter((t) => t.status === "done").length;
                  const pct = pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0;
                  return (
                    <div key={p.id} className="border border-border rounded-lg p-3 bg-paper space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Link
                            to="/implementation/$projectId"
                            params={{ projectId: p.id }}
                            className="font-display font-semibold text-base hover:underline text-foreground"
                          >
                            {p.name}
                          </Link>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            {clientName.get(p.client_id) ?? "—"}
                          </div>
                        </div>
                        <Link
                          to="/implementation/$projectId"
                          params={{ projectId: p.id }}
                        >
                          <Button size="sm" variant="outline" className="h-7 text-xs font-mono uppercase tracking-wider">
                            Open Project <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress ({doneCount}/{pTasks.length} tasks)</span>
                        <span className="font-mono font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-paper-soft rounded-full overflow-hidden border border-border/50">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      {pTasks.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                          {pTasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between text-xs py-0.5">
                              <span className={t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}>
                                {t.title}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                <Pill tone={t.status === "done" ? "muted" : t.status === "doing" ? "active" : t.status === "blocked" ? "danger" : undefined}>
                                  {t.status}
                                </Pill>
                                {t.assignee_id && (
                                  <span className="text-muted-foreground bg-paper-soft px-1.5 py-0.5 rounded border border-border">
                                    {memberLabel.get(t.assignee_id)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedStageModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Task Filter Modal */}
      <Dialog open={selectedTaskFilterModal !== null} onOpenChange={(o) => !o && setSelectedTaskFilterModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Hourglass className="h-5 w-5 text-primary" />
              {selectedTaskFilterModal === "overdue"
                ? "Overdue Tasks"
                : selectedTaskFilterModal === "week"
                  ? "Tasks Due This Week"
                  : selectedTaskFilterModal === "open"
                    ? "All Open Tasks"
                    : "Completed Tasks"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {taskFilterModalTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No tasks match this filter.
              </div>
            ) : (
              taskFilterModalTasks.map((t) => {
                const proj = projectMap.get(t.project_id);
                const isOverdue = (daysUntil(t.due_date) ?? 0) < 0 && t.status !== "done";

                return (
                  <div key={t.id} className="border border-border rounded-lg p-3 bg-paper flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateTaskStatus(t.id, t.status === "done" ? "todo" : "done")}
                          className="shrink-0"
                        >
                          <CheckCircle2
                            className={`h-4 w-4 ${t.status === "done" ? "text-emerald-500 fill-emerald-500/20" : "text-muted-foreground/50 hover:text-foreground"}`}
                          />
                        </button>
                        <span className={`font-medium text-sm ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        {proj && (
                          <Link
                            to="/implementation/$projectId"
                            params={{ projectId: proj.id }}
                            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:underline"
                          >
                            {proj.name}
                          </Link>
                        )}
                        {t.due_date && (
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${isOverdue ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground"}`}>
                            Due: {formatShortDate(t.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <Pill tone={t.status === "done" ? "muted" : t.status === "doing" ? "active" : t.status === "blocked" ? "danger" : undefined}>
                        {t.status}
                      </Pill>
                      {t.assignee_id && (
                        <span className="text-muted-foreground bg-paper-soft px-1.5 py-0.5 rounded border border-border">
                          {memberLabel.get(t.assignee_id)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedTaskFilterModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Assignee Workload Modal */}
      <Dialog open={selectedAssigneeModal !== null} onOpenChange={(o) => !o && setSelectedAssigneeModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Workload Allocation: {selectedAssigneeModal?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {assigneeModalTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No tasks currently assigned to {selectedAssigneeModal?.label}.
              </div>
            ) : (
              assigneeModalTasks.map((t) => {
                const proj = projectMap.get(t.project_id);
                return (
                  <div key={t.id} className="border border-border rounded-lg p-3 bg-paper flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-sm text-foreground">{t.title}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {proj && (
                          <Link
                            to="/implementation/$projectId"
                            params={{ projectId: proj.id }}
                            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:underline"
                          >
                            Project: {proj.name}
                          </Link>
                        )}
                        {t.due_date && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Due: {formatShortDate(t.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Pill tone={t.status === "done" ? "muted" : t.status === "doing" ? "active" : t.status === "blocked" ? "danger" : undefined}>
                      {t.status}
                    </Pill>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedAssigneeModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Client Implementation Rollup Modal */}
      <Dialog open={selectedClientModal !== null} onOpenChange={(o) => !o && setSelectedClientModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Client Projects: {selectedClientModal?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {clientModalProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No active implementation projects for this client.
              </div>
            ) : (
              clientModalProjects.map((p) => {
                const pTasks = tasksByProject.get(p.id) ?? [];
                const doneCount = pTasks.filter((t) => t.status === "done").length;
                return (
                  <div key={p.id} className="border border-border rounded-lg p-4 bg-paper space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Link
                          to="/implementation/$projectId"
                          params={{ projectId: p.id }}
                          className="font-display font-semibold text-base hover:underline text-foreground"
                        >
                          {p.name}
                        </Link>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Stage: {p.impl_stage ?? "Unassigned"}
                        </div>
                      </div>
                      <Link to="/implementation/$projectId" params={{ projectId: p.id }}>
                        <Button size="sm" variant="outline" className="h-7 text-xs font-mono uppercase tracking-wider">
                          Open <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tasks: {doneCount} of {pTasks.length} completed
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedClientModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bento-card p-5">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <div className="h-7 w-7 icon-badge-dark shrink-0">
          <div className="text-white">{icon}</div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: "danger" | "muted" }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={tone === "muted" ? "text-muted-foreground/70" : "text-muted-foreground font-medium"}>{label}</span>
      <span
        className={`font-mono tabular-nums font-bold ${
          tone === "danger" && value > 0 ? "text-red-600 font-bold" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "active" | "danger" | "muted";
}) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700 font-bold"
      : tone === "active"
        ? "border-neutral-900 bg-black text-white font-bold"
        : tone === "muted"
          ? "border-border text-muted-foreground"
          : "border-border bg-secondary text-foreground font-semibold";
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${cls}`}
    >
      {children}
    </span>
  );
}
