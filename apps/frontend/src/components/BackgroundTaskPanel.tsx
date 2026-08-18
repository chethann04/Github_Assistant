"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  RefreshCw,
  Cpu,
  GitBranch,
  FileText,
  ShieldAlert,
  Lock,
  GitPullRequest,
  Activity,
  Search,
  GitCommit,
  FolderTree,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  ArrowRight,
} from "lucide-react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export interface BackgroundTaskItem {
  id: string;
  type: string;
  targetParam?: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  currentStage?: string | null;
  repositoryId: string;
  repoName?: string;
  error?: string | null;
  hasResult?: boolean;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface BackgroundTaskPanelProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId?: string;
  onSelectFeature?: (featureTab: string, targetParam?: string | null) => void;
}

export const FEATURE_TYPE_MAP: Record<
  string,
  { label: string; tab: string; icon: any; color: string }
> = {
  ARCHITECTURE: { label: "Architecture", tab: "architecture", icon: Cpu, color: "text-blue-600 bg-blue-50 border-blue-200" },
  DEPENDENCY_GRAPH: { label: "Dependency Graph", tab: "deps", icon: GitBranch, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  DOCUMENTATION: { label: "Auto Docs", tab: "docs", icon: FileText, color: "text-amber-600 bg-amber-50 border-amber-200" },
  CODE_REVIEW: { label: "Code Review", tab: "bugs", icon: ShieldAlert, color: "text-rose-600 bg-rose-50 border-rose-200" },
  SECURITY_AUDIT: { label: "Security Audit", tab: "security", icon: Lock, color: "text-red-600 bg-red-50 border-red-200" },
  IMPACT_ANALYSIS: { label: "Impact Analysis", tab: "impact", icon: GitPullRequest, color: "text-teal-600 bg-teal-50 border-teal-200" },
  HEALTH_SCORE: { label: "Health Score", tab: "health", icon: Activity, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  CODE_SEARCH: { label: "Code Search", tab: "search", icon: Search, color: "text-sky-600 bg-sky-50 border-sky-200" },
  COMMIT_ANALYSIS: { label: "Commit History", tab: "commits", icon: GitCommit, color: "text-slate-600 bg-slate-50 border-slate-200" },
  FILES_ANALYSIS: { label: "Files Analysis", tab: "files", icon: FolderTree, color: "text-violet-600 bg-violet-50 border-violet-200" },
  CHAT: { label: "AI Chat", tab: "chat", icon: MessageSquare, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
};

export default function BackgroundTaskPanel({
  isOpen,
  onClose,
  repositoryId,
  onSelectFeature,
}: BackgroundTaskPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<BackgroundTaskItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchTasks = async () => {
    try {
      const url = repositoryId
        ? `${API_BASE}/analysis/jobs/history?repositoryId=${repositoryId}`
        : `${API_BASE}/analysis/jobs/history`;
      const res = await axios.get(url, { withCredentials: true });
      if (res.data && Array.isArray(res.data)) {
        setTasks(res.data);
      }
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchTasks().finally(() => setLoading(false));

    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, [isOpen, repositoryId]);

  if (!mounted || !isOpen) return null;

  const activeCount = tasks.filter((t) => t.status === "RUNNING" || t.status === "QUEUED").length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === "ACTIVE") return t.status === "RUNNING" || t.status === "QUEUED";
    if (filter === "COMPLETED") return t.status === "COMPLETED" || t.status === "FAILED";
    return true;
  });

  const handleCancel = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      await axios.post(`${API_BASE}/analysis/jobs/${jobId}/cancel`, {}, { withCredentials: true });
      fetchTasks();
    } catch {
      /* silent */
    }
  };

  const handleRetry = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      await axios.post(`${API_BASE}/analysis/jobs/${jobId}/retry`, {}, { withCredentials: true });
      fetchTasks();
    } catch {
      /* silent */
    }
  };

  const panelContent = (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-slate-900">Background Tasks</h2>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                {activeCount} Active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 text-xs">
          {(["ALL", "ACTIVE", "COMPLETED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`pb-2 px-2.5 font-medium transition-colors border-b-2 ${
                filter === tab
                  ? "border-emerald-600 text-emerald-800 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab === "ALL" ? `All (${tasks.length})` : tab === "ACTIVE" ? `Active (${activeCount})` : "Completed"}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs">Loading task history...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Clock className="w-8 h-8 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No tasks found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Background tasks you trigger across features will appear here.
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const meta = FEATURE_TYPE_MAP[task.type] || {
                label: task.type,
                tab: "architecture",
                icon: Cpu,
                color: "text-slate-600 bg-slate-50 border-slate-200",
              };
              const Icon = meta.icon;
              const isRunning = task.status === "RUNNING";
              const isQueued = task.status === "QUEUED";
              const isCompleted = task.status === "COMPLETED";
              const isFailed = task.status === "FAILED";

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    if (onSelectFeature) {
                      onSelectFeature(meta.tab, task.targetParam);
                      onClose();
                    }
                  }}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-2xs group hover:border-emerald-300"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg border ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                          {meta.label}
                          {task.targetParam ? ` (${task.targetParam})` : ""}
                        </h4>
                        {task.repoName && (
                          <p className="text-[10px] text-slate-400">{task.repoName}</p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {isRunning && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {task.progress}%
                        </span>
                      )}
                      {isQueued && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Queued
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Done
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5 text-red-600" /> Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage description */}
                  {task.currentStage && (
                    <p className="text-[11px] text-slate-500 mb-2 truncate">
                      {task.currentStage}
                    </p>
                  )}

                  {/* Progress bar for running jobs */}
                  {(isRunning || isQueued) && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(task.progress, 5)}%` }}
                      />
                    </div>
                  )}

                  {/* Actions / timestamps */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>
                      {new Date(task.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {(isRunning || isQueued) && (
                        <button
                          onClick={(e) => handleCancel(e, task.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-0.5"
                        >
                          <Ban className="w-2.5 h-2.5" /> Cancel
                        </button>
                      )}
                      {isFailed && (
                        <button
                          onClick={(e) => handleRetry(e, task.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-0.5"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Retry
                        </button>
                      )}
                      <span className="text-emerald-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Open <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panelContent, document.body);
}
