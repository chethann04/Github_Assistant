"use client";

import { useState } from "react";
import { Github, Search, AlertCircle, Loader2 } from "lucide-react";
import axios from "axios";

interface RepoImportFormProps {
  onJobStarted: (jobId: string, repoName: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

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
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center bg-white rounded-2xl p-2 sm:p-2.5 shadow-sm hover:shadow-md border border-[#D9E5E1] focus-within:ring-2 focus-within:ring-[#008F75]/30 focus-within:border-[#008F75] transition-all">
          <div className="p-2 rounded-xl bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] ml-1 shrink-0">
            <Github className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/expressjs/cors or owner/repo"
            required
            className="w-full bg-transparent px-3.5 py-3 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none text-sm sm:text-base font-normal"
          />
          <button
            type="submit"
            disabled={loading || !hasUrl}
            className={`font-semibold px-5 sm:px-6 py-3 rounded-xl flex items-center gap-2 transition-all shrink-0 text-sm shadow-xs ${
              hasUrl && !loading
                ? "bg-[#008F75] hover:bg-[#00735E] active:bg-[#00604E] text-white cursor-pointer shadow-sm hover:shadow active:scale-[0.99]"
                : "bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] cursor-not-allowed"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Importing...</span>
              </div>
            ) : (
              <>
                <span>Index Repo</span>
                <Search className="w-4 h-4 opacity-90" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
