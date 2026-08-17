"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  FileCode,
  Copy,
  Check,
  GitCommit,
  AlertTriangle,
  Flame,
  Info,
  Layers,
  HelpCircle,
  Wrench,
} from "lucide-react";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

export type CodeReviewSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type CodeReviewCategory =
  | "ALL"
  | "BUG"
  | "BAD_PRACTICE"
  | "DUPLICATION"
  | "MAINTAINABILITY"
  | "PERFORMANCE"
  | "ERROR_HANDLING"
  | "ARCHITECTURE"
  | "RELIABILITY";

export interface BugIssue {
  id: string;
  severity: CodeReviewSeverity;
  category: string;
  confidence?: "CONFIRMED" | "LIKELY" | "POTENTIAL";
  title: string;
  filePath: string;
  lineRange: string;
  problem?: string;
  whyItMatters?: string;
  description: string;
  suggestedFix: string;
  suggestedPatch?: string;
}

interface BugDetectorTabProps {
  repositoryId: string;
}

const CATEGORIES: Array<{ id: CodeReviewCategory | "ALL"; label: string }> = [
  { id: "ALL", label: "All Categories" },
  { id: "RELIABILITY", label: "Reliability & Edge Cases" },
  { id: "ERROR_HANDLING", label: "Error Handling" },
  { id: "PERFORMANCE", label: "Performance" },
  { id: "MAINTAINABILITY", label: "Maintainability" },
  { id: "ARCHITECTURE", label: "Architecture" },
  { id: "BAD_PRACTICE", label: "Anti-Patterns" },
];

export default function BugDetectorTab({ repositoryId }: BugDetectorTabProps) {
  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CodeReviewCategory>("ALL");

  const {
    result,
    status,
    progress,
    currentStage,
    error,
    isStaleCommit,
    isRunning,
    triggerJob,
    cancelJob,
    retryJob,
  } = useAnalysisJob<BugIssue[]>({
    repositoryId,
    type: "CODE_REVIEW",
    autoRunIfNone: true,
  });

  const bugs: BugIssue[] = Array.isArray(result) ? result : [];

  const handleCopyPatch = (patch: string, bugId: string) => {
    navigator.clipboard.writeText(patch);
    setCopiedPatchId(bugId);
    setTimeout(() => setCopiedPatchId(null), 2000);
  };

  const filteredBugs = bugs.filter((b) => {
    if (selectedCategory === "ALL") return true;
    return b.category?.toUpperCase() === selectedCategory;
  });

  const criticalCount = bugs.filter((b) => b.severity === "CRITICAL").length;
  const highCount = bugs.filter((b) => b.severity === "HIGH").length;
  const mediumCount = bugs.filter((b) => b.severity === "MEDIUM").length;
  const lowCount = bugs.filter((b) => b.severity === "LOW" || b.severity === "INFO").length;

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 w-fit">
            <ShieldAlert className="w-3.5 h-3.5" /> Comprehensive Code Review
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Advanced Code Review & Defect Analysis
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Grounded automated inspection across reliability, error boundaries, performance, and maintainability.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Rescan Code Review</span>
        </button>
      </div>

      {/* Background Analysis Progress & Stage Banner */}
      <div className="mt-4">
        <AnalysisProgressBanner
          status={status}
          progress={progress}
          currentStage={currentStage}
          error={error}
          isStaleCommit={isStaleCommit}
          onCancel={cancelJob}
          onRetry={retryJob}
          onRunLatest={() => triggerJob(true)}
        />
      </div>

      {/* Metric Counters Header */}
      {bugs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-rose-700 block">Critical</span>
              <span className="text-xl font-bold">{criticalCount}</span>
            </div>
            <Flame className="w-5 h-5 text-rose-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-orange-700 block">High</span>
              <span className="text-xl font-bold">{highCount}</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-700 block">Medium</span>
              <span className="text-xl font-bold">{mediumCount}</span>
            </div>
            <Layers className="w-5 h-5 text-amber-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-600 block">Low / Info</span>
              <span className="text-xl font-bold">{lowCount}</span>
            </div>
            <Info className="w-5 h-5 text-slate-500 opacity-80" />
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      {bugs.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 text-xs scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = cat.id === "ALL" ? bugs.length : bugs.filter((b) => b.category?.toUpperCase() === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-[#008F75] text-white border-[#008F75] shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Findings List */}
      <div>
        {filteredBugs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-slate-900 font-semibold">No issues found in this category</h4>
            <p className="text-xs text-slate-500 mt-1">
              Scanned code structures adhere cleanly to expected patterns.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBugs.map((bug) => {
              const severityColor =
                bug.severity === "CRITICAL"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : bug.severity === "HIGH"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : bug.severity === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : bug.severity === "LOW"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={bug.id}
                  className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-2xs"
                >
                  {/* Top Finding Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/70">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${severityColor}`}>
                        {bug.severity}
                      </span>
                      {bug.category && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 font-semibold">
                          {bug.category}
                        </span>
                      )}
                      {bug.confidence && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                          {bug.confidence}
                        </span>
                      )}
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{bug.title}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 shrink-0">
                      <FileCode className="w-3.5 h-3.5 text-[#008F75]" />
                      <span className="font-semibold text-slate-800">{bug.filePath}</span>
                      <span className="text-slate-400">({bug.lineRange})</span>
                    </div>
                  </div>

                  {/* Problem & Impact Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Problem
                      </span>
                      <p className="text-slate-700 leading-relaxed font-medium">
                        {bug.problem || bug.description}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> Why It Matters
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {bug.whyItMatters || "May impact system reliability, maintainability, or error resilience."}
                      </p>
                    </div>
                  </div>

                  {/* Suggested Fix */}
                  <div className="p-3.5 rounded-xl bg-[#E8F7F2]/60 border border-[#D9E5E1] text-xs text-slate-800 shadow-2xs space-y-1">
                    <span className="text-[10px] text-[#008F75] uppercase tracking-wider block font-bold flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Suggested Remediation / Fix:
                    </span>
                    <p className="text-xs leading-relaxed text-slate-800 font-medium">
                      {bug.suggestedFix}
                    </p>
                  </div>

                  {/* Unified Diff Patch */}
                  {bug.suggestedPatch && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 text-xs font-mono">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-300">
                          <GitCommit className="w-3.5 h-3.5 text-[#008F75]" /> Suggested Code Patch (Unified Diff)
                        </span>
                        <button
                          onClick={() => handleCopyPatch(bug.suggestedPatch!, bug.id)}
                          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                        >
                          {copiedPatchId === bug.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#10B981]" />
                              <span className="text-[#10B981]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Patch</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed font-mono text-xs">
                        {bug.suggestedPatch.split("\n").map((line, lIdx) => {
                          const isDel = line.startsWith("-");
                          const isAdd = line.startsWith("+");
                          return (
                            <div
                              key={lIdx}
                              className={
                                isDel
                                  ? "text-rose-400 bg-rose-950/40 px-1 rounded-xs"
                                  : isAdd
                                  ? "text-emerald-400 bg-emerald-950/40 px-1 rounded-xs"
                                  : "text-slate-400"
                              }
                            >
                              {line}
                            </div>
                          );
                        })}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
