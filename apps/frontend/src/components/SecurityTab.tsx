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
} from "lucide-react";
import axios from "axios";

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type SecurityCategory =
  | "ALL"
  | "HARDCODED_SECRETS"
  | "INSECURE_AUTH"
  | "INJECTION_RISK"
  | "XSS_RISK"
  | "INSECURE_DATABASE"
  | "SENSITIVE_DATA_EXPOSURE"
  | "INSECURE_LOGGING"
  | "DEPENDENCY_RISK"
  | "INSECURE_CONFIG"
  | "INPUT_VALIDATION";

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  category: string;
  cwe?: string;
  confidence?: "CONFIRMED" | "LIKELY" | "POTENTIAL";
  title: string;
  filePath: string;
  lineRange: string;
  evidence: string;
  explanation: string;
  suggestedRemediation: string;
}

interface SecurityTabProps {
  repositoryId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const CATEGORIES: Array<{ id: SecurityCategory; label: string; icon: any }> = [
  { id: "ALL", label: "All Vulnerabilities", icon: ShieldAlert },
  { id: "HARDCODED_SECRETS", label: "Secrets & Keys", icon: Key },
  { id: "INSECURE_AUTH", label: "Auth & Access", icon: Lock },
  { id: "INJECTION_RISK", label: "Injection Risks", icon: Terminal },
  { id: "INSECURE_DATABASE", label: "Database Security", icon: Database },
  { id: "SENSITIVE_DATA_EXPOSURE", label: "Data Exposure", icon: EyeOff },
  { id: "INSECURE_LOGGING", label: "Insecure Logging", icon: FileWarning },
  { id: "INSECURE_CONFIG", label: "Configuration", icon: AlertTriangle },
];

export default function SecurityTab({ repositoryId }: SecurityTabProps) {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<SecurityCategory>("ALL");

  const fetchSecurityScan = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/intelligence/${repositoryId}/security`);
      setFindings(response.data);
    } catch (err) {
      console.error("Failed to run security scan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityScan();
  }, [repositoryId]);

  const filteredFindings = findings.filter((f) => {
    if (selectedCategory === "ALL") return true;
    return f.category?.toUpperCase() === selectedCategory;
  });

  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f) => f.severity === "HIGH").length;
  const mediumCount = findings.filter((f) => f.severity === "MEDIUM").length;
  const lowCount = findings.filter((f) => f.severity === "LOW" || f.severity === "INFO").length;

  return (
    <div className="w-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 w-fit">
            <Lock className="w-3.5 h-3.5" /> OWASP Top 10 & CWE Security Audit
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Automated Security Vulnerability Assessment
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Grounded static & semantic detection of credentials, injection risks, auth flaws, and configuration exposures.
          </p>
        </div>

        <button
          onClick={fetchSecurityScan}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Rescan Security</span>
        </button>
      </div>

      {/* Metric Counters Header */}
      {!loading && findings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-rose-700 block">Critical</span>
              <span className="text-xl font-bold">{criticalCount}</span>
            </div>
            <Flame className="w-5 h-5 text-rose-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-orange-700 block">High</span>
              <span className="text-xl font-bold">{highCount}</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-700 block">Medium</span>
              <span className="text-xl font-bold">{mediumCount}</span>
            </div>
            <ShieldAlert className="w-5 h-5 text-amber-600 opacity-80" />
          </div>
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-600 block">Low / Info</span>
              <span className="text-xl font-bold">{lowCount}</span>
            </div>
            <Info className="w-5 h-5 text-slate-500 opacity-80" />
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      {!loading && findings.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 text-xs scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === "ALL"
                ? findings.length
                : findings.filter((f) => f.category?.toUpperCase() === cat.id).length;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-rose-700 text-white border-rose-700 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Findings List */}
      <div>
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">
              Scanning logical boundaries for OWASP Top 10 vulnerabilities and hardcoded secrets...
            </span>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-slate-900 font-semibold">No vulnerabilities detected in this category</h4>
            <p className="text-xs text-slate-500 mt-1">
              Scanned code structures adhere cleanly to secure coding standards.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFindings.map((finding) => {
              const severityColor =
                finding.severity === "CRITICAL"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : finding.severity === "HIGH"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : finding.severity === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : finding.severity === "LOW"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={finding.id}
                  className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-2xs"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/70">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${severityColor}`}>
                        {finding.severity}
                      </span>
                      {finding.cwe && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono font-semibold">
                          {finding.cwe}
                        </span>
                      )}
                      {finding.category && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 font-semibold">
                          {finding.category}
                        </span>
                      )}
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{finding.title}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 shrink-0">
                      <FileCode className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-semibold text-slate-800">{finding.filePath}</span>
                      <span className="text-slate-400">({finding.lineRange})</span>
                    </div>
                  </div>

                  {/* Vulnerability Explanation */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Attack Vector & Impact
                    </span>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {finding.explanation}
                    </p>
                  </div>

                  {/* Masked Evidence */}
                  {finding.evidence && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 text-xs font-mono">
                      <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5 font-sans font-semibold">
                        <Lock className="w-3.5 h-3.5 text-rose-400" /> Masked Vulnerability Evidence
                      </div>
                      <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed text-slate-300 font-mono text-xs">
                        {finding.evidence}
                      </pre>
                    </div>
                  )}

                  {/* Remediation */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 shadow-2xs space-y-1">
                    <span className="text-[10px] text-emerald-800 uppercase tracking-wider block font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Security Remediation Guidance:
                    </span>
                    <p className="text-xs leading-relaxed text-emerald-900 font-medium">
                      {finding.suggestedRemediation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
