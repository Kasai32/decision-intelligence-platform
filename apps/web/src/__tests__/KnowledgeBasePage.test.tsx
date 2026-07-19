import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { LessonLearned } from '@dip/shared';
import KnowledgeBasePage from '../app/knowledge-base/page';
import { apiClient } from '../lib/api-client';
import { getAccessToken } from '../lib/auth-storage';

jest.mock('../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
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

const lesson: LessonLearned = {
  id: 'lesson-1',
  tenantId: 't1',
  incidentId: 'incident-1',
  title: 'Payments outage retro',
  whatHappened: 'A bad deploy caused 500s for 12 minutes.',
  whatWentWell: [],
  whatToImprove: [],
  actionItems: [],
  tags: ['deploy'],
  createdByUserId: 'user-1',
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
};

describe('KnowledgeBasePage (ADR-0011 — Phase 5 Knowledge Base search)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (getAccessToken as jest.Mock).mockReturnValue('a-token');
  });

  it('never renders blank when unauthenticated — shows a sign-in prompt instead', () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<KnowledgeBasePage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows no results before a search is run', () => {
    render(<KnowledgeBasePage />);
    expect(screen.queryByText(/no lessons learned match/i)).not.toBeInTheDocument();
  });

  it('searches with query and tags and renders matching lessons', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([lesson]);
    render(<KnowledgeBasePage />);

    fireEvent.change(screen.getByLabelText(/^search$/i), { target: { value: 'payments' } });
    fireEvent.change(screen.getByLabelText(/tags/i), { target: { value: 'deploy' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/knowledge-base/search?query=payments&tags=deploy');
    });
    expect(await screen.findByText(lesson.title)).toBeInTheDocument();
  });
});
