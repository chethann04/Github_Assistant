"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  FolderTree,
  Star,
  GitBranch,
  ArrowLeft,
  Loader2,
  FileCode,
  Cpu,
  FileText,
  ShieldAlert,
  GitCommit,
  Trash2,
  AlertTriangle,
  GitPullRequest,
  Activity,
  BarChart3,
  Menu,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import axios from "axios";
import ChatInterface from "@/components/ChatInterface";
import CodeSearchTab from "@/components/CodeSearchTab";
import ArchitectureTab from "@/components/ArchitectureTab";
import DocGeneratorTab from "@/components/DocGeneratorTab";
import BugDetectorTab from "@/components/BugDetectorTab";
import CommitAnalysisTab from "@/components/CommitAnalysisTab";
import ImpactAnalysisTab from "@/components/ImpactAnalysisTab";
import HealthScoreTab from "@/components/HealthScoreTab";
import CitationDrawer, { CitationData } from "@/components/CitationDrawer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

type TabType =
  | "chat"
  | "architecture"
  | "docs"
  | "bugs"
  | "impact"
  | "health"
  | "search"
  | "commits"
  | "files";

export default function RepoWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [repo, setRepo] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [loading, setLoading] = useState(true);
  const [selectedFileCitation, setSelectedFileCitation] = useState<CitationData | null>(null);
  const [loadingFilePath, setLoadingFilePath] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDetails = async () => {
      try {
        const repoRes = await axios.get(`${API_BASE}/repos/${id}`);
        setRepo(repoRes.data);

        const filesRes = await axios.get(`${API_BASE}/repos/${id}/files`);
        setFiles(filesRes.data);
      } catch (err) {
        console.error("Failed to load repo data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleOpenFile = async (file: any) => {
    if (!id) return;
    setLoadingFilePath(file.path);
    try {
      const res = await axios.get(
        `${API_BASE}/repos/${id}/file-content?path=${encodeURIComponent(file.path)}`
      );
      const content = res.data?.content || "";
      const totalLines = content ? content.split("\n").length : 1;

      setSelectedFileCitation({
        filePath: file.path,
        startLine: 1,
        endLine: totalLines,
        snippet: content,
        fullContent: content,
        name: file.path.split("/").pop(),
      });
    } catch (err: any) {
      console.error("Failed to fetch file content:", err);
      alert(err.response?.data?.error || `Failed to load file content for ${file.path}`);
    } finally {
      setLoadingFilePath(null);
    }
  };

  const handleDeleteRepo = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_BASE}/repos/${id}`);
      router.push("/");
    } catch (err: any) {
      console.error("Failed to delete repository:", err);
      alert(err.response?.data?.error || "Failed to delete repository");
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Loading repository intelligence workspace...</span>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6">
        <h2 className="text-xl font-bold mb-2">Repository Not Found</h2>
        <button
          onClick={() => router.push("/")}
          className="text-emerald-700 flex items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Repositories
        </button>
      </div>
    );
  }

  // Primary AI Analysis Navigation Group
  const aiAnalysisTabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: "architecture", label: "Architecture", icon: Cpu },
    { id: "docs", label: "Auto Docs", icon: FileText },
    { id: "bugs", label: "Bug Review", icon: ShieldAlert },
    { id: "impact", label: "Impact Analysis", icon: GitPullRequest },
  ];

  // Repository Tools Navigation Group
  const repoToolsTabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: "chat", label: "AI Chat", icon: MessageSquare },
    { id: "health", label: "Health Score", icon: Activity },
    { id: "search", label: "Code Search", icon: Search },
    { id: "commits", label: "Commit History", icon: GitCommit },
    { id: "files", label: `Files (${files.length})`, icon: FolderTree },
  ];

  const allTabs = [...aiAnalysisTabs, ...repoToolsTabs];
  const currentTabObj = allTabs.find((t) => t.id === activeTab) || repoToolsTabs[0];

  const renderNavButtons = () => (
    <>
      {/* Top Section: Back & Repository Info */}
      <div className="p-4 pb-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-3 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors w-fit"
          title="Back to all repositories"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Repositories
        </button>

        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex items-start justify-between gap-1 mb-1">
            <h2 className="font-bold text-sm text-slate-900 truncate leading-tight" title={`${repo.owner}/${repo.name}`}>
              {repo.owner}/{repo.name}
            </h2>
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              title="Open on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-2">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-emerald-800 font-semibold">
              {repo.language || "Plaintext"}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500 fill-amber-400" /> {repo.stars}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <GitBranch className="w-3 h-3 text-slate-400" /> {repo.defaultBranch}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-1">
        <div className="h-px bg-slate-200/80 w-full" />
      </div>

      {/* Primary AI Analysis Section */}
      <div className="px-3 py-2">
        <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#008F75]" /> Primary AI Analysis
        </span>
        <div className="space-y-1">
          {aiAnalysisTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm border border-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-1">
        <div className="h-px bg-slate-200/80 w-full" />
      </div>

      {/* Repository Tools Section */}
      <div className="px-3 py-2 flex-1">
        <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Repository Tools
        </span>
        <div className="space-y-1">
          {repoToolsTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm border border-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Delete Action */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 mt-auto">
        {showConfirmDelete ? (
          <div className="p-2 bg-white rounded-xl border border-red-200 shadow-sm space-y-2">
            <p className="text-[11px] font-medium text-red-700">Delete repository data?</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDeleteRepo}
                disabled={isDeleting}
                className="flex-1 py-1 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-red-600 hover:bg-red-50/80 transition-colors border border-transparent hover:border-red-200"
            title="Delete this repository and its vectors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Delete Repository
            </span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 relative text-slate-900 overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-[-10%] right-[5%] w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[140px] pointer-events-none" />

      {/* ─── DESKTOP PERMANENT LEFT SIDEBAR ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200 shadow-xs z-30 overflow-y-auto">
        {renderNavButtons()}
      </aside>

      {/* ─── MOBILE DRAWER OVERLAY & SIDEBAR ────────────────────────────────── */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 shadow-2xl z-50 lg:hidden transform transition-transform duration-200 ease-in-out flex flex-col ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end p-2 border-b border-slate-100">
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col">
          {renderNavButtons()}
        </div>
      </div>

      {/* ─── MAIN CONTENT AREA (TO THE RIGHT OF THE SIDEBAR) ────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Header inside Main Area */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 text-sm truncate">
                {repo.owner}/{repo.name}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-semibold flex items-center gap-1.5 shrink-0">
                <currentTabObj.icon className="w-3 h-3 text-emerald-400" />
                {currentTabObj.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> Indexed & Ready
            </span>
          </div>
        </header>

        {/* Workspace Tab View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {activeTab === "chat" && (
            <ChatInterface repositoryId={repo.id} repoName={`${repo.owner}/${repo.name}`} files={files} />
          )}

          {activeTab === "architecture" && <ArchitectureTab repositoryId={repo.id} />}

          {activeTab === "docs" && <DocGeneratorTab repositoryId={repo.id} />}

          {activeTab === "bugs" && <BugDetectorTab repositoryId={repo.id} />}

          {activeTab === "impact" && <ImpactAnalysisTab repositoryId={repo.id} files={files} />}

          {activeTab === "health" && <HealthScoreTab repositoryId={repo.id} />}

          {activeTab === "search" && <CodeSearchTab repositoryId={repo.id} />}

          {activeTab === "commits" && <CommitAnalysisTab repositoryId={repo.id} />}

          {activeTab === "files" && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-700" /> Indexed Repository Files ({files.length})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[650px] overflow-y-auto pr-2">
                {files.map((file, idx) => {
                  const isLoadingThis = loadingFilePath === file.path;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenFile(file)}
                      className="p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {isLoadingThis ? (
                          <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
                        ) : (
                          <FileCode className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                        <span className="font-mono text-xs text-slate-700 group-hover:text-emerald-950 truncate font-medium">
                          {file.path}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                        {Math.round(file.size / 1024)} KB
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Citation / File Drawer */}
      <CitationDrawer
        citation={selectedFileCitation}
        repositoryId={repo.id}
        repoOwner={repo.owner}
        repoName={repo.name}
        commitSha={repo.latestCommit || repo.defaultBranch}
        onClose={() => setSelectedFileCitation(null)}
      />
    </div>
  );
}
