export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
}

export type SuggestionType =
  | "question"
  | "talking_point"
  | "fact_check"
  | "clarification"
  | "answer";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  preview: string;
  detail?: string;
  timestamp: number;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  timestamp: number;
  transcriptSnapshot: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  fromSuggestion?: string;
}

export interface Settings {
  suggestionPrompt: string;
  chatPrompt: string;
  detailPrompt: string;
  suggestionContextChars: number;
  detailContextChars: number;
  refreshIntervalSeconds: number;
}
