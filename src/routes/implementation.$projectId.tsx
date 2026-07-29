import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  IMPL_STAGES,
  TASK_STATUSES,
  type ImplStage,
  type TaskStatus,
} from "@/lib/implementation";
import { daysUntil, formatShortDate, formatZAR } from "@/lib/pipeline";
import { listTeamDirectory } from "@/lib/team-directory.functions";
import { getSavedQuoteRecord } from "@/lib/quote-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectClientPopover } from "@/components/ProjectClientPopover";
import { ProjectQuoteDialog } from "@/components/ProjectQuoteDialog";
import { FormErrorAlert } from "@/components/FormErrorAlert";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarClock,
  AlertTriangle,
  User,
  Users,
  Calculator,
  Edit3,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/implementation/$projectId")({
  component: ProjectTasksPage,
});

type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  status: string;
  impl_stage: string | null;
  due_date: string | null;
  notes: string | null;
  opportunity_value: number | null;
  project_type: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  created_by: string | null;
};

type ClientLite = { id: string; name: string };
type Member = { id: string; email: string };

function ProjectTasksPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const savedQuote = useMemo(() => getSavedQuoteRecord(projectId), [projectId, quoteOpen]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,client_id,status,impl_stage,due_date,notes,opportunity_value,project_type")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data as ProjectRow;
    },
  });

  const { data: client } = useQuery<ClientLite | null>({
    queryKey: ["client", project?.client_id],
    enabled: !!project?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("id", project!.client_id)
        .single();
      if (error) throw error;
      return data as ClientLite;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const teamFn = useServerFn(listTeamDirectory);
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team", "directory"],
    queryFn: () => teamFn(),
  });
  const memberLabel = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.email.split("@")[0]));
    return m;
  }, [members]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = { todo: [], doing: [], blocked: [], done: [] };
    for (const t of tasks) {
      if (t.status in map) map[t.status as TaskStatus].push(t);
    }
    return map;
  }, [tasks]);

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === status) return;
    qc.setQueryData<TaskRow[]>(["project_tasks", projectId], (old) =>
      (old ?? []).map((x) => (x.id === taskId ? { ...x, status } : x)),
    );
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    const { error } = await supabase
      .from("project_tasks")
      .update({ status })
      .eq("id", taskId);
    if (error) {
      toast.error("Could not move task");
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    }
  };

  const setImplStage = async (stage: ImplStage | null) => {
    if (!project) return;
    const updates: { impl_stage: ImplStage | null; status?: string } = { impl_stage: stage };
    if (stage && project.status !== "work_in_progress" && project.status !== "delivered") {
      updates.status = "work_in_progress";
    } else if (!stage && project.status === "work_in_progress") {
      updates.status = "lead";
    }

    qc.setQueryData(["project", projectId], {
      ...project,
      impl_stage: stage,
      status: updates.status ?? project.status,
    });

    const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
    if (error) {
      toast.error("Could not change stage");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
    qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    if (project.client_id) {
      qc.invalidateQueries({ queryKey: ["projects", project.client_id] });
    }
    toast.success(stage ? `Moved to ${stage}` : `Removed from implementation`);
  };

  const removeTask = async (taskId: string) => {
    qc.setQueryData<TaskRow[]>(["project_tasks", projectId], (old) =>
      (old ?? []).filter((x) => x.id !== taskId),
    );
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Could not delete");
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    }
  };

  const editingTask = editId ? tasks.find((t) => t.id === editId) ?? null : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.navigate({ to: "/implementation" })}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to board
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            {client ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                hash="projects"
                className="hover:underline"
              >
                {client.name}
              </Link>
            ) : (
              "—"
            )}
            {project && client && (
              <ProjectClientPopover
                projectId={project.id}
                currentClientId={project.client_id}
                trigger={
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition"
                    title="Reassign client"
                    aria-label="Reassign client"
                  >
                    <Users className="h-3 w-3" />
                  </button>
                }
              />
            )}
            <span className="text-muted-foreground/60">·</span>
            {tasks.length} tasks
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold leading-[0.95] tracking-tight truncate">
            {project?.name ?? "…"}
          </h1>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Stage
            </span>
            <Select
              value={project?.impl_stage ?? "none"}
              onValueChange={(v) => setImplStage(v === "none" ? null : (v as ImplStage))}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground">
                  Not in implementation
                </SelectItem>
                {IMPL_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setQuoteOpen(true)}
            className="gap-1.5"
          >
            <Calculator className="h-4 w-4 text-primary" /> Estimate Quote
          </Button>
          {project?.impl_stage ? (
            <Button
              variant="ghost"
              onClick={async () => {
                if (!project) return;
                await setImplStage(null);
                router.navigate({ to: "/implementation" });
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              Remove from implementation
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setImplStage("kickoff")}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add to implementation
            </Button>
          )}
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New task
          </Button>
        </div>
      </div>

      {/* Quote Summary Overview Card */}
      {savedQuote && (
        <div className="mb-8 rounded-xl border border-primary/20 bg-paper p-5 shadow-xs transition hover:border-primary/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-foreground">Project Quote Estimate</h2>
                  {savedQuote.isCustomized ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Amended Quote
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      AI Generated
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">
                    Updated {formatDistanceToNow(new Date(savedQuote.savedAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {savedQuote.result.lineItems.length} Deliverable Line Items · {savedQuote.result.complexity} Complexity
                </p>
              </div>
            </div>

            <Button
              onClick={() => setQuoteOpen(true)}
              className="gap-2 shrink-0 self-start md:self-auto"
            >
              <Edit3 className="h-4 w-4" /> Revisit & Edit Quote
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">Recommended Quote</span>
              <span className="text-lg font-bold font-display text-primary">
                {savedQuote.result.currency === "ZAR"
                  ? formatZAR(savedQuote.result.recommendedQuote)
                  : `${savedQuote.result.currency} ${savedQuote.result.recommendedQuote.toLocaleString()}`}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">Effort Hours</span>
              <span className="text-sm font-semibold font-mono text-foreground">
                {savedQuote.result.recommendedHours} Hours
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Blended ~{savedQuote.result.currency} {savedQuote.result.hourlyRate}/hr
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">Estimate Range</span>
              <span className="text-sm font-semibold font-mono text-foreground">
                {savedQuote.result.currency === "ZAR"
                  ? `${formatZAR(savedQuote.result.minQuote)} – ${formatZAR(savedQuote.result.maxQuote)}`
                  : `${savedQuote.result.minQuote.toLocaleString()} – ${savedQuote.result.maxQuote.toLocaleString()}`}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">Target Timeline</span>
              <span className="text-sm font-semibold text-foreground">
                {savedQuote.result.suggestedTimeline}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((col) => {
          const items = grouped[col.id];
          const isOver = overStatus === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setOverStatus(col.id); }}
              onDragLeave={() => setOverStatus((s) => (s === col.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStatus(null);
                if (dragId) moveTask(dragId, col.id);
                setDragId(null);
              }}
              className={`rounded-lg border bg-card flex flex-col min-h-[300px] transition ${
                isOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {col.label}
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground bg-paper-soft rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>
              <div className="p-2 flex-1 flex flex-col gap-2">
                {items.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 px-2 py-6 text-center border border-dashed border-border rounded-md">
                    Drop here
                  </div>
                ) : (
                  items.map((t) => {
                    const d = daysUntil(t.due_date);
                    const overdue = t.status !== "done" && d !== null && d < 0;
                    const canDelete = isAdmin || t.created_by === user?.id;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                        className="group rounded-md border border-border bg-paper hover:border-foreground transition p-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => setEditId(t.id)}
                          className="text-left w-full"
                        >
                          <div className="text-sm leading-snug group-hover:underline underline-offset-4">
                            {t.title}
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {t.assignee_id && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-border bg-paper-soft rounded-full px-2 py-0.5 text-muted-foreground">
                              <User className="h-2.5 w-2.5" />
                              {memberLabel.get(t.assignee_id) ?? "member"}
                            </span>
                          )}
                          {t.due_date && (
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                                overdue
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : "border-border bg-paper-soft text-muted-foreground"
                              }`}
                            >
                              <CalendarClock className="h-2.5 w-2.5" />
                              {formatShortDate(t.due_date)}
                              {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                            </span>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
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

      <TaskDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        members={members}
      />
      <TaskDialog
        open={!!editingTask}
        onOpenChange={(v) => !v && setEditId(null)}
        projectId={projectId}
        members={members}
        task={editingTask}
      />
      {project && (
        <ProjectQuoteDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          projectId={project.id}
          projectName={project.name}
          projectType={project.project_type}
          currentNotes={project.notes}
          currentValue={project.opportunity_value}
          onQuoteApplied={(newValue, newNotes) => {
            qc.setQueryData(["project", projectId], {
              ...project,
              opportunity_value: newValue,
              notes: newNotes,
            });
            qc.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  projectId,
  members,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  members: Member[];
  task?: TaskRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? "todo");
  const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? "unassigned");
  const [dueDate, setDueDate] = useState<string>(task?.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Reset form on open/task change
  useMemo(() => {
    if (open) {
      setTaskError(null);
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus((task?.status as TaskStatus) ?? "todo");
      setAssignee(task?.assignee_id ?? "unassigned");
      setDueDate(task?.due_date ?? "");
    }
  }, [open, task]);

  const save = async () => {
    setTaskError(null);
    if (!title.trim()) {
      const msg = "Task title is required.";
      setTaskError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      assignee_id: assignee === "unassigned" ? null : assignee,
      due_date: dueDate || null,
    };
    if (isEdit && task) {
      const { error } = await supabase.from("project_tasks").update(payload).eq("id", task.id);
      if (error) {
        setTaskError(error.message);
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("project_tasks").insert({
        ...payload,
        project_id: projectId,
        created_by: user?.id ?? null,
      });
      if (error) {
        setTaskError(error.message);
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    toast.success(isEdit ? "Task updated" : "Task added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormErrorAlert error={taskError} onDismiss={() => setTaskError(null)} title={isEdit ? "Failed to update task" : "Failed to add task"} />
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-due">Due</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{isEdit ? "Save" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
