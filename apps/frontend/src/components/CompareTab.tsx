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

interface CompareTabProps {
  currentRepoId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function CompareTab({ currentRepoId }: CompareTabProps) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await axios.get(`${API_BASE}/repos`);
        const otherRepos = (res.data || []).filter((r: any) => r.id !== currentRepoId);
        setRepos(otherRepos);
        if (otherRepos.length > 0) {
          setSelectedRepoId(otherRepos[0].id);
        }
      } catch (err) {
        console.error("Failed to load repositories:", err);
      }
    };
    fetchRepos();
  }, [currentRepoId]);

  const handleCompare = async (targetId = selectedRepoId) => {
    if (!targetId) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/intelligence/compare`, {
        repoId1: currentRepoId,
        repoId2: targetId,
      });
      setComparisonData(res.data);
    } catch (err) {
      console.error("Failed to compare repositories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRepoId) {
      handleCompare(selectedRepoId);
    }
  }, [selectedRepoId]);

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <GitCompare className="w-3.5 h-3.5 text-emerald-600" /> Multi-Repository Intelligence Compare
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Side-by-Side Codebase Comparison
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Compare architectural health, vector volume, security findings, and language footprints across repositories.
          </p>
        </div>

        {/* Target Repo Selector */}
        {repos.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Compare with:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-[#008F75]"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.owner}/{r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
          <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Synthesizing comparative intelligence metrics...</span>
        </div>
      ) : comparisonData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Repo 1 (Current) */}
          <div className="p-6 rounded-2xl bg-slate-50/80 border-2 border-[#008F75]/40 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Current Workspace
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">
                  {comparisonData.repo1.owner}/{comparisonData.repo1.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-slate-900">
                  {comparisonData.repo1.health.overallScore}
                </span>
                <span className="text-[10px] block uppercase font-bold text-slate-400">Health Score</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Language</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{comparisonData.repo1.language || "TypeScript"}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Stars / Forks</span>
                <span className="font-bold text-slate-900 mt-0.5 block">★ {comparisonData.repo1.stars} · ⑂ {comparisonData.repo1.forks}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Total Files</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{comparisonData.repo1.health.filesCount} files</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Vector Chunks</span>
                <span className="font-bold text-emerald-700 mt-0.5 block">{comparisonData.repo1.health.chunksCount} chunks</span>
              </div>
            </div>
          </div>

          {/* Repo 2 (Target) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  Comparison Target
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">
                  {comparisonData.repo2.owner}/{comparisonData.repo2.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-slate-900">
                  {comparisonData.repo2.health.overallScore}
                </span>
                <span className="text-[10px] block uppercase font-bold text-slate-400">Health Score</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Language</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{comparisonData.repo2.language || "Unknown"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Stars / Forks</span>
                <span className="font-bold text-slate-900 mt-0.5 block">★ {comparisonData.repo2.stars} · ⑂ {comparisonData.repo2.forks}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Total Files</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{comparisonData.repo2.health.filesCount} files</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Vector Chunks</span>
                <span className="font-bold text-emerald-700 mt-0.5 block">{comparisonData.repo2.health.chunksCount} chunks</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <GitCompare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-slate-800 font-semibold text-sm">Index a second repository to unlock comparative intelligence</h4>
          <p className="text-xs text-slate-500 mt-1">
            Compare codebase architecture, testing patterns, and health metrics side-by-side.
          </p>
        </div>
      )}
    </div>
  );
}
