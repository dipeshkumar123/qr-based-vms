import 'dotenv/config';

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
const RUNS = Number(process.env.PERF_RUNS || '8');
const ANALYTICS_P95_LIMIT_MS = Number(process.env.PERF_ANALYTICS_P95_MS || '1200');
const BIOMETRIC_P95_LIMIT_MS = Number(process.env.PERF_BIOMETRIC_P95_MS || '1800');

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

async function timeCall(name, fn, samples) {
  const started = Date.now();
  try {
    await fn();
    const ms = Date.now() - started;
    samples.push(ms);
    console.log(`OK ${name} ${ms}ms`);
  } catch (error) {
    const ms = Date.now() - started;
    samples.push(ms);
    console.error(`FAIL ${name} failed after ${ms}ms: ${error.message || error}`);
    throw error;
  }
}

async function run() {
  const headers = {
    'Content-Type': 'application/json',
    ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
  };

  const analyticsSamples = [];
  const biometricSamples = [];

  for (let i = 0; i < RUNS; i += 1) {
    await timeCall(
      'analytics dashboard',
      async () => {
        const r = await fetch(`${BASE_URL}/api/analytics/dashboard?days=30`, { headers });
        if (!r.ok) throw new Error(`status ${r.status}`);
      },
      analyticsSamples
    );

    await timeCall(
      'biometric stats',
      async () => {
        const r = await fetch(`${BASE_URL}/api/biometric/stats`, { headers });
        if (!r.ok) throw new Error(`status ${r.status}`);
      },
      biometricSamples
    );
  }

  const analyticsP95 = percentile(analyticsSamples, 95);
  const biometricP95 = percentile(biometricSamples, 95);

  console.log(`analytics p95=${analyticsP95}ms (limit=${ANALYTICS_P95_LIMIT_MS}ms)`);
  console.log(`biometric p95=${biometricP95}ms (limit=${BIOMETRIC_P95_LIMIT_MS}ms)`);

  if (analyticsP95 > ANALYTICS_P95_LIMIT_MS || biometricP95 > BIOMETRIC_P95_LIMIT_MS) {
    console.error('Performance regression detected');
    process.exitCode = 1;
    return;
  }

  console.log('Performance regression checks passed');
}

run().catch((error) => {
  console.error('Performance regression checks failed:', error.message || error);
  process.exitCode = 1;
});
