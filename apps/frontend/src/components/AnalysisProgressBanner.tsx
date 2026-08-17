"use client";

import React from "react";
import { RefreshCw, AlertCircle, AlertTriangle, Ban, Sparkles, CheckCircle2 } from "lucide-react";

interface AnalysisProgressBannerProps {
  status: "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  currentStage?: string | null;
  error?: string | null;
  isStaleCommit?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onRunLatest?: () => void;
}

export default function AnalysisProgressBanner({
  status,
  progress,
  currentStage,
  error,
  isStaleCommit,
  onCancel,
  onRetry,
  onRunLatest,
}: AnalysisProgressBannerProps) {
  const isRunning = status === "RUNNING";
  const isQueued = status === "QUEUED";
  const isFailed = status === "FAILED";

  return (
    <div className="space-y-3">
      {/* 1. Stale Commit Alert */}
      {isStaleCommit && !isRunning && !isQueued && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Repository updated:</strong> Newer commits are available since this analysis was generated.
            </span>
          </div>
          {onRunLatest && (
            <button
              onClick={onRunLatest}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors shadow-2xs cursor-pointer"
            >
              Analyze Latest Commit
            </button>
          )}
        </div>
      )}

      {/* 2. Active Analysis Progress Banner */}
      {(isRunning || isQueued) && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm border border-slate-800 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              <span className="font-semibold text-slate-100">
                {isQueued ? "Queued in background..." : "Background Analysis in progress"}
              </span>
              {currentStage && (
                <span className="text-slate-300 text-[11px] font-mono hidden sm:inline">
                  • {currentStage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 text-[10px] font-medium border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Ban className="w-2.5 h-2.5" /> Cancel
                </button>
              )}
            </div>
          </div>

          <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>

          {currentStage && (
            <p className="text-[11px] text-slate-300 sm:hidden truncate">{currentStage}</p>
          )}
        </div>
      )}

      {/* 3. Failure Alert Banner */}
      {isFailed && error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              <strong>Analysis failed:</strong> {error}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
