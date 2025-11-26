import fetch from "node-fetch";

interface GeminiResult {
  enabled: boolean;
  model?: string;
  output?: string;
  message?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

const GEMINI_ENABLED = (process.env.GEMINI_ENABLED ?? "false").toLowerCase() === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 12000);
const MAX_PROMPT_CHARS = Number(process.env.GEMINI_MAX_PROMPT_CHARS ?? 8000);

export async function generateGeminiCompletion(prompt: string): Promise<GeminiResult> {
  if (!GEMINI_ENABLED) return { enabled: false, message: "Gemini feature disabled" };
  if (!GEMINI_API_KEY) return { enabled: true, message: "Gemini API key missing" };
  if (!prompt || !prompt.trim()) return { enabled: true, error: "Prompt is required" };
  if (prompt.length > MAX_PROMPT_CHARS) return { enabled: true, error: "Prompt too long" };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Basic request body for Gemini text model (subject to provider evolution)
  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );
    clearTimeout(id);

    if (!resp.ok) {
      const text = await resp.text();
      return { enabled: true, model: GEMINI_MODEL, error: `Provider error ${resp.status}`, message: text.slice(0,300) };
    }

    const json: any = await resp.json();
    const output = extractText(json);
    const usage = extractUsage(json);
    return { enabled: true, model: GEMINI_MODEL, output, usage };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return { enabled: true, model: GEMINI_MODEL, error: 'Timeout' };
    }
    return { enabled: true, model: GEMINI_MODEL, error: e.message || 'Unknown error' };
  }
}

function extractText(payload: any): string | undefined {
  // Gemini response shape (simplified)
  const candidates = payload?.candidates;
  if (Array.isArray(candidates)) {
    for (const c of candidates) {
      const parts = c?.content?.parts;
      if (Array.isArray(parts)) {
        const textPart = parts.find((p: any) => typeof p?.text === 'string');
        if (textPart) return textPart.text as string;
      }
    }
  }
  return undefined;
}

function extractUsage(payload: any): { promptTokens?: number; completionTokens?: number } | undefined {
  const meta = payload?.usageMetadata;
  if (meta) {
    return { promptTokens: meta.promptTokenCount, completionTokens: meta.candidatesTokenCount };
  }
  return undefined;
}
