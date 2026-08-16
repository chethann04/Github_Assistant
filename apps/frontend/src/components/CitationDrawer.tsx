"use client";

import {
  X,
  Copy,
  Check,
  FileCode,
  Loader2,
  Maximize2,
  ExternalLink,
  Sparkles,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export interface CitationData {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score?: number;
  name?: string;
  fullContent?: string;
}

interface CitationDrawerProps {
  citation: CitationData | null;
  repositoryId?: string;
  repoOwner?: string;
  repoName?: string;
  commitSha?: string;
  onClose: () => void;
}

export default function CitationDrawer({
  citation,
  repositoryId,
  repoOwner,
  repoName,
  commitSha,
  onClose,
}: CitationDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [showFullFile, setShowFullFile] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // AI Code Explanation
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"code" | "explain">("code");

  // Reset states when citation changes
  useEffect(() => {
    setShowFullFile(false);
    setFullContent(citation?.fullContent || null);
    setFetchError(null);
    setExplanation(null);
    setActiveView("code");
  }, [citation]);

  // Fetch full file content if requested
  const loadFullFileContent = async () => {
    if (!citation || !repositoryId) return;
    if (fullContent) {
      setShowFullFile(true);
      return;
    }

    setLoadingFull(true);
    setFetchError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/repos/${repositoryId}/file-content?path=${encodeURIComponent(citation.filePath)}`
      );
      setFullContent(res.data.content);
      setShowFullFile(true);
    } catch (err: any) {
      console.error("Failed to fetch full file content:", err);
      setFetchError(err.response?.data?.error || "Failed to load full source file.");
    } finally {
      setLoadingFull(false);
    }
  };

  // Trigger AI Code Explanation
  const handleExplainCode = async () => {
    if (!citation || !repositoryId) return;
    if (explanation) {
      setActiveView("explain");
      return;
    }

    setExplaining(true);
    setActiveView("explain");
    try {
      const snippetToExplain = showFullFile && fullContent ? fullContent.slice(0, 3000) : citation.snippet;
      const res = await axios.post(`${API_BASE}/intelligence/${repositoryId}/explain`, {
        filePath: citation.filePath,
        snippet: snippetToExplain,
      });
      setExplanation(res.data?.explanation || "No explanation returned.");
    } catch (err: any) {
      console.error("Failed to explain code:", err);
      setExplanation(err.response?.data?.error || "Failed to generate code explanation.");
    } finally {
      setExplaining(false);
    }
  };

  if (!citation) return null;

  const displayedContent = showFullFile && fullContent ? fullContent : citation.snippet;
  const lines = displayedContent ? displayedContent.split("\n") : [];
  const baseStartLine = showFullFile ? 1 : citation.startLine || 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileExt = citation.filePath.split(".").pop() || "txt";

  // Compute exact GitHub deep link
  const githubUrl =
    repoOwner && repoName
      ? `https://github.com/${repoOwner}/${repoName}/blob/${commitSha || "main"}/${citation.filePath}#L${citation.startLine}-L${citation.endLine}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="relative w-full max-w-3xl h-full bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-2xl overflow-hidden text-slate-900">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileCode className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Source Code Verification</span>
            </div>

            <div className="flex items-center gap-2">
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Open exact line range on GitHub"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-slate-900 font-mono break-all">{citation.filePath}</h4>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold font-mono">
                  {showFullFile ? `Full File (${lines.length} lines)` : `Lines ${citation.startLine} - ${citation.endLine}`}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono uppercase">
                  {fileExt}
                </span>
                {citation.name && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {citation.name}
                  </span>
                )}
                {citation.score !== undefined && (
                  <span className="text-emerald-700 font-semibold">
                    Relevance: {Math.round(citation.score * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* View Selector (Source Code / AI Explain / Full File) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => {
                  setActiveView("code");
                  setShowFullFile(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeView === "code" && !showFullFile
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" /> Retrieved Chunk
                </span>
              </button>

              {repositoryId && (
                <button
                  onClick={loadFullFileContent}
                  disabled={loadingFull}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    showFullFile && activeView === "code"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  {loadingFull ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" /> Full File
                    </span>
                  )}
                </button>
              )}

              {repositoryId && (
                <button
                  onClick={handleExplainCode}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeView === "explain"
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Explain Code
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="p-3 my-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
            {fetchError}
          </div>
        )}

        {/* Content Viewer */}
        {activeView === "code" ? (
          <div className="flex-1 my-3 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed shadow-inner">
            <div className="flex min-w-full">
              {/* Line numbers column */}
              <div className="select-none py-3 px-3 text-right text-slate-400 bg-slate-100/70 border-r border-slate-200 shrink-0 font-mono text-xs">
                {lines.map((_, i) => (
                  <div key={i} className="leading-5">
                    {baseStartLine + i}
                  </div>
                ))}
              </div>
              {/* Code text column */}
              <pre className="py-3 px-4 flex-1 overflow-x-auto text-slate-900 whitespace-pre font-mono text-xs leading-5">
                {displayedContent}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 my-3 overflow-y-auto rounded-xl bg-white border border-slate-200 p-5 text-slate-800 text-sm leading-relaxed shadow-inner">
            {explaining ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-sm font-medium">Generating step-by-step code explanation with Gemini...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                {explanation}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
          <span className="text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {activeView === "explain"
              ? "AI-powered grounded code explanation"
              : showFullFile
              ? `Loaded full raw file (${displayedContent.length} characters)`
              : "Exact code chunk retrieved from local vector store"}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors shadow-sm border border-slate-800"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>
                {copied
                  ? "Copied"
                  : activeView === "explain"
                  ? "Copy Explanation"
                  : showFullFile
                  ? "Copy Full File"
                  : "Copy Snippet"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
