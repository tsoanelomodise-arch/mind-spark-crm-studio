import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Clock,
  Edit2,
  Check,
  X,
  Briefcase,
  ArrowUpRight,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export interface ProjectNotesDialogProps {
  project: {
    id: string;
    name: string;
    client_id: string;
    notes?: string | null;
    status?: string;
    impl_stage?: string | null;
  } | null;
  clientName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientNoteRow {
  id: string;
  client_id: string;
  project_id: string | null;
  body: string;
  created_at: string;
  created_by: string | null;
}

export function ProjectNotesDialog({
  project,
  clientName,
  open,
  onOpenChange,
}: ProjectNotesDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Summary / Overview notes state (projects.notes)
  const [summaryNotes, setSummaryNotes] = useState("");
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  // New activity log note state (client_notes)
  const [newLogNote, setNewLogNote] = useState("");
  const [isAddingLog, setIsAddingLog] = useState(false);

  // Editing existing log note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sync summary notes when project changes or dialog opens
  useEffect(() => {
    if (project) {
      setSummaryNotes(project.notes ?? "");
      setNewLogNote("");
      setEditingNoteId(null);
    }
  }, [project, open]);

  // Fetch log notes for this project from client_notes table
  const {
    data: logNotes = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["project-client-notes", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data, error } = await supabase
        .from("client_notes")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching project log notes:", error);
        return [];
      }
      return (data as ClientNoteRow[]) ?? [];
    },
    enabled: !!project?.id && open,
  });

  if (!project) return null;

  // Handler: Save Project Overview Notes
  const handleSaveSummary = async () => {
    setIsSavingSummary(true);
    const trimmed = summaryNotes.trim();
    const newValue = trimmed || null;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ notes: newValue })
        .eq("id", project.id);

      if (error) throw error;

      toast.success("Project overview notes updated");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
      qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
    } catch (err: any) {
      toast.error(`Failed to update notes: ${err.message || "Unknown error"}`);
    } finally {
      setIsSavingSummary(false);
    }
  };

  // Handler: Add Note to Project Activity Log
  const handleAddLogNote = async () => {
    const trimmed = newLogNote.trim();
    if (!trimmed) {
      toast.error("Please enter a note before adding.");
      return;
    }

    setIsAddingLog(true);
    try {
      const { error } = await supabase.from("client_notes").insert({
        client_id: project.client_id,
        project_id: project.id,
        body: trimmed,
        created_by: user?.id ?? null,
      });

      if (error) throw error;

      toast.success("Note added to project activity log");
      setNewLogNote("");
      refetchLogs();
      qc.invalidateQueries({ queryKey: ["client-notes", project.client_id] });
    } catch (err: any) {
      toast.error(`Failed to add note: ${err.message || "Unknown error"}`);
    } finally {
      setIsAddingLog(false);
    }
  };

  // Handler: Save Edit of an existing Log Note
  const handleSaveNoteEdit = async (noteId: string) => {
    const trimmed = editingNoteBody.trim();
    if (!trimmed) {
      toast.error("Note body cannot be empty.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("client_notes")
        .update({ body: trimmed })
        .eq("id", noteId);

      if (error) throw error;

      toast.success("Note updated");
      setEditingNoteId(null);
      setEditingNoteBody("");
      refetchLogs();
    } catch (err: any) {
      toast.error(`Failed to update note: ${err.message || "Unknown error"}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handler: Delete a Log Note
  const handleDeleteLogNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("client_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast.success("Note deleted");
      refetchLogs();
    } catch (err: any) {
      toast.error(`Failed to delete note: ${err.message || "Unknown error"}`);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border bg-paper">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <DialogTitle className="font-display text-xl font-semibold text-foreground">
                  Project Notes: {project.name}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap font-mono text-xs text-muted-foreground">
                <span>Client: {clientName || "—"}</span>
                <span>•</span>
                <span className="uppercase tracking-wider font-semibold text-foreground">
                  Status: {project.status || "Lead"}
                </span>
                {project.impl_stage && (
                  <>
                    <span>•</span>
                    <span className="capitalize text-primary">
                      Stage: {project.impl_stage}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Link
              to="/implementation/$projectId"
              params={{ projectId: project.id }}
              onClick={() => onOpenChange(false)}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-mono uppercase tracking-wider shrink-0"
              >
                Open Project <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </DialogHeader>

        {/* Tabbed Content */}
        <Tabs defaultValue="log" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 bg-paper-soft/40 border-b border-border">
            <TabsList className="bg-paper border border-border">
              <TabsTrigger
                value="log"
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Activity Journal ({logNotes.length})
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Overview Notes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Project Activity Journal / Log */}
          <TabsContent
            value="log"
            className="flex-1 overflow-y-auto p-5 space-y-5 m-0 focus-visible:outline-none"
          >
            {/* New Note Composer */}
            <div className="border border-border rounded-lg p-3 bg-paper space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Log New Note / Update for Pipeline
              </Label>
              <Textarea
                value={newLogNote}
                onChange={(e) => setNewLogNote(e.target.value)}
                placeholder="Type client feedback, meeting summary, project decisions, or roadmap notes..."
                className="min-h-[80px] text-sm bg-background border-border"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddLogNote}
                  disabled={isAddingLog || !newLogNote.trim()}
                  className="h-8 text-xs font-mono uppercase tracking-wider"
                >
                  {isAddingLog ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Note to Journal
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Note Stream */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Historical Project Notes
              </div>

              {isLoadingLogs ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading project notes...
                </div>
              ) : logNotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-paper-soft/30">
                  No logged notes for this project yet. Use the input above to record your first update.
                </div>
              ) : (
                logNotes.map((note) => (
                  <div
                    key={note.id}
                    className="border border-border rounded-lg p-3.5 bg-paper hover:border-border/80 transition space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono text-[11px] font-medium text-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDate(note.created_at)}
                      </span>
                      <div className="flex items-center gap-1">
                        {editingNoteId !== note.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditingNoteBody(note.body);
                              }}
                              className="p-1 hover:text-foreground text-muted-foreground rounded transition"
                              title="Edit note"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLogNote(note.id)}
                              className="p-1 hover:text-destructive text-muted-foreground rounded transition"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {editingNoteId === note.id ? (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          value={editingNoteBody}
                          onChange={(e) => setEditingNoteBody(e.target.value)}
                          className="min-h-[80px] text-sm bg-background border-border"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteBody("");
                            }}
                            className="h-7 text-xs"
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveNoteEdit(note.id)}
                            disabled={isSavingEdit}
                            className="h-7 text-xs font-mono uppercase tracking-wider"
                          >
                            {isSavingEdit ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" /> Save Note
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {note.body}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Primary Project Overview / Summary Notes */}
          <TabsContent
            value="summary"
            className="flex-1 overflow-y-auto p-5 space-y-4 m-0 focus-visible:outline-none"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Primary Project Overview & Scope Description
                </Label>
                {summaryNotes !== (project.notes ?? "") && (
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This high-level summary appears directly on pipeline project cards and client project summaries.
              </p>
              <Textarea
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                placeholder="Enter project scope details, technical requirements, or key objectives..."
                className="min-h-[180px] text-sm bg-background border-border font-sans leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleSaveSummary}
                disabled={isSavingSummary || summaryNotes === (project.notes ?? "")}
                className="h-8 text-xs font-mono uppercase tracking-wider"
              >
                {isSavingSummary ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" /> Save Overview Notes
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-paper flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-mono">
            {logNotes.length} logged journal entry{logNotes.length === 1 ? "" : "ies"}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-mono uppercase tracking-wider"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
