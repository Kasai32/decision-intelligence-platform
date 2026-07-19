import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { LessonLearned } from '@dip/shared';
import { LessonsLearnedPanel } from '../components/LessonsLearnedPanel';
import { apiClient } from '../lib/api-client';

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

const lesson: LessonLearned = {
  id: 'lesson-1',
  tenantId: 't1',
  incidentId: 'incident-1',
  title: 'Payments outage retro',
  whatHappened: 'A bad deploy caused 500s for 12 minutes.',
  whatWentWell: ['Fast detection'],
  whatToImprove: ['Canary deploys'],
  actionItems: ['Add canary stage to pipeline'],
  tags: ['deploy', 'payments'],
  createdByUserId: 'user-1',
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
};

describe('LessonsLearnedPanel (ADR-0011 — gated on CLOSED incident)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.post as jest.Mock).mockReset();
  });

  it('explains the CLOSED gate instead of showing a form for a non-CLOSED incident', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    render(<LessonsLearnedPanel incidentId="incident-1" incidentStatus="MITIGATED" />);

    await waitFor(() => expect(screen.getByText(/no lesson learned recorded yet/i)).toBeInTheDocument());
    expect(screen.getByText(/current status: MITIGATED/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
  });

  it('submits a new lesson for a CLOSED incident and prepends it to the list', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue(lesson);

    render(<LessonsLearnedPanel incidentId="incident-1" incidentStatus="CLOSED" />);
    await waitFor(() => expect(screen.getByText(/no lesson learned recorded yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: lesson.title } });
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: lesson.whatHappened } });
    fireEvent.click(screen.getByRole('button', { name: /record lesson learned/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/incidents/incident-1/lessons-learned',
        expect.objectContaining({ title: lesson.title, whatHappened: lesson.whatHappened }),
      );
    });
    expect(await screen.findByText(lesson.title)).toBeInTheDocument();
  });
});
