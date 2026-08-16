"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  GitBranch,
  ArrowRight,
  FolderGit2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";

interface Repository {
  id: string;
  url: string;
  owner: string;
  name: string;
  defaultBranch: string;
  latestCommit: string;
  language: string;
  stars: number;
  createdAt: string;
  indexJobs: Array<{
    status: string;
    progress: number;
    totalFiles: number;
    totalChunks: number;
  }>;
}

interface RepoListProps {
  onSelectRepo?: (repoId: string) => void;
  refreshTrigger?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function RepoList({ onSelectRepo, refreshTrigger }: RepoListProps) {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await axios.get(`${API_BASE}/repos`, {
        withCredentials: true,
        timeout: 10000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setRepos(data);
    } catch (err) {
      console.error("Failed to load repositories:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCardClick = (repoId: string) => {
    if (onSelectRepo) {
      onSelectRepo(repoId);
    } else {
      router.push(`/repo/${repoId}`);
    }
  };

  const handleDeleteRepo = async (e: React.MouseEvent, repoId: string) => {
    e.stopPropagation();
    if (confirmDeleteId !== repoId) {
      setConfirmDeleteId(repoId);
      return;
    }

    setDeletingId(repoId);
    setConfirmDeleteId(null);
    try {
      await axios.delete(`${API_BASE}/repos/${repoId}`);
      setRepos((prev) => prev.filter((r) => r.id !== repoId));
    } catch (err: any) {
      console.error("Failed to delete repository:", err);
      alert(err.response?.data?.error || "Failed to delete repository");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurgeAll = async () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }

    setIsPurging(true);
    setConfirmPurge(false);
    try {
      await axios.post(`${API_BASE}/repos/purge`);
      setRepos([]);
    } catch (err: any) {
      console.error("Failed to purge all repositories:", err);
      alert(err.response?.data?.error || "Failed to purge database");
    } finally {
      setIsPurging(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [refreshTrigger, fetchRepos]);

  useEffect(() => {
    const handleFocus = () => {
      fetchRepos();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchRepos]);

  if (loading && repos.length === 0) {
    return (
      <div className="w-full text-center py-8 text-[#64748B] flex items-center justify-center gap-2 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-[#008F75]" /> Loading indexed repositories...
      </div>
    );
  }

  if (error && repos.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl text-center my-6 border border-[#D9E5E1] shadow-xs">
        <FolderGit2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h4 className="text-[#0F172A] font-semibold mb-1 text-sm">Unable to load repositories</h4>
        <p className="text-xs text-[#64748B] mb-4">
          The backend server may still be starting up. Please try again.
        </p>
        <button
          onClick={fetchRepos}
          className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl text-center my-6 border border-[#D9E5E1] shadow-xs">
        <FolderGit2 className="w-10 h-10 mx-auto text-[#008F75] mb-3" />
        <h4 className="text-[#0F172A] font-semibold mb-1 text-sm">No repositories indexed yet</h4>
        <p className="text-xs text-[#64748B]">
          Paste any public GitHub URL above to initiate automated code chunking and vector indexing.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full my-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-bold text-[#0F172A] flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-[#008F75]" />
          My Indexed Codebases ({repos.length})
        </h3>

        <div className="flex items-center gap-2">
          {confirmPurge ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePurgeAll}
                disabled={isPurging}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                {isPurging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Confirm Purge All
              </button>
              <button
                onClick={() => setConfirmPurge(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors border border-slate-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPurge(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-[#64748B] hover:text-red-600 border border-[#D9E5E1] hover:border-red-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs"
              title="Delete all repositories and clear vector embeddings"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}

          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#008F75]" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {repos.map((repo) => {
          const latestJob = repo.indexJobs?.[0];
          const isReady = latestJob?.status === "COMPLETED";
          const isDeletingThis = deletingId === repo.id;
          const isConfirmingThis = confirmDeleteId === repo.id;

          return (
            <div
              key={repo.id}
              onClick={() => handleCardClick(repo.id)}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-[#D9E5E1] hover:border-[#008F75] shadow-xs hover:shadow-md hover:shadow-slate-900/5 transition-all cursor-pointer group flex flex-col justify-between relative"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5 gap-2">
                  <span className="font-semibold text-[#0F172A] group-hover:text-[#008F75] transition-colors text-base truncate">
                    {repo.owner}/{repo.name}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {isReady ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> Indexed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-800" /> {latestJob?.status || "PENDING"}
                      </span>
                    )}

                    {/* Delete Repository Button */}
                    {isConfirmingThis ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDeleteRepo(e, repo.id)}
                          disabled={isDeletingThis}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          title="Click again to confirm deletion"
                        >
                          {isDeletingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete?"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteRepo(e, repo.id)}
                        disabled={isDeletingThis}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                        title="Delete repository and vectors"
                      >
                        {isDeletingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] mb-4">
                  {repo.language && (
                    <span className="px-2 py-0.5 rounded bg-[#E8F7F2] text-[#008F75] font-mono border border-[#D9E5E1] font-semibold text-[11px]">
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" /> {repo.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-slate-400" /> {repo.defaultBranch}
                  </span>
                  {latestJob?.totalChunks ? (
                    <span className="flex items-center gap-1 text-[#008F75] font-semibold">
                      <Sparkles className="w-3 h-3 text-[#008F75]" /> {latestJob.totalChunks} chunks
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-[#64748B]">
                <span>
                  Commit: <code className="text-[#0F172A] font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{repo.latestCommit?.substring(0, 7) || "latest"}</code>
                </span>
                <span className="text-[#0F172A] group-hover:text-[#008F75] group-hover:translate-x-0.5 transition-all flex items-center gap-1 font-semibold">
                  Chat with Codebase <ArrowRight className="w-3.5 h-3.5 text-[#008F75]" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
