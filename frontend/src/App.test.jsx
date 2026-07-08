import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toBeInTheDocument();
  });
});
