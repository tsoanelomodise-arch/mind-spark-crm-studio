import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as mockSupabase } from "./client";

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    !SUPABASE_URL.includes("MY_SUPABASE")
  ) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // Fall back to local mock server client
  return mockSupabase as any;
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
