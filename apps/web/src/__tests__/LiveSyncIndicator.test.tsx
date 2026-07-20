import { act, render, screen } from '@testing-library/react';
import { LiveSyncIndicator } from '../components/LiveSyncIndicator';

describe('LiveSyncIndicator', () => {
  it('renders nothing before the first sync has landed', () => {
    const { container } = render(<LiveSyncIndicator lastSyncedAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "just now" immediately after a sync, then updates the elapsed time as it ticks', () => {
    jest.useFakeTimers();
    try {
      const now = Date.now();
      render(<LiveSyncIndicator lastSyncedAt={now} />);

      expect(screen.getByText(/synced just now/i)).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(screen.getByText(/synced 5s ago/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
