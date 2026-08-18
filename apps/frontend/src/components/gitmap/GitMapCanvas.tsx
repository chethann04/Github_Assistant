"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  GitMapNode,
  GitMapModule,
  GitMapEdge,
  GitMapViewMode,
  ModuleCategory,
} from "./GitMapTypes";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Sparkles,
} from "lucide-react";

interface GitMapCanvasProps {
  modules: GitMapModule[];
  nodes: GitMapNode[];
  edges: GitMapEdge[];
  viewMode: GitMapViewMode;
  selectedNodeId: string | null;
  selectedModuleId: string | null;
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  searchQuery: string;
  onSelectNode: (node: GitMapNode | null) => void;
  onSelectModule: (module: GitMapModule | null) => void;
  expandedModuleIds: Set<string>;
  onToggleExpandModule: (moduleId: string) => void;
}

interface CanvasLayoutNode {
  id: string;
  type: "module" | "file";
  label: string;
  subLabel?: string;
  category: ModuleCategory;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  importance: number;
  risk: number;
  isExpanded?: boolean;
  moduleId?: string;
  rawNode?: GitMapNode;
  rawModule?: GitMapModule;
  isHotspot?: boolean;
  commitCount?: number;
  topContributor?: string;
}

interface AggregatedEdge {
  id: string;
  source: string;
  target: string;
  sourceNode: CanvasLayoutNode;
  targetNode: CanvasLayoutNode;
  count: number;
  type: string;
  isHighlighted: boolean;
}

const CATEGORY_COLORS: Record<
  ModuleCategory,
  { bg: string; border: string; text: string; glow: string; badge: string }
> = {
  FRONTEND: { bg: "bg-indigo-950/90", border: "border-indigo-500", text: "text-indigo-300", glow: "#6366f1", badge: "bg-indigo-500/20 text-indigo-300" },
  BACKEND: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-300", glow: "#10b981", badge: "bg-emerald-500/20 text-emerald-300" },
  API: { bg: "bg-sky-950/90", border: "border-sky-500", text: "text-sky-300", glow: "#0ea5e9", badge: "bg-sky-500/20 text-sky-300" },
  DATABASE: { bg: "bg-amber-950/90", border: "border-amber-500", text: "text-amber-300", glow: "#f59e0b", badge: "bg-amber-500/20 text-amber-300" },
  AUTH: { bg: "bg-rose-950/90", border: "border-rose-500", text: "text-rose-300", glow: "#f43f5e", badge: "bg-rose-500/20 text-rose-300" },
  AI: { bg: "bg-purple-950/90", border: "border-purple-500", text: "text-purple-300", glow: "#a855f7", badge: "bg-purple-500/20 text-purple-300" },
  SERVICES: { bg: "bg-teal-950/90", border: "border-teal-500", text: "text-teal-300", glow: "#14b8a6", badge: "bg-teal-500/20 text-teal-300" },
  COMPONENTS: { bg: "bg-blue-950/90", border: "border-blue-500", text: "text-blue-300", glow: "#3b82f6", badge: "bg-blue-500/20 text-blue-300" },
  UTILS: { bg: "bg-slate-900/90", border: "border-slate-500", text: "text-slate-300", glow: "#64748b", badge: "bg-slate-500/20 text-slate-300" },
  CONFIG: { bg: "bg-zinc-900/90", border: "border-zinc-500", text: "text-zinc-300", glow: "#71717a", badge: "bg-zinc-500/20 text-zinc-300" },
  TESTS: { bg: "bg-pink-950/90", border: "border-pink-500", text: "text-pink-300", glow: "#ec4899", badge: "bg-pink-500/20 text-pink-300" },
  DOCS: { bg: "bg-cyan-950/90", border: "border-cyan-500", text: "text-cyan-300", glow: "#06b6d4", badge: "bg-cyan-500/20 text-cyan-300" },
  INFRA: { bg: "bg-orange-950/90", border: "border-orange-500", text: "text-orange-300", glow: "#f97316", badge: "bg-orange-500/20 text-orange-300" },
  SCRIPTS: { bg: "bg-stone-900/90", border: "border-stone-500", text: "text-stone-300", glow: "#78716c", badge: "bg-stone-500/20 text-stone-300" },
};

