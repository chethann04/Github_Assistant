"use client";

import React, { useState } from "react";
import {
  HowItWorksResponse,
  ArchitectureFlowStep,
  GitMapNode,
} from "./GitMapTypes";
import {
  X,
  Bot,
  Send,
  Loader2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileCode,
  Layers,
} from "lucide-react";
import axios from "axios";

interface GitMapAskModalProps {
  repositoryId: string;
  isOpen: boolean;
  onClose: () => void;
  onHighlightPath: (nodeIds: string[], edgeIds: string[]) => void;
  onSelectNodePath: (filePath: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const SAMPLE_QUESTIONS = [
  "How does authentication and session validation work?",
  "How does repository ingestion and code chunking execute?",
  "How does RAG vector retrieval generate answers?",
  "How does API routing connect to backend services and database?",
];

export default function GitMapAskModal({
  repositoryId,
  isOpen,
  onClose,
  onHighlightPath,
  onSelectNodePath,
}: GitMapAskModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HowItWorksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = customQuery || query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API_BASE}/gitmap/${repositoryId}/ask`,
        { query: activeQuery },
        { withCredentials: true }
      );
      setResponse(res.data);
      if (res.data.highlightedNodeIds && res.data.highlightedEdgeIds) {
        onHighlightPath(res.data.highlightedNodeIds, res.data.highlightedEdgeIds);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to trace architecture flow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                "How Does This Work?" <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Natural-language architecture execution path tracer
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
          {/* Query Input */}
          <form onSubmit={(e) => handleSubmit(e)} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. How does authentication work? or How are embeddings created?"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Trace Flow
            </button>
          </form>

          {/* Sample Prompts */}
          {!response && !loading && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Suggested Architecture Queries
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(q);
                      handleSubmit(undefined, q);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white text-left transition-all flex items-center justify-between text-xs"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
              <p className="text-xs">Traversing repository relationship graph and assembling execution path...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Response Execution Path Cards */}
          {response && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Overview Summary */}
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 leading-relaxed text-xs">
                <span className="font-bold block text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Architecture Trace Result
                </span>
                {response.overview}
              </div>

              {/* Step-by-Step Flow */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Traceable Execution Pipeline ({response.executionPath.length} Steps)
                </span>
                <div className="space-y-2 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                  {response.executionPath.map((step) => (
                    <div
                      key={step.order}
                      className="relative flex items-start gap-3 pl-8 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="absolute left-2.5 top-3.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-900">
                        {step.order}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-200 text-xs font-mono">
                            {step.component}
                          </span>
                          {step.nodeId && (
                            <button
                              onClick={() => {
                                onSelectNodePath(step.nodeId!);
                                onClose();
                              }}
                              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-400 transition-colors flex items-center gap-1"
                            >
                              <FileCode className="w-3 h-3" /> Focus on Graph
                            </button>
                          )}
                        </div>
                        <p className="text-slate-300 text-xs">{step.action}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
