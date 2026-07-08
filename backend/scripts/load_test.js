import 'dotenv/config';

const BASE_URL = process.env.LOAD_BASE_URL || process.env.PERF_BASE_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

const DURATION_SECONDS = Number(process.env.LOAD_DURATION_SECONDS || '30');
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || '10');
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE || '0.05');
const MAX_P95_MS = Number(process.env.LOAD_MAX_P95_MS || '2200');

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

async function hit(path) {
  const started = Date.now();
  const headers = {
    Accept: 'application/json',
    ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, { headers });
  const ms = Date.now() - started;
  if (!response.ok) {
    return { ok: false, ms, status: response.status };
  }
  return { ok: true, ms, status: response.status };
}

async function runScenario(name, path) {
  const endAt = Date.now() + DURATION_SECONDS * 1000;
  const durations = [];
  let total = 0;
  let failures = 0;

  async function worker() {
    while (Date.now() < endAt) {
      total += 1;
      try {
        const result = await hit(path);
        durations.push(result.ms);
        if (!result.ok) failures += 1;
      } catch {
        failures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const p95 = percentile(durations, 95);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const errorRate = total > 0 ? failures / total : 1;
  const rps = total / DURATION_SECONDS;

  console.log(`Scenario ${name}`);
  console.log(`  requests=${total} failures=${failures} errorRate=${errorRate.toFixed(3)}`);
  console.log(`  avg=${avg}ms p95=${p95}ms rps=${rps.toFixed(1)}`);

  return { name, total, failures, errorRate, avg, p95, rps };
}

async function run() {
  const dashboard = await runScenario('dashboard', '/api/analytics/dashboard?days=30');
  const biometric = await runScenario('biometric-stats', '/api/biometric/stats');

  const failed = [dashboard, biometric].some(
    (s) => s.errorRate > MAX_ERROR_RATE || s.p95 > MAX_P95_MS
  );

  console.log(`Thresholds: maxErrorRate=${MAX_ERROR_RATE}, maxP95Ms=${MAX_P95_MS}`);

  if (failed) {
    console.error('Load test thresholds failed');
    process.exitCode = 1;
    return;
  }

  console.log('Load test passed');
}

run().catch((error) => {
  console.error('Load test failed:', error.message || error);
  process.exitCode = 1;
});
