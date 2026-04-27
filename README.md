# TwinMind Copilot

A live AI meeting copilot that transcribes audio in real time and surfaces three contextual suggestions every 30 seconds — questions to ask, talking points, fact-checks, clarifications, and direct answers.

**Live demo:** `<your-vercel-url>`  
**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Groq API

---

## Setup

```bash
git clone <your-repo>
cd twinmind-copilot
npm install
npm run dev
```

Open `http://localhost:3000`, click Settings, and paste your Groq API key (free at [console.groq.com](https://console.groq.com)).

---

## Deploy to Vercel

```bash
npx vercel
```

No environment variables needed — the API key is entered per-session in the UI and never stored server-side.

---

## Stack choices

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 App Router | API routes + React in one repo, instant Vercel deploy |
| Transcription | Whisper Large V3 (Groq) | Required by spec; fastest Whisper available |
| LLM | Llama 4 Maverick 17B via Groq | GPT-OSS class model per spec; Groq gives ~300 tok/s |
| Styling | Tailwind CSS v4 | Fast iteration, zero runtime |
| Audio | MediaRecorder API | Native browser, no dependencies |

---

## Prompt strategy

### Suggestion generation (`lib/prompts.ts`)

The suggestion prompt does three things:

1. **Silent classification** — the model is asked to internally classify the conversation type (interview, sales call, brainstorm, lecture, technical, negotiation, casual) before generating suggestions. This shapes the mix without requiring a separate API call.

2. **Forced variety** — the prompt explicitly requires each of the 3 suggestions to be a *different* type (`question`, `talking_point`, `fact_check`, `clarification`, `answer`). This prevents the model from returning 3 similar follow-up questions.

3. **Recency bias** — the prompt instructs the model to weight the last 30 seconds heavily. Combined with the 3000-char context window (~90 seconds of speech), recent statements dominate the output.

**Context window:** 3,000 chars for suggestions (~90s of speech), 8,000 chars for detail answers and chat (full session context).

**Key insight:** The `preview` alone is instructed to deliver standalone value. This means a user gets something useful even without clicking — the click expands on it rather than revealing the actual insight.

### Detail answers

When a suggestion card is clicked, a separate non-streaming call is made with:
- Full transcript (up to 8k chars)
- The specific suggestion as the user query
- A prompt tuned for 150–400 word responses readable mid-meeting

### Chat (streaming)

The full transcript is injected as a system prompt. Chat messages carry full conversation history per request. Groq SSE is passed through directly to the client without buffering, so first token appears within ~200ms.

---

## Tradeoffs

- **No VAD (Voice Activity Detection):** Audio is chunked by time (every 30s) rather than silence detection. This keeps the code simple but means chunks may cut mid-sentence. Whisper handles this gracefully.
- **API key in browser:** The key is stored in `localStorage` and sent with each request. For a production system you'd use server-side sessions, but the spec says no auth/persistence is required.
- **No server-side persistence:** All state is in React. Refresh resets the session. The export button compensates.
- **Single model for everything:** Groq Llama 4 Maverick is used for both suggestions and chat per spec. In production, a smaller model (Llama 3 8B) for suggestions would cut latency ~40%.

---

## File structure

```
app/
  api/
    transcribe/route.ts   — POST: audio → Whisper → text
    suggestions/route.ts  — POST: transcript → 3 suggestions (JSON)
    chat/route.ts         — POST: chat (streaming) or detail (non-streaming)
  page.tsx                — 3-column UI, all session state
  layout.tsx
  globals.css
components/
  TranscriptPanel.tsx     — mic button + scrolling transcript
  SuggestionsPanel.tsx    — batched suggestion cards
  ChatPanel.tsx           — streaming chat with markdown
  SettingsModal.tsx       — API key + editable prompts/settings
lib/
  types.ts                — shared TypeScript interfaces
  prompts.ts              — all prompt templates + DEFAULT_SETTINGS
  groq.ts                 — Groq API client (transcribe, suggest, chat, stream)
```
