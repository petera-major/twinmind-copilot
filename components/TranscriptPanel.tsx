"use client";

import { useEffect, useRef } from "react";
import { TranscriptChunk } from "@/lib/types";

interface Props {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  sessionStartTime: number;
  onToggleRecording: () => void;
  isTranscribing: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function TranscriptPanel({
  chunks,
  isRecording,
  sessionStartTime,
  onToggleRecording,
  isTranscribing,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-purple-900/30">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">
          Transcript
        </h2>
        <button
          onClick={onToggleRecording}
          className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isRecording
              ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              : "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/40"
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-sm bg-red-400 animate-pulse" />
              Stop Recording
            </>
          ) : (
            <>
              <MicIcon />
              Start Recording
            </>
          )}
        </button>
        {isTranscribing && (
          <p className="text-xs text-purple-400/60 text-center mt-2 animate-pulse">
            Transcribing…
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scrollbar-thin scrollbar-thumb-purple-900/40">
        {chunks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-12 h-12 rounded-full bg-purple-900/30 flex items-center justify-center">
              <MicIcon className="text-purple-500" />
            </div>
            <p className="text-sm text-white/30 leading-relaxed">
              Start recording to see your live transcript here
            </p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <div key={chunk.id} className="group pb-4 border-b border-purple-900/20 last:border-0">
              <span className="text-[10px] font-mono text-purple-500/40 mb-2 block tracking-wide">
                {formatTime(chunk.timestamp - sessionStartTime)}
              </span>
              <p className="text-[13.5px] text-white/75 leading-[1.75]">
                {chunk.text}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
      />
    </svg>
  );
}