"use client";

import { useState } from "react";
import { GitPullRequest, AlertCircle, CheckCircle2, ChevronRight, Loader2, FileCode, Shield } from "lucide-react";
import axios from "axios";

interface ImpactAnalysisTabProps {
  repositoryId: string;
  files: Array<{ path: string; size: number }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function ImpactAnalysisTab({ repositoryId, files }: ImpactAnalysisTabProps) {
  const [selectedFile, setSelectedFile] = useState<string>(files[0]?.path || "");
  const [loading, setLoading] = useState(false);
  const [impactResult, setImpactResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/intelligence/${repositoryId}/impact`, {
        filePath: selectedFile,
      });
      setImpactResult(res.data);
    } catch (err: any) {
      console.error("Failed to analyze impact:", err);
      setError(err.response?.data?.error || "Failed to analyze file dependencies and impact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 w-fit">
            <GitPullRequest className="w-3.5 h-3.5" /> Static & AI Code Impact Analysis
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Dependency & Downstream Risk Scanner</h2>
        </div>
      </div>

      {/* File Selector Form */}
      <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">
            Select Target File to Analyze:
          </label>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
          >
            {files.map((f, idx) => (
              <option key={idx} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !selectedFile}
          className="w-full sm:w-auto mt-auto sm:mt-5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Analyze Impact
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 my-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {impactResult && (
        <div className="space-y-6 animate-in fade-in">
          {/* Impact Badge & Overview */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-slate-500">Target File:</span>
              <h3 className="text-base font-bold text-slate-900 font-mono">{impactResult.filePath}</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Predicted Impact:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  impactResult.impactLevel === "HIGH"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : impactResult.impactLevel === "MEDIUM"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {impactResult.impactLevel} RISK
              </span>
            </div>
          </div>

          {/* AI Explanation Summary */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Architectural Impact Summary
            </h4>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line">
              {impactResult.summary}
            </p>
          </div>

          {/* Direct Dependents List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-600" />
              Direct Dependent Modules ({impactResult.directDependents.length})
            </h4>

            {impactResult.directDependents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>No direct static imports found across scanned files. This file acts as a standalone leaf component or entry point.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {impactResult.directDependents.map((dep: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900 truncate">{dep.file}</span>
                      <span className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-semibold shrink-0">
                        {dep.confidence}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{dep.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
