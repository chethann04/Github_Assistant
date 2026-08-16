"use client";

import { useState, useEffect } from "react";
import { Cpu, RefreshCw, Copy, Check, GitFork, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

interface ArchitectureTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function ArchitectureTab({ repositoryId }: ArchitectureTabProps) {
  const [architecture, setArchitecture] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [activeView, setActiveView] = useState<"report" | "diagram">("report");

  const fetchArchitecture = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/intelligence/${repositoryId}/architecture`);
      setArchitecture(response.data.architecture);
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

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" /> AI Architecture Synthesis
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">High-Level System & Module Design</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mermaidCode && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveView("report")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeView === "report"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Full Report
              </button>
              <button
                onClick={() => setActiveView("diagram")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeView === "diagram"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" /> Mermaid Diagram
              </button>
            </div>
          )}

          <button
            onClick={fetchArchitecture}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span>Regenerate</span>
          </button>

          {activeView === "diagram" && mermaidCode ? (
            <button
              onClick={handleCopyMermaid}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              {copiedMermaid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMermaid ? "Copied" : "Copy Mermaid"}</span>
            </button>
          ) : (
            <button
              onClick={handleCopy}
              disabled={!architecture || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold shadow-sm border border-slate-800 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Markdown"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Synthesizing system modules, data flows, and dependencies...</span>
          </div>
        ) : activeView === "diagram" && mermaidCode ? (
          <div className="p-6 rounded-xl bg-slate-900 text-slate-100 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs font-mono text-emerald-400">
              <span>Mermaid Flowchart Specification</span>
              <button
                onClick={handleCopyMermaid}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
              >
                {copiedMermaid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMermaid ? "Copied" : "Copy Code"}</span>
              </button>
            </div>
            <pre className="font-mono text-xs overflow-x-auto leading-relaxed text-emerald-300">
              {mermaidCode}
            </pre>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-800 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
            <ReactMarkdown>{architecture}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
