"use client";

import React from "react";
import {
  HealthBreakdown,
  TechnicalDebtIndicators,
  GitActivityData,
} from "./GitMapTypes";
import {
  X,
  Activity,
  ShieldCheck,
  FileCode,
  AlertTriangle,
  Flame,
  Users,
  Layers,
  FileText,
  FlaskConical,
} from "lucide-react";

interface GitMapHealthModalProps {
  health: HealthBreakdown;
  technicalDebt: TechnicalDebtIndicators;
  gitActivity: GitActivityData;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (filePath: string) => void;
}

export default function GitMapHealthModal({
  health,
  technicalDebt,
  gitActivity,
  isOpen,
  onClose,
  onSelectNode,
}: GitMapHealthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Repository Health & Technical Debt Dashboard
              </h3>
              <p className="text-xs text-slate-400">
                Architectural stability, modularity, and risk indicator metrics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
          {/* Overall Health Score Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Overall Health Score
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold font-mono text-emerald-400">
                  {health.overallScore}
                </span>
                <span className="text-slate-500 font-mono text-xs">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Weighted calculation across structure, testing, docs, and ownership
              </p>
            </div>

            {/* Sub-breakdown Bars */}
            <div className="space-y-1.5 w-60">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Code Structure</span>
                  <span className="font-mono">{health.structureScore}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${health.structureScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Testing Coverage</span>
                  <span className="font-mono">{health.testingScore}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${health.testingScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Documentation</span>
                  <span className="font-mono">{health.documentationScore}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${health.documentationScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Ownership Distribution</span>
                  <span className="font-mono">{health.ownershipDistributionScore}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${health.ownershipDistributionScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Technical Debt Indicators Grid */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Potential Technical Debt Indicators
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">TODO / FIXME</span>
                <span className="text-base font-bold font-mono text-slate-200 mt-1 block">
                  {technicalDebt.todoCount + technicalDebt.fixmeCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Large Files</span>
                <span className="text-base font-bold font-mono text-amber-400 mt-1 block">
                  {technicalDebt.largeFilesCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Unreferenced</span>
                <span className="text-base font-bold font-mono text-slate-300 mt-1 block">
                  {technicalDebt.potentiallyUnreferencedFilesCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">High Risk Files</span>
                <span className="text-base font-bold font-mono text-red-400 mt-1 block">
                  {technicalDebt.highRiskModulesCount}
                </span>
              </div>
            </div>
          </div>

          {/* Technical Debt Items */}
          {technicalDebt.items.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Flagged Debt Items ({technicalDebt.items.length})
              </span>
              <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {technicalDebt.items.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectNode(item.filePath);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 text-xs block">{item.title}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{item.description}</span>
                    </div>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-md font-mono uppercase ${
                        item.severity === "HIGH"
                          ? "bg-red-950/60 text-red-400 border border-red-800"
                          : "bg-amber-950/60 text-amber-400 border border-amber-800"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contributor Concentration Risk Alerts */}
          {gitActivity.contributorConcentrationRisk.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Inferred Bus Factor / Ownership Risk
              </span>
              {gitActivity.contributorConcentrationRisk.map((r, idx) => (
                <p key={idx} className="text-xs leading-relaxed">
                  {r.recommendation}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
