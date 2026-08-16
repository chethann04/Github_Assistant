"use client";

import { useState, useEffect } from "react";
import { Activity, ShieldCheck, FileCheck, Code2, Wrench, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import axios from "axios";

interface HealthCategory {
  name: string;
  score: number;
  weight: number;
  evidence: string[];
}

interface HealthScoreData {
  overallScore: number;
  assessmentLabel: string;
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
    return "text-red-700 bg-red-50 border-red-200";
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
      <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Computing evidence-based repository health assessment...</span>
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
          <h2 className="text-xl font-bold text-slate-900 mt-2">Repository Health & Maintenance Score</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Calculated using deterministic evidence from file trees, documentation coverage, modularity, and secret protection policies.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 min-w-[120px] text-center shadow-2xs">
            <span className="text-3xl font-extrabold text-slate-900">{data.overallScore}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Out of 100</span>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            title="Recalculate Score"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.categories.map((cat, idx) => {
          const Icon = getCategoryIcon(cat.name);
          const colorClasses = getScoreColor(cat.score);

          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${colorClasses}`}>
                  {cat.score} / 100
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    cat.score >= 80 ? "bg-emerald-600" : cat.score >= 60 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>

              {/* Evidence Points */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Observed Evidence:
                </span>
                {cat.evidence.map((ev, eIdx) => (
                  <p key={eIdx} className="text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    <span>{ev}</span>
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
