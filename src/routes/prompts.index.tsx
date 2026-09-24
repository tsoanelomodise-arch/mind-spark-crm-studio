import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PromptsIcon, BespokeBadge } from "@/components/ui/bespoke-icons";
import { extractVariables } from "@/lib/prompt-template";
import { formatDistanceToNow } from "date-fns";
import { WikiSubNav } from "@/components/WikiSubNav";

export const Route = createFileRoute("/prompts/")({
  component: PromptsList,
});

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[];
  updated_at: string;
  user_id: string;
  client_id: string | null;
};

function PromptsList() {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<string | null>(null);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Prompt[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
  const clientName = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [prompts]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return prompts.filter((p) => {
      if (activeCat && p.category !== activeCat) return false;
      if (activeClient && p.client_id !== activeClient) return false;
      if (!ql) return true;
      return (
        p.title.toLowerCase().includes(ql) ||
        p.description?.toLowerCase().includes(ql) ||
        p.content.toLowerCase().includes(ql) ||
        p.tags.some((t) => t.toLowerCase().includes(ql))
      );
    });
  }, [prompts, q, activeCat, activeClient]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <WikiSubNav current="prompts" />
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Volume 01 · {prompts.length} prompts
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl font-extrabold leading-[0.92] tracking-tighter text-foreground">
            The Library.
          </h1>
          <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">
            Every prompt the team has written. Search, filter by client, refine, and fill in the blanks.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <Link to="/prompts/new">
            <Button className="h-11 gap-1.5">
              <Plus className="h-4 w-4" /> New prompt
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts, tags, content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 bg-card rounded-xl border border-border shadow-2xs"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={!activeCat} onClick={() => setActiveCat(null)}>All categories</Chip>
            {categories.map((c) => (
              <Chip key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>{c}</Chip>
            ))}
          </div>
        )}
      </div>

      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Chip active={!activeClient} onClick={() => setActiveClient(null)}>All clients</Chip>
          {clients.map((c) => (
            <Chip key={c.id} active={activeClient === c.id} onClick={() => setActiveClient(c.id)}>{c.name}</Chip>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState hasPrompts={prompts.length > 0} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => <PromptCard key={p.id} p={p} clientName={p.client_id ? clientName[p.client_id] : undefined} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[11px] uppercase tracking-widest px-3.5 py-1.5 rounded-full border transition cursor-pointer ${
        active
          ? "bg-black text-white border-black font-bold shadow-2xs"
          : "bg-card text-muted-foreground border-border hover:border-black/30 hover:text-foreground shadow-2xs"
      }`}
    >
      {children}
    </button>
  );
}

function PromptCard({ p, clientName }: { p: Prompt; clientName?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const vars = extractVariables(p.content);

  const isOwner = user?.id === p.user_id;
  const canDelete = isAdmin || isOwner;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    const { error } = await supabase.from("prompts").delete().eq("id", p.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Prompt "${p.title}" deleted`);
    qc.invalidateQueries({ queryKey: ["prompts"] });
  };

  return (
    <div
      onClick={() => router.navigate({ to: "/prompts/$id", params: { id: p.id } })}
      className="group text-left bento-card p-6 cursor-pointer flex flex-col justify-between hover:border-black/30 transition-all relative"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BespokeBadge size="sm">
              <PromptsIcon size={14} />
            </BespokeBadge>
            <div className="flex flex-col">
              {p.category && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{p.category}</span>
              )}
              {clientName && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-foreground font-bold">· {clientName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {vars.length > 0 && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest bg-secondary px-2.5 py-1 rounded-full border border-border text-foreground font-bold">
                {vars.length} var{vars.length > 1 ? "s" : ""}
              </span>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Delete prompt"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete prompt?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{p.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <h3 className="font-display text-xl font-bold leading-tight mb-2 text-foreground group-hover:text-neutral-600 transition-colors">
          {p.title}
        </h3>
        {p.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{p.description}</p>
        )}
        <p className="font-mono text-xs text-muted-foreground/90 line-clamp-3 mb-5 bg-secondary/60 p-3 rounded-xl border border-border/50">
          {p.content}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
        <div className="flex flex-wrap gap-1">
          {p.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="font-mono text-[10px] font-medium rounded-md px-2 py-0.5 bg-secondary text-foreground">{t}</Badge>
          ))}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground font-medium">{formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

function EmptyState({ hasPrompts }: { hasPrompts: boolean }) {
  return (
    <div className="bento-card p-12 text-center border-dashed">
      <div className="h-12 w-12 icon-badge-dark mx-auto mb-4">
        <FileText className="h-6 w-6 text-white" />
      </div>
      <h3 className="font-display text-2xl font-bold text-foreground">
        {hasPrompts ? "No matches" : "An empty shelf"}
      </h3>
      <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
        {hasPrompts ? "Try a different search or filter." : "Add the first prompt to get the library going."}
      </p>
      {!hasPrompts && (
        <Link to="/prompts/new" className="mt-6 inline-block">
          <span className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-neutral-800 transition">
            <Plus className="h-4 w-4" /> Create the first prompt
          </span>
        </Link>
      )}
    </div>
  );
}
