import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  FolderKanban,
  Building2,
  Calendar,
  DollarSign,
  Filter,
  Layers,
  ArrowRight,
  Archive,
  ArchiveRestore,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  X,
  Sparkles,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectValuePopover } from "@/components/ProjectValuePopover";
import { ProjectDatesPopover } from "@/components/ProjectDatesPopover";
import { ProjectClientPopover } from "@/components/ProjectClientPopover";
import { ProjectNamePopover } from "@/components/ProjectNamePopover";
import { ProjectNotesDialog } from "@/components/ProjectNotesDialog";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { BespokeBadge, PipelineIcon, ImplementationIcon, RecurringIcon } from "@/components/ui/bespoke-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Mind Spark — Projects Directory" },
      {
        name: "description",
        content: "Master list and unified directory of all client projects across Pipeline, Implementation, and Active Deliverables.",
      },
    ],
  }),
  component: ProjectsDirectoryPage,
});

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  impl_stage: string | null;
  notes: string | null;
  client_id: string;
  updated_at: string;
  created_at?: string;
  repeat_interval: string | null;
  archived_at: string | null;
  start_date: string | null;
  due_date: string | null;
  delivered_at: string | null;
  next_occurrence_date: string | null;
  opportunity_value: number | null;
  project_type: string | null;
};

type ClientLite = {
  id: string;
  name: string;
  industry?: string | null;
};

