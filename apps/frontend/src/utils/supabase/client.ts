import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://oiyavpehrmegpvyzeedz.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9peWF2cGVocm1lZ3B2eXplZWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQ0NzcsImV4cCI6MjEwMTY5MDQ3N30.AuJyYm-3x1k4XGNJ9rJ-oJqENAR7bHsa5v1_04lZL94";

export const createClient = () => {
  try {
    return createBrowserClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn("Supabase browser client init error:", err);
    return null as any;
  }
};
