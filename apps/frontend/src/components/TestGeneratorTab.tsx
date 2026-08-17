"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Code2,
  Copy,
  Check,
  RefreshCw,
  Search,
  FileCode,
  Sparkles,
  PlayCircle,
  FlaskConical,
} from "lucide-react";
import axios from "axios";
import { useAnalysisJob } from "@/hooks/useAnalysisJob";
import AnalysisProgressBanner from "@/components/AnalysisProgressBanner";

interface TestGeneratorTabProps {
  repositoryId: string;
}

const FRAMEWORKS = [
  { id: "vitest", label: "Vitest / Jest", ext: "ts" },
  { id: "pytest", label: "PyTest", ext: "py" },
  { id: "gotest", label: "Go Test", ext: "go" },
  { id: "cargo", label: "Cargo Test", ext: "rs" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function TestGeneratorTab({ repositoryId }: TestGeneratorTabProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [selectedFramework, setSelectedFramework] = useState<string>("vitest");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const targetParam = selectedFile ? `${selectedFile}:${selectedFramework}` : null;

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
  } = useAnalysisJob<{ testSuite: string; filePath: string; framework: string }>({
    repositoryId,
    type: "TEST_GENERATOR",
    targetParam,
    autoRunIfNone: false,
  });

  const testCode = result?.testSuite || "";

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await axios.get(`${API_BASE}/repos/${repositoryId}/files`, { withCredentials: true });
        const codeFiles = (res.data || []).filter(
          (f: any) =>
            /\.(ts|tsx|js|jsx|py|go|rs)$/i.test(f.path) &&
            !f.path.includes(".test.") &&
            !f.path.includes(".spec.")
        );
        setFiles(codeFiles);
        if (codeFiles.length > 0 && !selectedFile) {
          setSelectedFile(codeFiles[0].path);
        }
      } catch (err) {
        console.error("Failed to load repo files:", err);
      }
    };
    fetchFiles();
  }, [repositoryId, selectedFile]);

  const handleCopy = () => {
    navigator.clipboard.writeText(testCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 w-fit">
            <FlaskConical className="w-3.5 h-3.5 text-purple-600" /> Automated Test Synthesis
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Unit & Integration Test Suite Generator
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate grounded unit tests with edge-case mocking and deterministic assertions.
          </p>
        </div>

        <button
          onClick={() => triggerJob(true, `${selectedFile}:${selectedFramework}`, { filePath: selectedFile, framework: selectedFramework })}
          disabled={isRunning || !selectedFile}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
          <span>Generate Tests</span>
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
        onRunLatest={() => triggerJob(true, `${selectedFile}:${selectedFramework}`, { filePath: selectedFile, framework: selectedFramework })}
      />

      {/* Framework Selector */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <span className="text-xs font-semibold text-slate-500 px-2">Target Framework:</span>
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw.id}
            onClick={() => setSelectedFramework(fw.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedFramework === fw.id
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            {fw.label}
          </button>
        ))}
      </div>

      {/* Main 2-Column Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Picker */}
        <div className="lg:col-span-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col h-[520px]">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter source files..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-white border-purple-600 shadow-xs text-purple-950 font-semibold"
                      : "border-slate-200/80 bg-white/70 hover:bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-purple-600" : "text-slate-400"}`} />
                    <span className="truncate">{file.path}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Generated Test Code */}
        <div className="lg:col-span-8 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-900">
                {selectedFile ? `${selectedFile.split("/").pop()?.replace(/\.[^/.]+$/, "")}.test.${FRAMEWORKS.find((f) => f.id === selectedFramework)?.ext}` : "Test Output"}
              </span>
            </div>
            {testCode && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Suite"}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-xs p-4 rounded-xl bg-slate-900 text-emerald-400">
            {testCode ? (
              <pre className="whitespace-pre-wrap">{testCode}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-sans">
                Select a file and click &quot;Generate Tests&quot; to synthesize unit tests.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
