"use client";

import { useState, useEffect } from "react";
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
import axios from "axios";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function HealthScoreTab({ repositoryId }: HealthScoreTabProps) {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/intelligence/${repositoryId}/health`);
      setData(response.data);
    } catch (err) {
      console.error("Failed to load health assessment:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [repositoryId]);

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

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Computing deterministic repository health metrics...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Overview Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> {data.assessmentLabel}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Repository Health & Quality Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Derived from file trees, modularity, test coverage, and security posture.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 min-w-[130px] text-center shadow-2xs">
            <span className="text-4xl font-black text-slate-900">{data.overallScore}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Out of 100</span>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Metric Dashboard Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Files</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{data.filesCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Vector Chunks</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">{data.chunksCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Security Audit</span>
          <span className="text-sm font-bold text-orange-700 mt-1.5 block">
            {data.securitySummary.high} High · {data.securitySummary.medium} Med
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Code Review</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {data.codeReviewSummary.totalFindings} Findings
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Architecture</span>
          <span className="text-sm font-bold text-[#008F75] mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {data.architectureStatus}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Documentation</span>
          <span className="text-sm font-bold text-blue-700 mt-1.5 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-blue-600" /> {data.docStatus}
          </span>
        </div>
      </div>

      {/* Language Breakdown Bar */}
      {data.languages && data.languages.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#008F75]" /> Repository Language Distribution
          </h3>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5">
            {data.languages.map((l, idx) => {
              const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-500", "bg-rose-500", "bg-slate-400"];
              return (
                <div
                  key={idx}
                  style={{ width: `${l.percentage}%` }}
                  className={`${colors[idx % colors.length]} transition-all`}
                  title={`${l.name}: ${l.percentage}% (${l.count} files)`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            {data.languages.map((l, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="font-medium text-slate-700">{l.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">{l.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Potential Issues & Alerts */}
      {data.potentialProblems && data.potentialProblems.length > 0 && (
        <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Detected Health & Maintenance Warnings:
          </h3>
          <div className="space-y-1">
            {data.potentialProblems.map((prob, idx) => (
              <div key={idx} className="text-xs text-amber-900 flex items-start gap-2 font-medium">
                <span className="text-amber-500 font-bold">•</span>
                <span>{prob}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.categories.map((cat, idx) => {
          const Icon = getCategoryIcon(cat.name);
          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                    <Icon className="w-4 h-4 text-[#008F75]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{cat.name}</h3>
                    <span className="text-[11px] text-slate-400 font-medium">Weight: {Math.round(cat.weight * 100)}%</span>
                  </div>
                </div>

                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getScoreColor(cat.score)}`}>
                  {cat.score} / 100
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-[#008F75] transition-all duration-500"
                  style={{ width: `${cat.score}%` }}
                />
              </div>

              {/* Evidence Items */}
              <div className="space-y-1.5 pt-1">
                {cat.evidence.map((ev, eIdx) => (
                  <div key={eIdx} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-slate-400 font-mono text-[10px] mt-0.5">›</span>
                    <span>{ev}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
