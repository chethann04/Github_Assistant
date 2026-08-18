const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// Ensure API_BASE points to /api/v1 without double slashes
export const API_BASE = rawApiUrl.replace(/\/+$/, "").endsWith("/api/v1")
  ? rawApiUrl.replace(/\/+$/, "")
  : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`;

const SESSION_STORAGE_KEY = "github_assistant_session_id";

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    /* silent */
  }
}

/**
 * Builds a URL with sessionId query param attached for SSE / EventSource streams
 * where custom headers cannot be set natively.
 */
export function buildSseUrl(pathOrUrl: string): string {
  const base = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  const sessionId = getStoredSessionId();
  if (!sessionId) return base;

  const separator = base.includes("?") ? "&" : "?";
  if (base.includes("sessionId=")) return base;
  return `${base}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * Authenticated fetch wrapper that attaches x-session-id headers and captures session updates
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const sessionId = getStoredSessionId();

  if (sessionId && !headers.has("x-session-id")) {
    headers.set("x-session-id", sessionId);
  }

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  // Capture session ID returned by server
  const returnedSessionId =
    response.headers.get("x-session-id") ||
    response.headers.get("X-Session-Id");
  if (returnedSessionId) {
    setStoredSessionId(returnedSessionId);
  }

  return response;
}
