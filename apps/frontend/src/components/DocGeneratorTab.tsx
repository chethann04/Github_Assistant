"use client";

import { useState, useEffect } from "react";
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
import axios from "axios";

interface DocGeneratorTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const DOC_TYPES: Array<{ id: "readme" | "api" | "docstrings"; label: string; icon: any; filename: string }> = [
  { id: "readme", label: "README.md", icon: BookOpen, filename: "README.md" },
  { id: "api", label: "REST API Spec", icon: Terminal, filename: "API_SPEC.md" },
  { id: "docstrings", label: "Docstrings & Types", icon: Code, filename: "DOCSTRINGS.md" },
];

export default function DocGeneratorTab({ repositoryId }: DocGeneratorTabProps) {
  const [docType, setDocType] = useState<"readme" | "api" | "docstrings">("readme");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDocs = async (type: "readme" | "api" | "docstrings") => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/intelligence/${repositoryId}/docs`, {
        docType: type,
      });
      setContent(response.data.docs);
    } catch (err) {
      console.error("Failed to generate documentation:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs(docType);
  }, [repositoryId, docType]);

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
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header with Type Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Automated Documentation Engine
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            AI Documentation & API Spec Synthesizer
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Synthesize grounded project documentation, API contracts, and typed docstrings with GLM-5.2.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Selector */}
          <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-1">
            {DOC_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = docType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setDocType(type.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#008F75] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopy}
            disabled={!content || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!content || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* Main Documentation Viewer */}
      <div className="mt-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">
              Drafting structured {docType.toUpperCase()} documentation from indexed code...
            </span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-slate-800 bg-slate-50/70 p-6 sm:p-8 rounded-2xl border border-slate-200">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
