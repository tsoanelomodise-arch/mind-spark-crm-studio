import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, ExternalLink } from "lucide-react";
import { ClientsIcon, BespokeBadge } from "@/components/ui/bespoke-icons";
import { DeleteClientButton } from "@/components/DeleteClientButton";

export const Route = createFileRoute("/clients/")({
  component: ClientsList,
});

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  updated_at: string;
};

function ClientsList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,industry,website,status,updated_at")
        .order("name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["clients-counts"],
    queryFn: async () => {
      const [projects, creds, prompts] = await Promise.all([
        supabase.from("projects").select("client_id"),
        supabase.from("credentials").select("client_id"),
        supabase.from("prompts").select("client_id"),
      ]);
      const out: Record<string, { p: number; c: number; pr: number }> = {};
      const bump = (id: string | null, k: "p" | "c" | "pr") => {
        if (!id) return;
        out[id] ??= { p: 0, c: 0, pr: 0 };
        out[id][k]++;
      };
      projects.data?.forEach((r) => bump(r.client_id, "p"));
      creds.data?.forEach((r) => bump(r.client_id, "c"));
      prompts.data?.forEach((r) => bump(r.client_id, "pr"));
      return out;
    },
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return clients.filter((c) => {
      if (status && c.status !== status) return false;
      if (!ql) return true;
      return (
        c.name.toLowerCase().includes(ql) ||
        c.industry?.toLowerCase().includes(ql) ||
        c.website?.toLowerCase().includes(ql)
      );
    });
  }, [clients, q, status]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            {clients.length} clients on the roster
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl font-extrabold leading-[0.92] tracking-tighter text-foreground">
            Clients.
          </h1>
          <p className="mt-3 text-foreground/70 text-base max-w-xl leading-relaxed">
            Everyone the agency works with. Projects, people, logins, and prompts — all in one shelf.
          </p>
        </div>
        <Link to="/clients/new">
          <Button className="h-11 gap-1.5">
            <Plus className="h-4 w-4" /> New client
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 bg-card rounded-xl border border-border shadow-2xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["active", "paused", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? null : s)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3.5 py-1.5 rounded-full border transition cursor-pointer ${
                status === s
                  ? "bg-black text-white border-black font-bold shadow-2xs"
                  : "bg-card text-muted-foreground border-border hover:border-black/30 hover:text-foreground shadow-2xs"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bento-card p-12 text-center border-dashed">
          <BespokeBadge size="lg" className="mx-auto mb-4">
            <ClientsIcon size={22} />
          </BespokeBadge>
          <h3 className="font-display text-2xl font-bold text-foreground">
            {clients.length === 0 ? "No clients yet" : "No matches"}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
            {clients.length === 0 ? "Add your first client to start building the CRM." : "Try a different filter."}
          </p>
          {clients.length === 0 && (
            <Link to="/clients/new" className="mt-6 inline-block">
              <Button className="rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs px-5 py-2.5 shadow-2xs">Create the first client</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4 hidden md:table-cell">Industry</th>
                <th className="px-6 py-4 text-center">Projects</th>
                <th className="px-6 py-4 text-center">Logins</th>
                <th className="px-6 py-4 text-center">Prompts</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((c) => {
                const n = counts[c.id] ?? { p: 0, c: 0, pr: 0 };
                return (
                  <tr key={c.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-4">
                      <Link to="/clients/$clientId" params={{ clientId: c.id }} className="font-display font-semibold text-foreground hover:text-neutral-600 transition-colors">
                        {c.name}
                      </Link>
                      {c.website && (
                        <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground">
                          {c.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">{c.industry ?? "—"}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs font-semibold">{n.p}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs font-semibold">{n.c}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs font-semibold">{n.pr}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                          <Button variant="outline" size="sm" className="h-8 font-mono text-[10px] uppercase tracking-widest px-3 rounded-xl border-border hover:bg-black hover:text-white transition">
                            View
                          </Button>
                        </Link>
                        <DeleteClientButton clientId={c.id} clientName={c.name} size="sm" variant="ghost" showText={false} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-foreground text-background"
      : status === "paused"
        ? "bg-paper-soft text-foreground border border-border"
        : "bg-transparent text-muted-foreground border border-border";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}
