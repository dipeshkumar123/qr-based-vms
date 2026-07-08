import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnalyticsDashboard from './AnalyticsDashboard';

// ── Mock the API layer ────────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getWithSWR: vi.fn(),
}));

// ── Mock LoadingSpinner so we can assert its presence ────────────────────────
vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// ── Mock recharts to avoid canvas/SVG issues in jsdom ────────────────────────
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// ── Stub localStorage ─────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
});

// ── Minimal successful API payload ────────────────────────────────────────────
const mockAnalyticsPayload = {
  report: {
    summary: {
      total_visitors: 150,
      avg_daily_visitors: 5,
    },
  },
  peakHours: {
    forecast: { 9: 10, 10: 15, 14: 8 },
    peak_hours: [10],
    error: null,
  },
  frequentVisitors: [],
  suspiciousActivity: { suspicious_visitors: [] },
  trends: [
    { date: '2024-01-01', count: 5 },
    { date: '2024-01-02', count: 8 },
  ],
  statusDistribution: [],
  partialErrors: [],
  cache: null,
};

// ── Test suite ─────────────────────────────────────────────────────────────────
describe('AnalyticsDashboard', () => {
  let getWithSWRMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiModule = await import('../lib/api');
    getWithSWRMock = apiModule.getWithSWR;
  });

  // ── Test 1: Shows loading spinner before data loads ───────────────────────
  it('shows the loading spinner while data is being fetched', async () => {
    // Never resolves → loading state persists
    getWithSWRMock.mockReturnValue(new Promise(() => {}));

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  // ── Test 2: Renders the Analytics Dashboard heading after load ────────────
  it('renders "Analytics Dashboard" heading after successful data load', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /analytics dashboard/i })
      ).toBeInTheDocument();
    });
  });

  // ── Test 3: Renders key metric cards ─────────────────────────────────────
  it('renders key metric labels (Total Visitors, Avg Daily, Repeat Visitors)', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Visitors')).toBeInTheDocument();
      expect(screen.getByText('Avg Daily')).toBeInTheDocument();
      expect(screen.getByText('Repeat Visitors')).toBeInTheDocument();
      expect(screen.getByText('Suspicious')).toBeInTheDocument();
    });
  });

  // ── Test 4: Renders chart container sections ─────────────────────────────
  it('renders chart sections (Peak Hours Forecast, Visitor Trends)', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /peak hours forecast/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /visitor trends/i })
      ).toBeInTheDocument();
    });
  });

  // ── Test 5: Shows time-period selector buttons ────────────────────────────
  it('renders time-period selector buttons (7D, 14D, 30D, 60D, 90D)', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('7D')).toBeInTheDocument();
      expect(screen.getByText('30D')).toBeInTheDocument();
      expect(screen.getByText('90D')).toBeInTheDocument();
    });
  });

  // ── Test 6: Shows error banner on API failure ─────────────────────────────
  it('displays an error message when the API call fails', async () => {
    getWithSWRMock.mockRejectedValueOnce(new Error('Network error'));

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load analytics data/i)
      ).toBeInTheDocument();
    });
  });

  // ── Test 7: Frequent Visitors section renders correctly ───────────────────
  it('renders "Frequent Visitors" section heading', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Frequent Visitors')).toBeInTheDocument();
    });
  });

  // ── Test 8: Shows "No suspicious activity" when list is empty ────────────
  it('shows clean-bill message when there are no suspicious visitors', async () => {
    getWithSWRMock.mockResolvedValueOnce({
      data: mockAnalyticsPayload,
      cache: { hit: false, stale: false, ageMs: 0 },
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no suspicious activity/i)).toBeInTheDocument();
    });
  });
});
