import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { CountdownTimer } from '../components/CountdownTimer';

describe('CountdownTimer (ADR-0014 — deterministic, disclosed SLA countdown)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a calm, non-overdue countdown well before the deadline', () => {
    const createdAt = '2026-07-19T12:00:00.000Z';
    const deadline = new Date('2026-07-19T13:00:00.000Z'); // 1h window, all remaining
    render(<CountdownTimer createdAt={createdAt} deadline={deadline} />);

    act(() => {
      jest.advanceTimersByTime(0);
    });

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('1h 00m');
    expect(timer).not.toHaveTextContent('OVERDUE');
  });

  it('shows an OVERDUE state once the deadline has passed', () => {
    const createdAt = '2026-07-19T11:45:00.000Z';
    const deadline = new Date('2026-07-19T12:00:00.000Z'); // 15m window, already elapsed
    jest.setSystemTime(new Date('2026-07-19T12:05:00.000Z')); // 5 minutes past deadline

    render(<CountdownTimer createdAt={createdAt} deadline={deadline} />);

    act(() => {
      jest.advanceTimersByTime(0);
    });

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('OVERDUE');
    expect(timer.getAttribute('aria-label')).toMatch(/overdue/i);
  });

  it('ticks down as real time passes', () => {
    const createdAt = '2026-07-19T12:00:00.000Z';
    const deadline = new Date('2026-07-19T12:01:00.000Z'); // 60s window

    render(<CountdownTimer createdAt={createdAt} deadline={deadline} />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('00:50');
  });
});
