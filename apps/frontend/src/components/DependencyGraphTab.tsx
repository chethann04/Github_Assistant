"use client";

import { useState, useEffect } from "react";
import {
  GitBranch,
  Search,
  RefreshCw,
  FileCode,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Layers,
  Sparkles,
  Link,
} from "lucide-react";
import axios from "axios";

import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface DependencyNode {
  id: string;
  label: string;
  directory: string;
  inDegree: number;
  outDegree: number;
}

interface DependencyEdge {
  source: string;
  target: string;
  specifier: string;
}

interface DependencyGraphData {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  summary: {
    totalFiles: number;
    totalDependencies: number;
    mostImportedFiles: Array<{ filePath: string; count: number }>;
    externalPackages: string[];
  };
}

interface DependencyGraphTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function DependencyGraphTab({ repositoryId }: DependencyGraphTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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
  } = useAnalysisJob<DependencyGraphData>({
    repositoryId,
    type: "DEPENDENCY_GRAPH",
    autoRunIfNone: true,
  });

  const graphData: DependencyGraphData | null = result;

  useEffect(() => {
    if (graphData?.nodes && graphData.nodes.length > 0 && !selectedFile) {
      setSelectedFile(graphData.nodes[0].id);
    }
  }, [graphData, selectedFile]);

  const activeNode = graphData?.nodes?.find((n) => n.id === selectedFile) || graphData?.nodes?.[0];

  // Inward: Who imports this file? (edge.target === activeNode.id)
  const inwardImports = graphData?.edges?.filter((e) => e.target === activeNode?.id) || [];

  // Outward: What does this file import? (edge.source === activeNode.id)
  const outwardImports = graphData?.edges?.filter((e) => e.source === activeNode?.id) || [];

  const filteredNodes = (graphData?.nodes || []).filter((n) =>
    n.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <GitBranch className="w-3.5 h-3.5 text-emerald-600" /> Static Dependency AST Analysis
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Code Dependency Graph & Module Topology
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Deterministic import relationships extracted directly from source code ASTs.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Rebuild Graph</span>
        </button>
      </div>

      {/* Background Analysis Progress & Stage Banner */}
      <div className="mt-4">
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
      </div>

      {/* Metric Summary Cards */}
      {graphData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
            <span className="text-xs font-semibold text-slate-500 block">Analyzed Code Files</span>
            <span className="text-xl font-bold">{graphData.summary.totalFiles}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950">
            <span className="text-xs font-semibold text-emerald-700 block">Internal Connections</span>
            <span className="text-xl font-bold">{graphData.summary.totalDependencies}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950">
            <span className="text-xs font-semibold text-blue-700 block">External Packages</span>
            <span className="text-xl font-bold">{graphData.summary.externalPackages?.length || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950">
            <span className="text-xs font-semibold text-amber-700 block">Most Central Hub</span>
            <span className="text-sm font-bold truncate block">
              {graphData.summary.mostImportedFiles?.[0]?.filePath.split("/").pop() || "None"}
            </span>
          </div>
        </div>
      )}

      {/* Main 2-Column Interface */}
      {graphData && graphData.nodes && graphData.nodes.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: File Explorer List */}
        <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col h-[580px]">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#008F75]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredNodes.map((node) => {
              const isSelected = selectedFile === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedFile(node.id)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-white border-[#008F75] shadow-xs"
                      : "bg-white/70 hover:bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[#008F75]" : "text-slate-400"}`} />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800 truncate">{node.label}</div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">{node.directory}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-mono shrink-0 ml-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold" title="Inward: Files that import this">
                      ↓{node.inDegree}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold" title="Outward: Files this imports">
                      ↑{node.outDegree}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected File Dependency Inspector */}
        <div className="lg:col-span-7 space-y-4">
          {/* File Header */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-[#008F75] text-white flex items-center justify-center shrink-0">
                <FileCode className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h3 className="font-bold text-slate-900 text-sm truncate">{activeNode?.id || "Selected Module"}</h3>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Imported by <b className="text-emerald-700">{activeNode?.inDegree || 0}</b> files</span>
                  <span>·</span>
                  <span>Imports <b className="text-blue-700">{activeNode?.outDegree || 0}</b> files</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inward Dependencies: Who Imports This File? */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4 text-emerald-600" /> Who imports this file? (Inward Dependents)
            </h4>

            {inwardImports.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center bg-white rounded-xl border border-slate-200">
                No internal files directly import this file (potential top-level entry point or leaf).
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {inwardImports.map((edge, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedFile(edge.source)}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-800 truncate">{edge.source}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">spec: {edge.specifier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outward Dependencies: What Does This File Import? */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-blue-600" /> What does this file import? (Outward Dependencies)
            </h4>

            {outwardImports.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center bg-white rounded-xl border border-slate-200">
                No internal workspace files imported.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {outwardImports.map((edge, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedFile(edge.target)}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-800 truncate">{edge.target}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{edge.specifier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External Packages Pill Matrix */}
          {graphData.summary.externalPackages?.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-600" /> Detected External Packages ({graphData.summary.externalPackages.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                {graphData.summary.externalPackages.map((pkg, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700 font-medium"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="py-16 text-center text-slate-400 text-xs">
          Click &quot;Rebuild Graph&quot; to parse repository imports and construct the dependency graph.
        </div>
      )}
    </div>
  );
}
