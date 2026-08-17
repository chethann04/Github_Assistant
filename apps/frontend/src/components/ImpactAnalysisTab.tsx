"use client";

import { useState } from "react";
import { GitPullRequest, AlertCircle, CheckCircle2, ChevronRight, FileCode, Shield, RefreshCw } from "lucide-react";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface ImpactAnalysisTabProps {
  repositoryId: string;
  files: Array<{ path: string; size: number }>;
}

export default function ImpactAnalysisTab({ repositoryId, files }: ImpactAnalysisTabProps) {
  const [selectedFile, setSelectedFile] = useState<string>(files[0]?.path || "src/index.ts");

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
  } = useAnalysisJob({
    repositoryId,
    type: "IMPACT_ANALYSIS",
    targetParam: selectedFile,
    autoRunIfNone: false,
  });

  const impactResult = result;

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 w-fit">
            <GitPullRequest className="w-3.5 h-3.5" /> Static & AI Code Impact Analysis
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Dependency & Downstream Risk Scanner</h2>
          <p className="text-xs text-slate-500 mt-1">Trace blast radius, direct callers, and ripple risks across downstream modules.</p>
        </div>
      </div>

      {/* File Selector Form */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
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
          onClick={() => triggerJob(true, selectedFile, { filePath: selectedFile })}
          disabled={isRunning || !selectedFile}
          className="w-full sm:w-auto px-5 py-2 mt-auto rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Analyze Blast Radius</span>
        </button>
      </div>

      {/* Background Analysis Progress & Stage Banner */}
      <AnalysisProgressBanner
        status={status}
        progress={progress}
        currentStage={currentStage}
        error={error}
        isStaleCommit={isStaleCommit}
        onCancel={cancelJob}
        onRetry={retryJob}
        onRunLatest={() => triggerJob(true, selectedFile, { filePath: selectedFile })}
      />

      {/* Results View */}
      {impactResult && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" /> Blast Radius Summary
            </h3>
            <p className="text-xs text-slate-600 mt-2 font-mono bg-white p-3 rounded-lg border border-slate-200">
              {impactResult.explanation || impactResult.summary || "Analysis completed successfully."}
            </p>
          </div>

          {impactResult.affectedFiles && impactResult.affectedFiles.length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Directly Dependent Files ({impactResult.affectedFiles.length})
              </h4>
              <div className="space-y-1.5">
                {impactResult.affectedFiles.map((file: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 font-mono">
                    <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
