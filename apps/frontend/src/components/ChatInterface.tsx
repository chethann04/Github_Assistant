"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, FileCode, Sparkles, Loader2, ArrowRight,
  StopCircle, Copy, Check, Bug, Cpu, GitCommit, FolderOpen, Plus, Trash2, Edit3, X,
  ChevronDown, Search as SearchIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import CitationDrawer, { CitationData } from "./CitationDrawer";

type ChatMode = "repo" | "file" | "debug" | "architecture" | "commits";
export type AIModelProvider = "dual" | "gemini" | "openai";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: CitationData[];
  provider?: AIModelProvider | string;
}

interface Session {
  id: string;
  title: string;
  mode: ChatMode;
  updatedAt: string;
  messages?: Array<{ role: string; content: string; createdAt: string }>;
}

interface ChatInterfaceProps {
  repositoryId: string;
  repoName: string;
  files?: Array<{ path: string; size: number }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export const getAiModelsList = (isNvidia: boolean = false, modelName: string = "") => {
  const modelShortName = modelName ? modelName.split("/").pop() || modelName : (isNvidia ? "GLM-5.2" : "GPT-4o");
  const secondaryLabel = isNvidia ? `GLM (${modelShortName})` : "OpenAI ChatGPT";
  const secondaryBadge = isNvidia ? "NVIDIA NIM" : "GPT-4o";

  return [
    {
      id: "dual" as AIModelProvider,
      label: "Dual-AI Ensemble",
      shortLabel: "Dual-AI",
      badge: isNvidia ? "Gemini + GLM" : "Gemini + GPT-4o",
      description: isNvidia 
        ? "Gemini draft + GLM verification for zero hallucinations"
        : "Gemini draft + ChatGPT verification for zero hallucinations",
      pillColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      id: "gemini" as AIModelProvider,
      label: "Google Gemini",
      shortLabel: "Gemini",
      badge: "Gemini 2.5 Flash",
      description: "Ultra-fast codebase traversal and streaming",
      pillColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "openai" as AIModelProvider,
      label: secondaryLabel,
      shortLabel: isNvidia ? "GLM" : "ChatGPT",
      badge: secondaryBadge,
      description: isNvidia 
        ? `NVIDIA NIM accelerated inference (${modelShortName})`
        : "Deep code reasoning and multi-file architecture",
      pillColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];
};

export const AI_MODELS = getAiModelsList();

const MODES: Array<{ id: ChatMode; label: string; icon: any; description: string }> = [
  { id: "repo",         label: "Codebase",     icon: Sparkles,    description: "Chat with full codebase" },
  { id: "file",         label: "File",          icon: FolderOpen,  description: "Focus on a specific file" },
  { id: "debug",        label: "Debug",         icon: Bug,         description: "Analyze bugs and errors" },
  { id: "architecture", label: "Architecture",  icon: Cpu,         description: "System design analysis" },
  { id: "commits",      label: "Commits",       icon: GitCommit,   description: "Understand recent changes" },
];

const MODE_PROMPTS: Record<ChatMode, string[]> = {
  repo:         ["Explain the high-level architecture", "Where are the main API endpoints?", "How is state managed?", "What are the key dependencies?"],
  file:         ["What does this file do?", "Explain the main function here", "What are the imports used for?", "Any potential bugs in this file?"],
  debug:        ["Analyze potential null pointer issues", "Find unhandled promise rejections", "What could cause race conditions?", "Check for security vulnerabilities"],
  architecture: ["Describe the layered architecture", "Map the data flow through the system", "What design patterns are used?", "Identify potential bottlenecks"],
  commits:      ["Summarize recent changes", "What major features were added recently?", "Any breaking changes in commits?", "Which files change most frequently?"],
};

export default function ChatInterface({ repositoryId, repoName, files = [] }: ChatInterfaceProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);
  const [mode, setMode] = useState<ChatMode>("repo");
  const [selectedModel, setSelectedModel] = useState<AIModelProvider>("dual");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<{
    gemini: boolean;
    openai: boolean;
    activeDefault: string;
    isNvidia?: boolean;
    openaiModel?: string;
    geminiModel?: string;
  }>({
    gemini: true,
    openai: true,
    activeDefault: "dual",
  });
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Custom Glassmorphic File Dropdown State
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFileDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch available AI providers (Gemini & ChatGPT)
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/providers`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAvailableProviders(data);
          if (data.activeDefault && (data.activeDefault === "dual" || data.activeDefault === "gemini" || data.activeDefault === "openai")) {
            setSelectedModel(data.activeDefault);
          }
        }
      } catch { /* silent */ }
    };
    fetchProviders();
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/${repositoryId}/sessions`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [repositoryId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startNewChat = async () => {
    setActiveSessionId(null);
    setMessages([{
      id: "initial",
      role: "ASSISTANT",
      content: `Hello! I'm your AI assistant for **${repoName}**. I'm in **${MODES.find(m => m.id === mode)?.label}** mode. What would you like to know?`,
    }]);
    setInput("");
  };

  // Load existing session messages
  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const session = await res.json();
      setActiveSessionId(sessionId);
      setMode((session.mode as ChatMode) || "repo");
      if (session.selectedFile) setSelectedFile(session.selectedFile);
      setMessages(
        session.messages?.map((m: any) => ({
          id: m.id || Date.now().toString(),
          role: m.role as "USER" | "ASSISTANT",
          content: m.content,
          citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : [],
        })) || []
      );
      setShowSidebar(false);
    } catch { /* silent */ }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch { /* silent */ }
  };

