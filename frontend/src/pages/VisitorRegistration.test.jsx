import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import VisitorRegistration from './VisitorRegistration';

// ── Mock the API client ────────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// ── Mock heavy dependencies that are not needed for unit tests ─────────────────
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }) => <svg data-testid="qr-code" data-value={value} />,
}));

vi.mock('../components/PhotoCapture', () => ({
  default: ({ onPhotoCaptured, onClose }) => (
    <div data-testid="photo-capture">
      <button onClick={() => onPhotoCaptured('data:image/png;base64,abc')}>
        Capture
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../components/Modal', () => ({
  default: ({ isOpen, children }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────────
const renderComponent = () =>
  render(
    <MemoryRouter>
      <VisitorRegistration />
    </MemoryRouter>
  );

const fillValidForm = async (user) => {
  await user.type(screen.getByPlaceholderText('John Doe'), 'Jane Smith');
  await user.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com');
  await user.type(screen.getByPlaceholderText('+1 (555) 123-4567'), '+1234567890');
  await user.type(screen.getByPlaceholderText('Meeting with...'), 'Product demo');
};

// ── Test suite ──────────────────────────────────────────────────────────────────
describe('VisitorRegistration', () => {
  let apiClientMock;

  beforeEach(async () => {
    // Re-import to get the mocked version
    const apiModule = await import('../lib/api');
    apiClientMock = apiModule.default;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: Renders form fields correctly ──────────────────────────────────
  it('renders all form fields and the submit button', () => {
    renderComponent();

    expect(screen.getByText('Visitor Registration')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Phone Number')).toBeInTheDocument();
    expect(screen.getByText('Purpose of Visit')).toBeInTheDocument();
    expect(screen.getByText('Register & Get QR Code')).toBeInTheDocument();
  });

  // ── Test 2: Inputs are empty on initial render ─────────────────────────────
  it('initialises with empty form fields', () => {
    renderComponent();

    expect(screen.getByPlaceholderText('John Doe').value).toBe('');
    expect(screen.getByPlaceholderText('john@example.com').value).toBe('');
    expect(screen.getByPlaceholderText('+1 (555) 123-4567').value).toBe('');
    expect(screen.getByPlaceholderText('Meeting with...').value).toBe('');
  });

  // ── Test 3: Controlled inputs update on change ─────────────────────────────
  it('updates field value as user types', async () => {
    const user = userEvent.setup();
    renderComponent();

    const nameInput = screen.getByPlaceholderText('John Doe');
    await user.type(nameInput, 'Alice');
    expect(nameInput.value).toBe('Alice');
  });

  // ── Test 4: All required form fields have the 'required' attribute ────────
  it('all required fields carry the required attribute for native browser validation', () => {
    renderComponent();

    expect(screen.getByPlaceholderText('John Doe')).toBeRequired();
    expect(screen.getByPlaceholderText('john@example.com')).toBeRequired();
    expect(screen.getByPlaceholderText('+1 (555) 123-4567')).toBeRequired();
    expect(screen.getByPlaceholderText('Meeting with...')).toBeRequired();
  });

  // ── Test 5: API is called with correct data on valid submit ─────────────────
  it('calls apiClient.post with form data on valid submit', async () => {
    const user = userEvent.setup();
    const apiModule = await import('../lib/api');
    apiModule.default.post.mockResolvedValueOnce({
      data: { qrToken: 'TEST-QR-TOKEN-123', id: 'visitor-1' },
    });
    // Second call for analytics event – resolve silently
    apiModule.default.post.mockResolvedValue({ data: {} });

    renderComponent();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(apiModule.default.post).toHaveBeenCalledWith('/api/visitors', {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1234567890',
        purpose: 'Product demo',
      });
    });
  });

  // ── Test 6: Shows success QR code on successful API response ────────────────
  it('renders the QR code and success message after registration', async () => {
    const user = userEvent.setup();
    const apiModule = await import('../lib/api');
    apiModule.default.post.mockResolvedValue({
      data: { qrToken: 'MY-UNIQUE-QR', id: 'visitor-99' },
    });

    renderComponent();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText('Registration Successful!')).toBeInTheDocument();
      expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    });
  });

  // ── Test 7: Shows error message on API failure ──────────────────────────────
  it('displays an error banner when the API returns an error', async () => {
    const user = userEvent.setup();
    const apiModule = await import('../lib/api');
    apiModule.default.post.mockRejectedValueOnce({
      response: { data: { message: 'Email already registered' } },
    });

    renderComponent();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  // ── Test 8: Button shows loading state while submitting ─────────────────────
  it('shows "Registering..." while the API call is in flight', async () => {
    const user = userEvent.setup();
    const apiModule = await import('../lib/api');
    // Never resolve so we can observe loading state
    apiModule.default.post.mockReturnValue(new Promise(() => {}));

    renderComponent();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText('Registering...')).toBeInTheDocument();
    });
  });
});
