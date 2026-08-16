import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://oiyavpehrmegpvyzeedz.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9peWF2cGVocm1lZ3B2eXplZWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQ0NzcsImV4cCI6MjEwMTY5MDQ3N30.AuJyYm-3x1k4XGNJ9rJ-oJqENAR7bHsa5v1_04lZL94";

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  try {
    return createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in Server Component
          }
        },
      },
    });
  } catch (err) {
    console.warn("Supabase server client error:", err);
    return null as any;
  }
};
