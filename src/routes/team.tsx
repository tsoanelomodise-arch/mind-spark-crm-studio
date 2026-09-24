import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  User as UserIcon,
  Mail,
  UserPlus,
  Trash2,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Building,
  Sparkles,
  RefreshCw,
} from "lucide-react";
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
import { inviteTeamMember, listTeamMembers, removeTeamMember } from "@/lib/team.functions";
import { formatDistanceToNow } from "date-fns";
import { FormErrorAlert } from "@/components/FormErrorAlert";
import { WorkspaceIcon } from "@/components/ui/bespoke-icons";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { user, isAdmin: currentUserIsAdmin } = useAuth();
  const fetchMembers = useServerFn(listTeamMembers);
  const invite = useServerFn(inviteTeamMember);
  const remove = useServerFn(removeTeamMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchMembers(),
  });

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        m.user_id.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const isAdmin = m.roles.includes("admin");
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && isAdmin) ||
        (roleFilter === "member" && !isAdmin);

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = members.length;
    const admins = members.filter((m) => m.roles.includes("admin")).length;
    const active = members.filter((m) => !!m.lastSignInAt || m.confirmed).length;
    const pending = members.filter((m) => !m.confirmed && !m.lastSignInAt).length;
    return { total, admins, active, pending };
  }, [members]);

  const setAdmin = async (uid: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      if (uid === user?.id) return toast.error("You cannot remove your own admin role.");
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", uid)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["team"] });
    toast.success(makeAdmin ? "Promoted teammate to Admin" : "Admin role revoked");
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (!email.trim()) {
      const msg = "Teammate email is required.";
      setInviteError(msg);
      toast.error(msg);
      return;
    }
    setInviting(true);
    try {
      const res = await invite({ data: { email: email.trim(), role } });
      toast.success(
        res.alreadyExisted
          ? "Teammate existed — workspace role updated"
          : `Invite sent to ${res.email}`,
      );
      setEmail("");
      setRole("member");
      setInviteError(null);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      setInviteError(msg);
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const onRemove = async (uid: string) => {
    try {
      await remove({ data: { userId: uid } });
      toast.success("Teammate removed from workspace");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/80">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
              <WorkspaceIcon size={14} />
            </span>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace & Access
            </p>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Team Directory
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Manage studio teammates, role assignments, permissions, and invitations across the
            agency workspace.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Teammates</span>
            <UserIcon className="h-4 w-4" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground">Workspace members</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Administrators</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.admins}</p>
          <p className="text-[11px] text-muted-foreground">Full access & billing</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.active}</p>
          <p className="text-[11px] text-muted-foreground">Confirmed accounts</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Invites</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.pending}</p>
          <p className="text-[11px] text-muted-foreground">Awaiting sign-in</p>
        </div>
      </div>

      {/* Invite Teammate Card */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
        <FormErrorAlert
          error={inviteError}
          onDismiss={() => setInviteError(null)}
          title="Failed to invite teammate"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-foreground">
                Invite a Teammate
              </h2>
              <p className="text-xs text-muted-foreground">
                Send an invitation to collaborate on mind maps, prompt libraries, and client
                pipelines.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onInvite} className="space-y-4 pt-1">
          <div className="grid sm:grid-cols-[1fr_200px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@agency.com"
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Workspace Role</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "member" | "admin")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="member">Member (Read/Write)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={inviting || !email.trim()}
              className="gap-2 h-10 px-5 font-semibold shrink-0"
            >
              {inviting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>
              Admins can configure team roles, create deliverables, and reveal vault credentials.
              Members have access to all CRM assets and mind maps.
            </span>
          </div>
        </form>
      </div>

      {/* Directory Table / Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`px-2.5 py-1 text-xs rounded-md transition font-medium ${
                roleFilter === "all"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("admin")}
              className={`px-2.5 py-1 text-xs rounded-md transition font-medium ${
                roleFilter === "admin"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admins ({stats.admins})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("member")}
              className={`px-2.5 py-1 text-xs rounded-md transition font-medium ${
                roleFilter === "member"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Members ({stats.total - stats.admins})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">
              Loading workspace team members...
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center space-y-3">
            <WorkspaceIcon size={32} className="mx-auto text-muted-foreground/60" />
            <div>
              <p className="text-sm font-semibold text-foreground">No teammates found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery
                  ? "Try refining your search filter above."
                  : "Invite your first teammate to join this workspace."}
              </p>
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs h-8"
              >
                Clear search filter
              </Button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Teammate</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status / Activity</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMembers.map((m) => {
                    const isMemberAdmin = m.roles.includes("admin");
                    const isCurrentUser = m.user_id === user?.id || m.email === user?.email;
                    const isPending = !m.confirmed && !m.lastSignInAt;

                    return (
                      <tr key={m.user_id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground font-semibold text-xs shrink-0 border border-border">
                              {m.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                                  {m.email}
                                </span>
                                {isCurrentUser && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-mono border-primary/40 bg-primary/5 text-primary"
                                  >
                                    You
                                  </Badge>
                                )}
                              </div>
                              <p className="font-mono text-[11px] text-muted-foreground truncate">
                                ID: {m.user_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase font-semibold tracking-wider px-2.5 py-1 rounded-full border ${
                              isMemberAdmin
                                ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {isMemberAdmin ? (
                              <ShieldCheck className="h-3 w-3" />
                            ) : (
                              <UserIcon className="h-3 w-3" />
                            )}
                            {isMemberAdmin ? "Admin" : "Member"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {isPending ? (
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Invitation pending</span>
                            </div>
                          ) : m.lastSignInAt ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>
                                Active{" "}
                                {formatDistanceToNow(new Date(m.lastSignInAt), { addSuffix: true })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-foreground font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Joined</span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isMemberAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isCurrentUser}
                                onClick={() => setAdmin(m.user_id, false)}
                                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
                              >
                                Revoke Admin
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAdmin(m.user_id, true)}
                                className="h-8 text-xs border-border font-medium hover:bg-primary hover:text-primary-foreground"
                              >
                                Make Admin
                              </Button>
                            )}

                            {!isCurrentUser && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    title={`Remove ${m.email}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove {m.email}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will revoke all access for this teammate from the
                                      workspace. Any content, prompts, or notes created by them will
                                      remain preserved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onRemove(m.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove Teammate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
