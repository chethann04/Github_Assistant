"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export interface UseAnalysisJobOptions {
  repositoryId: string;
  type: string;
  targetParam?: string | null;
  autoRunIfNone?: boolean;
}

interface ClientCachedState {
  jobId: string | null;
  result: any;
  status: "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  currentStage: string | null;
  commitSha: string | null;
  isStaleCommit: boolean;
  cachedAt: number;
}

// In-memory client cache to render previously loaded/completed features in 0ms
const clientAnalysisCache = new Map<string, ClientCachedState>();

export function useAnalysisJob<T = any>({
  repositoryId,
  type,
  targetParam,
  autoRunIfNone = true,
}: UseAnalysisJobOptions) {
  const cacheKey = `${repositoryId}:${type}${targetParam ? `:${targetParam}` : ""}`;
  const initialCached = clientAnalysisCache.get(cacheKey);

  const [jobId, setJobId] = useState<string | null>(() => initialCached?.jobId || null);
  const [result, setResult] = useState<T | null>(() => (initialCached?.result as T) || null);
  const [status, setStatus] = useState<"IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED">(
    () => initialCached?.status || "IDLE"
  );
  const [progress, setProgress] = useState(() => initialCached?.progress || 0);
  const [currentStage, setCurrentStage] = useState<string | null>(() => initialCached?.currentStage || null);
  const [error, setError] = useState<string | null>(null);
  const [commitSha, setCommitSha] = useState<string | null>(() => initialCached?.commitSha || null);
  const [isStaleCommit, setIsStaleCommit] = useState(() => initialCached?.isStaleCommit || false);
  const [isInitialLoading, setIsInitialLoading] = useState(() => !initialCached || initialCached.status === "IDLE");

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialMountRef = useRef(false);

  // Close SSE stream and polling
  const cleanupObservers = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Update client-side cache
  const updateClientCache = useCallback(
    (updates: Partial<ClientCachedState>) => {
      const current = clientAnalysisCache.get(cacheKey) || {
        jobId: null,
        result: null,
        status: "IDLE",
        progress: 0,
        currentStage: null,
        commitSha: null,
        isStaleCommit: false,
        cachedAt: Date.now(),
      };
      clientAnalysisCache.set(cacheKey, {
        ...current,
        ...updates,
        cachedAt: Date.now(),
      });
    },
    [cacheKey]
  );

  // Poll fallback
  const pollJobStatus = useCallback(
    async (targetJobId: string) => {
      try {
        const res = await axios.get(`${API_BASE}/analysis/jobs/${targetJobId}`, {
          withCredentials: true,
        });
        const job = res.data;
        if (!job) return;

        setStatus(job.status);
        setProgress(job.progress);
        setCurrentStage(job.currentStage);
        if (job.commitSha) setCommitSha(job.commitSha);

        updateClientCache({
          jobId: targetJobId,
          status: job.status,
          progress: job.progress,
          currentStage: job.currentStage,
          commitSha: job.commitSha,
        });

        if (job.status === "COMPLETED") {
          setResult(job.result);
          setError(null);
          updateClientCache({ result: job.result, status: "COMPLETED" });
          cleanupObservers();
        } else if (job.status === "FAILED") {
          setError(job.error || "Analysis failed.");
          cleanupObservers();
        } else if (job.status === "CANCELLED") {
          cleanupObservers();
        }
      } catch {
        /* silent */
      }
    },
    [cleanupObservers, updateClientCache]
  );

  // Attach to live SSE stream
  const observeJob = useCallback(
    (targetJobId: string) => {
      cleanupObservers();
      setJobId(targetJobId);

      try {
        const es = new EventSource(`${API_BASE}/analysis/jobs/${targetJobId}/events`, {
          withCredentials: true,
        });
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const { data } = parsed;
            if (!data) return;

            if (data.status) setStatus(data.status);
            if (data.progress !== undefined) setProgress(data.progress);
            if (data.currentStage) setCurrentStage(data.currentStage);

            updateClientCache({
              jobId: targetJobId,
              status: data.status,
              progress: data.progress,
              currentStage: data.currentStage,
            });

            if (data.status === "COMPLETED" || parsed.type === "completed") {
              if (data.result !== undefined) {
                setResult(data.result);
                updateClientCache({ result: data.result, status: "COMPLETED" });
              }
              setError(null);
              cleanupObservers();
            } else if (data.status === "FAILED" || parsed.type === "failed") {
              setError(data.error || "Analysis failed.");
              cleanupObservers();
            } else if (data.status === "CANCELLED" || parsed.type === "cancelled") {
              cleanupObservers();
            }
          } catch {
            /* silent */
          }
        };

        es.onerror = () => {
          // If SSE drops, fall back to periodic polling
          cleanupObservers();
          pollingTimerRef.current = setInterval(() => {
            pollJobStatus(targetJobId);
          }, 3000);
        };
      } catch {
        pollingTimerRef.current = setInterval(() => {
          pollJobStatus(targetJobId);
        }, 3000);
      }
    },
    [cleanupObservers, pollJobStatus, updateClientCache]
  );

  // Trigger analysis (forceRun = true creates a new background job)
  const triggerJob = useCallback(
    async (forceRun = true, customTarget?: string | null, params?: any) => {
      setError(null);
      try {
        const res = await axios.post(
          `${API_BASE}/analysis/jobs`,
          {
            repositoryId,
            type,
            targetParam: customTarget !== undefined ? customTarget : targetParam,
            params,
            forceRun,
          },
          { withCredentials: true }
        );

        const data = res.data;
        if (data.jobId) {
          setJobId(data.jobId);
          setStatus(data.status);
          setProgress(data.progress || 0);
          setCurrentStage(data.currentStage || "Initializing");

          updateClientCache({
            jobId: data.jobId,
            status: data.status,
            progress: data.progress || 0,
            currentStage: data.currentStage || "Initializing",
          });

          if (data.status === "COMPLETED") {
            setResult(data.result);
            updateClientCache({ result: data.result, status: "COMPLETED" });
          } else {
            observeJob(data.jobId);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || "Failed to start analysis");
      }
    },
    [repositoryId, type, targetParam, observeJob, updateClientCache]
  );

  // Cancel job
  const cancelJob = useCallback(async () => {
    if (!jobId) return;
    try {
      await axios.post(`${API_BASE}/analysis/jobs/${jobId}/cancel`, {}, { withCredentials: true });
      setStatus("CANCELLED");
      setCurrentStage("Cancelled by user");
      updateClientCache({ status: "CANCELLED", currentStage: "Cancelled by user" });
      cleanupObservers();
    } catch {
      /* silent */
    }
  }, [jobId, cleanupObservers, updateClientCache]);

  // Retry job
  const retryJob = useCallback(async () => {
    if (!jobId) return;
    try {
      await axios.post(`${API_BASE}/analysis/jobs/${jobId}/retry`, {}, { withCredentials: true });
      setStatus("QUEUED");
      setProgress(0);
      setCurrentStage("Queued for retry");
      setError(null);
      observeJob(jobId);
    } catch {
      /* silent */
    }
  }, [jobId, observeJob]);

  // Load latest state on mount
  useEffect(() => {
    let isMounted = true;
    cleanupObservers();

    const loadLatest = async () => {
      try {
        const queryTarget = targetParam ? `&targetParam=${encodeURIComponent(targetParam)}` : "";
        const res = await axios.get(
          `${API_BASE}/analysis/jobs/latest?repositoryId=${repositoryId}&type=${type}${queryTarget}`,
          { withCredentials: true, timeout: 8000 }
        );

        if (!isMounted) return;
        const job = res.data;

        if (job) {
          setJobId(job.jobId);
          setStatus(job.status);
          setProgress(job.progress || 0);
          setCurrentStage(job.currentStage);
          setCommitSha(job.commitSha);
          setIsStaleCommit(Boolean(job.isStaleCommit));

          updateClientCache({
            jobId: job.jobId,
            status: job.status,
            progress: job.progress,
            currentStage: job.currentStage,
            commitSha: job.commitSha,
            isStaleCommit: Boolean(job.isStaleCommit),
            result: job.result,
          });

          if (job.status === "COMPLETED" && job.result) {
            setResult(job.result);
          } else if (job.status === "RUNNING" || job.status === "QUEUED") {
            if (job.result) setResult(job.result); // preserve existing result while running
            observeJob(job.jobId);
          } else if (job.status === "FAILED") {
            if (job.result) setResult(job.result);
            setError(job.error || "Previous analysis failed.");
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err.response?.status === 404 && autoRunIfNone && !initialMountRef.current) {
          initialMountRef.current = true;
          triggerJob(false);
        }
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    };

    loadLatest();

    return () => {
      isMounted = false;
      cleanupObservers();
    };
  }, [repositoryId, type, targetParam, autoRunIfNone, cleanupObservers, observeJob, triggerJob, updateClientCache]);

  return {
    jobId,
    result,
    status,
    progress,
    currentStage,
    error,
    commitSha,
    isStaleCommit,
    isInitialLoading,
    isRunning: status === "RUNNING",
    isQueued: status === "QUEUED",
    isCompleted: status === "COMPLETED",
    isFailed: status === "FAILED",
    triggerJob,
    cancelJob,
    retryJob,
  };
}
