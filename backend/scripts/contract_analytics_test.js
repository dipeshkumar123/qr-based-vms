import 'dotenv/config';
import { z } from 'zod';

const BASE_URL = process.env.CONTRACT_BASE_URL || process.env.PERF_BASE_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

const TrendPointSchema = z.object({
  date: z.string().optional(),
  count: z.number().optional(),
}).passthrough();

const DashboardSchema = z.object({
  report: z.object({
    summary: z.record(z.any()).optional(),
  }).passthrough(),
  peakHours: z.object({
    forecast: z.any().optional(),
    peak_hours: z.array(z.any()).optional(),
    error: z.string().nullable().optional(),
  }).passthrough(),
  frequentVisitors: z.array(z.any()),
  suspiciousActivity: z.object({
    suspicious_visitors: z.array(z.any()).optional(),
  }).passthrough(),
  trends: z.array(TrendPointSchema).optional(),
  statusDistribution: z.array(
    z.object({
      status: z.string(),
      count: z.number(),
    })
  ),
  partialErrors: z.array(z.string()).optional(),
  generatedAt: z.string(),
  cache: z.object({
    hit: z.boolean(),
    stale: z.boolean().optional(),
    cachedAt: z.string().optional(),
  }),
}).passthrough();

const StatusDistributionSchema = z.object({
  distribution: z.array(
    z.object({
      status: z.string(),
      count: z.number(),
    })
  ),
});

async function fetchJson(path) {
  const headers = {
    Accept: 'application/json',
    ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const bodyText = await res.text();
  let body;

  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error(`${path} returned non-JSON response (status=${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function run() {
  const dashboard = await fetchJson('/api/analytics/dashboard?days=30');
  DashboardSchema.parse(dashboard);
  console.log('Dashboard contract: OK');

  const statusDistribution = await fetchJson('/api/analytics/status-distribution');
  StatusDistributionSchema.parse(statusDistribution);
  console.log('Status distribution contract: OK');

  console.log('Analytics contract tests passed');
}

run().catch((error) => {
  console.error('Analytics contract tests failed:', error.message || error);
  process.exitCode = 1;
});
