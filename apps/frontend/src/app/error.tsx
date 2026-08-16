"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Next.js App Error]:", error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-red-200 text-center m-6 shadow-sm">
      <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
      <h3 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h3>
      <p className="text-xs text-slate-600 max-w-md mb-6 leading-relaxed">
        {error?.message || "An unexpected error occurred while rendering the page."}
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-sm border border-slate-800"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Try Again</span>
      </button>
    </div>
  );
}
