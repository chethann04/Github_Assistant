"use client";

import { useState } from "react";
import { Search, FileCode, Sparkles, Loader2, ArrowRight } from "lucide-react";
import axios from "axios";
import CitationDrawer, { CitationData } from "./CitationDrawer";

interface CodeSearchTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function CodeSearchTab({ repositoryId }: CodeSearchTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/chat/${repositoryId}/search`, {
        query: query.trim(),
        limit: 8,
      });
      setResults(response.data);
    } catch (err) {
      console.error("Semantic search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Search Header Form */}
      <form onSubmit={handleSearch} className="w-full">
        <div className="relative flex items-center glass-panel rounded-3xl p-2.5 shadow-xl shadow-emerald-950/5 border border-white/90 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all">
          <Search className="w-5 h-5 text-emerald-700 ml-4 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code semantically (e.g., 'auth middleware', 'database pooling', 'error handler')..."
            className="w-full bg-transparent px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none text-sm font-normal"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shrink-0 shadow-md border border-slate-800 group"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <>
                <span>Search Code</span>
                <Sparkles className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results List */}
      {results.length > 0 ? (
        <div className="space-y-4">
          <span className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Ranked Semantic Matches ({results.length}):
          </span>

          <div className="grid grid-cols-1 gap-4">
            {results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCitation(item)}
                className="relative bg-white/55 backdrop-blur-2xl p-6 rounded-3xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/80 hover:border-emerald-300 hover:shadow-[0_20px_40px_-12px_rgba(16,185,129,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-white/60 to-transparent rounded-bl-3xl pointer-events-none" />

                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-50/80 text-emerald-700 border border-emerald-100 shadow-2xs">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                      {item.filePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100/90 text-slate-800 border border-slate-200/90 font-mono font-medium">
                      Lines {item.startLine}-{item.endLine}
                    </span>
                    {item.score !== undefined && (
                      <span className="text-xs px-3 py-0.5 rounded-full bg-emerald-50/90 text-emerald-800 border border-emerald-200/90 font-semibold shadow-2xs">
                        {Math.round(item.score * 100)}% match
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/90 backdrop-blur-md border border-slate-200/90 font-mono text-xs text-slate-800 max-h-36 overflow-hidden relative shadow-inner">
                  <pre className="whitespace-pre-wrap">{item.snippet.slice(0, 300)}...</pre>
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-slate-50/90 to-transparent pointer-events-none" />
                </div>

                <div className="flex justify-end mt-3">
                  <span className="text-xs text-slate-900 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all flex items-center gap-1 font-semibold">
                    Inspect Full Chunk <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="text-center py-16 bg-white/55 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-[0_10px_30px_rgb(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)]">
            <Search className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
            <h4 className="text-base font-bold text-slate-900">Semantic Code Similarity</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Type natural language questions or concepts to retrieve the most relevant functions and classes instantly.
            </p>
          </div>
        )
      )}

      {/* Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        repositoryId={repositoryId}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
