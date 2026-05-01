// Map API DTOs onto the field names used by the existing UI components.
// Keeps the screen code tidy while the contract stays canonical in worker types.

import type { Category, ReportListItem } from './types';
import type { CatKey } from '@/components/illustrations';

const CAT_TO_ICON: Record<Category, CatKey> = {
  taxi_scam: 'taxi',
  fake_exchange: 'exchange',
  online_fraud: 'online',
  restaurant_scam: 'menu',
  other: 'pickpocket',
};

export type UIRow = {
  id: string;
  cat: CatKey;
  urgency: 1 | 2 | 3 | 4;
  cluster: number;
  time: string;
  location: string;
  media?: string;
  summary: string;
};

function urgencyBucket(score: number): 1 | 2 | 3 | 4 {
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  return 1;
}

// "9m", "2h", "3d"
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function toUIRow(r: ReportListItem & { location?: string | null }): UIRow {
  const location =
    (r as ReportListItem & { location?: string | null }).location ??
    'Praha';
  return {
    id: shortId(r.id),
    cat: r.category ? CAT_TO_ICON[r.category] : 'pickpocket',
    urgency: urgencyBucket(r.urgency_score ?? 0),
    cluster: r.cluster_count ?? 1,
    time: relativeTime(r.created_at),
    location,
    media: r.has_media ? 'media' : undefined,
    summary: r.text_description || '(no description)',
  };
}

export function shortId(uuid: string): string {
  // first 4 chars of uuid → "HG-abcd"
  return `HG-${uuid.slice(0, 4)}`;
}
