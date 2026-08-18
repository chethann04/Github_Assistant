"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  GitMapGraphPayload,
  GitMapNode,
  GitMapModule,
  GitMapViewMode,
  ModuleCategory,
} from "./GitMapTypes";
import GitMapCanvas from "./GitMapCanvas";
import GitMapInspector from "./GitMapInspector";
import GitMapAskModal from "./GitMapAskModal";
import GitMapImpactModal from "./GitMapImpactModal";
import GitMapOnboardingModal from "./GitMapOnboardingModal";
import GitMapHealthModal from "./GitMapHealthModal";
import {
  Compass,
  Activity,
  Bot,
  RefreshCw,
  Search,
  Layers,
  FileCode,
  Flame,
  Users,
  Zap,
  Filter,
  Loader2,
  ShieldAlert,
  Sparkles,
  Package,
} from "lucide-react";

interface GitMapTabProps {
  repositoryId: string;
  onOpenFileContent?: (filePath: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function GitMapTab({ repositoryId, onOpenFileContent }: GitMapTabProps) {
  const [data, setData] = useState<GitMapGraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View & Interactive State
  const [viewMode, setViewMode] = useState<GitMapViewMode>("architecture");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>("ALL");

  const [selectedNode, setSelectedNode] = useState<GitMapNode | null>(null);
  const [selectedModule, setSelectedModule] = useState<GitMapModule | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  // Highlighting
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([]);

  // Modals
  const [showAskModal, setShowAskModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactTargetFilePath, setImpactTargetFilePath] = useState<string | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Fetch initial graph analysis
  const fetchGraphData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`${API_BASE}/gitmap/${repositoryId}/map`, {
        withCredentials: true,
      });
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to load GitMap graph data:", err);
      setError(err.response?.data?.error || "Failed to load GitMap architecture map");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    fetchGraphData(false);
  }, [fetchGraphData]);

  // Handle module expansion toggle
  const handleToggleExpandModule = (moduleId: string) => {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  // Filtered nodes based on search, category, and risk
  const filteredNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((node) => {
      if (selectedCategory !== "ALL" && node.category !== selectedCategory) return false;
      if (selectedRiskFilter !== "ALL" && node.riskLevel !== selectedRiskFilter) return false;
      return true;
    });
  }, [data, selectedCategory, selectedRiskFilter]);

  // Handle Focus On Node from Modals / External actions
  const handleSelectNodeByPath = (filePath: string) => {
    if (!data) return;
    const target = data.nodes.find((n) => n.id === filePath);
    if (target) {
      setSelectedNode(target);
      setSelectedModule(null);
      setExpandedModuleIds((prev) => new Set([...Array.from(prev), target.moduleId]));
      setHighlightedNodeIds([target.id]);
    }
  };

  const handleTriggerImpact = (filePath: string) => {
    setImpactTargetFilePath(filePath);
    setShowImpactModal(true);
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] flex flex-col bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Toolbar */}
      <header className="p-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0">
        {/* Left: Mode Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            onClick={() => setViewMode("architecture")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "architecture"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Architecture
          </button>
          <button
            onClick={() => setViewMode("files")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "files"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Files
          </button>
          <button
            onClick={() => setViewMode("git")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "git"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Hotspots
          </button>
          <button
            onClick={() => setViewMode("contributors")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "contributors"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-400" /> Contributors
          </button>
        </div>

        {/* Center: Search & Category Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files, modules, endpoints..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-xs transition-colors"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="FRONTEND">Frontend</option>
            <option value="BACKEND">Backend</option>
            <option value="API">API</option>
            <option value="DATABASE">Database</option>
            <option value="AUTH">Auth</option>
            <option value="AI">AI / Vector</option>
            <option value="SERVICES">Services</option>
            <option value="TESTS">Tests</option>
          </select>
        </div>

        {/* Right Action Modals Trigger */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAskModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Bot className="w-3.5 h-3.5" /> "How It Works"
          </button>
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Compass className="w-3.5 h-3.5" /> Start Here
          </button>
          <button
            onClick={() => setShowHealthModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Health ({data?.health.overallScore || 0}%)
          </button>
          <button
            onClick={() => fetchGraphData(true)}
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Re-analyze repository"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-medium">Constructing deterministic architecture map...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="p-3 rounded-full bg-red-950/60 border border-red-800 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">Analysis Error</h3>
            <p className="text-xs text-red-300 max-w-md">{error}</p>
            <button
              onClick={() => fetchGraphData(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs mt-2"
            >
              Retry Analysis
            </button>
          </div>
        ) : data ? (
          <>
            {/* Interactive Canvas Graph */}
            <div className="flex-1 h-full relative">
              <GitMapCanvas
                modules={data.modules}
                nodes={filteredNodes}
                edges={data.edges}
                viewMode={viewMode}
                selectedNodeId={selectedNode?.id || null}
                selectedModuleId={selectedModule?.id || null}
                highlightedNodeIds={highlightedNodeIds}
                highlightedEdgeIds={highlightedEdgeIds}
                searchQuery={searchQuery}
                onSelectNode={(node) => {
                  setSelectedNode(node);
                  if (node) setSelectedModule(null);
                }}
                onSelectModule={(mod) => {
                  setSelectedModule(mod);
                  if (mod) setSelectedNode(null);
                }}
                expandedModuleIds={expandedModuleIds}
                onToggleExpandModule={handleToggleExpandModule}
              />
            </div>

            {/* Inspector Details Side Panel */}
            <GitMapInspector
              selectedNode={selectedNode}
              selectedModule={selectedModule}
              edges={data.edges}
              allNodes={data.nodes}
              onClose={() => {
                setSelectedNode(null);
                setSelectedModule(null);
                setHighlightedNodeIds([]);
                setHighlightedEdgeIds([]);
              }}
              onSelectNode={(node) => {
                setSelectedNode(node);
                setSelectedModule(null);
                setHighlightedNodeIds([node.id]);
              }}
              onAnalyzeImpact={handleTriggerImpact}
              onAskAi={(q) => {
                setShowAskModal(true);
              }}
              onOpenFileContent={(filePath) => {
                if (onOpenFileContent) onOpenFileContent(filePath);
              }}
            />
          </>
        ) : null}
      </div>

      {/* Modals & Drawers */}
      <GitMapAskModal
        repositoryId={repositoryId}
        isOpen={showAskModal}
        onClose={() => setShowAskModal(false)}
        onHighlightPath={(nodeIds, edgeIds) => {
          setHighlightedNodeIds(nodeIds);
          setHighlightedEdgeIds(edgeIds);
        }}
        onSelectNodePath={handleSelectNodeByPath}
      />

      <GitMapImpactModal
        repositoryId={repositoryId}
        targetFilePath={impactTargetFilePath}
        isOpen={showImpactModal}
        onClose={() => {
          setShowImpactModal(false);
          setImpactTargetFilePath(null);
        }}
        onHighlightImpact={(nodeIds, edgeIds) => {
          setHighlightedNodeIds(nodeIds);
          setHighlightedEdgeIds(edgeIds);
        }}
        onSelectNode={handleSelectNodeByPath}
      />

      {data && (
        <GitMapOnboardingModal
          onboardingGuide={data.onboardingGuide || []}
          isOpen={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          onSelectNode={handleSelectNodeByPath}
        />
      )}

      {data && (
        <GitMapHealthModal
          health={data.health}
          technicalDebt={data.technicalDebt}
          gitActivity={data.gitActivity}
          isOpen={showHealthModal}
          onClose={() => setShowHealthModal(false)}
          onSelectNode={handleSelectNodeByPath}
        />
      )}
    </div>
  );
}
