"use client";

import { useState, useEffect } from "react";
import {
  GitCommit,
  Flame,
  ExternalLink,
  Calendar,
  User,
  Loader2,
  GitPullRequest,
  Search,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Tag,
} from "lucide-react";
import axios from "axios";

interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  avatarUrl?: string;
  url: string;
}

interface CommitAnalysisTabProps {
  repositoryId: string;
  onAskAIAboutCommit?: (commitSha: string, message: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function CommitAnalysisTab({
  repositoryId,
  onAskAIAboutCommit,
}: CommitAnalysisTabProps) {
  const [data, setData] = useState<{
    commits: CommitSummary[];
    hotspots: Array<{ file: string; changes: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");

  const fetchCommits = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/intelligence/${repositoryId}/commits`);
      setData(response.data);
    } catch (err) {
      console.error("Failed to load commit analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommits();
  }, [repositoryId]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Aggregating git commit log and calculating code hotspots...</span>
      </div>
    );
  }

  const getCommitType = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.startsWith("feat")) return { label: "Feature", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    if (lower.startsWith("fix")) return { label: "Bug Fix", color: "bg-rose-50 text-rose-800 border-rose-200" };
    if (lower.startsWith("refactor")) return { label: "Refactor", color: "bg-blue-50 text-blue-800 border-blue-200" };
    if (lower.startsWith("docs")) return { label: "Docs", color: "bg-purple-50 text-purple-800 border-purple-200" };
    if (lower.startsWith("test")) return { label: "Test", color: "bg-amber-50 text-amber-800 border-amber-200" };
    return { label: "Commit", color: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  const filteredCommits = (data?.commits || []).filter((c) => {
    const matchesSearch =
      c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sha.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedTag === "ALL") return true;

    const lower = c.message.toLowerCase();
    if (selectedTag === "FEAT") return lower.startsWith("feat");
    if (selectedTag === "FIX") return lower.startsWith("fix");
    if (selectedTag === "REFACTOR") return lower.startsWith("refactor");
    if (selectedTag === "DOCS") return lower.startsWith("docs");
    return true;
  });

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
            <GitCommit className="w-3.5 h-3.5 text-emerald-600" /> Git Intelligence & Churn
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Commit History & Code Churn Hotspots
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Analyze recent commit velocity, author contributions, and high-frequency code modifications.
          </p>
        </div>

        <button
          onClick={fetchCommits}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Commits</span>
        </button>
      </div>

      {/* Code Churn Hotspots Section */}
      {data?.hotspots && data.hotspots.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-600">
              <Flame className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-base">Top Churn Hotspots (Frequently Changed Files)</h3>
            </div>
            <span className="text-xs text-slate-400">High churn files often carry higher regression risk</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.hotspots.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs"
              >
                <span className="font-mono text-xs text-slate-800 truncate mr-2 font-semibold">{item.file}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                      style={{ width: `${Math.min(item.changes * 20, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-rose-700 font-mono font-bold">
                    {item.changes} edits
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit History Timeline Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Type:</span>
            {["ALL", "FEAT", "FIX", "REFACTOR", "DOCS"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedTag === tag
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search commit messages..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-[#008F75]"
            />
          </div>
        </div>

        {/* Commit List */}
        <div className="space-y-3">
          {filteredCommits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No commits matching the selected filter.
            </div>
          ) : (
            filteredCommits.map((commit, idx) => {
              const commitType = getCommitType(commit.message);
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50/70 hover:bg-[#E8F7F2]/20 border border-slate-200 hover:border-[#008F75] transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shrink-0 mt-0.5 shadow-2xs">
                      <GitCommit className="w-4 h-4 text-[#008F75]" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${commitType.color}`}>
                          {commitType.label}
                        </span>
                        <h4 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug">
                          {commit.message}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-slate-700">{commit.author}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(commit.date).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                      {commit.sha}
                    </span>

                    {commit.url && (
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
