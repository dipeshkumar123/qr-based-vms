/**
 * CheckIn feature tests
 *
 * CheckInPage.tsx requires @tanstack/react-query (not in node_modules) and
 * html5-qrcode (browser-only). Both are fully mocked at the factory level
 * before any module graph resolution occurs.
 *
 * The vi.mock() calls MUST appear at the top of the file (Vitest hoists them).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Shared mutate spy (captured at factory time) ──────────────────────────────
const mockMutate = vi.fn();

// ── Mock @tanstack/react-query BEFORE any import that uses it ─────────────────
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }),
  ),
}));

// ── Mock html5-qrcode (browser camera API unavailable in jsdom) ───────────────
vi.mock('html5-qrcode', () => {
  const mockInstance = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    scanFile: vi.fn(),
  };
  const Html5Qrcode = vi.fn(() => mockInstance);
  Html5Qrcode.getCameras = vi.fn().mockResolvedValue([
    { id: 'cam1', label: 'Back Camera' },
  ]);
  return {
    Html5Qrcode,
    Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  };
});

// ── The `api` npm package fills "../api" in tests (no src/api.ts exists) ──────
vi.mock('api', () => ({
  default: vi.fn(),
  checkInVisitor: vi.fn().mockResolvedValue({
    name: 'Alice',
    phone: '123',
    purpose: 'Demo',
  }),
}));

// ── Stub the Modal component ──────────────────────────────────────────────────
vi.mock('../components/Modal', () => ({
  Modal: ({ open, children, title }) =>
    open ? (
      <div data-testid="modal" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// ── Import AFTER all mocks are declared ──────────────────────────────────────
import { CheckInPage } from './CheckInPage';

// ── Helpers ───────────────────────────────────────────────────────────────────
const renderAuthenticated = () =>
  render(<CheckInPage adminEnabled={true} adminStatus="authenticated" />);

const renderUnauthenticated = () =>
  render(<CheckInPage adminEnabled={false} adminStatus="unauthenticated" />);

// ── Test suite ─────────────────────────────────────────────────────────────────
describe('CheckInPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-apply the default mock return so isPending stays false
    const { useMutation } = vi.mocked(
      await vi.importMock('@tanstack/react-query').catch(() => null) ?? {}
    );
  });

  // ── Test 1: Renders hero heading ──────────────────────────────────────────
  it('renders the main heading "Touchless QR Check-In"', () => {
    renderAuthenticated();
    expect(
      screen.getByRole('heading', { name: /touchless qr check-in/i })
    ).toBeInTheDocument();
  });

  // ── Test 2: Renders Live QR Scanner section ───────────────────────────────
  it('renders the "Live QR Scanner" section', () => {
    renderAuthenticated();
    expect(
      screen.getByRole('heading', { name: /live qr scanner/i })
    ).toBeInTheDocument();
  });

  // ── Test 3: Shows authentication guard when admin is disabled ─────────────
  it('shows "Authentication required" guard when adminEnabled is false', () => {
    renderUnauthenticated();
    expect(screen.getByText('Authentication required')).toBeInTheDocument();
  });

  // ── Test 4: Shows "Scanning" status label when authenticated ─────────────
  it('shows "Scanning" status when admin is authenticated', () => {
    renderAuthenticated();
    expect(screen.getByText('Scanning')).toBeInTheDocument();
  });

  // ── Test 5: Renders manual token input ───────────────────────────────────
  it('renders the manual QR token input field', () => {
    renderAuthenticated();
    expect(
      screen.getByPlaceholderText('Paste or type the QR value')
    ).toBeInTheDocument();
  });

  // ── Test 6: Submitting empty / blank token does not call mutate ───────────
  it('does not call mutate when the manual token is blank', async () => {
    renderAuthenticated();

    const input = screen.getByPlaceholderText('Paste or type the QR value');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  // ── Test 7: Shows paused label when not authenticated ─────────────────────
  it('shows "Scanner paused" when admin is not authenticated', () => {
    renderUnauthenticated();
    expect(screen.getByText('Scanner paused')).toBeInTheDocument();
  });

  // ── Test 8: Error shown when unauthenticated user submits a token ─────────
  it('shows admin-session error when unauthenticated user submits a token', async () => {
    renderUnauthenticated();

    const input = screen.getByPlaceholderText('Paste or type the QR value');
    fireEvent.change(input, { target: { value: 'SOME-TOKEN' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(
        screen.getByText(/admin session required before confirming check-ins/i)
      ).toBeInTheDocument();
    });
  });

  // ── Test 9: Scanning tips section is rendered ─────────────────────────────
  it('renders the scanning tips section', () => {
    renderAuthenticated();
    expect(screen.getByText('Scanning tips')).toBeInTheDocument();
  });

  // ── Test 10: File upload input label is present ───────────────────────────
  it('renders the "Upload QR image" file input control', () => {
    renderAuthenticated();
    expect(screen.getByText('Upload QR image')).toBeInTheDocument();
  });
});
