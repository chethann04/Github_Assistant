"use client";

import { useState, useEffect } from "react";
import { GitCommit, Flame, ExternalLink, Calendar, User, Loader2, GitPullRequest } from "lucide-react";
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
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function CommitAnalysisTab({ repositoryId }: CommitAnalysisTabProps) {
  const [data, setData] = useState<{
    commits: CommitSummary[];
    hotspots: Array<{ file: string; changes: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommits = async () => {
      try {
        const response = await axios.get(`${API_BASE}/intelligence/${repositoryId}/commits`);
        setData(response.data);
      } catch (err) {
        console.error("Failed to load commit analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommits();
  }, [repositoryId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Aggregating commit log and calculating code hotspots...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Hotspots Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-orange-600">
          <Flame className="w-5 h-5" />
          <h3 className="font-bold text-slate-900 text-base">File Change Hotspots</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data?.hotspots.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs"
            >
              <span className="font-mono text-xs text-slate-700 truncate mr-2 font-medium">{item.file}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full"
                    style={{ width: `${Math.min(item.changes * 4, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-orange-700 font-mono font-bold">
                  {item.changes} edits
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commit History Timeline */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-slate-900">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <GitCommit className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Recent Commit History ({data?.commits.length})</h3>
        </div>

        <div className="space-y-3">
          {data?.commits.map((commit, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-50/70 hover:bg-emerald-50/30 border border-slate-200 hover:border-emerald-200 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 mt-0.5 border border-emerald-100">
                  <GitPullRequest className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    {commit.message}
                  </h4>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> {commit.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> {commit.date}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-xs text-slate-700 border border-slate-200">
                  {commit.sha}
                </span>
                {commit.url && (
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
