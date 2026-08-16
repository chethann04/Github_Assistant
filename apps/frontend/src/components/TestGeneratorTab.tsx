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
  const [testCode, setTestCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await axios.get(`${API_BASE}/repos/${repositoryId}/files`);
        const codeFiles = (res.data || []).filter((f: any) =>
          /\.(ts|tsx|js|jsx|py|go|rs)$/i.test(f.path) &&
          !f.path.includes('.test.') &&
          !f.path.includes('.spec.')
        );
        setFiles(codeFiles);
        if (codeFiles.length > 0) {
          setSelectedFile(codeFiles[0].path);
        }
      } catch (err) {
        console.error("Failed to load repo files:", err);
      }
    };
    fetchFiles();
  }, [repositoryId]);

  const handleGenerate = async (fileToTest = selectedFile, framework = selectedFramework) => {
    if (!fileToTest) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/intelligence/${repositoryId}/generate-tests`, {
        filePath: fileToTest,
        framework,
      });
      setTestCode(res.data.testSuite);
    } catch (err) {
      console.error("Failed to generate tests:", err);
    } finally {
      setLoading(false);
    }
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <FlaskConical className="w-3.5 h-3.5 text-emerald-600" /> AI Automated Test Generation
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Unit & Integration Test Suite Synthesizer
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate production-ready test suites with 100% boundary, error, and async test coverage.
          </p>
        </div>

        {/* Framework Selector Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {FRAMEWORKS.map((fw) => (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFramework === fw.id
                  ? "bg-[#008F75] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {fw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: File Selector on Left, Test Code on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Target File Selector */}
        <div className="lg:col-span-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col h-[560px]">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter code files..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#008F75]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-white border-[#008F75] shadow-xs"
                      : "bg-white/70 hover:bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCode
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? "text-[#008F75]" : "text-slate-400"
                      }`}
                    />
                    <span className="font-mono text-[11px] text-slate-800 truncate font-medium">
                      {file.path}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => handleGenerate(selectedFile, selectedFramework)}
            disabled={loading || !selectedFile}
            className="mt-3 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Generate Test Suite</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Generated Test Code Viewer */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#008F75]" />
              <span className="text-xs font-mono font-bold text-slate-800">
                {selectedFile ? `${selectedFile.split("/").pop()}.test.ts` : "test_suite.ts"}
              </span>
            </div>

            {testCode && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-[490px] rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">
                Synthesizing test coverage, mocks, edge cases, and assertions with GLM-5.2...
              </span>
            </div>
          ) : testCode ? (
            <div className="h-[490px] rounded-2xl bg-slate-900 border border-slate-800 p-4 font-mono text-xs overflow-y-auto">
              <pre className="text-emerald-400 whitespace-pre leading-relaxed">{testCode}</pre>
            </div>
          ) : (
            <div className="h-[490px] rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center text-slate-400 gap-2 p-6">
              <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No test suite generated yet</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Select any source file from the list on the left and click "Generate Test Suite" to synthesize comprehensive automated tests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