const PIPELINE_STATUSES = [
  { id: "lead", label: "Lead", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  { id: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200" },
  { id: "pitched", label: "Pitched", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200" },
  { id: "quote_sent", label: "Quote Sent", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" },
  { id: "work_in_progress", label: "In Progress (Won)", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" },
  { id: "delivered", label: "Delivered", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200" },
  { id: "lost", label: "Lost", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200" },
];

const IMPL_STAGES = [
  { id: "not_started", label: "Not Started" },
  { id: "kickoff", label: "Kickoff" },
  { id: "design", label: "Design / Strategy" },
  { id: "development", label: "Development" },
  { id: "testing", label: "Testing / QA" },
  { id: "review", label: "Client Review" },
  { id: "completed", label: "Completed" },
  { id: "done", label: "Done" },
];

const PROJECT_TYPES = [
  { id: "one_off", label: "One-Off Project" },
  { id: "recurring", label: "Recurring" },
  { id: "retainer", label: "Monthly Retainer" },
  { id: "bespoke", label: "Bespoke System" },
  { id: "audit", label: "Audit & Consulting" },
  { id: "implementation", label: "Implementation" },
];

function formatZAR(val: number | null) {
  if (val == null) return "R 0";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(val);
}

function ProjectsDirectoryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [implStageFilter, setImplStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewTab, setViewTab] = useState<"active" | "archived">("active");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");

  // Create Project Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("work_in_progress");
  const [newImplStage, setNewImplStage] = useState("kickoff");
  const [newType, setNewType] = useState("bespoke");
  const [newValue, setNewValue] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRepeatInterval, setNewRepeatInterval] = useState("none");
  const [newNotes, setNewNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Queries
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,impl_stage,notes,client_id,updated_at,created_at,repeat_interval,archived_at,start_date,due_date,delivered_at,next_occurrence_date,opportunity_value,project_type")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,industry").order("name");
      if (error) throw error;
      return data as ClientLite[];
    },
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  // Derived Project Groups
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived_at), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => !!p.archived_at), [projects]);

  const currentList = viewTab === "active" ? activeProjects : archivedProjects;

  // Filtered List
  const filteredProjects = useMemo(() => {
    return currentList.filter((p) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = clientMap.get(p.client_id)?.toLowerCase() || "";
        const matchName = p.name.toLowerCase().includes(q);
        const matchClient = clientName.includes(q);
        const matchNotes = p.notes?.toLowerCase().includes(q) || false;
        if (!matchName && !matchClient && !matchNotes) return false;
      }

      // Client filter
      if (selectedClientId !== "all" && p.client_id !== selectedClientId) return false;

      // Status filter
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      // Impl stage filter
      if (implStageFilter !== "all") {
        if (implStageFilter === "none" && p.impl_stage) return false;
        if (implStageFilter !== "none" && p.impl_stage !== implStageFilter) return false;
      }

      // Type filter
      if (typeFilter !== "all" && p.project_type !== typeFilter) return false;

      return true;
    });
  }, [currentList, searchQuery, selectedClientId, statusFilter, implStageFilter, typeFilter, clientMap]);

  // KPI Metrics
  const stats = useMemo(() => {
    const totalActiveValue = activeProjects.reduce((sum, p) => sum + (p.opportunity_value || 0), 0);
    const inProgressCount = activeProjects.filter(
      (p) => p.status === "work_in_progress" || (p.impl_stage && p.impl_stage !== "completed" && p.impl_stage !== "done")
    ).length;
    const deliveredCount = activeProjects.filter((p) => p.status === "delivered").length;
    return {
      totalActive: activeProjects.length,
      totalValue: totalActiveValue,
      inProgressCount,
      deliveredCount,
      archivedCount: archivedProjects.length,
    };
  }, [activeProjects, archivedProjects]);

  // Quick updates
  const handleUpdateStatus = async (projectId: string, newStatusVal: string) => {
    const isDelivered = newStatusVal === "delivered";
    const deliveredAt = isDelivered ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatusVal, delivered_at: deliveredAt })
      .eq("id", projectId);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }
    toast.success("Project pipeline status updated");
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleUpdateImplStage = async (projectId: string, newStageVal: string | null) => {
    const { error } = await supabase
      .from("projects")
      .update({ impl_stage: newStageVal })
      .eq("id", projectId);

    if (error) {
      toast.error(`Failed to update implementation stage: ${error.message}`);
      return;
    }
    toast.success("Implementation stage updated");
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleToggleArchive = async (p: ProjectRow) => {
    const isArchiving = !p.archived_at;
    const archived_at = isArchiving ? new Date().toISOString() : null;
    const { error } = await supabase.from("projects").update({ archived_at }).eq("id", p.id);

    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(isArchiving ? `Archived "${p.name}"` : `Restored "${p.name}"`);
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  // Create Project handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!newName.trim()) {
      toast.error("Project name is required");
      return;
    }

    setIsCreating(true);
    const parsedVal = newValue.trim() ? Number(newValue.replace(/[^\d.-]/g, "")) : null;
    const isDelivered = newStatus === "delivered";
    const deliveredStamp = isDelivered ? new Date().toISOString() : null;

    const { error } = await supabase.from("projects").insert({
      client_id: newClientId,
      name: newName.trim(),
      status: newStatus,
      impl_stage: newImplStage || null,
      project_type: newType || null,
      opportunity_value: Number.isFinite(parsedVal) && (parsedVal as number) >= 0 ? parsedVal : null,
      start_date: newStartDate || null,
      due_date: newDueDate || null,
      repeat_interval: newRepeatInterval,
      notes: newNotes.trim() || null,
      delivered_at: deliveredStamp,
    } as any);

    setIsCreating(false);
    if (error) {
      toast.error(`Failed to create project: ${error.message}`);
      return;
    }

    toast.success(`Project "${newName.trim()}" created successfully!`);
    qc.invalidateQueries({ queryKey: ["projects"] });
    setCreateOpen(false);

    // Reset form
    setNewName("");
    setNewValue("");
    setNewNotes("");
    setNewStartDate("");
    setNewDueDate("");
  };

  return (
    <div className="flex min-h-screen w-screen flex-col overflow-x-hidden bg-background text-foreground">
      <main className="flex-1 px-6 md:px-10 py-10 max-w-[1400px] w-full mx-auto relative rounded-3xl my-4 sm:my-6 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-sm">
        {/* Header Title Section */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
                Directory & Overview
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold leading-[0.95] tracking-tighter text-foreground flex items-center gap-3">
              Projects.
            </h1>
            <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">
              Master directory of all client projects. Search, filter, track values, update pipeline stages, and launch implementation boards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button className="bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-6 py-3.5 rounded-xl text-xs uppercase tracking-[0.15em] font-bold transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer hover:scale-[1.02]">
                  <Plus size={16} />
                  <span>New Project</span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl p-6 rounded-2xl bg-card border border-border shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-bold flex items-center gap-2">
                    <FolderKanban size={22} />
                    <span>Create New Project</span>
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Client *</Label>
                      <select
                        value={newClientId}
                        onChange={(e) => setNewClientId(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                        required
                      >
                        <option value="">-- Select Client --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.industry ? `(${c.industry})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Project Name *</Label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Website Redesign & SEO Portal"
                        className="rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Project Type</Label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                      >
                        {PROJECT_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Opportunity Value (ZAR)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="500"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="e.g. 25000"
                        className="rounded-xl font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Pipeline Status</Label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                      >
                        {PIPELINE_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Implementation Stage</Label>
                      <select
                        value={newImplStage}
                        onChange={(e) => setNewImplStage(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                      >
                        <option value="">None / Not Started</option>
                        {IMPL_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Start Date</Label>
                      <Input
                        type="date"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                        className="rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Due Date</Label>
                      <Input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Repeat Interval</Label>
                      <select
                        value={newRepeatInterval}
                        onChange={(e) => setNewRepeatInterval(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                      >
                        <option value="none">One-off / Non-recurring</option>
                        <option value="monthly">Monthly Cycle</option>
                        <option value="quarterly">Quarterly Cycle</option>
                        <option value="yearly">Yearly Renewal</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Project Notes & Scope</Label>
                      <textarea
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Key requirements, client objectives, or kickoff details..."
                        rows={3}
                        className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-2 border-t border-border gap-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" className="rounded-xl text-xs">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="bg-black text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
                    >
                      {isCreating ? "Creating..." : "Save Project"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Total Active</span>
              <FolderKanban size={16} />
            </div>
            <div className="font-display text-3xl font-extrabold text-foreground">
              {stats.totalActive}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              Active client projects
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Active Pipeline Value</span>
              <DollarSign size={16} className="text-emerald-500" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-foreground truncate">
              {formatZAR(stats.totalValue)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              Combined active value
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">In Implementation</span>
              <ImplementationIcon size={16} className="text-blue-500" />
            </div>
            <div className="font-display text-3xl font-extrabold text-foreground">
              {stats.inProgressCount}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              Active execution & dev
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Delivered</span>
              <CheckCircle2 size={16} className="text-sky-500" />
            </div>
            <div className="font-display text-3xl font-extrabold text-foreground">
              {stats.deliveredCount}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              Successfully completed
            </span>
          </div>
        </div>

        {/* Toolbar: Search, Filters, Tab View */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 mb-6 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by name, client, or notes..."
                className="pl-10 pr-4 py-2.5 rounded-xl text-sm border-border bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Active vs Archived Tab */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-secondary p-1 rounded-xl border border-border text-xs">
                <button
                  onClick={() => setViewTab("active")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewTab === "active"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Active ({stats.totalActive})
                </button>
                <button
                  onClick={() => setViewTab("archived")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewTab === "archived"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Archived ({stats.archivedCount})
                </button>
              </div>

              {/* List vs Grid mode */}
              <div className="flex items-center bg-secondary p-1 rounded-xl border border-border text-xs">
                <button
                  onClick={() => setDisplayMode("list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    displayMode === "list"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  List
                </button>
                <button
                  onClick={() => setDisplayMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    displayMode === "grid"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  Grid
                </button>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
              <Filter size={14} />
              <span>Filter by:</span>
            </div>

            {/* Client Filter */}
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Pipeline Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Pipeline Statuses</option>
              {PIPELINE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Implementation Stage Filter */}
            <select
              value={implStageFilter}
              onChange={(e) => setImplStageFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Implementation Stages</option>
              <option value="none">No Implementation Stage</option>
              {IMPL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Project Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Project Types</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Reset Filters button if any active */}
            {(selectedClientId !== "all" ||
              statusFilter !== "all" ||
              implStageFilter !== "all" ||
              typeFilter !== "all" ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSelectedClientId("all");
                  setStatusFilter("all");
                  setImplStageFilter("all");
                  setTypeFilter("all");
                  setSearchQuery("");
                }}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer ml-auto"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Projects Content Area */}
        {loadingProjects ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground animate-pulse">
            Loading projects directory...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <FolderKanban size={36} className="mx-auto text-muted-foreground/60 mb-3" />
            <h3 className="font-display text-2xl font-semibold text-foreground">
              No matching projects found.
            </h3>
            <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || selectedClientId !== "all" || statusFilter !== "all"
                ? "Try adjusting your search criteria or clearing filters."
                : "Get started by creating your first client project."}
            </p>
          </div>
        ) : displayMode === "list" ? (
          /* LIST / TABLE VIEW */
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="hidden md:grid grid-cols-12 px-6 py-3.5 bg-secondary/60 border-b border-border text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
              <div className="col-span-3">Project / Type</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-2">Pipeline Status</div>
              <div className="col-span-2">Impl. Stage</div>
              <div className="col-span-1 text-right">Value</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <ul className="divide-y divide-border">
              {filteredProjects.map((p) => {
                const clientName = clientMap.get(p.client_id) || "Unknown Client";
                const statusMeta =
                  PIPELINE_STATUSES.find((s) => s.id === p.status) || {
                    id: p.status,
                    label: p.status,
                    color: "bg-secondary text-foreground",
                  };
                const implMeta = IMPL_STAGES.find((s) => s.id === p.impl_stage);

                return (
                  <li
                    key={p.id}
                    className="flex flex-col md:grid md:grid-cols-12 px-6 py-4 items-start md:items-center gap-3 hover:bg-secondary/30 transition-colors"
                  >
                    {/* Project Name & Type */}
                    <div className="col-span-3 w-full pr-2">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/implementation/$projectId"
                          params={{ projectId: p.id }}
                          className="font-display text-base font-bold text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {p.name}
                        </Link>
                        <ProjectNamePopover
                          projectId={p.id}
                          currentName={p.name}
                          align="start"
                          trigger={
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition cursor-pointer"
                              title="Rename project"
                            >
                              <Edit3 size={13} />
                            </button>
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {p.project_type && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {PROJECT_TYPES.find((t) => t.id === p.project_type)?.label || p.project_type}
                          </span>
                        )}
                        {p.repeat_interval && p.repeat_interval !== "none" && (
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <RecurringIcon size={12} />
                            {p.repeat_interval}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Client Name */}
                    <div className="col-span-2 w-full">
                      <ProjectClientPopover
                        projectId={p.id}
                        clientId={p.client_id}
                        trigger={
                          <button className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1.5 cursor-pointer text-left">
                            <Building2 size={13} className="text-muted-foreground shrink-0" />
                            <span className="truncate">{clientName}</span>
                          </button>
                        }
                      />
                    </div>

                    {/* Pipeline Status Selector */}
                    <div className="col-span-2 w-full">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all border border-black/10 inline-flex items-center gap-1.5 ${statusMeta.color}`}
                          >
                            <span>{statusMeta.label}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 p-1 rounded-xl shadow-lg border border-border">
                          {PIPELINE_STATUSES.map((s) => (
                            <DropdownMenuItem
                              key={s.id}
                              onSelect={() => handleUpdateStatus(p.id, s.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                            >
                              <span className={`w-2 h-2 rounded-full ${s.color.split(" ")[0]}`} />
                              <span>{s.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Implementation Stage Selector */}
                    <div className="col-span-2 w-full">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border inline-flex items-center gap-1.5 cursor-pointer">
                            <ImplementationIcon size={12} />
                            <span>{implMeta ? implMeta.label : "Not set"}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 p-1 rounded-xl shadow-lg border border-border">
                          <DropdownMenuItem
                            onSelect={() => handleUpdateImplStage(p.id, null)}
                            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer text-muted-foreground"
                          >
                            None / Unset
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {IMPL_STAGES.map((s) => (
                            <DropdownMenuItem
                              key={s.id}
                              onSelect={() => handleUpdateImplStage(p.id, s.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                            >
                              <span>{s.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Value */}
                    <div className="col-span-1 w-full text-right">
                      <ProjectValuePopover
                        projectId={p.id}
                        value={p.opportunity_value}
                        align="end"
                        trigger={
                          <button className="font-mono text-xs font-bold text-foreground hover:bg-secondary px-2 py-1 rounded-lg transition cursor-pointer">
                            {formatZAR(p.opportunity_value)}
                          </button>
                        }
                      />
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 w-full flex items-center justify-end gap-1.5">
                      {/* Dates Popover */}
                      <ProjectDatesPopover
                        project={p}
                        align="end"
                        trigger={
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer" title="Manage Dates">
                            <Calendar size={15} />
                          </button>
                        }
                      />

                      {/* Notes Modal */}
                      <ProjectNotesDialog
                        projectId={p.id}
                        projectName={p.name}
                        notes={p.notes}
                        trigger={
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer" title="Notes">
                            <FileText size={15} />
                          </button>
                        }
                      />

                      {/* Implementation Board Link */}
                      <Link
                        to="/implementation/$projectId"
                        params={{ projectId: p.id }}
                        className="bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-wider font-bold transition whitespace-nowrap shadow-2xs flex items-center gap-1"
                        title="Open Implementation Board"
                      >
                        <span>Board</span>
                        <ArrowRight size={12} />
                      </Link>

                      {/* More Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer">
                            <MoreVertical size={15} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-border">
                          <ProjectNamePopover
                            projectId={p.id}
                            currentName={p.name}
                            align="end"
                            trigger={
                              <div className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 hover:bg-secondary select-none">
                                <Edit3 size={14} />
                                <span>Rename Project</span>
                              </div>
                            }
                          />

                          <DropdownMenuItem
                            onSelect={() => navigate({ to: "/clients/$clientId", params: { clientId: p.client_id } })}
                            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2"
                          >
                            <Building2 size={14} />
                            <span>View Client</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={() => handleToggleArchive(p)}
                            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2"
                          >
                            {p.archived_at ? (
                              <>
                                <ArchiveRestore size={14} />
                                <span>Unarchive</span>
                              </>
                            ) : (
                              <>
                                <Archive size={14} />
                                <span>Archive</span>
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DeleteProjectButton
                            projectIds={p.id}
                            projectName={p.name}
                            trigger={
                              <button className="w-full text-left text-xs text-rose-600 dark:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 cursor-pointer font-semibold">
                                Delete Project
                              </button>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((p) => {
              const clientName = clientMap.get(p.client_id) || "Unknown Client";
              const statusMeta =
                PIPELINE_STATUSES.find((s) => s.id === p.status) || {
                  id: p.status,
                  label: p.status,
                  color: "bg-secondary text-foreground",
                };
              const implMeta = IMPL_STAGES.find((s) => s.id === p.impl_stage);

              return (
                <div
                  key={p.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-black/30 hover:shadow-md"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-black/10 ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      <ProjectValuePopover
                        projectId={p.id}
                        value={p.opportunity_value}
                        align="end"
                        trigger={
                          <button className="font-mono text-xs font-extrabold text-foreground bg-secondary px-2.5 py-1 rounded-lg border border-border cursor-pointer">
                            {formatZAR(p.opportunity_value)}
                          </button>
                        }
                      />
                    </div>

                    {/* Title & Client */}
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/implementation/$projectId"
                        params={{ projectId: p.id }}
                        className="font-display text-xl font-bold text-foreground hover:text-blue-600 transition-colors block flex-1"
                      >
                        {p.name}
                      </Link>
                      <ProjectNamePopover
                        projectId={p.id}
                        currentName={p.name}
                        align="end"
                        trigger={
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition cursor-pointer shrink-0"
                            title="Rename project"
                          >
                            <Edit3 size={15} />
                          </button>
                        }
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Building2 size={13} />
                      <Link to="/clients/$clientId" params={{ clientId: p.client_id }} className="hover:underline">
                        {clientName}
                      </Link>
                    </div>

                    {/* Impl Stage & Type */}
                    <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-xs">
                      {implMeta && (
                        <span className="bg-secondary px-2.5 py-1 rounded-lg font-semibold text-foreground border border-border text-[11px] flex items-center gap-1">
                          <ImplementationIcon size={12} />
                          {implMeta.label}
                        </span>
                      )}
                      {p.project_type && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                          {PROJECT_TYPES.find((t) => t.id === p.project_type)?.label || p.project_type}
                        </span>
                      )}
                    </div>

                    {/* Dates preview if set */}
                    {(p.start_date || p.due_date) && (
                      <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-2">
                        <Calendar size={12} />
                        <span>
                          {p.start_date ? new Date(p.start_date).toLocaleDateString() : "Start TBD"} &rarr;{" "}
                          {p.due_date ? new Date(p.due_date).toLocaleDateString() : "Due TBD"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-2">
                    <Link
                      to="/implementation/$projectId"
                      params={{ projectId: p.id }}
                      className="bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition shadow-2xs flex items-center gap-1.5"
                    >
                      <span>Open Board</span>
                      <ArrowRight size={14} />
                    </Link>

                    <div className="flex items-center gap-1">
                      <ProjectDatesPopover
                        project={p}
                        align="end"
                        trigger={
                          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer" title="Manage Dates">
                            <Calendar size={15} />
                          </button>
                        }
                      />
                      <ProjectNotesDialog
                        projectId={p.id}
                        projectName={p.name}
                        notes={p.notes}
                        trigger={
                          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer" title="Notes">
                            <FileText size={15} />
                          </button>
                        }
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer">
                            <MoreVertical size={15} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 p-1 rounded-xl shadow-lg border border-border">
                          <DropdownMenuItem
                            onSelect={() => handleToggleArchive(p)}
                            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2"
                          >
                            {p.archived_at ? (
                              <>
                                <ArchiveRestore size={14} />
                                <span>Unarchive</span>
                              </>
                            ) : (
                              <>
                                <Archive size={14} />
                                <span>Archive</span>
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DeleteProjectButton
                            projectIds={p.id}
                            projectName={p.name}
                            trigger={
                              <button className="w-full text-left text-xs text-rose-600 dark:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 cursor-pointer font-semibold">
                                Delete Project
                              </button>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-6 bg-card flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">System Status</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Projects Sync Active
          </span>
        </div>
        <div className="font-display font-medium">Mind Spark Studio — Projects Master Directory</div>
      </footer>
    </div>
  );
}
