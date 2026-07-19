import { render, screen } from '@testing-library/react';
import CommandCenterPage from '../app/page';

jest.mock('../lib/auth-storage', () => ({
  getAccessToken: jest.fn(() => null),
}));

describe('CommandCenterPage', () => {
  it('never renders blank when unauthenticated — shows a sign-in prompt instead', async () => {
    render(<CommandCenterPage />);
    expect(await screen.findByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Executive Command Center');
  });
});
