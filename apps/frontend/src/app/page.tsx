"use client";

import { useState } from "react";
import {
  Github,
  Sparkles,
  Database,
  Code2,
  Cpu,
  ShieldCheck,
  Zap,
  Search,
  MessageSquare,
  FileText,
  ShieldAlert,
  GitCommit,
  ArrowDown,
  CheckCircle2,
  FolderGit2,
  Layers,
  Bot,
  FileCode,
} from "lucide-react";
import RepoImportForm from "@/components/RepoImportForm";
import IngestionProgress from "@/components/IngestionProgress";
import RepoList from "@/components/RepoList";

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "GitHub Repository",
    description: "Public GitHub repository URL provided by the user.",
    icon: Github,
  },
  {
    step: "2",
    title: "Repository Ingestion",
    description: "Recursive file tree traversal, filtering binaries and sensitive files.",
    icon: Layers,
  },
  {
    step: "3",
    title: "Logical Code Chunking",
    description: "Structural boundary chunking by functions, classes, and logical code blocks.",
    icon: Code2,
  },
  {
    step: "4",
    title: "Gemini Embeddings",
    description: "Dense 1536-dimensional vector embeddings generated per code chunk.",
    icon: Zap,
  },
  {
    step: "5",
    title: "Vector Store Search",
    description: "Cosine similarity vector retrieval strictly scoped by repository ID.",
    icon: Database,
  },
  {
    step: "6",
    title: "RAG Context Retrieval",
    description: "Relevance re-ranking and secret redaction prior to AI prompt assembly.",
    icon: ShieldCheck,
  },
  {
    step: "7",
    title: "Gemini AI Response",
    description: "Multi-turn streaming code reasoning grounded in retrieved code context.",
    icon: Bot,
  },
  {
    step: "8",
    title: "Source-linked AI Answers",
    description: "Verifiable responses with exact file path and line number citations.",
    icon: FileCode,
  },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Codebase Chat",
    description: "Multi-turn, context-aware conversations grounded directly in your repository code with verifiable line citations.",
    badge: "Interactive Chat",
  },
  {
    icon: Cpu,
    title: "Architecture Synthesis",
    description: "Automated high-level system design mapping, module dependency graphs, and request execution flow analysis.",
    badge: "System Design",
  },
  {
    icon: FileText,
    title: "Auto Documentation",
    description: "One-click generation of comprehensive README files, REST API references, and inline function docstrings.",
    badge: "Auto Docs",
  },
  {
    icon: ShieldAlert,
    title: "Bug & Security Review",
    description: "In-depth code review detecting unhandled exceptions, null pointer bugs, race conditions, and vulnerabilities.",
    badge: "Code Quality",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Natural language vector search finding relevant classes, functions, and logic across all files in sub-milliseconds.",
    badge: "Vector Search",
  },
  {
    icon: GitCommit,
    title: "Commit Analysis",
    description: "Analyze commit history evolution, author contributions, and visual file change hotspot metrics.",
    badge: "Git Insights",
  },
];

const SUPPORTED_TECHNOLOGIES = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C/C++",
  "C#",
  "Ruby",
  "PHP",
  "SQL",
  "Markdown",
  "HTML / CSS",
  "Docker",
];

const WHAT_YOU_GET = [
  "Code-aware chat",
  "Semantic code search",
  "Architecture analysis",
  "Documentation generation",
  "Bug/security analysis",
  "Commit history insights",
];

