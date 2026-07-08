import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';

// ── Mock apiClient ────────────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
  getWithSWR: vi.fn(),
}));

// ── Mock zustand authStore ────────────────────────────────────────────────────
const mockLogout = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isAdmin: true,
    logout: mockLogout,
  })),
}));

// ── Mock framer-motion to avoid animation complexity in tests ─────────────────
vi.mock('framer-motion', () => {
  const Comp = ({ children, ...rest }) => <div {...rest}>{children}</div>;
  return {
    motion: {
      div: Comp,
      span: ({ children, ...rest }) => <span {...rest}>{children}</span>,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

// ── Mock heavy component dependencies ─────────────────────────────────────────
vi.mock('../components/Modal', () => ({
  default: ({ isOpen, children }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock('../components/QRScanner', () => ({
  default: () => <div data-testid="qr-scanner" />,
}));

vi.mock('../components/BiometricVerification', () => ({
  default: () => <div data-testid="biometric-verification" />,
}));

vi.mock('../components/VirtualizedList', () => ({
  default: ({ items, renderItem }) => (
    <div data-testid="virtualized-list">{items.map(renderItem)}</div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const statsResponse = {
  data: {
    total: 0,
    registered: 0,
    checkedIn: 0,
    checkedOut: 0,
    todayTotal: 0,
    todayCheckedIn: 0,
  },
};

const emptyVisitorsResponse = {
  data: { items: [], total: 0 },
};

const emptyLedgerResponse = {
  data: { items: [], total: 0 },
};

const thresholdsResponse = {
  data: {
    thresholds: {
      registrationBacklogRatio: 0.35,
      lowTodayCheckInRate: 0.6,
      activePopulationGap: 8,
    },
  },
};

const setupMocks = async (overrides = {}) => {
  const apiModule = await import('../lib/api');
  const mockGet = apiModule.default.get;

  mockGet.mockImplementation((url) => {
    if (url === '/api/visitors') return Promise.resolve(overrides.visitors ?? emptyVisitorsResponse);
    if (url === '/api/ledger') return Promise.resolve(overrides.ledger ?? emptyLedgerResponse);
    if (url === '/api/visitors/stats') return Promise.resolve(overrides.stats ?? statsResponse);
    if (url === '/api/admin/alert-thresholds') return Promise.resolve(thresholdsResponse);
    if (url.startsWith('/api/biometric/info')) return Promise.resolve({ data: { has_encoding: false } });
    return Promise.resolve({ data: {} });
  });
};

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );

// ── Test suite ─────────────────────────────────────────────────────────────────
describe('AdminDashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setupMocks();
  });

  // ── Test 1: Shows loading state on initial render ─────────────────────────
  it('renders stat cards (Total Visitors, Checked In, etc.) after loading', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Total Visitors')).toBeInTheDocument();
      expect(screen.getByText('Checked In')).toBeInTheDocument();
      expect(screen.getByText('Checked Out')).toBeInTheDocument();
      expect(screen.getByText('Registered')).toBeInTheDocument();
    });
  });

  // ── Test 2: Renders table headers when visitors tab is active ────────────
  it('renders visitor table headers (Name, Email, Phone, Status, Biometric, Actions)', async () => {
    // Provide one visitor so the table renders (empty list renders empty state)
    await setupMocks({
      visitors: {
        data: {
          items: [
            {
              id: '1',
              name: 'Alice',
              email: 'alice@test.com',
              phone: '1234567890',
              status: 'registered',
              qrToken: 'abc123',
              biometricEnrolled: false,
            },
          ],
          total: 1,
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Biometric')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  // ── Test 3: Shows empty state when no visitors ───────────────────────────
  it('shows "No visitors found" empty state when visitor list is empty', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No visitors found')).toBeInTheDocument();
      expect(
        screen.getByText('Registered visitors will appear here')
      ).toBeInTheDocument();
    });
  });

  // ── Test 4: Shows Insights Summary section ────────────────────────────────
  it('renders the Insights Summary section with actionable signals', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Insights Summary')).toBeInTheDocument();
    });
  });

  // ── Test 5: Renders visitor data in the table ─────────────────────────────
  it('renders visitor rows after data loads', async () => {
    await setupMocks({
      visitors: {
        data: {
          items: [
            {
              id: '42',
              name: 'Bob Marley',
              email: 'bob@music.com',
              phone: '9876543210',
              status: 'checked_in',
              qrToken: 'token-42',
              biometricEnrolled: false,
            },
          ],
          total: 1,
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      // getAllByText handles the case where a name appears more than once
      const names = screen.getAllByText('Bob Marley');
      expect(names.length).toBeGreaterThan(0);
      const emails = screen.getAllByText('bob@music.com');
      expect(emails.length).toBeGreaterThan(0);
      expect(screen.getAllByText('Checked In').length).toBeGreaterThan(0);
    });
  });
});
