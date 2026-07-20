import type { EvidenceSourceCategory } from '@dip/shared';

export const EVIDENCE_SOURCE_CATEGORY_LABEL: Record<EvidenceSourceCategory, string> = {
  MONITORING: 'Monitoring',
  CLOUD_PROVIDER: 'Cloud provider',
  LOG_AGGREGATOR: 'Log aggregator',
  TICKETING: 'Ticketing',
  CHAT: 'Chat',
  HUMAN: 'Human',
  OTHER: 'Other',
};
