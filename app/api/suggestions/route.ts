import { NextRequest, NextResponse } from "next/server";
import { getSuggestions } from "../../../lib/groq";
import { buildSuggestionPrompt } from "../../../lib/prompts";
import { Suggestion, SuggestionType } from "../../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, apiKey, suggestionPrompt, suggestionContextChars } =
      body;

    if (!transcript || !apiKey) {
      return NextResponse.json(
        { error: "Missing transcript or apiKey" },
        { status: 400 }
      );
    }

    const prompt = buildSuggestionPrompt(
      transcript,
      suggestionContextChars ?? 3000,
      suggestionPrompt
    );

    const raw = await getSuggestions(apiKey, prompt);

    // Parse JSON 
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let parsed: { type: SuggestionType; preview: string }[];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw },
        { status: 502 }
      );
    }

    const suggestions: Suggestion[] = parsed.slice(0, 3).map((s, i) => ({
      id: `${Date.now()}-${i}`,
      type: s.type,
      preview: s.preview,
      timestamp: Date.now(),
    }));

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
