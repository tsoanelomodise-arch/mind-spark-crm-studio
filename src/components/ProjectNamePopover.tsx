import { useState, type ReactNode, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Edit3 } from "lucide-react";

export function ProjectNamePopover({
  projectId,
  currentName,
  trigger,
  align = "start",
  onUpdated,
}: {
  projectId: string;
  currentName: string;
  trigger?: ReactNode;
  align?: "start" | "center" | "end";
  onUpdated?: (newName: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const save = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Project name cannot be empty");
      return;
    }
    if (trimmed === currentName) {
      setOpen(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ name: trimmed })
      .eq("id", projectId);

    setSaving(false);
    if (error) {
      toast.error(`Failed to update project name: ${error.message}`);
      return;
    }

    toast.success("Project name updated");
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    onUpdated?.(trimmed);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName(currentName);
      }}
    >
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
            title="Edit project name"
            aria-label="Edit project name"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 p-4 shadow-xl border border-border rounded-xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`pn-edit-${projectId}`} className="text-xs font-semibold">
              Project Name
            </Label>
            <Input
              id={`pn-edit-${projectId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              className="text-xs rounded-lg"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-lg"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !name.trim()}
              className="h-8 text-xs rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold"
            >
              {saving ? "Saving..." : "Save Name"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
