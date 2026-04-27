"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TranscriptPanel from "@/components/TranscriptPanel";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import ChatPanel from "@/components/ChatPanel";
import SettingsModal from "@/components/SettingsModal";
import {
  TranscriptChunk,
  SuggestionBatch,
  ChatMessage,
  Settings,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/prompts";

// ─── helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fullTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => c.text).join(" ");
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Home() {
  // Persisted across modal saves
  const [apiKey, setApiKey] = useState<string>("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);

  // Session state
  const [sessionStartTime] = useState(Date.now());
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>(
    []
  );
  const [suggestionBatches, setSuggestionBatches] = useState<
    SuggestionBatch[]
  >([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load API key from localStorage after mount (avoids SSR mismatch) ────────
  useEffect(() => {
    const stored = localStorage.getItem("groq_api_key") ?? "";
    setApiKey(stored);
    if (!stored) setShowSettings(true);
  }, []);

  // ── Save key to localStorage ───────────────────────────────────────────────
  const handleSaveSettings = (newKey: string, newSettings: Settings) => {
    setApiKey(newKey);
    setSettings(newSettings);
    if (typeof window !== "undefined") {
      localStorage.setItem("groq_api_key", newKey);
    }
  };

  // ── Transcribe the buffered audio ──────────────────────────────────────────
  const flushAndTranscribe = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob);
      form.append("apiKey", apiKey);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();

      if (data.text && data.text.trim()) {
        const chunk: TranscriptChunk = {
          id: uid(),
          text: data.text.trim(),
          timestamp: Date.now(),
        };
        setTranscriptChunks((prev) => [...prev, chunk]);
        return chunk;
      }
    } catch (e) {
      console.error("Transcription error:", e);
    } finally {
      setIsTranscribing(false);
    }
  }, [apiKey]);

  // ── Fetch suggestions ──────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(
    async (chunks: TranscriptChunk[]) => {
      if (chunks.length === 0) return;

      const transcript = fullTranscript(chunks);
      if (transcript.trim().length < 20) return;

      setIsSuggestionsLoading(true);
      try {
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            apiKey,
            suggestionPrompt: settings.suggestionPrompt,
            suggestionContextChars: settings.suggestionContextChars,
          }),
        });
        const data = await res.json();

        if (data.suggestions) {
          const batch: SuggestionBatch = {
            id: uid(),
            suggestions: data.suggestions,
            timestamp: Date.now(),
            transcriptSnapshot: transcript.slice(-500),
          };
          setSuggestionBatches((prev) => [batch, ...prev]);
        }
      } catch (e) {
        console.error("Suggestions error:", e);
      } finally {
        setIsSuggestionsLoading(false);
      }
    },
    [apiKey, settings]
  );

  // ── Manual refresh ─────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!apiKey) { setShowSettings(true); return; }
    const chunk = await flushAndTranscribe();
    setTranscriptChunks((prev) => {
      const updated = chunk ? [...prev, chunk] : prev;
      fetchSuggestions(updated);
      return prev; // state already updated in flushAndTranscribe
    });
    // Simpler: just use latest state
    fetchSuggestions(transcriptChunks);
  }, [apiKey, flushAndTranscribe, fetchSuggestions, transcriptChunks]);

  // ── Auto-refresh timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      refreshTimerRef.current = setInterval(async () => {
        await flushAndTranscribe();
        setTranscriptChunks((latest) => {
          fetchSuggestions(latest);
          return latest;
        });
      }, settings.refreshIntervalSeconds * 1000);
    } else {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [isRecording, settings.refreshIntervalSeconds, flushAndTranscribe, fetchSuggestions]);

  // ── Start / stop recording ─────────────────────────────────────────────────
  const toggleRecording = useCallback(async () => {
    if (!apiKey) { setShowSettings(true); return; }

    if (isRecording) {
      // Stop
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };

        // Collect data every 30s
        recorder.start(settings.refreshIntervalSeconds * 1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (e) {
        console.error("Mic error:", e);
        alert(
          "Could not access microphone. Please allow microphone permissions and try again."
        );
      }
    }
  }, [apiKey, isRecording, settings.refreshIntervalSeconds]);

  // ── Suggestion click → chat ────────────────────────────────────────────────
  const handleSuggestionClick = useCallback(
    async (suggestionId: string, preview: string) => {
      if (!apiKey) { setShowSettings(true); return; }

      // Add user message
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: preview,
        timestamp: Date.now(),
        fromSuggestion: preview,
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsChatStreaming(true);

      try {
        const transcript = fullTranscript(transcriptChunks);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "detail",
            transcript,
            apiKey,
            suggestion: preview,
            detailPrompt: settings.detailPrompt,
            detailContextChars: settings.detailContextChars,
          }),
        });
        const data = await res.json();

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: data.answer ?? "Sorry, I could not generate an answer.",
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        console.error("Detail error:", e);
      } finally {
        setIsChatStreaming(false);
      }
    },
    [apiKey, transcriptChunks, settings]
  );

  // ── Manual chat send (streaming) ───────────────────────────────────────────
  const handleChatSend = useCallback(
    async (text: string) => {
      if (!apiKey) { setShowSettings(true); return; }

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      const updatedMessages = [...chatMessages, userMsg];
      setChatMessages(updatedMessages);
      setIsChatStreaming(true);

      // Placeholder for streaming assistant message
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      try {
        const transcript = fullTranscript(transcriptChunks);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "chat",
            transcript,
            apiKey,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            chatPrompt: settings.chatPrompt,
            detailContextChars: settings.detailContextChars,
          }),
        });

        if (!res.body) throw new Error("No stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                fullContent += delta;
                setChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch {
              // Ignore malformed SSE chunks
            }
          }
        }
      } catch (e) {
        console.error("Chat stream error:", e);
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.content === ""
              ? { ...m, content: "Sorry, something went wrong." }
              : m
          )
        );
      } finally {
        setIsChatStreaming(false);
      }
    },
    [apiKey, chatMessages, transcriptChunks, settings]
  );

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionStartTime: new Date(sessionStartTime).toISOString(),
      transcript: transcriptChunks.map((c) => ({
        timestamp: new Date(c.timestamp).toISOString(),
        text: c.text,
      })),
      suggestionBatches: suggestionBatches.map((b) => ({
        timestamp: new Date(b.timestamp).toISOString(),
        suggestions: b.suggestions.map((s) => ({
          type: s.type,
          preview: s.preview,
          detail: s.detail,
        })),
      })),
      chat: chatMessages.map((m) => ({
        timestamp: new Date(m.timestamp).toISOString(),
        role: m.role,
        content: m.content,
        fromSuggestion: m.fromSuggestion,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#080514] text-white overflow-hidden">
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-purple-900/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-900/50">
            <span className="text-xs font-bold">T</span>
          </div>
          <span className="font-semibold text-white/90 tracking-tight">
            TwinMind Copilot
          </span>
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <ExportIcon />
            Export
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <GearIcon />
            Settings
            {!apiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* No API key banner */}
      {!apiKey && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between">
          <p className="text-xs text-amber-300">
            ⚠ Paste your Groq API key in Settings to get started. Free at{" "}
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              console.groq.com
            </a>
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs font-semibold text-amber-300 hover:text-amber-200"
          >
            Open Settings →
          </button>
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden divide-x divide-purple-900/30">
        {/* Left: Transcript */}
        <div className="w-[28%] flex flex-col overflow-hidden">
          <TranscriptPanel
            chunks={transcriptChunks}
            isRecording={isRecording}
            sessionStartTime={sessionStartTime}
            onToggleRecording={toggleRecording}
            isTranscribing={isTranscribing}
          />
        </div>

        {/* Middle: Suggestions */}
        <div className="w-[34%] flex flex-col overflow-hidden">
          <SuggestionsPanel
            batches={suggestionBatches}
            onSuggestionClick={handleSuggestionClick}
            onRefresh={handleRefresh}
            isLoading={isSuggestionsLoading}
            isRecording={isRecording}
          />
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel
            messages={chatMessages}
            onSend={handleChatSend}
            isStreaming={isChatStreaming}
          />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
