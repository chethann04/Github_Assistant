"use client";

import React from "react";
import { OnboardingStep } from "./GitMapTypes";
import {
  X,
  Compass,
  FileCode,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface GitMapOnboardingModalProps {
  onboardingGuide: OnboardingStep[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (filePath: string) => void;
}

export default function GitMapOnboardingModal({
  onboardingGuide,
  isOpen,
  onClose,
  onSelectNode,
}: GitMapOnboardingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Developer Onboarding: "Start Here" Roadmap <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Curated reading order to understand this repository in 15 minutes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs custom-scrollbar">
          {onboardingGuide.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Onboarding synthesis in progress...</p>
          ) : (
            onboardingGuide.map((step) => (
              <div
                key={step.step}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-[10px]">
                      {step.step}
                    </span>
                    <span className="font-bold text-slate-200 text-xs font-mono">
                      {step.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                      {step.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onSelectNode(step.path);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <FileCode className="w-3 h-3" /> Focus on Map
                  </button>
                </div>

                <p className="text-slate-300 leading-relaxed text-xs">{step.whatItDoes}</p>
                <p className="text-slate-400 text-[11px] font-mono">
                  <span className="text-amber-400/90 font-semibold">Why it matters: </span>
                  {step.whyItMatters}
                </p>

                {step.connectsTo && step.connectsTo.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-semibold">Connects to:</span>
                    {step.connectsTo.map((target, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400"
                      >
                        {target}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
