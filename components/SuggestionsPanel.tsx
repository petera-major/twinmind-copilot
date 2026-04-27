"use client";

import { SuggestionBatch, SuggestionType } from "@/lib/types";

interface Props {
  batches: SuggestionBatch[];
  onSuggestionClick: (suggestionId: string, preview: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isRecording: boolean;
}

const TYPE_CONFIG: Record<
  SuggestionType,
  { label: string; color: string; bg: string; dot: string }
  > = {
  question: {
    label: "Ask",
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/25",
    dot: "bg-violet-400",
  },
  talking_point: {
    label: "Point",
    color: "text-purple-300",
    bg: "bg-purple-500/10 border-purple-500/25",
    dot: "bg-purple-400",
  },
  fact_check: {
    label: "Fact",
    color: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-400",
  },
  clarification: {
    label: "Clarify",
    color: "text-sky-300",
    bg: "bg-sky-500/10 border-sky-500/25",
    dot: "bg-sky-400",
  },
  answer: {
    label: "Answer",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-400",
  },
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuggestionsPanel({
  batches,
  onSuggestionClick,
  onRefresh,
  isLoading,
  isRecording,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-purple-900/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-purple-400">
          Live Suggestions
        </h2>
        <button
          onClick={onRefresh}
          disabled={isLoading || !isRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-800/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <RefreshIcon spinning={isLoading} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8 scrollbar-thin scrollbar-thumb-purple-900/40">
        {batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <div className="w-14 h-14 rounded-full bg-purple-900/30 flex items-center justify-center text-2xl">
            💭
            </div>
            <p className="text-sm text-white/30 leading-relaxed max-w-[200px]">
              Suggestions will appear here as you speak
            </p>
          </div>
        ) : (
          batches.map((batch, batchIdx) => (
            <div key={batch.id}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-purple-900/25" />
                <span className="text-[10px] text-purple-500/50 font-mono tracking-wide">
                  {formatTimestamp(batch.timestamp)}
                  {batchIdx === 0 && (
                    <span className="ml-1.5 text-purple-400/80 font-semibold">
                      · latest
                    </span>
                  )}
                </span>
                <div className="h-px flex-1 bg-purple-900/25" />
              </div>

              <div className="space-y-3">
                {batch.suggestions.map((s) => {
                  const cfg = TYPE_CONFIG[s.type];
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSuggestionClick(s.id, s.preview)}
                      className={`w-full text-left px-4 py-4 rounded-2xl border ${cfg.bg} hover:brightness-125 transition-all duration-150 group`}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className={`text-[11px] font-semibold uppercase tracking-widest ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[13.5px] text-white/80 leading-relaxed">
                        {s.preview}
                      </p>
                      <p className={`mt-3 text-[11px] ${cfg.color} opacity-0 group-hover:opacity-60 transition-opacity`}>
                        Tap for full answer →
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-purple-400/50">
              Generating suggestions…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}