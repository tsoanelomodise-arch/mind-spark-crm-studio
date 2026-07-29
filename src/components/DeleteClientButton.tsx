import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export async function deleteClientWithCascade(clientId: string) {
  // 1. Get all project IDs associated with this client
  const { data: clientProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientId);

  const projectIds = clientProjects?.map((p) => p.id) || [];

  if (projectIds.length > 0) {
    // Delete project sub-records
    await Promise.all([
      supabase.from("project_tasks").delete().in("project_id", projectIds),
      supabase.from("project_credentials").delete().in("project_id", projectIds),
      supabase.from("project_milestones").delete().in("project_id", projectIds),
      supabase.from("project_stages").delete().in("project_id", projectIds),
    ]);
    // Delete projects
    await supabase.from("projects").delete().eq("client_id", clientId);
  }

  // 2. Delete all client-level associated records
  await Promise.all([
    supabase.from("credentials").delete().eq("client_id", clientId),
    supabase.from("contacts").delete().eq("client_id", clientId),
    supabase.from("client_notes").delete().eq("client_id", clientId),
    supabase.from("client_conversations").delete().eq("client_id", clientId),
    supabase.from("recurring_projects").delete().eq("client_id", clientId),
    supabase.from("prompts").update({ client_id: null }).eq("client_id", clientId),
  ]);

  // 3. Delete the primary client record
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

export function DeleteClientButton({
  clientId,
  clientName,
  redirectOnDelete = false,
  variant = "ghost",
  size = "sm",
  showText = true,
}: {
  clientId: string;
  clientName: string;
  redirectOnDelete?: boolean;
  variant?: "ghost" | "outline" | "destructive";
  size?: "default" | "sm" | "icon";
  showText?: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteClientWithCascade(clientId);
      toast.success(`Client "${clientName}" deleted`);

      // Invalidate queries across the app
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients", "lite"] });
      qc.invalidateQueries({ queryKey: ["clients-counts"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["credentials"] });
      qc.invalidateQueries({ queryKey: ["prompts"] });

      if (redirectOnDelete) {
        router.navigate({ to: "/clients" });
      }
    } catch (err: any) {
      toast.error(`Could not delete client: ${err.message || "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title={`Delete ${clientName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {showText && <span className="ml-1.5 font-mono text-[11px] uppercase tracking-widest">Delete</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {clientName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <strong>{clientName}</strong> and all linked projects, tasks, contacts, logins, notes, and conversations. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete Client"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
