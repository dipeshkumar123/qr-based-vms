import 'dotenv/config';
import { z } from 'zod';

const BASE_URL = process.env.CHAOS_BASE_URL || process.env.PERF_BASE_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
const CHAOS_MODE = process.env.CHAOS_MODE || 'biometric_down';
const TEST_VISITOR_ID = Number(process.env.CHAOS_VISITOR_ID || '1');

const DashboardDegradedSchema = z.object({
  partialErrors: z.array(z.string()).min(1),
}).passthrough();

const BiometricFallbackSchema = z.object({
  success: z.boolean(),
  is_match: z.boolean(),
  fallback: z.object({
    active: z.literal(true),
    mode: z.string(),
    retry_after_seconds: z.number(),
  }),
}).passthrough();

function getHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
  };
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...(init.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  return { status: res.status, body };
}

async function runAnalyticsChaos() {
  const { status, body } = await fetchJson('/api/analytics/dashboard?days=30');
  if (status !== 200) {
    throw new Error(`Expected HTTP 200 for degraded dashboard path, got ${status}`);
  }
  DashboardDegradedSchema.parse(body);
  console.log('Analytics chaos contract: degraded dashboard payload OK');
}

async function runBiometricChaos() {
  const payload = {
    visitor_id: TEST_VISITOR_ID,
    photo_base64: 'A'.repeat(128),
    match_threshold: 0.5,
  };

  const { status, body } = await fetchJson('/api/biometric/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (status !== 200) {
    throw new Error(`Expected HTTP 200 fallback response, got ${status}`);
  }

  BiometricFallbackSchema.parse(body);
  console.log('Biometric chaos contract: fallback response OK');
}

async function run() {
  if (CHAOS_MODE === 'analytics_down') {
    await runAnalyticsChaos();
  } else if (CHAOS_MODE === 'biometric_down') {
    await runBiometricChaos();
  } else {
    throw new Error(`Unsupported CHAOS_MODE: ${CHAOS_MODE}`);
  }

  console.log('Chaos upstream test passed');
}

run().catch((error) => {
  console.error('Chaos upstream test failed:', error.message || error);
  process.exitCode = 1;
});
