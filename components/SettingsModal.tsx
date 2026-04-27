"use client";

import { useState } from "react";
import { Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/prompts";

interface Props {
  apiKey: string;
  settings: Settings;
  onSave: (apiKey: string, settings: Settings) => void;
  onClose: () => void;
}

export default function SettingsModal({
  apiKey,
  settings,
  onSave,
  onClose,
}: Props) {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  const update = (field: keyof Settings, value: string | number) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(localKey, localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f0a1e] border border-purple-900/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/30 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-purple-900/30">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* API Key */}
          <Section title="Groq API Key" description="Get yours free at console.groq.com">
            <input
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="gsk_..."
              className="field"
            />
          </Section>

          {/* Timing */}
          <Section title="Refresh Interval" description="How often to auto-generate suggestions (seconds)">
            <input
              type="number"
              value={localSettings.refreshIntervalSeconds}
              onChange={(e) =>
                update("refreshIntervalSeconds", Number(e.target.value))
              }
              min={10}
              max={120}
              className="field w-32"
            />
          </Section>

          {/* Context windows */}
          <Section title="Suggestion Context Window" description="Characters of transcript to send for suggestions">
            <input
              type="number"
              value={localSettings.suggestionContextChars}
              onChange={(e) =>
                update("suggestionContextChars", Number(e.target.value))
              }
              min={500}
              max={10000}
              step={500}
              className="field w-40"
            />
          </Section>

          <Section title="Detail / Chat Context Window" description="Characters of transcript to send for chat answers">
            <input
              type="number"
              value={localSettings.detailContextChars}
              onChange={(e) =>
                update("detailContextChars", Number(e.target.value))
              }
              min={1000}
              max={20000}
              step={1000}
              className="field w-40"
            />
          </Section>

          {/* Prompts */}
          <Section title="Suggestion Prompt" description="Use {transcript} as the placeholder">
            <textarea
              value={localSettings.suggestionPrompt}
              onChange={(e) => update("suggestionPrompt", e.target.value)}
              rows={8}
              className="field text-xs font-mono"
            />
          </Section>

          <Section title="Detail Answer Prompt" description="Use {transcript} and {suggestion} as placeholders">
            <textarea
              value={localSettings.detailPrompt}
              onChange={(e) => update("detailPrompt", e.target.value)}
              rows={6}
              className="field text-xs font-mono"
            />
          </Section>

          <Section title="Chat System Prompt" description="Use {transcript} as the placeholder">
            <textarea
              value={localSettings.chatPrompt}
              onChange={(e) => update("chatPrompt", e.target.value)}
              rows={4}
              className="field text-xs font-mono"
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-purple-900/30">
          <button
            onClick={handleReset}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .field {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 10px;
          padding: 10px 14px;
          color: white;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .field:focus {
          border-color: rgba(139,92,246,0.5);
        }
        .field::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1">
        {title}
      </label>
      {description && (
        <p className="text-xs text-white/30 mb-2">{description}</p>
      )}
      {children}
    </div>
  );
}
