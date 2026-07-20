import { render, screen } from '@testing-library/react';
import type { CalibrationReport } from '@dip/shared';
import CalibrationPage from '../app/calibration/page';
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

describe('CalibrationPage (ADR-0016 — real, computed statistics, never fabricated)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (getAccessToken as jest.Mock).mockReturnValue('a-token');
  });

  it('never renders blank when unauthenticated — shows a sign-in prompt instead', () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<CalibrationPage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows "not enough data yet" below the sample-size threshold instead of a fabricated number', async () => {
    const report: CalibrationReport = {
      totalLabeledOutcomes: 1,
      minimumSampleSizeThreshold: 5,
      dimensions: [
        {
          dimension: 'evidenceCompleteness',
          goodSampleSize: 1,
          badSampleSize: 0,
          meanWhenGood: 100,
          meanWhenBad: null,
          meanDifference: null,
          sufficientData: false,
        },
        {
          dimension: 'sourceReliability',
          goodSampleSize: 1,
          badSampleSize: 0,
          meanWhenGood: 90,
          meanWhenBad: null,
          meanDifference: null,
          sufficientData: false,
        },
        {
          dimension: 'dataFreshness',
          goodSampleSize: 1,
          badSampleSize: 0,
          meanWhenGood: 95,
          meanWhenBad: null,
          meanDifference: null,
          sufficientData: false,
        },
        {
          dimension: 'aiCertainty',
          goodSampleSize: 1,
          badSampleSize: 0,
          meanWhenGood: 50,
          meanWhenBad: null,
          meanDifference: null,
          sufficientData: false,
        },
      ],
    };
    (apiClient.get as jest.Mock).mockResolvedValue(report);

    render(<CalibrationPage />);

    expect(await screen.findByText('1')).toBeInTheDocument(); // totalLabeledOutcomes
    expect(screen.getAllByText(/not enough data yet \(1 of 5\)/i)).toHaveLength(4);
    expect(screen.getAllByText(/no bad-outcome samples recorded yet/i)).toHaveLength(4);
  });

  it('shows the computed mean difference once the sample is sufficient', async () => {
    const report: CalibrationReport = {
      totalLabeledOutcomes: 5,
      minimumSampleSizeThreshold: 5,
      dimensions: [
        {
          dimension: 'evidenceCompleteness',
          goodSampleSize: 3,
          badSampleSize: 2,
          meanWhenGood: 80,
          meanWhenBad: 40,
          meanDifference: 40,
          sufficientData: true,
        },
        {
          dimension: 'sourceReliability',
          goodSampleSize: 3,
          badSampleSize: 2,
          meanWhenGood: 80,
          meanWhenBad: 40,
          meanDifference: 40,
          sufficientData: true,
        },
        {
          dimension: 'dataFreshness',
          goodSampleSize: 3,
          badSampleSize: 2,
          meanWhenGood: 80,
          meanWhenBad: 40,
          meanDifference: 40,
          sufficientData: true,
        },
        {
          dimension: 'aiCertainty',
          goodSampleSize: 3,
          badSampleSize: 2,
          meanWhenGood: 80,
          meanWhenBad: 40,
          meanDifference: 40,
          sufficientData: true,
        },
      ],
    };
    (apiClient.get as jest.Mock).mockResolvedValue(report);

    render(<CalibrationPage />);

    expect(await screen.findAllByText(/difference: \+40\.0/i)).toHaveLength(4);
    expect(screen.queryByText(/not enough data yet \(/i)).not.toBeInTheDocument();
  });
});
