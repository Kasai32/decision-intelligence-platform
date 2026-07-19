import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SimulationPage from '../app/simulation/page';
import { apiClient, ApiError } from '../lib/api-client';
import { getAccessToken } from '../lib/auth-storage';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('../lib/api-client', () => ({
  apiClient: { post: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

jest.mock('../lib/auth-storage', () => ({
  getAccessToken: jest.fn(() => 'a-token'),
}));

describe('SimulationPage (ADR-0013 facilitator panel)', () => {
  beforeEach(() => {
    push.mockClear();
    (apiClient.post as jest.Mock).mockReset();
    (getAccessToken as jest.Mock).mockReturnValue('a-token');
  });

  it('never renders blank when unauthenticated — shows a sign-in prompt instead', () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<SimulationPage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('offers a button for each of the two scenarios', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('button', { name: /Scenario A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scenario B/i })).toBeInTheDocument();
  });

  it('triggers CYBER_RANSOMWARE and redirects to the Command Center on success', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      scenario: 'CYBER_RANSOMWARE',
      incident: { id: 'incident-1' },
    });

    render(<SimulationPage />);
    fireEvent.click(screen.getByRole('button', { name: /Scenario A/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/simulation/trigger', {
        scenario: 'CYBER_RANSOMWARE',
      });
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('shows an error message and does not redirect when the backend rejects the trigger (e.g. non-admin, 403)', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError(403, 'Insufficient role: ADMIN required'),
    );

    render(<SimulationPage />);
    fireEvent.click(screen.getByRole('button', { name: /Scenario B/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Insufficient role: ADMIN required');
    });
    expect(push).not.toHaveBeenCalled();
  });
});
