"use client";

import { useState, useEffect } from "react";
import { FileText, Copy, Check, BookOpen, Code, Terminal, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

interface DocGeneratorTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const DOC_TYPES: Array<{ id: "readme" | "api" | "docstrings"; label: string; icon: any }> = [
  { id: "readme", label: "README.md", icon: BookOpen },
  { id: "api", label: "REST API Spec", icon: Terminal },
  { id: "docstrings", label: "Docstrings", icon: Code },
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

  return (
    <div className="w-full glass-panel p-6 sm:p-8 rounded-3xl border border-white/80 shadow-xl relative text-slate-900">
      {/* Header with Type Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 glass-pill px-3 py-1 rounded-full border border-emerald-200 w-fit shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Auto Documentation Suite
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Generate Docs & API Specifications</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Glassmorphic Segmented Selector */}
          <div className="p-1 rounded-2xl bg-slate-100/90 backdrop-blur-md border border-slate-200 flex items-center gap-1 shadow-inner">
            {DOC_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = docType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setDocType(type.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-sm border border-slate-800"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-400" : ""}`} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopy}
            disabled={!content || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold shadow-sm border border-slate-800 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Main Documentation Viewer */}
      <div className="mt-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Drafting structured {docType.toUpperCase()} documentation...</span>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none text-sm leading-relaxed bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 text-slate-800 shadow-sm">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
