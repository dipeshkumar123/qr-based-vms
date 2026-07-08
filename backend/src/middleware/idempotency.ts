import { createHash } from "crypto";
import type { Request, RequestHandler, Response } from "express";
import { ErrorCodes, sendApiError } from "../utils/errorCatalog.js";

type CachedResponse = {
  statusCode: number;
  body: any;
  contentType?: string;
  expiresAt: number;
};

type InFlightEntry = {
  bodyHash: string;
  waiters: Array<(response: CachedResponse | null) => void>;
};

const completed = new Map<string, CachedResponse>();
const inFlight = new Map<string, InFlightEntry>();

function hashBody(body: unknown): string {
  const raw = body == null ? "" : JSON.stringify(body);
  return createHash("sha256").update(raw).digest("hex");
}

function buildCacheKey(req: Request, key: string): string {
  return `${req.method}:${req.baseUrl}${req.path}:${key}`;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of completed.entries()) {
    if (v.expiresAt <= now) completed.delete(k);
  }
}, 60_000).unref();

function replay(res: Response, cached: CachedResponse) {
  if (cached.contentType) {
    res.setHeader("Content-Type", cached.contentType);
  }
  res.status(cached.statusCode).send(cached.body);
}

export function idempotency(options?: { ttlMs?: number }): RequestHandler {
  const ttlMs = options?.ttlMs ?? 10 * 60_000;

  return async (req, res, next) => {
    const key = req.header("Idempotency-Key");
    if (!key) {
      next();
      return;
    }

    const bodyHash = hashBody(req.body);
    const cacheKey = buildCacheKey(req, key);

    const cached = completed.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      replay(res, cached);
      return;
    }

    const existingFlight = inFlight.get(cacheKey);
    if (existingFlight) {
      if (existingFlight.bodyHash !== bodyHash) {
        sendApiError(res, {
          status: 409,
          message: "Idempotency-Key reused with different payload",
          code: ErrorCodes.IDEMPOTENCY_KEY_REUSED,
          requestId: (req.id as string),
        });
        return;
      }

      const result = await new Promise<CachedResponse | null>((resolve) => {
        existingFlight.waiters.push(resolve);
      });

      if (result) {
        replay(res, result);
        return;
      }

      sendApiError(res, {
        status: 409,
        message: "Duplicate request in progress",
        code: ErrorCodes.IDEMPOTENCY_DUPLICATE_IN_FLIGHT,
        requestId: (req.id as string),
      });
      return;
    }

    inFlight.set(cacheKey, { bodyHash, waiters: [] });

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let finalized = false;

    const finalize = (payload: any) => {
      if (finalized) return;
      finalized = true;

      const flight = inFlight.get(cacheKey);
      inFlight.delete(cacheKey);

      const shouldCache = res.statusCode >= 200 && res.statusCode < 300;
      let cachedResponse: CachedResponse | null = null;

      if (shouldCache) {
        cachedResponse = {
          statusCode: res.statusCode,
          body: payload,
          contentType: String(res.getHeader("Content-Type") || ""),
          expiresAt: Date.now() + ttlMs,
        };
        completed.set(cacheKey, cachedResponse);
      }

      if (flight) {
        for (const waiter of flight.waiters) waiter(cachedResponse);
      }
    };

    res.json = ((payload: any) => {
      finalize(payload);
      return originalJson(payload);
    }) as Response["json"];

    res.send = ((payload: any) => {
      finalize(payload);
      return originalSend(payload);
    }) as Response["send"];

    next();
  };
}
