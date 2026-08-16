import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    if (supabase) {
      await supabase.auth.getUser();
    }
    return response;
  } catch (err) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/todos/:path*",
  ],
};
