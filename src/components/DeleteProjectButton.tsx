import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  projectIds: string | string[];
  projectName: string;
  description?: string;
  trigger?: ReactNode;
  onDeleted?: () => void;
  clientId?: string;
};

export function DeleteProjectButton({
  projectIds,
  projectName,
  description,
  trigger,
  onDeleted,
  clientId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = Array.isArray(projectIds) ? projectIds : [projectIds];

  const handleDelete = async () => {
    setBusy(true);
    try {
      // Delete associated child records first to avoid foreign key violation errors
      await supabase.from("project_tasks").delete().in("project_id", ids);
      await supabase.from("project_credentials").delete().in("project_id", ids);
      await supabase.from("client_notes").delete().in("project_id", ids);

      const { error } = await supabase.from("projects").delete().in("id", ids);
      if (error) {
        toast.error(`Delete failed: ${error.message}`);
        setBusy(false);
        return;
      }

      toast.success(ids.length > 1 ? `Deleted ${ids.length} projects` : "Project deleted");

      // Optimistically remove deleted project(s) from active query caches
      const idSet = new Set(ids);
      qc.setQueriesData({ queryKey: ["projects"] }, (oldData: any) => {
        if (Array.isArray(oldData)) {
          return oldData.filter((p) => !idSet.has(p?.id));
        }
        return oldData;
      });

      qc.invalidateQueries({ queryKey: ["projects"] });
      if (clientId) qc.invalidateQueries({ queryKey: ["projects", clientId] });

      setOpen(false);
      onDeleted?.();
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred while deleting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <button
            type="button"
            title="Delete project"
            aria-label="Delete project"
            className="text-muted-foreground hover:text-destructive transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {ids.length > 1 ? `Delete "${projectName}" series?` : `Delete "${projectName}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              (ids.length > 1
                ? `This permanently removes ${ids.length} projects in this recurring series, including any credentials, notes, and conversations linked to them. This cannot be undone.`
                : "This permanently removes the project and any credentials, notes, and conversations linked to it. This cannot be undone.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
