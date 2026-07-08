import 'dotenv/config';

const BASE_URL = process.env.INTEGRATION_BASE_URL || process.env.PERF_BASE_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
const REQUIRE_BIOMETRIC = (process.env.INTEGRATION_REQUIRE_BIOMETRIC || 'true') === 'true';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headers(extra = {}) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
    ...extra,
  };
}

async function request(path, init = {}, expectJson = true) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });

  const text = await res.text();
  const body = expectJson && text ? JSON.parse(text) : text;
  return { status: res.status, body };
}

async function run() {
  assert(ADMIN_KEY, 'ADMIN_API_KEY must be set for integration tests');

  const unique = Date.now();
  const visitorPayload = {
    name: `Integration User ${unique}`,
    email: `integration-${unique}@example.com`,
    phone: '+15550001111',
    purpose: 'Integration flow validation',
  };

  const created = await request('/api/visitors', {
    method: 'POST',
    headers: { ...headers({ 'idempotency-key': `create-${unique}` }) },
    body: JSON.stringify(visitorPayload),
  });

  assert(created.status === 201, `Expected 201 for visitor create, got ${created.status}`);
  assert(created.body?.id, 'Visitor create did not return id');
  assert(created.body?.qrToken, 'Visitor create did not return qrToken');
  const visitorId = created.body.id;
  const qrToken = created.body.qrToken;

  const verifyAdmin = await request('/api/admin/verify', { method: 'GET' }, false);
  assert(verifyAdmin.status === 204, `Expected 204 for admin verify, got ${verifyAdmin.status}`);

  const analytics = await request('/api/analytics/dashboard?days=7', { method: 'GET' }, true);
  assert(analytics.status === 200, `Expected 200 for analytics dashboard, got ${analytics.status}`);
  assert(typeof analytics.body === 'object', 'Analytics dashboard did not return object payload');

  const checkIn = await request(`/api/visitors/${qrToken}/check-in`, {
    method: 'POST',
    headers: { ...headers({ 'idempotency-key': `checkin-${unique}` }) },
  });
  assert(checkIn.status === 200, `Expected 200 for check-in, got ${checkIn.status}`);
  assert(checkIn.body?.status === 'checked_in', 'Check-in did not set checked_in status');

  const checkOut = await request(`/api/visitors/${qrToken}/check-out`, {
    method: 'POST',
    headers: { ...headers({ 'idempotency-key': `checkout-${unique}` }) },
  });
  assert(checkOut.status === 200, `Expected 200 for check-out, got ${checkOut.status}`);
  assert(checkOut.body?.status === 'checked_out', 'Check-out did not set checked_out status');

  const biometric = await request('/api/biometric/health', { method: 'GET' }, true);
  if (REQUIRE_BIOMETRIC) {
    assert(biometric.status === 200, `Expected 200 for biometric health, got ${biometric.status}`);
  } else {
    console.log(`Biometric health status=${biometric.status} (non-blocking)`);
  }

  const cleanup = await request(`/api/visitors/${visitorId}`, { method: 'DELETE' }, false);
  assert(cleanup.status === 204, `Expected 204 for cleanup delete, got ${cleanup.status}`);

  console.log('Integration tests passed');
}

run().catch((error) => {
  console.error('Integration tests failed:', error.message || error);
  process.exitCode = 1;
});
