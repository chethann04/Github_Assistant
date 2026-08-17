"use client";

import { useState, useEffect } from "react";
import {
  GitCompare,
  Star,
  GitFork,
  Activity,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import axios from "axios";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface CompareTabProps {
  currentRepoId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function CompareTab({ currentRepoId }: CompareTabProps) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");

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
    repositoryId: currentRepoId,
    type: "COMPARE_REPOS",
    targetParam: selectedRepoId || null,
    autoRunIfNone: false,
  });

  const comparisonData = result;

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await axios.get(`${API_BASE}/repos`, { withCredentials: true });
        const otherRepos = (res.data || []).filter((r: any) => r.id !== currentRepoId);
        setRepos(otherRepos);
        if (otherRepos.length > 0 && !selectedRepoId) {
          setSelectedRepoId(otherRepos[0].id);
        }
      } catch (err) {
        console.error("Failed to load repositories:", err);
      }
    };
    fetchRepos();
  }, [currentRepoId, selectedRepoId]);

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1.5 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200 w-fit">
            <GitCompare className="w-3.5 h-3.5 text-cyan-600" /> Side-by-Side Comparison
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Cross-Repository Health & Architecture Comparison
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Compare codebase architecture, complexity, and security posture across projects.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true, selectedRepoId, { targetRepoId: selectedRepoId })}
          disabled={isRunning || !selectedRepoId}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Compare Repositories</span>
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
        onRunLatest={() => triggerJob(true, selectedRepoId, { targetRepoId: selectedRepoId })}
      />

      {/* Target Repo Picker */}
      {repos.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Select Target Repository:</label>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-hidden"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.owner}/{r.name} ({r.language || "Unknown"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Comparison Grid View */}
      {comparisonData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Repo 1 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">{comparisonData.repo1.owner}/{comparisonData.repo1.name}</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>★ {comparisonData.repo1.stars}</span>
              <span>🍴 {comparisonData.repo1.forks}</span>
              <span className="font-mono font-semibold">{comparisonData.repo1.language}</span>
            </div>
            {comparisonData.repo1.health && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Health Score</span>
                <span className="text-lg font-black text-emerald-700">{comparisonData.repo1.health.overallScore}/100</span>
              </div>
            )}
          </div>

          {/* Repo 2 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">{comparisonData.repo2.owner}/{comparisonData.repo2.name}</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>★ {comparisonData.repo2.stars}</span>
              <span>🍴 {comparisonData.repo2.forks}</span>
              <span className="font-mono font-semibold">{comparisonData.repo2.language}</span>
            </div>
            {comparisonData.repo2.health && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Health Score</span>
                <span className="text-lg font-black text-emerald-700">{comparisonData.repo2.health.overallScore}/100</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
