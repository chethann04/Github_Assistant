"use client";

import { useState } from "react";
import {
  FileText,
  Copy,
  Check,
  BookOpen,
  Code,
  Terminal,
  Sparkles,
  Download,
  RefreshCw,
  Cpu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface DocGeneratorTabProps {
  repositoryId: string;
}

const DOC_TYPES: Array<{ id: "readme" | "api" | "docstrings"; label: string; icon: any; filename: string }> = [
  { id: "readme", label: "README.md", icon: BookOpen, filename: "README.md" },
  { id: "api", label: "REST API Spec", icon: Terminal, filename: "API_SPEC.md" },
  { id: "docstrings", label: "Docstrings & Types", icon: Code, filename: "DOCSTRINGS.md" },
];

export default function DocGeneratorTab({ repositoryId }: DocGeneratorTabProps) {
  const [docType, setDocType] = useState<"readme" | "api" | "docstrings">("readme");
  const [copied, setCopied] = useState(false);

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
  } = useAnalysisJob<{ docs: string; docType: string }>({
    repositoryId,
    type: "DOCUMENTATION",
    targetParam: docType,
    autoRunIfNone: true,
  });

  const content = result?.docs || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const currentDoc = DOC_TYPES.find((d) => d.id === docType) || DOC_TYPES[0];
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentDoc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" /> Automated Documentation Engine
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Repository Documentation Generator
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate production-grade markdown READMEs, API specifications, and docstrings from codebase AST.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true, docType)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Regenerate Docs</span>
        </button>
      </div>

      {/* Background Analysis Progress & Stage Banner */}
      <AnalysisProgressBanner
        status={status}
        progress={progress}
        currentStage={currentStage}
        error={error}
        isStaleCommit={isStaleCommit}
        onCancel={cancelJob}
        onRetry={retryJob}
        onRunLatest={() => triggerJob(true, docType)}
      />

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1">
          {DOC_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = docType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setDocType(type.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {content && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Markdown Document Content */}
      {content ? (
        <div className="p-6 sm:p-8 rounded-xl bg-slate-50 border border-slate-200 font-sans prose prose-slate max-w-none text-slate-900">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400 text-xs">
          Click &quot;Regenerate Docs&quot; to synthesize technical documentation for this repository.
        </div>
      )}
    </div>
  );
}
