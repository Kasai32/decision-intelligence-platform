import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../app/login/page';
import { apiClient, ApiError } from '../lib/api-client';
import { storeTokens } from '../lib/auth-storage';

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
  afterEach(() => {
    jest.clearAllMocks();
  });

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

  it('logs straight in when the account has a single tenant (no selection step)', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(storeTokens).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' });
    });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('shows a tenant picker for a multi-tenant account, then completes login with the chosen tenant', async () => {
    (apiClient.post as jest.Mock).mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.resolve({
          tenantSelectionRequired: true,
          tenantSelectionToken: 'selection-token',
          tenants: [
            { id: 'tenant-1', name: 'Acme', slug: 'acme' },
            { id: 'tenant-2', name: 'Globex', slug: 'globex' },
          ],
        });
      }
      return Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' });
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByLabelText(/multiple tenants/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/multiple tenants/i), {
      target: { value: 'tenant-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/select-tenant', {
        tenantSelectionToken: 'selection-token',
        tenantId: 'tenant-2',
      });
    });
    expect(storeTokens).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' });
  });
});