export default function Home() {
  const [activeJob, setActiveJob] = useState<{ id: string; name: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleJobStarted = (jobId: string, repoName: string) => {
    setActiveJob({ id: jobId, name: repoName });
  };

  const handleJobComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between px-4 sm:px-8 lg:px-12 py-6 bg-[#F8FAFC] text-[#0F172A] w-full overflow-x-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-[-8%] left-[20%] w-[600px] h-[600px] bg-[#E8F7F2]/60 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-[10%] w-[600px] h-[600px] bg-[#E8F7F2]/40 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-[1550px] flex justify-between items-center z-10 py-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] shadow-2xs">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-[#0F172A] block leading-tight">
              GITHUB CODEBASE AI ASSISTANT
            </span>
            <span className="text-xs text-[#64748B] font-normal">
              Understand any public GitHub codebase with AI
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F7F2] border border-[#D9E5E1] text-[#008F75] shadow-2xs text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            V1 Ingestion Queue Active
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-[1550px] z-10 text-center py-4 flex flex-col items-center">
        {/* Pre-title Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F7F2] text-xs font-semibold text-[#008F75] mb-5 border border-[#D9E5E1] shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#008F75]" />
          <span>GITHUB CODEBASE AI ASSISTANT</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 leading-[1.05] text-[#0F172A]">
          Understand any public <br className="hidden sm:inline" />
          <span className="text-[#008F75]">
            GitHub codebase with AI
          </span>
        </h1>

        {/* What You Get Card */}
        <div className="w-full max-w-4xl bg-white p-6 sm:p-7 rounded-2xl border border-[#D9E5E1] shadow-sm shadow-slate-900/5 mb-8 text-left">
          <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
            <FolderGit2 className="w-4 h-4 text-[#008F75]" />
            Paste a public GitHub repository and get:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs sm:text-sm text-[#475569] font-medium">
            {WHAT_YOU_GET.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#008F75] shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Repository Ingestion Form */}
        <RepoImportForm onJobStarted={handleJobStarted} />

        {/* Live Progress Poller */}
        {activeJob && (
          <IngestionProgress
            jobId={activeJob.id}
            repoName={activeJob.name}
            onComplete={handleJobComplete}
            onCancel={() => setActiveJob(null)}
          />
        )}

        {/* List of Indexed Repositories */}
        <RepoList refreshTrigger={refreshTrigger} />

        {/* Downward Section Indicator */}
        <div className="my-10 flex flex-col items-center gap-2 text-slate-400">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-[#D9E5E1]" />
          <div className="p-2 rounded-full bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] shadow-2xs">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* HOW IT WORKS SECTION */}
        <section className="w-full my-6 text-left">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold text-[#008F75] uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#E8F7F2] border border-[#D9E5E1] shadow-2xs inline-block">
              Pipeline Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2.5">
              HOW IT WORKS
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-1 max-w-xl mx-auto">
              The complete end-to-end flow from repository ingestion to verifiable source-linked answers.
            </p>
          </div>

          {/* Responsive Workflow Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {WORKFLOW_STEPS.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.step}
                  className="bg-white p-5 rounded-2xl border border-[#D9E5E1] hover:border-[#008F75] shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="p-2.5 rounded-xl bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] group-hover:bg-[#008F75] group-hover:text-white transition-colors shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#64748B] px-2.5 py-0.5 rounded-lg bg-slate-50 border border-[#D9E5E1]">
                        Step {step.step}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[#0F172A] text-sm sm:text-base group-hover:text-[#008F75] transition-colors mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs text-[#475569] leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Downward Section Indicator */}
        <div className="my-10 flex flex-col items-center gap-2 text-slate-400">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-[#D9E5E1]" />
          <div className="p-2 rounded-full bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] shadow-2xs">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* FEATURES SECTION */}
        <section className="w-full my-6 text-left">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold text-[#008F75] uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#E8F7F2] border border-[#D9E5E1] shadow-2xs inline-block">
              Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2.5">
              FEATURES
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-1 max-w-xl mx-auto">
              Everything you need to deeply inspect, query, document, and analyze any codebase.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-[#D9E5E1] hover:border-[#008F75] shadow-xs hover:shadow-md hover:shadow-slate-900/5 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-xl bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] group-hover:bg-[#008F75] group-hover:text-white transition-colors shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] font-semibold">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[#0F172A] text-base sm:text-lg mb-2 group-hover:text-[#008F75] transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#475569] leading-relaxed font-normal">{feat.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Downward Section Indicator */}
        <div className="my-10 flex flex-col items-center gap-2 text-slate-400">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-[#D9E5E1]" />
          <div className="p-2 rounded-full bg-[#E8F7F2] text-[#008F75] border border-[#D9E5E1] shadow-2xs">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* SUPPORTED TECHNOLOGIES SECTION */}
        <section className="w-full my-6 bg-white p-6 sm:p-10 rounded-3xl border border-[#D9E5E1] shadow-xs text-center">
          <span className="text-xs font-semibold text-[#008F75] uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#E8F7F2] border border-[#D9E5E1] inline-block mb-2 shadow-2xs">
            Ecosystem
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-2">
            SUPPORTED TECHNOLOGIES
          </h2>
          <p className="text-xs text-[#64748B] mb-6 max-w-md mx-auto">
            Language-aware structural parsing and semantic vector embeddings across all modern programming languages.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-4xl mx-auto">
            {SUPPORTED_TECHNOLOGIES.map((tech) => (
              <span
                key={tech}
                className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-[#E8F7F2] text-[#334155] hover:text-[#008F75] border border-[#D9E5E1] hover:border-[#008F75] text-xs sm:text-sm font-medium transition-all shadow-2xs"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1550px] z-10 pt-8 mt-6 border-t border-[#D9E5E1] flex flex-col sm:flex-row justify-between items-center text-xs text-[#64748B] gap-4">
        <span>GITHUB CODEBASE AI ASSISTANT — Understand any public GitHub codebase with AI</span>
        <div className="flex flex-wrap items-center gap-6 text-[#475569] font-medium">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />NVIDIA Nemotron-3</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />GLM-5.2 Intelligence</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />ChromaDB Vectors</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />Supabase Prisma</span>
        </div>
      </footer>
    </div>
  );
}
