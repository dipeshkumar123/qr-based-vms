import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendDir, "..");
const envPath = path.join(backendDir, ".env");

function readEnv(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

function runCompose(args) {
  const result = spawnSync("docker", ["compose", "-f", path.join(repoRoot, "docker-compose.yml"), ...args], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getIngestHealth(baseUrl, adminKey) {
  const res = await fetchJson(`${baseUrl}/api/analytics/events/ingest-health`, {
    headers: { "x-admin-key": adminKey },
  });
  assert(res.status === 200, `ingest-health expected 200, got ${res.status}`);
  return res.data?.health || {};
}

async function postEvent(baseUrl, serviceKey, i) {
  const payload = {
    name: "notification_sent",
    payload: {
      phase: "phase7-reliability-drill",
      index: i,
      at: new Date().toISOString(),
    },
  };

  const res = await fetchJson(`${baseUrl}/api/analytics/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-key": serviceKey,
    },
    body: JSON.stringify(payload),
  });

  assert(res.status === 200, `event post expected 200, got ${res.status}`);
  return res.data;
}

async function waitForReady(baseUrl, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchJson(`${baseUrl}/ready`, {}, 4000);
      if (res.status === 200) return;
    } catch {
      // keep retrying
    }
    await sleep(1500);
  }
  throw new Error("Backend /ready did not recover in time");
}

async function waitForFlush(baseUrl, adminKey, serviceKey, baselineFlushRecovered, timeoutMs = 30000) {
  const start = Date.now();
  let last = null;
  let probeIndex = 1000;
  while (Date.now() - start < timeoutMs) {
    last = await getIngestHealth(baseUrl, adminKey);
    const recoveredNow = (last.memoryFlushRecovered || 0) > baselineFlushRecovered;
    const noBuffered = (last.memoryBufferedEvents || 0) === 0;
    if (recoveredNow && noBuffered && !last.breakerOpen) {
      return last;
    }

    // Keep a low-rate trigger once breaker is closed so buffered events can flush.
    if (!last.breakerOpen && (last.memoryBufferedEvents || 0) > 0) {
      try {
        await postEvent(baseUrl, serviceKey, probeIndex);
        probeIndex += 1;
      } catch {
        // Ignore transient post failures while recovery stabilizes.
      }
    }

    await sleep(1500);
  }
  return last;
}

async function main() {
  const env = readEnv(envPath);
  const adminKey = env.ADMIN_API_KEY;
  const serviceKey = env.SERVICE_API_KEY;
  const port = env.PORT || "4000";
  const baseUrl = `http://localhost:${port}`;

  assert(adminKey, "ADMIN_API_KEY missing in backend/.env");
  assert(serviceKey, "SERVICE_API_KEY missing in backend/.env");

  console.log(`[drill] baseUrl=${baseUrl}`);

  const baseline = await getIngestHealth(baseUrl, adminKey);
  console.log(`[drill] baseline: ${JSON.stringify(baseline)}`);

  await postEvent(baseUrl, serviceKey, 0);

  console.log("[drill] stopping postgres to simulate outage...");
  runCompose(["stop", "postgres"]);

  try {
    for (let i = 1; i <= 8; i += 1) {
      await postEvent(baseUrl, serviceKey, i);
      await sleep(120);
    }

    const degraded = await getIngestHealth(baseUrl, adminKey);
    console.log(`[drill] during outage: ${JSON.stringify(degraded)}`);

    const sawFailureSignals =
      (degraded.dbInsertFailures || 0) > (baseline.dbInsertFailures || 0) ||
      (degraded.memoryFallbackCount || 0) > (baseline.memoryFallbackCount || 0) ||
      !!degraded.breakerOpen;
    assert(sawFailureSignals, "No failure signals observed during simulated outage");

    const baselineFlushRecovered = degraded.memoryFlushRecovered || 0;

    console.log("[drill] starting postgres for recovery...");
    runCompose(["start", "postgres"]);

    await waitForReady(baseUrl);
    await postEvent(baseUrl, serviceKey, 99);

    const recovered = await waitForFlush(baseUrl, adminKey, serviceKey, baselineFlushRecovered);
    console.log(`[drill] after recovery: ${JSON.stringify(recovered)}`);

    assert(!recovered.breakerOpen, "Breaker still open after recovery window");
    assert((recovered.memoryBufferedEvents || 0) === 0, "Memory buffer did not flush back to DB");
    assert((recovered.memoryFlushRecovered || 0) > baselineFlushRecovered, "No buffered events were recovered");

    console.log("[drill] PASS: outage/recovery signals and flush behavior verified");
  } finally {
    // Ensure postgres is up even if assertions fail.
    try {
      runCompose(["start", "postgres"]);
    } catch {
      // no-op
    }
  }
}

main().catch((err) => {
  console.error(`[drill] FAIL: ${err.message}`);
  process.exit(1);
});
