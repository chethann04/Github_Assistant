"use client";

import { useState } from "react";
import {
  Activity,
  ShieldCheck,
  FileCheck,
  Code2,
  Wrench,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Cpu,
  Layers,
  Globe,
  Flame,
} from "lucide-react";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface HealthCategory {
  name: string;
  score: number;
  weight: number;
  evidence: string[];
}

interface LanguageStat {
  name: string;
  count: number;
  percentage: number;
}

interface HealthScoreData {
  overallScore: number;
  assessmentLabel: string;
  filesCount: number;
  chunksCount: number;
  languages: LanguageStat[];
  dependenciesCount: number;
  securitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  codeReviewSummary: {
    totalFindings: number;
  };
  architectureStatus: string;
  docStatus: string;
  potentialProblems: string[];
  categories: HealthCategory[];
}

interface HealthScoreTabProps {
  repositoryId: string;
}

export default function HealthScoreTab({ repositoryId }: HealthScoreTabProps) {
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
  } = useAnalysisJob<HealthScoreData>({
    repositoryId,
    type: "HEALTH_SCORE",
    autoRunIfNone: true,
  });

  const data: HealthScoreData | null = result;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-rose-700 bg-rose-50 border-rose-200";
  };

  const getCategoryIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "documentation":
        return FileCheck;
      case "code quality":
        return Code2;
      case "testing":
        return CheckCircle2;
      case "security":
        return ShieldCheck;
      default:
        return Wrench;
    }
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> Multi-Dimensional Health Assessment
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Repository Architecture & Security Health Score
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Grounded evaluation across documentation completeness, code quality, dependency health, and security posture.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Recalculate Health</span>
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
        onRunLatest={() => triggerJob(true)}
      />

      {data && (
        <div className="space-y-6">
          {/* Main Score Hero Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">
                Composite Codebase Rating
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold">{data.assessmentLabel}</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Evaluated from {data.filesCount} indexed files, {data.chunksCount} code chunks, and {data.dependenciesCount} dependency links.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-emerald-400">{data.overallScore}</span>
                <span className="text-[10px] text-slate-300 font-semibold uppercase mt-0.5">/ 100</span>
              </div>
            </div>
          </div>

          {/* Sub-Category Evaluation Cards */}
          {data.categories && data.categories.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.categories.map((cat, idx) => {
                const Icon = getCategoryIcon(cat.name);
                const colorClass = getScoreColor(cat.score);
                return (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-slate-500" /> {cat.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
                        {cat.score}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full"
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>

                    <ul className="text-[11px] text-slate-500 space-y-1 pt-1">
                      {cat.evidence?.map((ev, eIdx) => (
                        <li key={eIdx} className="truncate">• {ev}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
