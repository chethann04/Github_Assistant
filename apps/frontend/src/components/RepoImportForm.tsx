"use client";

import { useState } from "react";
import { Github, Search, AlertCircle, Sparkles } from "lucide-react";
import axios from "axios";

interface RepoImportFormProps {
  onJobStarted: (jobId: string, repoName: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const SAMPLE_REPOS = [
  { label: "expressjs/cors", url: "https://github.com/expressjs/cors" },
  { label: "chethann04/Deadlock-Detection-", url: "https://github.com/chethann04/Deadlock-Detection-" },
  { label: "pallets/flask", url: "https://github.com/pallets/flask" },
];

export default function RepoImportForm({ onJobStarted }: RepoImportFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImportUrl = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE}/repos/import`,
        { url: cleanUrl },
        { timeout: 15000 }
      );
      const { jobId, repository } = response.data;
      onJobStarted(jobId, `${repository.owner}/${repository.name}`);
      setUrl("");
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Failed to connect to backend server. Make sure port 4000 is reachable.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleImportUrl(url);
  };

  const hasUrl = Boolean(url.trim());

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-lg shadow-slate-900/5 border border-[#D9E5E1] focus-within:ring-2 focus-within:ring-[#008F75]/25 focus-within:border-[#008F75] transition-all">
          <Github className="w-5 h-5 text-[#008F75] ml-3.5 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/expressjs/cors or owner/repo"
            required
            className="w-full bg-transparent px-3.5 py-3 text-[#0F172A] placeholder-slate-400 focus:outline-none text-sm sm:text-base font-normal"
          />
          <button
            type="submit"
            disabled={loading || !hasUrl}
            className={`font-semibold px-5 sm:px-6 py-3 rounded-xl flex items-center gap-2 transition-all shrink-0 text-sm shadow-sm ${
              hasUrl && !loading
                ? "bg-[#008F75] hover:bg-[#007A65] active:bg-[#006B58] text-white shadow-[#008F75]/20 cursor-pointer"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Index Repo</span>
                <Search className="w-4 h-4 opacity-90" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick-Try Sample Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-[#64748B]">
        <span className="flex items-center gap-1 font-medium text-[#475569]">
          <Sparkles className="w-3 h-3 text-[#008F75]" /> Try example:
        </span>
        {SAMPLE_REPOS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => setUrl(sample.url)}
            className="px-3 py-1 rounded-lg bg-white hover:bg-[#E8F7F2] text-[#475569] hover:text-[#008F75] border border-[#D9E5E1] hover:border-[#008F75] font-mono text-[11px] font-medium transition-all shadow-2xs cursor-pointer"
          >
            {sample.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
