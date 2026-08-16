"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle, Code, Layers, Sparkles, X, RotateCcw } from "lucide-react";
import axios from "axios";

interface IngestionProgressProps {
  jobId: string;
  repoName: string;
  onComplete: () => void;
  onCancel?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function IngestionProgress({ jobId, repoName, onComplete, onCancel }: IngestionProgressProps) {
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    let interval: any;
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE}/indexing/status/${jobId}`, {
          withCredentials: true,
        });
        const data = response.data;
        setJobStatus(data);

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
          if (data.status === "COMPLETED") {
            onComplete();
          }
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 1500);

    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  const handleCancelIndexing = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await axios.post(
        `${API_BASE}/indexing/cancel/${jobId}`,
        {},
        { withCredentials: true }
      );
      setJobStatus((prev: any) => ({
        ...prev,
        status: "FAILED",
        errorMessage: "Indexing was cancelled by user.",
        currentStep: "Cancelled",
      }));
    } catch (err: any) {
      console.error("Failed to cancel indexing:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const progress = jobStatus?.progress || 0;
  const currentStep = jobStatus?.currentStep || '';
  const status = jobStatus?.status || "PENDING";
  const isInProgress = status !== "COMPLETED" && status !== "FAILED";

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-[#D9E5E1] my-6 shadow-sm shadow-slate-900/5 relative overflow-hidden text-left animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-xs font-semibold text-[#008F75] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#008F75]" /> Indexing Pipeline
          </span>
          <h3 className="text-base font-bold text-[#0F172A] mt-0.5">{repoName}</h3>
        </div>
        <div className="flex items-center gap-2">
          {status === "COMPLETED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7F2] text-[#008F75] text-xs font-semibold border border-[#D9E5E1]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> Ready for Chat
            </span>
          ) : status === "FAILED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              <XCircle className="w-3.5 h-3.5 text-red-600" /> {jobStatus?.errorMessage?.includes("cancelled") ? "Cancelled" : "Ingestion Failed"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7F2] text-[#008F75] text-xs font-semibold border border-[#D9E5E1]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#008F75]" /> {status}
            </span>
          )}

          {/* Cancel Button while indexing */}
          {isInProgress && (
            <button
              onClick={handleCancelIndexing}
              disabled={isCancelling}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800 border border-red-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Cancel repository indexing"
            >
              {isCancelling ? <Loader2 className="w-3 h-3 animate-spin text-red-600" /> : <X className="w-3 h-3 text-red-600" />}
              <span>{isCancelling ? "Cancelling..." : "Cancel"}</span>
            </button>
          )}

          {/* Dismiss button when failed / cancelled */}
          {!isInProgress && onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4 overflow-hidden p-0.5 border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-2xs ${
            status === "FAILED" ? "bg-red-500" : "bg-[#008F75]"
          }`}
          style={{ width: `${status === "FAILED" ? 100 : progress}%` }}
        />
      </div>

      {/* Current Step Text */}
      {currentStep && status !== 'COMPLETED' && status !== 'FAILED' && (
        <p className="text-xs text-[#475569] text-center mb-3 font-mono">{currentStep}</p>
      )}

      {/* Pipeline Stages */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs text-[#64748B] pt-2 border-t border-slate-100">
        <div className={`flex flex-col items-center gap-1 ${progress >= 15 ? 'text-[#008F75] font-semibold' : ''}`}>
          <Clock className="w-4 h-4" />
          <span>Fetch Tree</span>
        </div>
        <div className={`flex flex-col items-center gap-1 ${progress >= 35 ? 'text-[#008F75] font-semibold' : ''}`}>
          <Code className="w-4 h-4" />
          <span>Logical Chunking</span>
        </div>
        <div className={`flex flex-col items-center gap-1 ${progress >= 65 ? 'text-[#008F75] font-semibold' : ''}`}>
          <Layers className="w-4 h-4" />
          <span>Vector Embed</span>
        </div>
        <div className={`flex flex-col items-center gap-1 ${progress === 100 ? 'text-[#008F75] font-semibold' : ''}`}>
          <Sparkles className="w-4 h-4 text-[#008F75]" />
          <span>Vector Store</span>
        </div>
      </div>

      {jobStatus?.totalFiles > 0 && (
        <div className="mt-4 flex justify-between text-xs text-[#475569] pt-3 border-t border-slate-100">
          <span>Files Processed: <strong className="text-[#0F172A]">{jobStatus.totalFiles}</strong></span>
          <span>Logical Chunks: <strong className="text-[#008F75] font-semibold">{jobStatus.totalChunks}</strong></span>
        </div>
      )}

      {jobStatus?.errorMessage && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
            {jobStatus.errorMessage}
          </p>
          <div className="flex gap-2">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 text-center text-xs py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-sm border border-slate-800"
              >
                Dismiss & Try Another Repo
              </button>
            )}
            <a
              href="/"
              className="flex-1 text-center text-xs py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#475569] hover:text-[#0F172A] transition-colors border border-slate-200"
            >
              Return to Homepage
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