// Logical architectural layer ordering for pleasant circle/ring distribution
const CATEGORY_ORDER: Record<ModuleCategory, number> = {
  FRONTEND: 0,
  COMPONENTS: 1,
  API: 2,
  SERVICES: 3,
  BACKEND: 4,
  AI: 5,
  DATABASE: 6,
  AUTH: 7,
  UTILS: 8,
  CONFIG: 9,
  INFRA: 10,
  SCRIPTS: 11,
  TESTS: 12,
  DOCS: 13,
};

export default function GitMapCanvas({
  modules,
  nodes,
  edges,
  viewMode,
  selectedNodeId,
  selectedModuleId,
  highlightedNodeIds,
  highlightedEdgeIds,
  searchQuery,
  onSelectNode,
  onSelectModule,
  expandedModuleIds,
  onToggleExpandModule,
}: GitMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Dragging State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [nodeCustomPositions, setNodeCustomPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const dragStartNodePos = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null);

  // 1. Calculate Base Layout Positions
  const layoutNodes = useMemo<CanvasLayoutNode[]>(() => {
    const list: CanvasLayoutNode[] = [];
    const modCount = modules.length || 1;

    // Sort modules by architectural tier
    const sortedModules = [...modules].sort(
      (a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
    );

    // Responsive ellipse radius
    const radiusX = Math.max(280, Math.min(520, modCount * 48));
    const radiusY = Math.max(200, Math.min(380, modCount * 36));
    const centerX = 500;
    const centerY = 350;

    const moduleCenterMap = new Map<string, { x: number; y: number }>();

    sortedModules.forEach((mod, idx) => {
      let mx: number;
      let my: number;

      // Check if user manually dragged this node
      const customPos = nodeCustomPositions.get(mod.id);
      if (customPos) {
        mx = customPos.x;
        my = customPos.y;
      } else {
        const angle = (idx / modCount) * 2 * Math.PI - Math.PI / 2;
        mx = centerX + Math.cos(angle) * radiusX;
        my = centerY + Math.sin(angle) * radiusY;
      }

      moduleCenterMap.set(mod.id, { x: mx, y: my });

      const isExpanded = expandedModuleIds.has(mod.id) || viewMode !== "architecture";

      if (viewMode === "architecture" || !expandedModuleIds.has(mod.id)) {
        list.push({
          id: mod.id,
          type: "module",
          label: mod.name,
          subLabel: `${mod.fileCount} files`,
          category: mod.category,
          x: mx,
          y: my,
          radius: 50,
          width: 176,
          height: 84,
          importance: mod.importanceScore,
          risk: mod.riskScore,
          isExpanded,
          rawModule: mod,
        });
      }

      // If module is expanded or in non-architecture views, layout its internal files
      if (isExpanded) {
        const modFiles = nodes.filter((n) => n.moduleId === mod.id || mod.files.includes(n.id));
        const fileCount = modFiles.length || 1;
        const subRadius = Math.min(220, Math.max(65, fileCount * 13));

        modFiles.forEach((file, fIdx) => {
          let fx: number;
          let fy: number;

          const fileCustomPos = nodeCustomPositions.get(file.id);
          if (fileCustomPos) {
            fx = fileCustomPos.x;
            fy = fileCustomPos.y;
          } else {
            const fAngle = (fIdx / fileCount) * 2 * Math.PI - Math.PI / 2;
            fx = mx + Math.cos(fAngle) * subRadius;
            fy = my + Math.sin(fAngle) * subRadius;
          }

          list.push({
            id: file.id,
            type: "file",
            label: file.name,
            subLabel: file.language,
            category: file.category,
            x: fx,
            y: fy,
            radius: file.importanceScore >= 70 ? 28 : 22,
            width: 140,
            height: 52,
            importance: file.importanceScore,
            risk: file.riskScore,
            moduleId: mod.id,
            rawNode: file,
            isHotspot: file.isHotspot,
            commitCount: file.commitCount,
            topContributor: file.topContributor,
          });
        });
      }
    });

    return list;
  }, [modules, nodes, expandedModuleIds, viewMode, nodeCustomPositions]);

  // Coordinate Map
  const nodeCoordMap = useMemo(() => {
    const map = new Map<string, CanvasLayoutNode>();
    for (const n of layoutNodes) {
      map.set(n.id, n);
    }
    return map;
  }, [layoutNodes]);

  // 2. Compute Aggregated and Clean Visible Edges
  const visibleEdges = useMemo<AggregatedEdge[]>(() => {
    const edgeAggMap = new Map<string, AggregatedEdge>();

    for (const edge of edges) {
      let sourceNode = nodeCoordMap.get(edge.source);
      let targetNode = nodeCoordMap.get(edge.target);

      // If source or target is inside a collapsed module, reroute to the module node
      if (!sourceNode) {
        const sourceFile = nodes.find((n) => n.id === edge.source);
        if (sourceFile) sourceNode = nodeCoordMap.get(sourceFile.moduleId);
      }
      if (!targetNode) {
        const targetFile = nodes.find((n) => n.id === edge.target);
        if (targetFile) targetNode = nodeCoordMap.get(targetFile.moduleId);
      }

      // Valid connection between two visible nodes
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        const pairKey = `${sourceNode.id}->${targetNode.id}`;
        const isHighlighted =
          highlightedEdgeIds.includes(edge.id) ||
          sourceNode.id === selectedNodeId ||
          targetNode.id === selectedNodeId ||
          sourceNode.id === selectedModuleId ||
          targetNode.id === selectedModuleId ||
          (highlightedNodeIds.includes(sourceNode.id) && highlightedNodeIds.includes(targetNode.id));

        const existing = edgeAggMap.get(pairKey);
        if (existing) {
          existing.count += 1;
          if (isHighlighted) existing.isHighlighted = true;
        } else {
          edgeAggMap.set(pairKey, {
            id: pairKey,
            source: sourceNode.id,
            target: targetNode.id,
            sourceNode,
            targetNode,
            count: 1,
            type: edge.type,
            isHighlighted,
          });
        }
      }
    }

    return Array.from(edgeAggMap.values());
  }, [edges, nodeCoordMap, nodes, highlightedEdgeIds, selectedNodeId, selectedModuleId, highlightedNodeIds]);

  // Center & Fit Screen
  const handleFitScreen = useCallback(() => {
    if (layoutNodes.length === 0 || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 600;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of layoutNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const boundsWidth = Math.max(350, maxX - minX + 280);
    const boundsHeight = Math.max(250, maxY - minY + 220);
    const scale = Math.min(1.15, Math.max(0.35, Math.min(width / boundsWidth, height / boundsHeight)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      scale,
    });
  }, [layoutNodes]);

  // Auto-fit whenever node layout changes or on initial load
  useEffect(() => {
    if (layoutNodes.length > 0) {
      handleFitScreen();
    }
  }, [layoutNodes.length, viewMode, handleFitScreen]);

  // ResizeObserver to maintain fit when container changes size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      handleFitScreen();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [handleFitScreen]);

  // Zoom Controls
  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(2.5, Math.max(0.2, prev.scale + delta)),
    }));
  };

  // Pan & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (draggedNodeId) return; // Node dragging handled separately
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId && dragStartNodePos.current) {
      const dx = (e.clientX - dragStartNodePos.current.mouseX) / transform.scale;
      const dy = (e.clientY - dragStartNodePos.current.mouseY) / transform.scale;
      setNodeCustomPositions((prev) => {
        const next = new Map(prev);
        next.set(draggedNodeId, {
          x: dragStartNodePos.current!.nodeX + dx,
          y: dragStartNodePos.current!.nodeY + dy,
        });
        return next;
      });
      return;
    }

    if (!isPanning) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
    dragStartNodePos.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(2.5, Math.max(0.25, prev.scale * zoomFactor)),
    }));
  };

  // Focus on specific search matches
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const match = layoutNodes.find(
      (n) =>
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match && containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      setTransform({
        x: width / 2 - match.x * 1.1,
        y: height / 2 - match.y * 1.1,
        scale: 1.1,
      });
    }
  }, [searchQuery, layoutNodes]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[550px] bg-slate-950 overflow-hidden select-none border border-slate-800/80 rounded-2xl shadow-2xl"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? "grabbing" : draggedNodeId ? "move" : "grab" }}
    >
      {/* Background Matrix Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle, #38bdf8 1px, transparent 1px)`,
          backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg text-slate-300">
        <button
          onClick={() => handleZoom(0.2)}
          className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-0.5" />
        <button
          onClick={handleFitScreen}
          className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setNodeCustomPositions(new Map());
            handleFitScreen();
          }}
          className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          title="Reset Layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* View Mode Indicator Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-md text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
          {viewMode} Mode
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400 text-[11px] font-mono">
          {layoutNodes.length} nodes · {visibleEdges.length} connections
        </span>
      </div>

      {/* Main SVG Graph Layer */}
      <svg
        className="w-full h-full absolute inset-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <defs>
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" opacity="0.65" />
          </marker>
          <marker
            id="edge-arrow-highlight"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Module Cluster Boundary Rings (when expanded) */}
        {modules.map((mod) => {
          if (!expandedModuleIds.has(mod.id) && viewMode !== "files") return null;
          const modPos = nodeCoordMap.get(mod.id);
          if (!modPos) return null;

          return (
            <circle
              key={`ring-${mod.id}`}
              cx={modPos.x}
              cy={modPos.y}
              r={150}
              fill="none"
              stroke={CATEGORY_COLORS[mod.category]?.glow || "#64748b"}
              strokeWidth={1.5}
              strokeDasharray="6 6"
              opacity={0.25}
            />
          );
        })}

        {/* Render Clean Aggregated Edges */}
        {visibleEdges.map(({ id, sourceNode, targetNode, count, isHighlighted }) => {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.hypot(dx, dy) || 1;

          // Gentle smooth curve
          const curvature = Math.min(26, dist * 0.08);
          const nx = -dy / dist;
          const ny = dx / dist;
          const cx = (sourceNode.x + targetNode.x) / 2 + nx * curvature;
          const cy = (sourceNode.y + targetNode.y) / 2 + ny * curvature;

          const pathD = `M ${sourceNode.x} ${sourceNode.y} Q ${cx} ${cy} ${targetNode.x} ${targetNode.y}`;

          // Stroke width based on relationship weight
          const strokeWidth = isHighlighted ? 3 : Math.min(3, Math.max(1.2, 1 + count * 0.3));

          return (
            <g key={id} className="pointer-events-none">
              <path
                d={pathD}
                fill="none"
                stroke={isHighlighted ? "#38bdf8" : "#334155"}
                strokeWidth={strokeWidth}
                opacity={isHighlighted ? 0.95 : 0.4}
                markerEnd={isHighlighted ? "url(#edge-arrow-highlight)" : "url(#edge-arrow)"}
                className="transition-all duration-300"
              />
              {/* Connection Volume Indicator on Highlight */}
              {isHighlighted && count > 1 && (
                <text
                  x={cx}
                  y={cy - 6}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="9"
                  fontWeight="bold"
                  className="font-mono bg-slate-900"
                >
                  {count} refs
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes Layer */}
        {layoutNodes.map((node) => {
          const isSelected =
            node.id === selectedNodeId || (node.type === "module" && node.id === selectedModuleId);
          const isHighlighted = highlightedNodeIds.includes(node.id);
          const isSearchMatch =
            Boolean(searchQuery.trim()) &&
            (node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              node.id.toLowerCase().includes(searchQuery.toLowerCase()));

          const colorTheme = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.UTILS;
          const isHotspot = viewMode === "git" && (node.isHotspot || (node.commitCount && node.commitCount >= 3));

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer select-none"
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggedNodeId(node.id);
                dragStartNodePos.current = {
                  mouseX: e.clientX,
                  mouseY: e.clientY,
                  nodeX: node.x,
                  nodeY: node.y,
                };
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (node.type === "module" && node.rawModule) {
                  onSelectModule(node.rawModule);
                  onSelectNode(null);
                } else if (node.type === "file" && node.rawNode) {
                  onSelectNode(node.rawNode);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (node.type === "module") {
                  onToggleExpandModule(node.id);
                }
              }}
            >
              {/* Highlight Glow Aura */}
              {(isSelected || isHighlighted || isSearchMatch || isHotspot) && (
                <circle
                  r={node.type === "module" ? 56 : 34}
                  fill={isHotspot ? "#ef4444" : isSelected ? "#38bdf8" : colorTheme.glow}
                  opacity={0.25}
                  className="animate-pulse"
                />
              )}

              {/* Node Body Card */}
              {node.type === "module" ? (
                // MODULE NODE
                <g>
                  <rect
                    x={-node.width / 2}
                    y={-node.height / 2}
                    width={node.width}
                    height={node.height}
                    rx={14}
                    fill="#090d16"
                    stroke={isSelected ? "#38bdf8" : isHighlighted ? "#f59e0b" : colorTheme.glow}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="shadow-2xl transition-all"
                  />
                  {/* Category Accent Stripe */}
                  <rect
                    x={-node.width / 2 + 10}
                    y={-node.height / 2 + 8}
                    width={node.width - 20}
                    height={2}
                    rx={1}
                    fill={colorTheme.glow}
                    opacity={0.8}
                  />
                  <text
                    x={0}
                    y={-10}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="bold"
                    className="font-sans"
                  >
                    {node.label.length > 20 ? `${node.label.substring(0, 18)}…` : node.label}
                  </text>
                  <text
                    x={0}
                    y={8}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    className="font-mono"
                  >
                    {node.subLabel}
                  </text>
                  <rect
                    x={-35}
                    y={16}
                    width={70}
                    height={16}
                    rx={4}
                    fill={node.risk >= 65 ? "#ef4444" : "#10b981"}
                    opacity={0.2}
                  />
                  <text
                    x={0}
                    y={27}
                    textAnchor="middle"
                    fill={node.risk >= 65 ? "#f87171" : "#34d399"}
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {node.risk >= 65 ? `RISK ${node.risk}` : `SCORE ${node.importance}`}
                  </text>
                </g>
              ) : (
                // FILE NODE
                <g>
                  <circle
                    r={node.radius}
                    fill="#090d16"
                    stroke={
                      isHotspot
                        ? "#ef4444"
                        : isSelected
                        ? "#38bdf8"
                        : isHighlighted
                        ? "#f59e0b"
                        : colorTheme.glow
                    }
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={node.importance >= 70 ? "10" : "8.5"}
                    fontWeight={node.importance >= 70 ? "bold" : "normal"}
                    className="font-mono"
                  >
                    {node.label.length > 14 ? `${node.label.substring(0, 12)}…` : node.label}
                  </text>
                  {isHotspot && (
                    <text
                      x={node.radius - 4}
                      y={-node.radius + 6}
                      fontSize="11"
                    >
                      🔥
                    </text>
                  )}
                  {viewMode === "contributors" && node.topContributor && (
                    <text
                      x={0}
                      y={node.radius + 12}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="8"
                      className="font-sans"
                    >
                      👤 {node.topContributor}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Canvas Help Hint */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-3 text-[11px] text-slate-500 pointer-events-none">
        <span>💡 Click node to inspect · Drag node to rearrange · Double-click module to expand · Scroll to zoom</span>
      </div>
    </div>
  );
}
