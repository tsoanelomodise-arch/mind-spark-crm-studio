import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileText, Search, ArrowRight } from "lucide-react";
import { WikiIcon, BespokeBadge } from "@/components/ui/bespoke-icons";
import { WikiSubNav } from "@/components/WikiSubNav";
import { formatDistanceToNow } from "date-fns";
import { slugify } from "@/lib/wiki";
import { FormErrorAlert } from "@/components/FormErrorAlert";

export const Route = createFileRoute("/wiki/")({
  component: WikiIndex,
});

function WikiIndex() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");

  const { data: spaces = [] } = useQuery({
    queryKey: ["wiki-spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_spaces")
        .select("id, name, slug, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: pageCounts = {} } = useQuery({
    queryKey: ["wiki-page-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wiki_pages").select("space_id");
      if (error) throw error;
      const out: Record<string, number> = {};
      data?.forEach((r) => {
        out[r.space_id] = (out[r.space_id] ?? 0) + 1;
      });
      return out;
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["wiki-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, updated_at, space_id, space:wiki_spaces(name, slug)")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["wiki-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, excerpt, content, space_id, space:wiki_spaces(name, slug)")
        .or(`title.ilike.${term},content.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolveSpace = (pSpace: any, spaceId?: string) => {
    const s = Array.isArray(pSpace) ? pSpace[0] : pSpace;
    if (s?.slug && s?.name) return { name: s.name as string, slug: s.slug as string };
    if (spaceId) {
      const found = spaces.find((sp) => sp.id === spaceId);
      if (found) return { name: found.name, slug: found.slug };
    }
    return { name: spaces[0]?.name ?? "Wiki", slug: spaces[0]?.slug ?? "" };
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <WikiSubNav current="wiki" />
      <div className="flex items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Knowledge Base
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl font-extrabold leading-[0.92] tracking-tighter text-foreground">
            Wiki.
          </h1>
          <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">SOPs, playbooks and agency know-how.</p>
        </div>
        {isAdmin && <NewSpaceDialog />}
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all pages…"
          className="pl-10 h-11 bg-card rounded-xl border border-border shadow-2xs"
        />
      </div>

      {q.trim().length >= 2 ? (
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
          </h2>
          <div className="space-y-3">
            {searchResults.map((p) => {
              const space = resolveSpace((p as any).space, p.space_id);
              if (!space.slug) return null;
              return (
                <Link
                  key={p.id}
                  to="/wiki/$spaceSlug/$pageSlug"
                  params={{ spaceSlug: space.slug, pageSlug: p.slug }}
                  className="block bento-card p-5 hover:border-black/30 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground">{p.title}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest bg-secondary px-2.5 py-0.5 rounded-full border border-border font-bold">
                      {space.name}
                    </span>
                  </div>
                  {p.excerpt && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.excerpt}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <section className="mb-12">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4 font-semibold">
              Spaces
            </h2>
            {spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No spaces yet. {isAdmin && "Create the first one."}
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {spaces.map((s) => (
                  <Link
                    key={s.id}
                    to="/wiki/$spaceSlug"
                    params={{ spaceSlug: s.slug }}
                    className="group bento-card p-6 flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <BespokeBadge size="sm">
                          <WikiIcon size={14} />
                        </BespokeBadge>
                        <span className="font-mono text-[10px] uppercase tracking-widest bg-secondary px-2.5 py-1 rounded-full border border-border text-foreground font-bold">
                          {pageCounts[s.id] ?? 0} pages
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-xl leading-tight text-foreground group-hover:text-neutral-600 transition-colors">
                        {s.name}
                      </h3>
                      {s.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.description}</p>
                      )}
                    </div>
                    <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold text-foreground group-hover:text-neutral-600 transition">
                      <span>Open space</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4 font-semibold">
              Recently updated
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No pages yet.</p>
            ) : (
              <div className="bento-card divide-y divide-border/60 overflow-hidden">
                {recent.map((p) => {
                  const space = resolveSpace((p as any).space, p.space_id);
                  if (!space.slug) return null;
                  let formattedDate = "recently";
                  try {
                    const d = new Date(p.updated_at);
                    if (!isNaN(d.getTime())) {
                      formattedDate = formatDistanceToNow(d, { addSuffix: true });
                    }
                  } catch {
                    formattedDate = "recently";
                  }
                  return (
                    <div key={p.id}>
                      <Link
                        to="/wiki/$spaceSlug/$pageSlug"
                        params={{ spaceSlug: space.slug, pageSlug: p.slug }}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-neutral-800 shrink-0" />
                          <span className="font-semibold text-sm text-foreground hover:underline">{p.title}</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 font-medium">
                            · {space.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 font-medium">
                          {formattedDate}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function NewSpaceDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      const msg = "Space name is required.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error: err } = await supabase.from("wiki_spaces").insert({
      name: name.trim(),
      slug: slugify(name),
      description: description.trim() || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success("Space created");
    setOpen(false);
    setName("");
    setDescription("");
    setError(null);
    qc.invalidateQueries({ queryKey: ["wiki-spaces"] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New space
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormErrorAlert error={error} onDismiss={() => setError(null)} title="Failed to create space" />
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Agency SOPs" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
