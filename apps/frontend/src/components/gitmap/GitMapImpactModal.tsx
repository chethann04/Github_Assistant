"use client";

import React, { useState, useEffect } from "react";
import { ImpactAnalysisResponse } from "./GitMapTypes";
import {
  X,
  Zap,
  Loader2,
  ShieldAlert,
  Layers,
  FileCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import axios from "axios";

interface GitMapImpactModalProps {
  repositoryId: string;
  targetFilePath: string | null;
  isOpen: boolean;
  onClose: () => void;
  onHighlightImpact: (nodeIds: string[], edgeIds: string[]) => void;
  onSelectNode: (filePath: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function GitMapImpactModal({
  repositoryId,
  targetFilePath,
  isOpen,
  onClose,
  onHighlightImpact,
  onSelectNode,
}: GitMapImpactModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImpactAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !targetFilePath) return;

    const fetchImpact = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.post(
          `${API_BASE}/gitmap/${repositoryId}/impact`,
          { filePath: targetFilePath },
          { withCredentials: true }
        );
        setData(res.data);
        if (res.data.highlightedNodeIds && res.data.highlightedEdgeIds) {
          onHighlightImpact(res.data.highlightedNodeIds, res.data.highlightedEdgeIds);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to analyze impact");
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, [isOpen, targetFilePath, repositoryId]);

  if (!isOpen || !targetFilePath) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Blast Radius Impact Analysis
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                Target: {targetFilePath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <p className="text-xs">Computing recursive downstream dependencies and blast radius...</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Impact Level
                  </span>
                  <span
                    className={`text-lg font-bold font-mono mt-1 ${
                      data.impactLevel === "CRITICAL"
                        ? "text-red-400"
                        : data.impactLevel === "HIGH"
                        ? "text-orange-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {data.impactLevel}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Direct Dependents
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 mt-1">
                    {data.directDependentsCount} files
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Affected Modules
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 mt-1">
                    {data.affectedModulesCount} modules
                  </span>
                </div>
              </div>

              {/* AI Impact Explanation */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-indigo-200 leading-relaxed text-xs space-y-1">
                <span className="font-bold block text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Architectural Ripple Assessment
                </span>
                <p>{data.aiExplanation}</p>
              </div>

              {/* Risk Mitigation Recommendations */}
              {data.riskMitigationRecommendations.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Recommendations Prior to Modifying
                  </span>
                  <ul className="space-y-1 text-slate-300 text-xs list-disc list-inside">
                    {data.riskMitigationRecommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Direct Dependents List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Direct Downstream Files ({data.directDependents.length})
                </span>
                {data.directDependents.length === 0 ? (
                  <p className="text-slate-500 text-xs">No direct internal dependents.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {data.directDependents.map((dep) => (
                      <div
                        key={dep.id}
                        onClick={() => {
                          onSelectNode(dep.path);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-200 font-mono truncate">{dep.path}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-mono">
                          {dep.relationship}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
