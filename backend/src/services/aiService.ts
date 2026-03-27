import fetch from "node-fetch";
import { geminiConfig } from "../config.js";

interface GeminiResult {
  enabled: boolean;
  model?: string;
  output?: string;
  message?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export async function generateGeminiCompletion(prompt: string): Promise<GeminiResult> {
  if (!geminiConfig.enabled) return { enabled: false, message: "Gemini feature disabled" };
  if (!geminiConfig.apiKey) return { enabled: true, message: "Gemini API key missing" };
  if (!prompt || !prompt.trim()) return { enabled: true, error: "Prompt is required" };
  if (prompt.length > geminiConfig.maxPromptChars) return { enabled: true, error: "Prompt too long" };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), geminiConfig.timeoutMs);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  try {
    // Use API key in header (x-goog-api-key) instead of URL query param to avoid log leakage
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiConfig.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiConfig.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const text = await resp.text();
      return { enabled: true, model: geminiConfig.model, error: `Provider error ${resp.status}`, message: text.slice(0, 300) };
    }

    const json: any = await resp.json();
    const output = extractText(json);
    const usage = extractUsage(json);
    return { enabled: true, model: geminiConfig.model, output, usage };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return { enabled: true, model: geminiConfig.model, error: "Timeout" };
    }
    return { enabled: true, model: geminiConfig.model, error: e.message || "Unknown error" };
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
