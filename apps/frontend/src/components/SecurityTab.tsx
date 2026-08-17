"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  FileCode,
  AlertTriangle,
  Flame,
  Info,
  Lock,
  Key,
  Database,
  FileWarning,
  EyeOff,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import axios from "axios";

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type SecurityConfidence = "CONFIRMED" | "HIGH_CONFIDENCE" | "POTENTIAL" | "INFO";
export type SecurityFilter = "ALL" | "CONFIRMED" | "POTENTIAL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW_INFO";

export interface SecurityFinding {
  id: string;
  repositoryId: string;
  commitSha: string;
  severity: SecuritySeverity;
  category: string;
  cwe?: string;
  confidence: SecurityConfidence;
  title: string;
  filePath: string;
  startLine: number;
  endLine: number;
  lineRange: string;
  evidence: string;
  problem: string;
  whyItMatters: string;
  explanation: string;
  suggestedRemediation: string;
  recommendedFix: string;
}

interface SecurityTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const FILTER_OPTIONS: Array<{ id: SecurityFilter; label: string }> = [
  { id: "ALL", label: "All Findings" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "POTENTIAL", label: "Potential" },
  { id: "CRITICAL", label: "Critical" },
  { id: "HIGH", label: "High" },
  { id: "MEDIUM", label: "Medium" },
  { id: "LOW_INFO", label: "Low / Info" },
];

export default function SecurityTab({ repositoryId }: SecurityTabProps) {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<SecurityFilter>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSecurityScan = async (forceRescan = false) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/intelligence/${repositoryId}/security`, {
        forceRescan,
      });
      setFindings(response.data);
    } catch (err) {
      console.error("Failed to run security scan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityScan(false);
  }, [repositoryId]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFindings = findings.filter((f) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "CONFIRMED") return f.confidence === "CONFIRMED" || f.confidence === "HIGH_CONFIDENCE";
    if (activeFilter === "POTENTIAL") return f.confidence === "POTENTIAL" || f.confidence === "INFO";
    if (activeFilter === "CRITICAL") return f.severity === "CRITICAL";
    if (activeFilter === "HIGH") return f.severity === "HIGH";
    if (activeFilter === "MEDIUM") return f.severity === "MEDIUM";
    if (activeFilter === "LOW_INFO") return f.severity === "LOW" || f.severity === "INFO";
    return true;
  });

  const confirmedCount = findings.filter((f) => f.confidence === "CONFIRMED" || f.confidence === "HIGH_CONFIDENCE").length;
  const potentialCount = findings.filter((f) => f.confidence === "POTENTIAL").length;
  const infoCount = findings.filter((f) => f.confidence === "INFO").length;
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f) => f.severity === "HIGH").length;

  const getSeverityBadge = (sev: SecuritySeverity) => {
    switch (sev) {
      case "CRITICAL":
        return <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[11px] font-bold">CRITICAL</span>;
      case "HIGH":
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full text-[11px] font-bold">HIGH</span>;
      case "MEDIUM":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold">MEDIUM</span>;
      case "LOW":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">LOW</span>;
      case "INFO":
      default:
        return <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[11px] font-bold">INFO</span>;
    }
  };

  const getConfidenceBadge = (conf: SecurityConfidence) => {
    switch (conf) {
      case "CONFIRMED":
        return <span className="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Confirmed Vulnerability</span>;
      case "HIGH_CONFIDENCE":
        return <span className="bg-orange-100 text-orange-800 border border-orange-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">High Confidence</span>;
      case "POTENTIAL":
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">Potential Weakness</span>;
      case "INFO":
      default:
        return <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase">Informational</span>;
    }
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 w-fit">
            <Lock className="w-3.5 h-3.5 text-red-600" /> Hardened Security Engine
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Static & AI Security Vulnerability Scanner
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Grounded OWASP Top 10 vulnerability assessment with confidence grading, verified CWE mapping, and secret masking.
          </p>
        </div>

        <button
          onClick={() => fetchSecurityScan(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Rescan Security</span>
        </button>
      </div>

      {/* Security Confidence & Severity Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Findings</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{findings.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-red-50/70 border border-red-200">
          <span className="text-[11px] font-semibold text-red-700 block uppercase">Confirmed</span>
          <span className="text-2xl font-bold text-red-800 mt-1 block">{confirmedCount}</span>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
          <span className="text-[11px] font-semibold text-amber-700 block uppercase">Potential</span>
          <span className="text-2xl font-bold text-amber-800 mt-1 block">{potentialCount}</span>
        </div>
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
          <span className="text-[11px] font-semibold text-blue-700 block uppercase">Informational</span>
          <span className="text-2xl font-bold text-blue-800 mt-1 block">{infoCount}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-600 block uppercase">Critical / High</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{criticalCount + highCount}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === f.id
                ? "bg-[#008F75] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
          <div className="w-8 h-8 border-2 border-[#008F75] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Scanning codebase with hardened security heuristics & GLM-5.2...</span>
        </div>
      ) : filteredFindings.length > 0 ? (
        <div className="space-y-4">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 hover:border-slate-300 transition-all"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {getSeverityBadge(finding.severity)}
                  {getConfidenceBadge(finding.confidence)}
                  {finding.cwe && (
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                      {finding.cwe}
                    </span>
                  )}
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {finding.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <FileCode className="w-3.5 h-3.5 text-slate-400" />
                  <span>{finding.filePath}</span>
                  <span>({finding.lineRange})</span>
                </div>
              </div>

              {/* Title & Problem */}
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {finding.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>Problem: </strong>{finding.problem || finding.explanation}
                </p>
              </div>

              {/* Attack Vector & Impact */}
              {finding.whyItMatters && (
                <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-xs text-red-900">
                  <span className="font-bold block text-red-800">Attack Vector & Security Impact:</span>
                  <span className="mt-0.5 block">{finding.whyItMatters}</span>
                </div>
              )}

              {/* Evidence Code Snippet */}
              {finding.evidence && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Grounded Code Evidence (Masked)
                  </span>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
                    <pre className="text-amber-300">{finding.evidence}</pre>
                  </div>
                </div>
              )}

              {/* Recommended Fix */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Recommended Remediation
                  </span>
                  {finding.recommendedFix && (
                    <button
                      onClick={() => handleCopy(finding.id, finding.recommendedFix)}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 cursor-pointer"
                    >
                      {copiedId === finding.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === finding.id ? "Copied" : "Copy Fix"}</span>
                    </button>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 font-medium">
                  <p>{finding.suggestedRemediation}</p>
                  {finding.recommendedFix && finding.recommendedFix !== finding.suggestedRemediation && (
                    <pre className="mt-2 p-2 bg-white rounded-lg border border-emerald-200 font-mono text-[11px] text-emerald-900 whitespace-pre-wrap">
                      {finding.recommendedFix}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
          <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">No vulnerabilities found in this filter</h4>
          <p className="text-xs text-slate-500 mt-1">
            All scanned source files adhere to secure coding and OWASP best practices.
          </p>
        </div>
      )}
    </div>
  );
}