  const startRename = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingSession(session.id);
    setRenameValue(session.title);
  };

  const submitRename = async (sessionId: string) => {
    if (!renameValue.trim()) return;
    try {
      await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: renameValue.trim() } : s));
    } catch { /* silent */ }
    setRenamingSession(null);
  };

  const copyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSendMessage = async (text: string) => {
    const query = text.trim();
    if (!query || streaming) return;

    if (mode === "file" && !selectedFile) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: "ASSISTANT",
        content: "⚠️ Please select a file first using the file dropdown to use File Chat mode.",
      }]);
      return;
    }

    setInput("");
    const userMsgId = Date.now().toString();
    const assistantMsgId = (Date.now() + 1).toString();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "USER", content: query },
      { id: assistantMsgId, role: "ASSISTANT", content: "", citations: [], provider: selectedModel },
    ]);

    setStreaming(true);
    abortRef.current = false;

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          repositoryId,
          chatSessionId: activeSessionId,
          mode,
          selectedFilePath: mode === "file" ? selectedFile : undefined,
          provider: selectedModel,
        }),
      });

      if (!response.body) throw new Error("ReadableStream not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        if (abortRef.current) {
          try { await reader.cancel(); } catch {}
          break;
        }
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace(/^data:\s*/, "").trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "sessionId" && event.data?.sessionId) {
              setActiveSessionId(event.data.sessionId);
              setTimeout(() => loadSessions(), 500);
            } else if (event.type === "provider" && event.data?.provider) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, provider: event.data.provider } : msg
              ));
            } else if (event.type === "citations" && event.data?.citations) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, citations: event.data.citations } : msg
              ));
            } else if (event.type === "token" && event.data?.token !== undefined) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: (msg.content || "") + event.data.token } : msg
              ));
            } else if (event.type === "error" && event.data?.message) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: (msg.content || "") + `\n\n*${event.data.message}*` } : msg
              ));
            }
          } catch { /* pass */ }
        }
      }
    } catch (err: any) {
      setMessages((prev) => prev.map((msg) =>
        msg.id === assistantMsgId
          ? { ...msg, content: `Error: ${err.message || "Failed to stream response."}` }
          : msg
      ));
    } finally {
      setStreaming(false);
      setTimeout(() => loadSessions(), 1000);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  const initialMessages = messages.length <= 1;

  return (
    <div className="flex h-[780px] w-full rounded-3xl border border-white/80 overflow-hidden shadow-xl shadow-slate-900/5 bg-white/85 backdrop-blur-2xl relative">
      {/* Session Sidebar */}
      {showSidebar && (
        <div className="w-64 shrink-0 bg-white/70 backdrop-blur-xl border-r border-slate-200/80 flex flex-col z-20">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Conversations</span>
            <button onClick={() => setShowSidebar(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => { startNewChat(); setShowSidebar(false); }}
            className="m-2.5 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" /> New Chat
          </button>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No conversations yet</p>
            )}
            {sessions.map((session) => {
              const ModeIcon = MODES.find((m) => m.id === session.mode)?.icon || Sparkles;
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                    isActive
                      ? "bg-emerald-50/90 border border-emerald-200 text-emerald-950 font-semibold shadow-2xs"
                      : "hover:bg-white/80 text-slate-700 border border-transparent"
                  }`}
                >
                  <ModeIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-700" : "text-slate-600"}`} />
                  {renamingSession === session.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => submitRename(session.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitRename(session.id); if (e.key === "Escape") setRenamingSession(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-white rounded px-1.5 py-0.5 text-slate-900 text-xs outline-none border border-emerald-600 shadow-xs"
                    />
                  ) : (
                    <span className="flex-1 truncate">{session.title}</span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => startRename(session, e)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => deleteSession(session.id, e)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-slate-50/50 backdrop-blur-md relative">
        {/* Mode & Model Selector Header */}
        <div className="p-3 border-b border-slate-200/80 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-xl hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 transition-all shadow-2xs"
              title="Toggle conversations"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 bg-slate-100/90 backdrop-blur-md p-1 rounded-full border border-slate-200 shadow-inner">
              {MODES.map((m) => {
                const Icon = m.icon;
                const isSelected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-sm border border-slate-800"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-400" : ""}`} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Model Selector Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              {(() => {
                const currentAiModels = getAiModelsList(availableProviders.isNvidia, availableProviders.openaiModel);
                const currentModelObj = currentAiModels.find(m => m.id === selectedModel) || currentAiModels[0];
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-slate-300/80 hover:border-slate-400 text-xs font-semibold text-slate-800 shadow-2xs transition-all"
                      title="Select AI Model"
                    >
                      {selectedModel === "dual" ? (
                        <span className="flex items-center gap-1.5 text-purple-700 font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span className="hidden sm:inline">Dual-AI</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 rounded-md text-purple-800 font-mono">
                            {currentModelObj.badge}
                          </span>
                        </span>
                      ) : selectedModel === "openai" ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                          <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{currentModelObj.label}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-blue-700 font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Gemini 2.5 Flash</span>
                        </span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isModelDropdownOpen ? "rotate-180 text-slate-700" : ""}`} />
                    </button>

                    {isModelDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl glass-dropdown border border-slate-200/90 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select AI Engine</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                        </div>
                        <div className="space-y-1.5">
                          {currentAiModels.map((m) => {
                            const isChosen = selectedModel === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setIsModelDropdownOpen(false);
                                }}
                                className={`w-full flex flex-col items-start gap-1 p-2.5 rounded-xl text-left transition-all ${
                                  isChosen
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "hover:bg-slate-100/90 text-slate-800 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className={`text-xs font-bold ${isChosen ? "text-white" : "text-slate-900"}`}>
                                    {m.label}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                                    isChosen ? "bg-white/20 text-white" : m.pillColor
                                  }`}>
                                    {m.badge}
                                  </span>
                                </div>
                                <p className={`text-[11px] leading-tight ${isChosen ? "text-slate-300" : "text-slate-500"}`}>
                                  {m.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <button
              onClick={startNewChat}
              className="p-2 rounded-xl hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 transition-all shadow-2xs"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CUSTOM GLASSMORPHIC FILE DROPDOWN (in File Mode) */}
        {mode === "file" && (
          <div className="px-4 py-2.5 border-b border-slate-200/80 bg-white/70 backdrop-blur-md flex items-center gap-3 z-30" ref={dropdownRef}>
            <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-emerald-700" /> Focus File:
            </span>

            <div className="relative flex-1">
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsFileDropdownOpen(!isFileDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white border border-slate-300 hover:border-emerald-400 text-left text-xs text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate font-mono font-medium">
                    {selectedFile || "Click to choose a file from repository..."}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFileDropdownOpen ? "rotate-180 text-emerald-600" : ""}`} />
              </button>

              {/* Glassmorphic Dropdown Popover */}
              {isFileDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl glass-dropdown border border-slate-200/90 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Search filter input */}
                  <div className="relative mb-2">
                    <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={fileFilter}
                      onChange={(e) => setFileFilter(e.target.value)}
                      placeholder="Filter files by path or name..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-slate-900 placeholder-slate-400"
                    />
                  </div>

                  {/* File items list */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {filteredFiles.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">No matching files found</p>
                    ) : (
                      filteredFiles.map((f) => {
                        const isSelected = selectedFile === f.path;
                        const ext = f.path.split(".").pop() || "txt";

                        return (
                          <div
                            key={f.path}
                            onClick={() => {
                              setSelectedFile(f.path);
                              setIsFileDropdownOpen(false);
                              setFileFilter("");
                            }}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-emerald-50 text-emerald-950 font-semibold border border-emerald-200 shadow-2xs"
                                : "hover:bg-slate-100/80 text-slate-700 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[10px] font-mono uppercase font-bold text-slate-700 shrink-0">
                                {ext}
                              </span>
                              <span className="font-mono truncate">{f.path}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400 text-[10px]">
                              <span>{Math.round(f.size / 1024)} KB</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 ml-1" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-950/5">
                  <Bot className="w-8 h-8 text-emerald-700" />
                </div>
                <p className="text-slate-900 font-bold mb-1">Start a conversation</p>
                <p className="text-slate-500 text-sm">Ask anything about {repoName}</p>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "USER";
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? "ml-auto flex-row-reverse max-w-2xl" : "mr-auto max-w-3xl"}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isUser
                    ? "bg-slate-900 text-white shadow-slate-900/20 border border-slate-800"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`relative p-4 rounded-2xl text-sm leading-relaxed group shadow-md transition-all ${
                  isUser
                    ? "bg-slate-900 text-white rounded-tr-none shadow-slate-900/20 border border-slate-800"
                    : "bg-white/90 backdrop-blur-md text-slate-800 border border-slate-200/90 rounded-tl-none shadow-slate-900/5"
                }`}>
                  {/* Assistant Model Badge */}
                  {!isUser && msg.provider && (
                    <div className="mb-2 flex items-center gap-1.5">
                      {msg.provider === "dual" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                          <Sparkles className="w-2.5 h-2.5 text-purple-600" /> Dual-AI ({availableProviders.isNvidia ? "Gemini + GLM Verified" : "Gemini + GPT-4o Verified"})
                        </span>
                      ) : msg.provider === "openai" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <Cpu className="w-2.5 h-2.5 text-emerald-600" /> {availableProviders.isNvidia ? `GLM (${(availableProviders.openaiModel || "GLM-5.2").split("/").pop()})` : "ChatGPT (GPT-4o)"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                          <Sparkles className="w-2.5 h-2.5 text-blue-600" /> Gemini 2.5 Flash
                        </span>
                      )}
                    </div>
                  )}

                  {/* Copy button */}
                  {msg.content && (
                    <button
                      onClick={() => copyMessage(msg.id, msg.content)}
                      className={`absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                        isUser
                          ? "hover:bg-slate-800 text-slate-400 hover:text-white"
                          : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}

                  {msg.content ? (
                    <div className={`prose prose-sm max-w-none pr-6 ${isUser ? "prose-invert text-white" : "prose-slate text-slate-800"}`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Searching vectors & generating response...</span>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold mb-2 block flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-emerald-700" /> Sources ({msg.citations.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cit, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCitation(cit)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-50/80 hover:bg-emerald-100 hover:border-emerald-300 border border-emerald-200/90 text-emerald-950 transition-all flex items-center gap-1 font-mono shadow-2xs"
                          >
                            <span>{cit.filePath.split("/").pop()}</span>
                            <span className="text-emerald-700 font-sans font-bold">
                              L{cit.startLine}-{cit.endLine}
                            </span>
                            {cit.score !== undefined && (
                              <span className="text-emerald-700 font-sans">{Math.round(cit.score * 100)}%</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {initialMessages && (
          <div className="px-5 pb-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {MODE_PROMPTS[mode].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="text-left text-xs p-3 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-950 transition-all flex items-center justify-between group shadow-sm hover:shadow-md"
                >
                  <span>{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-white/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "file"
                  ? selectedFile
                    ? `Ask about ${selectedFile.split("/").pop()}...`
                    : "Select a file above first..."
                  : `Ask about ${repoName}...`
              }
              className="flex-1 bg-white/90 backdrop-blur-md border border-slate-300 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
            />

            {streaming ? (
              <button
                type="button"
                onClick={() => { abortRef.current = true; setStreaming(false); }}
                className="p-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors shadow-sm"
                title="Stop generation"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-3 rounded-2xl bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-all shadow-md border border-slate-800 group"
              >
                <Send className="w-5 h-5 group-hover:text-emerald-400 transition-colors" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Citation Slide-over Drawer */}
      {selectedCitation && (
        <CitationDrawer
          citation={selectedCitation}
          repositoryId={repositoryId}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </div>
  );
}
