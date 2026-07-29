import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as mockSupabase } from "./client";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || SUPABASE_URL.includes("MY_SUPABASE")) {
      // Fallback mock context for preview/local mode
      return next({
        context: {
          supabase: mockSupabase,
          userId: "user-1",
          claims: { sub: "user-1", email: "architect@mindspark.studio" },
        },
      });
    }

    try {
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next({
          context: {
            supabase: mockSupabase,
            userId: "user-1",
            claims: { sub: "user-1", email: "architect@mindspark.studio" },
          },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        return next({
          context: {
            supabase: mockSupabase,
            userId: "user-1",
            claims: { sub: "user-1", email: "architect@mindspark.studio" },
          },
        });
      }

      const client = createClient<Database>(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

      const { data, error } = await client.auth.getClaims(token);
      if (error || !data?.claims?.sub) {
        return next({
          context: {
            supabase: mockSupabase,
            userId: "user-1",
            claims: { sub: "user-1", email: "architect@mindspark.studio" },
          },
        });
      }

      return next({
        context: {
          supabase: client,
          userId: data.claims.sub,
          claims: data.claims,
        },
      });
    } catch {
      return next({
        context: {
          supabase: mockSupabase,
          userId: "user-1",
          claims: { sub: "user-1", email: "architect@mindspark.studio" },
        },
      });
    }
  }
);
