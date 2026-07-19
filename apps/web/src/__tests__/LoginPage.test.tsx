import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../app/login/page';
import { apiClient, ApiError } from '../lib/api-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  storeTokens: jest.fn(),
}));

describe('LoginPage', () => {
  it('shows an error message when login fails', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new ApiError(401, 'Invalid email or password'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });
  });
});
