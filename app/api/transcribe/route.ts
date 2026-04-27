import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "../../../lib/groq";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;
    const apiKey = formData.get("apiKey") as string | null;

    if (!audio || !apiKey) {
      return NextResponse.json(
        { error: "Missing audio or apiKey" },
        { status: 400 }
      );
    }

    const text = await transcribeAudio(apiKey, audio);
    return NextResponse.json({ text: text.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
