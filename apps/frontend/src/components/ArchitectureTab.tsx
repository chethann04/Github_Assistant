"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  RefreshCw,
  Copy,
  Check,
  GitFork,
  FileText,
  Layers,
  Layout,
  Server,
  Database,
  Lock,
  Sparkles,
  Search,
  Globe,
  FileCode,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

interface ArchitectureTabProps {
  repositoryId: string;
}

interface ArchNode {
  id: string;
  name: string;
  category: "FRONTEND" | "BACKEND" | "DATABASE" | "AUTH" | "AI" | "API" | "CONFIG";
  description: string;
  icon: any;
  patterns: RegExp[];
}

const ARCH_NODES: ArchNode[] = [
  {
    id: "frontend",
    name: "Frontend & UI Layer",
    category: "FRONTEND",
    description: "Client application, React components, state hooks, and routing",
    icon: Layout,
    patterns: [/apps\/frontend/i, /src\/components/i, /src\/app/i, /src\/pages/i, /\.tsx$/i, /\.jsx$/i],
  },
  {
    id: "backend",
    name: "Backend Core & Express",
    category: "BACKEND",
    description: "Server entry points, middleware pipelines, and controllers",
    icon: Server,
    patterns: [/apps\/backend/i, /src\/index/i, /src\/server/i, /src\/app/i, /src\/middleware/i],
  },
  {
    id: "api",
    name: "API Routes & Gateway",
    category: "API",
    description: "REST endpoints, SSE stream endpoints, request validation",
    icon: Globe,
    patterns: [/src\/routes/i, /src\/api/i, /routes\.ts/i, /endpoints/i],
  },
  {
    id: "database",
    name: "Database & ORM",
    category: "DATABASE",
    description: "Prisma schema, SQL migrations, persistence clients",
    icon: Database,
    patterns: [/prisma/i, /schema\.prisma/i, /database/i, /models/i, /migrations/i],
  },
  {
    id: "auth",
    name: "Authentication & Sessions",
    category: "AUTH",
    description: "Anonymous session management, token guards, security headers",
    icon: Lock,
    patterns: [/auth/i, /session/i, /guard/i, /jwt/i, /cookie/i],
  },
  {
    id: "ai",
    name: "AI & Vector Search (ChromaDB)",
    category: "AI",
    description: "Nemotron-3 embeddings (2048D), GLM-5.2 LLM, Chroma vector store",
    icon: Sparkles,
    patterns: [/rag/i, /chroma/i, /embedding/i, /llm/i, /openai/i, /gemini/i, /intelligence/i],
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function ArchitectureTab({ repositoryId }: ArchitectureTabProps) {
  const [architecture, setArchitecture] = useState<string>("");
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [activeView, setActiveView] = useState<"interactive" | "report" | "diagram">("interactive");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("frontend");

  const fetchArchitecture = async () => {
    setLoading(true);
    try {
      const [archRes, filesRes] = await Promise.all([
        axios.post(`${API_BASE}/intelligence/${repositoryId}/architecture`),
        axios.get(`${API_BASE}/repos/${repositoryId}/files`),
      ]);
      setArchitecture(archRes.data.architecture);
      setFiles(filesRes.data || []);
    } catch (err) {
      console.error("Failed to generate architecture:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchitecture();
  }, [repositoryId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(architecture);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract Mermaid code block
  const mermaidMatch = architecture.match(/```mermaid([\s\S]*?)```/);
  const mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : null;

  const handleCopyMermaid = () => {
    if (!mermaidCode) return;
    navigator.clipboard.writeText(mermaidCode);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const selectedNode = ARCH_NODES.find((n) => n.id === selectedNodeId) || ARCH_NODES[0];
  const nodeFiles = files.filter((f) => selectedNode.patterns.some((pat) => pat.test(f.path)));

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" /> Interactive Architecture Engine
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            System Architecture & Module Relationships
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Explore architectural components, cross-module dependencies, and interactive source relationships.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveView("interactive")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === "interactive"
                  ? "bg-[#008F75] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Component Map
            </button>
            <button
              onClick={() => setActiveView("report")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === "report"
                  ? "bg-[#008F75] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Technical Report
            </button>
            {mermaidCode && (
              <button
                onClick={() => setActiveView("diagram")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeView === "diagram"
                    ? "bg-[#008F75] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" /> Mermaid Flowchart
              </button>
            )}
          </div>

          <button
            onClick={fetchArchitecture}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
          <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">
            Synthesizing architectural layers, data flows, and module boundaries...
          </span>
        </div>
      ) : (
        <div className="mt-6">
          {/* 1. INTERACTIVE COMPONENT MAP VIEW */}
          {activeView === "interactive" && (
            <div className="space-y-6">
              {/* Architecture Node Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {ARCH_NODES.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const Icon = node.icon;
                  const matchingCount = files.filter((f) =>
                    node.patterns.some((pat) => pat.test(f.path))
                  ).length;

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group shadow-2xs ${
                        isSelected
                          ? "bg-gradient-to-b from-[#E8F7F2] to-white border-[#008F75] shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
                      }`}
                    >
                      <div>
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 transition-colors ${
                            isSelected
                              ? "bg-[#008F75] text-white"
                              : "bg-white text-slate-700 border border-slate-200 group-hover:border-[#008F75]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{node.name}</h4>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{matchingCount} files</span>
                        <ArrowRight
                          className={`w-3 h-3 transition-transform ${
                            isSelected ? "text-[#008F75] translate-x-0.5" : "text-slate-400"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Node Details & File Breakdown */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#008F75] text-white flex items-center justify-center">
                      <selectedNode.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{selectedNode.name}</h3>
                      <p className="text-xs text-slate-600">{selectedNode.description}</p>
                    </div>
                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold w-fit">
                    {nodeFiles.length} Related Source Files
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {nodeFiles.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500">
                      No direct file matches indexed for this architectural layer.
                    </div>
                  ) : (
                    nodeFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs flex items-center justify-between group shadow-2xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCode className="w-3.5 h-3.5 text-[#008F75] shrink-0" />
                          <span className="font-mono text-[11px] text-slate-800 truncate font-medium">
                            {file.path}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                          {Math.round(file.size / 1024)} KB
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. FULL REPORT VIEW */}
          {activeView === "report" && (
            <div className="relative">
              <div className="flex justify-end mb-3">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied Report</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              </div>

              <div className="prose prose-sm max-w-none text-slate-800 bg-slate-50/60 p-6 rounded-2xl border border-slate-200">
                <ReactMarkdown>{architecture}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 3. MERMAID DIAGRAM VIEW */}
          {activeView === "diagram" && mermaidCode && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleCopyMermaid}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                >
                  {copiedMermaid ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied Mermaid Code</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Mermaid Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs overflow-x-auto">
                <div className="text-[11px] text-emerald-400 font-bold mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5" /> Mermaid Flowchart Definition:
                </div>
                <pre className="leading-relaxed whitespace-pre text-slate-300">{mermaidCode}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
