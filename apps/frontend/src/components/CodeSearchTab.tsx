"use client";

import { useState } from "react";
import {
  Search,
  FileCode,
  Sparkles,
  Loader2,
  ArrowRight,
  Filter,
  Check,
  Copy,
  ExternalLink,
  Code2,
  Compass,
} from "lucide-react";
import axios from "axios";
import CitationDrawer, { CitationData } from "./CitationDrawer";

interface CodeSearchTabProps {
  repositoryId: string;
}

const PREDEFINED_CONCEPTS = [
  "Authentication & Session Middleware",
  "Vector Embeddings & Chunking",
  "Database Schema & Prisma Models",
  "REST API Endpoints & Routing",
  "Error Handling & Logging",
  "AI Provider & LLM Service",
  "Static Dependency Analysis",
  "Git Commit & History Processing",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function highlightMatches(text: string, searchQuery: string, isDark: boolean = true) {
  if (!text || !searchQuery || !searchQuery.trim()) return text;

  const trimmed = searchQuery.trim();
  const rawTokens = trimmed
    .split(/[\s,;+()\[\]{}'"]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const allTerms = Array.from(new Set([trimmed, ...rawTokens])).filter(Boolean);
  allTerms.sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) return text;

  const escapedTerms = allTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  const markClass = isDark
    ? "bg-amber-400/30 text-amber-200 font-bold px-1 py-0.5 rounded shadow-2xs border border-amber-400/40"
    : "bg-amber-200/90 text-amber-950 font-bold px-1 py-0.5 rounded shadow-2xs border border-amber-300";

  return parts.map((part, index) => {
    if (regex.test(part)) {
      regex.lastIndex = 0;
      return (
        <mark key={index} className={markClass}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function CodeSearchTab({ repositoryId }: CodeSearchTabProps) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<CitationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const executeSearch = async (searchTerm: string) => {
    const clean = searchTerm.trim();
    if (!clean) return;

    setActiveQuery(clean);
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/chat/${repositoryId}/search`, {
        query: clean,
        limit: 15,
      });
      setResults(response.data || []);
    } catch (err) {
      console.error("Semantic search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleCopySnippet = (snippet: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
          <Compass className="w-3.5 h-3.5 text-emerald-600" /> Semantic & Keyword Code Locator
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
          Code Search & Implementation Finder
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Hybrid semantic and keyword search across all indexed repository functions, symbols, and files.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="w-full">
        <div className="relative flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:ring-2 focus-within:ring-[#008F75]/30 focus-within:border-[#008F75] transition-all">
          <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any keyword, symbol, function, or concept (e.g. 'handleOpenFile', 'auth', 'BankersAlgorithm')..."
            className="w-full bg-transparent px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none text-xs sm:text-sm font-normal"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 text-xs shadow-xs cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Search Code</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Quick Concept Pills */}
      <div>
        <span className="text-[11px] font-semibold text-slate-500 block mb-2">
          Quick Searches:
        </span>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_CONCEPTS.map((concept, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(concept);
                executeSearch(concept);
              }}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-[#E8F7F2] text-slate-700 hover:text-[#008F75] border border-slate-200 hover:border-[#008F75] transition-all font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>{concept}</span>
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
          <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">
            Executing hybrid semantic & keyword vector search...
          </span>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#008F75]" /> Matched Code Locations ({results.length}):
            </span>
            <span className="text-xs text-slate-400">Click any card to inspect code in drawer</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCitation(item)}
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-[#008F75] hover:bg-[#E8F7F2]/30 transition-all cursor-pointer group shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <FileCode className="w-4 h-4 text-[#008F75] shrink-0" />
                    <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-[#008F75] transition-colors truncate">
                      {highlightMatches(item.filePath, activeQuery, false)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 font-mono font-medium">
                      Lines {item.startLine}–{item.endLine}
                    </span>
                    {item.score !== undefined && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-2xs">
                        {Math.round(item.score * 100)}% match
                      </span>
                    )}
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 text-xs font-mono">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-sans">
                      <Code2 className="w-3 h-3 text-[#008F75]" /> Implementation Snippet
                    </span>
                    <button
                      onClick={(e) => handleCopySnippet(item.snippet, idx, e)}
                      className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed text-slate-300 max-h-36 font-mono text-xs">
                    {highlightMatches(item.snippet, activeQuery, true)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeQuery ? (
        <div className="text-center py-16 text-slate-500">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-slate-800 font-semibold text-sm">No code matches found for &quot;{activeQuery}&quot;</h4>
          <p className="text-xs text-slate-500 mt-1">
            Try searching for specific variable names, functions, route paths, or broader terms.
          </p>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-slate-800 font-semibold text-sm">Enter a search query or select a concept above</h4>
          <p className="text-xs text-slate-500 mt-1">
            Hybrid search combines exact keyword, symbol occurrences, and 2048-dimensional dense vector embeddings.
          </p>
        </div>
      )}

      {/* Citation Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        repositoryId={repositoryId}
        searchQuery={activeQuery}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
