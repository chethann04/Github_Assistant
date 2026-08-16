"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, RefreshCw, FileCode, Copy, Check, GitCommit } from "lucide-react";
import axios from "axios";

interface BugIssue {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence?: "CONFIRMED" | "LIKELY" | "POTENTIAL";
  title: string;
  filePath: string;
  lineRange: string;
  description: string;
  suggestedFix: string;
  suggestedPatch?: string;
}

interface BugDetectorTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function BugDetectorTab({ repositoryId }: BugDetectorTabProps) {
  const [bugs, setBugs] = useState<BugIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedPatchId, setCopiedPatchId] = useState<string | null>(null);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/intelligence/${repositoryId}/bugs`);
      setBugs(response.data);
    } catch (err) {
      console.error("Failed to scan bugs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, [repositoryId]);

  const handleCopyPatch = (patch: string, bugId: string) => {
    navigator.clipboard.writeText(patch);
    setCopiedPatchId(bugId);
    setTimeout(() => setCopiedPatchId(null), 2000);
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 w-fit">
            <ShieldAlert className="w-3.5 h-3.5" /> Static & LLM Security Review
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Bug Detection & Code Quality Review</h2>
        </div>

        <button
          onClick={fetchBugs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-slate-800" : ""}`} />
          <span>Rescan Codebase</span>
        </button>
      </div>

      {/* Issues List */}
      <div className="mt-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Analyzing patterns for unhandled exceptions, null safety, and security risks...</span>
          </div>
        ) : bugs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-slate-900 font-semibold">No critical code patterns flagged</h4>
            <p className="text-xs text-slate-500 mt-1">All scanned logical blocks adhere to safe exception and parameter boundaries.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bugs.map((bug) => {
              const severityColor =
                bug.severity === "CRITICAL"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : bug.severity === "HIGH"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : bug.severity === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={bug.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${severityColor}`}>
                        {bug.severity}
                      </span>
                      {bug.confidence && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-semibold">
                          {bug.confidence}
                        </span>
                      )}
                      <h4 className="font-semibold text-slate-900 text-sm">{bug.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                      <FileCode className="w-3.5 h-3.5 text-slate-700" />
                      <span>{bug.filePath} ({bug.lineRange})</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">{bug.description}</p>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 shadow-2xs space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
                      Suggested Fix / Mitigation:
                    </span>
                    <p className="text-xs leading-relaxed text-slate-700">{bug.suggestedFix}</p>
                  </div>

                  {/* Unified Diff Patch */}
                  {bug.suggestedPatch && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 text-xs font-mono">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <GitCommit className="w-3 h-3 text-emerald-400" /> Suggested Code Patch (Diff)
                        </span>
                        <button
                          onClick={() => handleCopyPatch(bug.suggestedPatch!, bug.id)}
                          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                          {copiedPatchId === bug.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy Patch
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3 overflow-x-auto whitespace-pre leading-relaxed">
                        {bug.suggestedPatch.split("\n").map((line, lIdx) => {
                          const isDel = line.startsWith("-");
                          const isAdd = line.startsWith("+");
                          return (
                            <div
                              key={lIdx}
                              className={
                                isDel
                                  ? "text-red-400 bg-red-950/40"
                                  : isAdd
                                  ? "text-emerald-400 bg-emerald-950/40"
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
