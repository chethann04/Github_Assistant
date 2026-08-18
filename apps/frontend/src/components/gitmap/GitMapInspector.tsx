"use client";

import React from "react";
import {
  GitMapNode,
  GitMapModule,
  GitMapEdge,
  RiskLevel,
} from "./GitMapTypes";
import {
  X,
  FileCode,
  Folder,
  Layers,
  ShieldAlert,
  Star,
  GitCommit,
  Users,
  Zap,
  ArrowRight,
  ExternalLink,
  Bot,
  Flame,
  Clock,
  Sparkles,
} from "lucide-react";

interface GitMapInspectorProps {
  selectedNode: GitMapNode | null;
  selectedModule: GitMapModule | null;
  edges: GitMapEdge[];
  allNodes: GitMapNode[];
  onClose: () => void;
  onSelectNode: (node: GitMapNode) => void;
  onAnalyzeImpact: (filePath: string) => void;
  onAskAi: (query: string) => void;
  onOpenFileContent: (filePath: string) => void;
}

const RISK_BADGES: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-red-950/60", text: "text-red-400", border: "border-red-800" },
  HIGH: { bg: "bg-orange-950/60", text: "text-orange-400", border: "border-orange-800" },
  MEDIUM: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800" },
  LOW: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800" },
};

export default function GitMapInspector({
  selectedNode,
  selectedModule,
  edges,
  allNodes,
  onClose,
  onSelectNode,
  onAnalyzeImpact,
  onAskAi,
  onOpenFileContent,
}: GitMapInspectorProps) {
  if (!selectedNode && !selectedModule) return null;

  // Direct dependents (files that import selectedNode)
  const dependents = selectedNode
    ? edges
        .filter((e) => e.target === selectedNode.id && e.isInternal)
        .map((e) => allNodes.find((n) => n.id === e.source))
        .filter(Boolean) as GitMapNode[]
    : [];

  // Direct dependencies (files that selectedNode imports)
  const dependencies = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id && e.isInternal)
        .map((e) => allNodes.find((n) => n.id === e.target))
        .filter(Boolean) as GitMapNode[]
    : [];

  const riskBadge = selectedNode
    ? RISK_BADGES[selectedNode.riskLevel]
    : selectedModule
    ? RISK_BADGES[selectedModule.riskLevel]
    : RISK_BADGES.LOW;

  return (
    <aside className="w-96 shrink-0 h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col z-20 shadow-2xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-start justify-between gap-2 bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 shrink-0">
            {selectedNode ? <FileCode className="w-5 h-5" /> : <Folder className="w-5 h-5 text-indigo-400" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate font-mono">
              {selectedNode ? selectedNode.name : selectedModule?.name}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {selectedNode ? selectedNode.path : `${selectedModule?.fileCount} files in module`}
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

      {/* Content Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
        {/* Score & Risk Overview Row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Importance
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-100 font-mono">
                {selectedNode ? selectedNode.importanceScore : selectedModule?.importanceScore}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              {selectedNode?.isEntryPoint ? "Entry Point File" : "Centrality weighted"}
            </span>
          </div>

          <div className={`p-3 rounded-xl border flex flex-col justify-between ${riskBadge.bg} ${riskBadge.border}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${riskBadge.text}`}>
              <ShieldAlert className="w-3 h-3" /> Risk Score
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-slate-100">
                {selectedNode ? selectedNode.riskScore : selectedModule?.riskScore}
              </span>
              <span className="text-[10px] text-slate-400">/ 100 ({selectedNode ? selectedNode.riskLevel : selectedModule?.riskLevel})</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              {selectedNode?.isHotspot ? "🔥 Active Hotspot" : "Coupling score"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {selectedNode && (
            <button
              onClick={() => onAnalyzeImpact(selectedNode.id)}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-900/30 transition-all"
            >
              <Zap className="w-3.5 h-3.5" /> Analyze Impact
            </button>
          )}
          <button
            onClick={() =>
              onAskAi(
                selectedNode
                  ? `How does ${selectedNode.name} work in this repository?`
                  : `Explain the architecture of the ${selectedModule?.name} module.`
              )
            }
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" /> Ask AI
          </button>
        </div>

        {/* Purpose / Summary */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" /> Architecture Role
          </span>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {selectedNode
              ? selectedNode.summary ||
                `${selectedNode.name} is a ${selectedNode.category.toLowerCase()} module file written in ${
                  selectedNode.language
                }, providing core logic for ${selectedNode.moduleName}.`
              : selectedModule?.description}
          </p>
        </div>

        {/* Risk Factors */}
        {((selectedNode && selectedNode.riskReasons.length > 0) || (selectedModule && selectedModule.riskFactors.length > 0)) && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/40 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Risk Factors & Rationale
            </span>
            <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
              {(selectedNode?.riskReasons || selectedModule?.riskFactors || []).map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Git & Contributor Metrics */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <GitCommit className="w-3 h-3 text-sky-400" /> Git Activity & Ownership
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <GitCommit className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedNode ? `${selectedNode.commitCount} commits` : `${selectedModule?.topContributors.length || 1} contributors`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedNode?.topContributor ? `Top: ${selectedNode.topContributor}` : "Distributed"}</span>
            </div>
          </div>

          {/* Contributor Distribution Bar */}
          {selectedNode && selectedNode.contributors.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{selectedNode.contributors[0].name}</span>
                <span>{selectedNode.contributors[0].percentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${selectedNode.contributors[0].percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Direct Dependents (Who uses this?) */}
        {selectedNode && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Direct Dependents ({dependents.length})</span>
              <span className="text-slate-500 font-mono text-[9px]">Imported By</span>
            </span>
            {dependents.length === 0 ? (
              <p className="text-slate-500 text-[11px]">No internal files directly import this file.</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                {dependents.slice(0, 10).map((dep) => (
                  <button
                    key={dep.id}
                    onClick={() => onSelectNode(dep)}
                    className="w-full p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors text-[11px] text-left"
                  >
                    <span className="truncate font-mono">{dep.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {dep.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Direct Dependencies (What does this use?) */}
        {selectedNode && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Dependencies ({dependencies.length})</span>
              <span className="text-slate-500 font-mono text-[9px]">Imports</span>
            </span>
            {dependencies.length === 0 ? (
              <p className="text-slate-500 text-[11px]">No internal workspace imports.</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                {dependencies.slice(0, 10).map((dep) => (
                  <button
                    key={dep.id}
                    onClick={() => onSelectNode(dep)}
                    className="w-full p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors text-[11px] text-left"
                  >
                    <span className="truncate font-mono">{dep.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {dep.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View Code Source button */}
        {selectedNode && (
          <button
            onClick={() => onOpenFileContent(selectedNode.path)}
            className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
          >
            <FileCode className="w-3.5 h-3.5" /> View Source File
          </button>
        )}
      </div>
    </aside>
  );
}
