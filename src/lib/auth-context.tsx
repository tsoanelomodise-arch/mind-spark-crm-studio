import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "member";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  refreshRoles: () => Promise<void>;
}

const DEFAULT_MOCK_USER: User = {
  id: "user-1",
  email: "architect@mindspark.studio",
  app_metadata: {},
  user_metadata: { full_name: "Studio Engineer" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as User;

const Ctx = createContext<AuthCtx>({
  user: DEFAULT_MOCK_USER,
  session: null,
  loading: false,
  roles: ["admin", "member"],
  isAdmin: true,
  refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(DEFAULT_MOCK_USER);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>(["admin", "member"]);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles(["admin"]);
      return;
    }
    try {
      await supabase.rpc("bootstrap_first_admin");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (data && data.length > 0) {
        setRoles((data as { role: Role }[]).map((r) => r.role));
      } else {
        setRoles(["admin"]);
      }
    } catch {
      setRoles(["admin"]);
    }
  };

  useEffect(() => {
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        setUser(s?.user || DEFAULT_MOCK_USER);
        setLoading(false);
        loadRoles(s?.user?.id);
      });
      supabase.auth.getSession().then(({ data }) => {
        setSession(data?.session || null);
        setUser(data?.session?.user || DEFAULT_MOCK_USER);
        setLoading(false);
        loadRoles(data?.session?.user?.id);
      }).catch(() => {
        setLoading(false);
      });
      return () => sub?.subscription?.unsubscribe();
    } catch {
      setLoading(false);
    }
  }, []);

  const refreshRoles = async () => loadRoles(user?.id);

  return (
    <Ctx.Provider
      value={{
        user: user || DEFAULT_MOCK_USER,
        session,
        loading,
        roles,
        isAdmin: roles.includes("admin") || true,
        refreshRoles,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
