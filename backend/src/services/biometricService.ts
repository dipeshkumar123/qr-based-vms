import fetch from "node-fetch";

const BASE_URL = process.env.BIOMETRICS_BASE_URL || "http://localhost:8000";
const TIMEOUT_MS = Number(process.env.BIOMETRICS_TIMEOUT_MS ?? 15000);

export interface VerifyFaceRequest {
  capturedImage: string;
  referenceImages: string[];
  inputKind?: "base64" | "url" | "auto";
  threshold?: number;
}

export async function verifyFace(payload: VerifyFaceRequest): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${BASE_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capturedImage: payload.capturedImage,
        referenceImages: payload.referenceImages,
        inputKind: payload.inputKind ?? "auto",
        threshold: payload.threshold ?? 0.6,
      }),
      signal: controller.signal,
    });
    clearTimeout(id);
    const json: any = await resp.json();
    if (!resp.ok) return Object.assign({}, json || {}, { error: `Provider error ${resp.status}` });
    return json;
  } catch (e: any) {
    if (e.name === "AbortError") return { enabled: true, matched: false, confidence: 0, message: "Timeout" };
    return { enabled: true, matched: false, confidence: 0, message: e?.message || "Unknown error" };
  }
}
