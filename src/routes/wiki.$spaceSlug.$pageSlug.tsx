import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Pencil, Trash2, Clock, Copy, Plus, Wand2, Check, X,
  ChevronRight, FolderTree, FileText, ArrowUpRight, BookOpen, Edit3,
} from "lucide-react";
import { slugify } from "@/lib/wiki";
import { Markdown } from "@/components/ui/markdown";
import { formatDistanceToNow } from "date-fns";
import { FormErrorAlert } from "@/components/FormErrorAlert";
import { LinkedEntities } from "@/components/wiki/LinkedEntities";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";

export const Route = createFileRoute("/wiki/$spaceSlug/$pageSlug")({
  component: PageView,
});

function PageView() {
  const { spaceSlug, pageSlug } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [duplicating, setDuplicating] = useState(false);

  // Quick Inline WYSIWYG Editing state
  const [isQuickEditing, setIsQuickEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "published">("draft");
  const [editParentId, setEditParentId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["wiki-page-detail", spaceSlug, pageSlug],
    queryFn: async () => {
      const { data: space, error: e1 } = await supabase
        .from("wiki_spaces")
        .select("id, name, slug")
        .eq("slug", spaceSlug)
        .maybeSingle();
      if (e1) throw e1;
      if (!space) return null;

      const { data: page, error: e2 } = await supabase
        .from("wiki_pages")
        .select("*")
        .eq("space_id", space.id)
        .eq("slug", pageSlug)
        .maybeSingle();
      if (e2) throw e2;
      if (!page) return null;

      // Parent page query for 1-to-N breadcrumbs
      let parentPage: { id: string; title: string; slug: string } | null = null;
      if (page.parent_id) {
        const { data: p } = await supabase
          .from("wiki_pages")
          .select("id, title, slug")
          .eq("id", page.parent_id)
          .maybeSingle();
        parentPage = p;
      }

      // Direct child pages (1-to-N relationship)
      const { data: childPages } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, excerpt, status, updated_at")
        .eq("space_id", space.id)
        .eq("parent_id", page.id)
        .order("position")
        .order("title");

      // Siblings for parent selector dropdown
      const { data: siblings } = await supabase
        .from("wiki_pages")
        .select("id, title")
        .eq("space_id", space.id)
        .neq("id", page.id)
        .order("title");

      return {
        space,
        page,
        parentPage,
        childPages: childPages ?? [],
        siblings: siblings ?? [],
      };
    },
  });

  const page = data?.page;
  const canEdit = !!page && (isAdmin || page.created_by === user?.id);

  // Sync edit state when page loads or quick editing is activated
  useEffect(() => {
    if (page && !isQuickEditing) {
      setEditTitle(page.title);
      setEditContent(page.content);
      setEditExcerpt(page.excerpt ?? "");
      setEditStatus((page.status as "draft" | "published") ?? "draft");
      setEditParentId(page.parent_id ?? "");
    }
  }, [page, isQuickEditing]);

  const saveQuickEdit = async (payload: {
    title: string;
    content: string;
    excerpt: string;
    status: "draft" | "published";
    parentId: string;
  }) => {
    if (!page) return;
    if (!payload.title.trim()) throw new Error("Title is required");

    const { error } = await supabase
      .from("wiki_pages")
      .update({
        title: payload.title.trim(),
        content: payload.content,
        excerpt: payload.excerpt.trim() || null,
        status: payload.status,
        parent_id: payload.parentId || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", page.id);

    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["wiki-page-detail", spaceSlug, pageSlug] });
    qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
    qc.invalidateQueries({ queryKey: ["wiki-recent"] });
  };

  const autosave = useAutosave(
    {
      title: editTitle,
      content: editContent,
      excerpt: editExcerpt,
      status: editStatus,
      parentId: editParentId,
    },
    saveQuickEdit,
    { enabled: isQuickEditing && canEdit },
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6">Loading page…</div>;
  }
  if (!data || !page) {
    return <div className="text-sm text-muted-foreground py-6">Page not found.</div>;
  }

  const handleFinishQuickEdit = async () => {
    try {
      await saveQuickEdit({
        title: editTitle,
        content: editContent,
        excerpt: editExcerpt,
        status: editStatus,
        parentId: editParentId,
      });
      toast.success("Page updated");
      setIsQuickEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save edits";
      toast.error(message);
    }
  };

  const duplicate = async () => {
    setDuplicating(true);
    try {
      const baseTitle = `${page.title} (copy)`;
      const baseSlug = slugify(baseTitle);
      const { data: existing, error: e1 } = await supabase
        .from("wiki_pages")
        .select("slug")
        .eq("space_id", page.space_id)
        .like("slug", `${baseSlug}%`);
      if (e1) throw e1;
      const taken = new Set((existing ?? []).map((r) => r.slug));
      let slug = baseSlug;
      let n = 2;
      while (taken.has(slug)) slug = `${baseSlug}-${n++}`;
      let title = baseTitle;
      if (n > 2) title = `${page.title} (copy ${n - 1})`;
      const { data: created, error: e2 } = await supabase
        .from("wiki_pages")
        .insert({
          space_id: page.space_id,
          parent_id: page.parent_id,
          title,
          slug,
          content: page.content,
          excerpt: page.excerpt,
          status: "draft",
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select("slug")
        .single();
      if (e2) throw e2;
      toast.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
      qc.invalidateQueries({ queryKey: ["wiki-recent"] });
      router.navigate({
        to: "/wiki/$spaceSlug/$pageSlug",
        params: { spaceSlug, pageSlug: created.slug },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to duplicate";
      toast.error(message);
    } finally {
      setDuplicating(false);
    }
  };

  const del = async () => {
    const { error } = await supabase.from("wiki_pages").delete().eq("id", page.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
    qc.invalidateQueries({ queryKey: ["wiki-recent"] });
    router.navigate({ to: "/wiki/$spaceSlug", params: { spaceSlug } });
  };

  return (
    <article className="py-2 space-y-6">
      {/* 1-to-N Parent Breadcrumb Trail */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex-wrap">
        <Link to="/wiki/$spaceSlug" params={{ spaceSlug }} className="hover:text-foreground transition flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {data.space.name}
        </Link>
        {data.parentPage && (
          <>
            <ChevronRight className="h-3 w-3 opacity-50" />
            <Link
              to="/wiki/$spaceSlug/$pageSlug"
              params={{ spaceSlug, pageSlug: data.parentPage.slug }}
              className="hover:text-foreground transition font-medium"
            >
              {data.parentPage.title}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="text-foreground font-semibold truncate">{page.title}</span>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {page.status === "draft" ? (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                Draft
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Published
              </Badge>
            )}
            <Clock className="h-3 w-3 ml-1" />
            updated {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
          </div>

          {!isQuickEditing ? (
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold leading-tight break-words">
              {page.title}
            </h1>
          ) : (
            <div className="mt-3 space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Page Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-xl font-display font-semibold h-11"
                placeholder="Page Title..."
              />
            </div>
          )}

          {page.excerpt && !isQuickEditing && (
            <p className="mt-2 text-sm text-muted-foreground italic">{page.excerpt}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isQuickEditing ? (
              <>
                <SaveStatus status={autosave.status} />
                <Button size="sm" onClick={handleFinishQuickEdit} className="gap-1.5 bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" /> Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsQuickEditing(false)}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setIsQuickEditing(true)}
                  className="gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" /> WYSIWYG Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.navigate({
                      to: "/wiki/$spaceSlug/$pageSlug/edit",
                      params: { spaceSlug, pageSlug },
                    })
                  }
                  className="gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Full Editor
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={duplicate}
                  disabled={duplicating}
                  className="gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> {duplicating ? "Duplicating…" : "Duplicate"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this page?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{page.title}" and its sub-page hierarchy.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}
      </div>

      {/* WYSIWYG Quick Editing Form Panel */}
      {isQuickEditing && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in-50 duration-200">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "draft" | "published")}
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-xs font-medium"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Parent Page (1-to-N Hierarchy)</Label>
              <select
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-xs font-medium"
              >
                <option value="">— Top Level —</option>
                {data.siblings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Excerpt / Summary</Label>
            <Input
              value={editExcerpt}
              onChange={(e) => setEditExcerpt(e.target.value)}
              placeholder="Brief summary for cards and search..."
              className="mt-1 h-9 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1 block">
              Rich Text Content
            </Label>
            <WysiwygEditor
              value={editContent}
              onValueChange={setEditContent}
              placeholder="Type your knowledge content here..."
            />
          </div>
        </div>
      )}

      {/* Main Page Rendered Content (When not quick editing) */}
      {!isQuickEditing && (
        <div className="min-h-[200px]">
          {page.content.trim() === "" ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-border p-6">
              <p className="text-sm text-muted-foreground italic">
                This wiki page is empty.
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickEditing(true)}
                  className="mt-3 gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Start WYSIWYG Editing
                </Button>
              )}
            </div>
          ) : (
            <Markdown className="text-base leading-relaxed">{page.content}</Markdown>
          )}
        </div>
      )}

      {/* 1-to-N Sub-Pages Section */}
      <div className="pt-8 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-foreground">
              Sub-Pages & Child Topics (1-to-N)
            </h3>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {data.childPages.length}
            </Badge>
          </div>

          {canEdit && (
            <NewSubPageDialog
              spaceId={data.space.id}
              spaceSlug={spaceSlug}
              parentId={page.id}
              parentTitle={page.title}
            />
          )}
        </div>

        {data.childPages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic bg-paper/50 p-4 rounded-lg border border-border/60">
            No child sub-pages linked yet. Click "Add Sub-Page" above to construct a 1-to-N page hierarchy.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.childPages.map((child) => (
              <Link
                key={child.id}
                to="/wiki/$spaceSlug/$pageSlug"
                params={{ spaceSlug, pageSlug: child.slug }}
                className="group p-3.5 rounded-lg border border-border bg-paper hover:bg-paper-soft hover:border-primary/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                      {child.title}
                    </span>
                    {child.status === "draft" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        draft
                      </Badge>
                    )}
                  </div>
                  {child.excerpt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {child.excerpt}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Updated {formatDistanceToNow(new Date(child.updated_at), { addSuffix: true })}</span>
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Linked Entities & Relational Wiki Page Links */}
      <div className="pt-4">
        <LinkedEntities pageId={page.id} canEdit={canEdit} />
      </div>
    </article>
  );
}

function NewSubPageDialog({
  spaceId,
  spaceSlug,
  parentId,
  parentTitle,
}: {
  spaceId: string;
  spaceSlug: string;
  parentId: string;
  parentTitle: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      const msg = "Sub-page title is required.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const baseSlug = slugify(title);

    const { data: existing } = await supabase
      .from("wiki_pages")
      .select("slug")
      .eq("space_id", spaceId)
      .like("slug", `${baseSlug}%`);

    const taken = new Set((existing ?? []).map((p) => p.slug));
    let finalSlug = baseSlug;
    let n = 2;
    while (taken.has(finalSlug)) finalSlug = `${baseSlug}-${n++}`;

    const { data, error: err } = await supabase
      .from("wiki_pages")
      .insert({
        space_id: spaceId,
        parent_id: parentId,
        title: title.trim(),
        slug: finalSlug,
        content: "",
        status: "draft",
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select("slug")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }

    toast.success("Sub-page created");
    setOpen(false);
    setTitle("");
    setError(null);
    qc.invalidateQueries({ queryKey: ["wiki-space-pages", spaceId] });
    qc.invalidateQueries({ queryKey: ["wiki-page-detail", spaceSlug] });

    router.navigate({
      to: "/wiki/$spaceSlug/$pageSlug",
      params: { spaceSlug, pageSlug: data!.slug },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
          <Plus className="h-3.5 w-3.5" /> Add Sub-Page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Sub-page under "{parentTitle}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <FormErrorAlert error={error} onDismiss={() => setError(null)} title="Failed to create sub-page" />
          <div>
            <Label className="text-xs">Sub-page Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architecture Blueprint"
              className="mt-1"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This new topic page will be linked in a 1-to-N parent-child relationship under <strong>{parentTitle}</strong>.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create Sub-page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
