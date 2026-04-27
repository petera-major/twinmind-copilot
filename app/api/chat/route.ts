import { NextRequest } from "next/server";
import { streamChatResponse, getDetailAnswer } from "../../../lib/groq";
import {
  buildChatSystemPrompt,
  buildDetailPrompt,
} from "../../../lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      transcript,
      apiKey,
      messages,
      chatPrompt,
      detailContextChars,
      suggestion,
      detailPrompt,
      mode, 
    } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing apiKey" }), {
        status: 400,
      });
    }

    if (mode === "detail") {
      const systemPrompt = buildDetailPrompt(
        transcript,
        suggestion,
        detailContextChars ?? 8000,
        detailPrompt
      );
      const answer = await getDetailAnswer(apiKey, systemPrompt, suggestion);
      return new Response(JSON.stringify({ answer }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildChatSystemPrompt(
      transcript,
      detailContextChars ?? 8000,
      chatPrompt
    );

    const stream = await streamChatResponse(apiKey, systemPrompt, messages);

    // passes groq sse stream directly to user
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
