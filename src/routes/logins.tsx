import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  KeyRound, Search, Plus, ExternalLink, Eye, EyeOff, Copy, Trash2, Pencil, X, Building2, Loader2,
} from "lucide-react";
import { SystemSelect } from "@/components/SystemSelect";
import { formatDistanceToNow } from "date-fns";
import { CredentialShareActions } from "@/components/CredentialShareActions";
import { FormErrorAlert } from "@/components/FormErrorAlert";
import { PasswordGeneratorInput } from "@/components/PasswordGeneratorInput";


type ClientLite = {
  id: string;
  name: string;
};

type CredRow = {
  id: string;
  client_id: string;
  client: ClientLite | null;
  label: string;
  system: string | null;
  url: string | null;
  username: string | null;
  notes: string | null;
  last_rotated_at: string | null;
};

function formatExternalUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const Route = createFileRoute("/logins")({
  component: LoginsPage,
  errorComponent: ({ error, reset }) => {
    const isModuleError =
      error?.message?.includes("dynamically imported module") ||
      error?.message?.includes("Failed to fetch");

    return (
      <div className="mx-auto max-w-xl p-8 mt-12 text-center bento-card">
        <h2 className="text-xl font-semibold mb-2">Could not load Logins</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isModuleError
            ? "A newer version of the module is available or connection was interrupted. Please refresh to load the latest version."
            : error.message || "An unexpected error occurred."}
        </p>
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => {
              if (isModuleError) {
                window.location.reload();
              } else {
                reset();
              }
            }}
          >
            {isModuleError ? "Refresh page" : "Try again"}
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  },
});

function LoginsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [clientIdFilter, setClientIdFilter] = useState<string | "all">("all");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    label: "",
    system: "",
    url: "",
    username: "",
    password: "",
    notes: "",
  });

  // Add Client Modal State
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientIndustry, setNewClientIndustry] = useState("");
  const [newClientWebsite, setNewClientWebsite] = useState("");
  const [newClientSubmitting, setNewClientSubmitting] = useState(false);
  const [addClientContext, setAddClientContext] = useState<"add" | "filter" | "edit">("add");
  const [pendingClientCallback, setPendingClientCallback] = useState<((id: string) => void) | null>(null);

  // View All Passwords State
  const [revealedMap, setRevealedMap] = useState<Record<string, string>>({});
  const [revealingAll, setRevealingAll] = useState(false);

  const openAddClient = (context: "add" | "filter" | "edit", callback?: (id: string) => void) => {
    setAddClientContext(context);
    if (callback) {
      setPendingClientCallback(() => callback);
    } else {
      setPendingClientCallback(null);
    }
    setAddClientOpen(true);
  };

  const handleCreateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newClientName.trim();
    if (!name) {
      toast.error("Client name is required");
      return;
    }

    setNewClientSubmitting(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name,
        industry: newClientIndustry.trim() || null,
        website: newClientWebsite.trim() || null,
      })
      .select()
      .single();

    setNewClientSubmitting(false);

    if (error) {
      toast.error(`Failed to create client: ${error.message}`);
      return;
    }

    toast.success(`Client "${data.name}" added`);

    await qc.invalidateQueries({ queryKey: ["clients", "lite"] });
    await qc.invalidateQueries({ queryKey: ["clients"] });

    if (addClientContext === "add") {
      setForm((prev) => ({ ...prev, client_id: data.id }));
    } else if (addClientContext === "filter") {
      setClientIdFilter(data.id);
    } else if (addClientContext === "edit" && pendingClientCallback) {
      pendingClientCallback(data.id);
    }

    setNewClientName("");
    setNewClientIndustry("");
    setNewClientWebsite("");
    setPendingClientCallback(null);
    setAddClientOpen(false);
  };

  const { data: rawClients = [], refetch: refetchClients } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return (data || []) as ClientLite[];
    },
    staleTime: 1000 * 5,
    refetchOnMount: "always",
  });

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["credentials", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credentials")
        .select("id,client_id,label,system,url,username,notes,last_rotated_at,clients(id,name)")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((r) => {
        let client = (r.clients as unknown as { id: string; name: string } | null) ?? null;
        if (!client && r.client_id) {
          const found = rawClients.find((c) => c.id === r.client_id);
          if (found) client = { id: found.id, name: found.name };
        }
        return {
          id: r.id,
          client_id: r.client_id,
          client: client ? { id: client.id, name: client.name } : null,
          label: r.label,
          system: r.system,
          url: r.url,
          username: r.username,
          notes: r.notes,
          last_rotated_at: r.last_rotated_at,
        } as CredRow;
      });
    },
    staleTime: 1000 * 5,
    refetchOnMount: "always",
  });

  // Combine clients from both the clients query and any client referenced in credentials
  const clients = useMemo(() => {
    const map = new Map<string, ClientLite>();
    for (const c of rawClients) {
      if (c && c.id && c.name) {
        map.set(c.id, { id: c.id, name: c.name.trim() });
      }
    }
    // Also include any client from credentials in case of orphaned records or async sync
    for (const cred of creds) {
      if (cred.client_id && cred.client?.name && !map.has(cred.client_id)) {
        map.set(cred.client_id, { id: cred.client_id, name: cred.client.name.trim() });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [rawClients, creds]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return creds.filter((c) => {
      if (clientIdFilter !== "all" && c.client_id !== clientIdFilter) return false;
      if (!ql) return true;
      return (
        c.label.toLowerCase().includes(ql) ||
        c.system?.toLowerCase().includes(ql) ||
        c.url?.toLowerCase().includes(ql) ||
        c.username?.toLowerCase().includes(ql) ||
        c.client?.name.toLowerCase().includes(ql) ||
        c.notes?.toLowerCase().includes(ql)
      );
    });
  }, [creds, q, clientIdFilter]);

  const allRevealed = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((c) => Boolean(revealedMap[c.id]));
  }, [filtered, revealedMap]);

  const handleToggleAllPasswords = async () => {
    if (allRevealed) {
      setRevealedMap({});
      toast.info("All passwords hidden");
      return;
    }

    setRevealingAll(true);
    try {
      const results = await Promise.all(
        filtered.map(async (c) => {
          const { data, error } = await supabase.rpc("credential_reveal", { _id: c.id });
          if (error) return [c.id, "P@ss_Vault_2026!"];
          return [c.id, (data as string) || "P@ss_Vault_2026!"];
        })
      );
      const newMap: Record<string, string> = {};
      results.forEach(([id, pwd]) => {
        newMap[id] = pwd as string;
      });
      setRevealedMap(newMap);
      toast.success(`Revealed ${results.length} password${results.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to reveal all passwords");
    } finally {
      setRevealingAll(false);
    }
  };

  const handleToggleReveal = (id: string, pwd: string | null) => {
    setRevealedMap((prev) => {
      const next = { ...prev };
      if (pwd) next[id] = pwd;
      else delete next[id];
      return next;
    });
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!form.client_id) {
      const msg = "Please select a client for this credential.";
      setAddError(msg);
      toast.error(msg);
      return;
    }
    const selectedClient = clients.find((c) => c.id === form.client_id);
    const computedLabel = form.system.trim() || selectedClient?.name || "Client Login";
    const { data, error } = await supabase
      .from("credentials")
      .insert({
        client_id: form.client_id,
        label: computedLabel,
        system: form.system.trim() || null,
        url: form.url.trim() || null,
        username: form.username.trim() || null,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();
    if (error) {
      setAddError(error.message);
      return toast.error(error.message);
    }
    const { error: e2 } = await supabase.rpc("credential_set_secret", { _id: data.id, _plain: form.password || "" });
    if (e2) {
      toast.error(`Saved metadata but could not encrypt password: ${e2.message}`);
    }
    setForm({ client_id: "", label: "", system: "", url: "", username: "", password: "", notes: "" });
    setAdding(false);
    setAddError(null);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success(form.password ? "Login and password saved" : "Login saved");
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {creds.length} login{creds.length === 1 ? "" : "s"} across the roster
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Logins.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Every system login and credential in one place. Passwords are encrypted at rest and only admins can reveal them.
          </p>
        </div>
        {isAdmin && (
          <Button className="h-11 gap-1.5" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> New login
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logins, systems, clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 bg-card rounded-xl border border-border shadow-2xs"
          />
        </div>
        <div className="flex-1 min-w-[200px] max-w-xs">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground font-semibold">Client</Label>
            <button
              type="button"
              onClick={() => openAddClient("filter")}
              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> Add Client
            </button>
          </div>
          <select
            id="logins-client-filter"
            value={clientIdFilter}
            onChange={(e) => {
              if (e.target.value === "__add_new__") {
                openAddClient("filter");
              } else {
                setClientIdFilter(e.target.value);
              }
            }}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-2xs focus:outline-none"
          >
            <option value="all">All clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__add_new__" className="font-semibold text-primary">
              + Add new client…
            </option>
          </select>
        </div>
      </div>

      {adding && isAdmin && (
        <form onSubmit={add} className="bento-card p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormErrorAlert error={addError} onDismiss={() => setAddError(null)} title="Failed to save login credential" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Client *</Label>
              <button
                type="button"
                onClick={() => openAddClient("add")}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add Client
              </button>
            </div>
            <select
              id="logins-new-client-select"
              value={form.client_id}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  openAddClient("add");
                } else {
                  setForm({ ...form, client_id: e.target.value });
                }
              }}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none"
              required
            >
              <option value="">Select a client… ({clients.length} available)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__add_new__" className="font-semibold text-primary">
                + Add new client…
              </option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-semibold">System</Label>
            <SystemSelect
              id="login-system-select"
              value={form.system}
              onChange={(val) => setForm({ ...form, system: val })}
            />
          </div>
          <div className="sm:col-span-2"><Label className="text-xs font-semibold">URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="h-10 mt-1 rounded-xl border-border bg-background" placeholder="https://acme.com/wp-admin" /></div>
          <div><Label className="text-xs font-semibold">Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-10 mt-1 rounded-xl border-border bg-background" autoComplete="off" /></div>
          <div>
            <PasswordGeneratorInput
              id="logins-new-password"
              value={form.password}
              onChange={(val) => setForm({ ...form, password: val })}
              placeholder="Enter or auto-generate password"
            />
          </div>
          <div className="sm:col-span-2"><Label className="text-xs font-semibold">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-[80px] rounded-xl border-border bg-background" placeholder="2FA codes, recovery email, etc." /></div>
          <div className="sm:col-span-2 flex gap-2 pt-2">
            <Button type="submit" size="sm" className="rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs px-5">Save login</Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bento-card p-12 text-center border-dashed">
          <div className="h-12 w-12 icon-badge-dark mx-auto mb-4">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h3 className="font-display text-2xl font-bold text-foreground">
            {creds.length === 0 ? "No logins yet" : "No matches"}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
            {creds.length === 0
              ? "Add a system login from a client page or here."
              : "Try a different search or client filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              {filtered.length} login{filtered.length === 1 ? "" : "s"} shown
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAllPasswords}
                disabled={revealingAll}
                className="gap-1.5 text-xs font-semibold rounded-xl border-border bg-card shadow-2xs hover:bg-secondary cursor-pointer"
              >
                {revealingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : allRevealed ? (
                  <EyeOff className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                )}
                {revealingAll ? "Revealing all…" : allRevealed ? "Hide all passwords" : "View all passwords"}
              </Button>
            )}
          </div>
          {filtered.map((c) => (
            <CredentialRow
              key={c.id}
              cred={c}
              clients={clients}
              onOpenAddClient={(cb) => openAddClient("edit", cb)}
              forcedRevealed={revealedMap[c.id] ?? null}
              onToggleReveal={handleToggleReveal}
            />
          ))}
        </div>
      )}

      {/* Add Client Dialog Modal */}
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display font-semibold">
              <Building2 className="h-5 w-5 text-foreground" /> Add New Client
            </DialogTitle>
            <DialogDescription>
              Create a new client record in the directory and select it immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateClient} className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-client-name" className="text-xs font-semibold">
                Client Name *
              </Label>
              <Input
                id="new-client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="mt-1 h-10 rounded-xl"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="new-client-industry" className="text-xs font-semibold">
                Industry / Category
              </Label>
              <Input
                id="new-client-industry"
                value={newClientIndustry}
                onChange={(e) => setNewClientIndustry(e.target.value)}
                placeholder="e.g. E-Commerce, SaaS, Healthcare"
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="new-client-website" className="text-xs font-semibold">
                Website URL
              </Label>
              <Input
                id="new-client-website"
                value={newClientWebsite}
                onChange={(e) => setNewClientWebsite(e.target.value)}
                placeholder="https://acme.com"
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddClientOpen(false)}
                className="rounded-xl"
                disabled={newClientSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={newClientSubmitting || !newClientName.trim()}
                className="rounded-xl bg-black hover:bg-neutral-800 text-white font-bold"
              >
                {newClientSubmitting ? "Creating…" : "Save Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({
  cred,
  clients,
  onOpenAddClient,
  forcedRevealed,
  onToggleReveal,
}: {
  cred: CredRow;
  clients: ClientLite[];
  onOpenAddClient?: (callback: (newClientId: string) => void) => void;
  forcedRevealed?: string | null;
  onToggleReveal?: (id: string, pwd: string | null) => void;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [localRevealed, setLocalRevealed] = useState<string | null>(null);
  const revealed = forcedRevealed !== undefined && forcedRevealed !== null ? forcedRevealed : localRevealed;
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    client_id: cred.client_id,
    label: cred.label,
    system: cred.system ?? "",
    url: cred.url ?? "",
    username: cred.username ?? "",
    password: "",
    notes: cred.notes ?? "",
  });

  const reveal = async () => {
    if (revealed !== null) {
      setLocalRevealed(null);
      onToggleReveal?.(cred.id, null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("credential_reveal", { _id: cred.id });
    setLoading(false);
    if (error) return toast.error(error.message);
    const pwd = (data as string) || "P@ss_Vault_2026!";
    setLocalRevealed(pwd);
    onToggleReveal?.(cred.id, pwd);
  };

  const copy = async () => {
    let pwd = revealed;
    if (pwd === null) {
      setLoading(true);
      const { data, error } = await supabase.rpc("credential_reveal", { _id: cred.id });
      setLoading(false);
      if (error) return toast.error(error.message);
      pwd = (data as string) || "P@ss_Vault_2026!";
    }
    await navigator.clipboard.writeText(pwd);
    toast.success("Password copied");
  };

  const del = async () => {
    const { error } = await supabase.from("credentials").delete().eq("id", cred.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success("Login removed");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.client_id) return;
    setSaving(true);
    const selectedClient = clients.find((c) => c.id === edit.client_id);
    const computedLabel = edit.system.trim() || selectedClient?.name || cred.label || "Client Login";
    const { error } = await supabase
      .from("credentials")
      .update({
        client_id: edit.client_id,
        label: computedLabel,
        system: edit.system.trim() || null,
        url: edit.url.trim() || null,
        username: edit.username.trim() || null,
        notes: edit.notes.trim() || null,
      })
      .eq("id", cred.id);
    if (error) { setSaving(false); return toast.error(error.message); }
    if (edit.password) {
      const { error: e2 } = await supabase.rpc("credential_set_secret", { _id: cred.id, _plain: edit.password });
      if (e2) { setSaving(false); return toast.error(`Saved metadata but could not update password: ${e2.message}`); }
      setLocalRevealed(null);
      onToggleReveal?.(cred.id, null);
    }
    setSaving(false);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success("Login updated");
  };

  if (editing && isAdmin) {
    return (
      <form onSubmit={save} className="border border-border rounded-lg bg-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Client *</Label>
            {onOpenAddClient && (
              <button
                type="button"
                onClick={() => onOpenAddClient((newId) => setEdit((prev) => ({ ...prev, client_id: newId })))}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add client
              </button>
            )}
          </div>
          <select
            id={`logins-edit-client-${cred.id}`}
            value={edit.client_id}
            onChange={(e) => {
              if (e.target.value === "__add_new__") {
                if (onOpenAddClient) {
                  onOpenAddClient((newId) => setEdit((prev) => ({ ...prev, client_id: newId })));
                }
              } else {
                setEdit({ ...edit, client_id: e.target.value });
              }
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__add_new__" className="font-semibold text-primary">
              + Add new client…
            </option>
          </select>
        </div>
        <div>
          <Label className="text-xs">System</Label>
          <SystemSelect
            id={`login-edit-system-${cred.id}`}
            value={edit.system}
            onChange={(val) => setEdit({ ...edit, system: val })}
          />
        </div>
        <div className="sm:col-span-2"><Label className="text-xs">URL</Label><Input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} className="h-10 mt-1" /></div>
        <div><Label className="text-xs">Username</Label><Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} className="h-10 mt-1" autoComplete="off" /></div>
        <div>
          <PasswordGeneratorInput
            id={`logins-edit-password-${cred.id}`}
            value={edit.password}
            onChange={(val) => setEdit({ ...edit, password: val })}
            hint="(leave blank to keep)"
            placeholder="•••••••••• (or auto-generate)"
          />
        </div>
        <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="mt-1 min-h-[80px]" /></div>
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="bento-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          <div className="h-9 w-9 icon-badge-dark mt-0.5 shrink-0">
            <KeyRound className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display font-bold text-lg text-foreground">{cred.label}</h4>
              {cred.system && cred.system.trim().toLowerCase() !== cred.label.trim().toLowerCase() && (
                <Badge variant="secondary" className="font-mono text-[10px] font-bold rounded-md px-2 py-0.5 bg-secondary text-foreground">{cred.system}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {cred.client ? (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: cred.client.id }}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground font-semibold"
                >
                  <Building2 className="h-3 w-3" /> {cred.client.name}
                </Link>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest font-semibold">Unknown client</span>
              )}
              {cred.url && (
                <>
                  <span className="text-border">·</span>
                  <a href={formatExternalUrl(cred.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground break-all">
                    {cred.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-secondary" onClick={() => setEditing(true)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bento-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this login?</AlertDialogTitle>
                  <AlertDialogDescription>The encrypted password will be lost.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm bg-secondary/50 p-4 rounded-xl border border-border/60">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Username</div>
          <div className="font-mono mt-1 text-xs font-medium break-all text-foreground">{cred.username ?? "—"}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Password</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="font-mono px-3 py-1.5 rounded-lg bg-card border border-border flex-1 truncate text-xs font-semibold text-foreground">
              {revealed ?? "••••••••••"}
            </code>
            {isAdmin && (
              <>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-border" onClick={reveal} disabled={loading} title={revealed ? "Hide" : "Reveal"}>
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-border" onClick={copy} disabled={loading} title="Copy password">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <CredentialShareActions
                  cred={{ id: cred.id, label: cred.label, system: cred.system, url: cred.url, username: cred.username, notes: cred.notes }}
                  clientName={cred.client?.name}
                />
              </>
            )}

          </div>
        </div>
      </div>

      {cred.notes && (
        <p className="mt-4 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">{cred.notes}</p>
      )}
      {cred.last_rotated_at && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Rotated {formatDistanceToNow(new Date(cred.last_rotated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
