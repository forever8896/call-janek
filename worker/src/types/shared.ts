// Canonical contract between backend and Expo client.
// FE team imports from this file — keep changes backwards-compatible.

export type ReportStatus =
  | 'queued'
  | 'transcribing'
  | 'processing'
  | 'ready'
  | 'spam'
  | 'quarantine'
  | 'archived'
  | 'actioned'

export type Category =
  | 'taxi_scam'
  | 'fake_exchange'
  | 'online_fraud'
  | 'restaurant_scam'
  | 'other'

export type EntityType = 'place' | 'business' | 'person'
export type MediaKind = 'image' | 'video' | 'audio'
export type PipelineStep = 'whisper' | 'spam' | 'dedupe' | 'category' | 'urgency' | 'entities' | 'web_research'
export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface Entity {
  type: EntityType
  name: string
  address?: string
  confidence: number
}

export interface MediaItem {
  id: string
  storage_path: string
  kind: MediaKind
  mime_type: string
  size_bytes: number | null
  signed_url?: string | null   // populated by /admin/reports/:id, valid 1h
}

export interface EvidenceItem {
  id: string
  source_url: string
  title: string | null
  snippet: string | null
  relevance_score: number | null
  fetched_at: string
}

export interface PipelineRun {
  step: PipelineStep
  status: PipelineStepStatus
  attempts: number
  started_at: string | null
  finished_at: string | null
  error: string | null
}

export interface ReportListItem {
  id: string
  created_at: string
  text_description: string
  category: Category
  urgency_score: number
  urgency_reason: string
  cluster_id: string | null
  cluster_count: number | null
  entity_count: number
  evidence_count: number
  has_media: boolean
}

export interface ReportNote {
  id: string
  created_at: string
  body: string
  author: string | null   // email or display name when available
}

export interface ReportDetail {
  id: string
  created_at: string
  status: ReportStatus
  text_description: string
  transcript: string | null
  location: string | null
  business_name: string | null
  category: Category
  urgency_score: number
  urgency_reason: string
  cluster_id: string | null
  entities: Entity[]
  media: MediaItem[]
  evidence: EvidenceItem[]
  notes: ReportNote[]
  cluster: {
    id: string
    canonical_report_id: string
    report_count: number
    similar_reports: ReportListItem[]
  } | null
  pipeline_runs: PipelineRun[]
}

// ─── Request bodies ────────────────────────────────────────────────────────────

export interface SubmitReportBody {
  text_description: string
  location?: string
  business_name?: string
  media_paths?: string[]
  audio_path?: string         // path returned by POST /reports/transcribe
  audio_mime_type?: string    // e.g. 'audio/mp4'
  reporter_id?: string
}

export interface TranscribeResponse {
  transcript: string
  audio_path: string
  mime_type: string
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface SubmitReportResponse {
  report_id: string
  status: 'queued'
}

export interface AudioUploadResponse {
  report_id: string
  status: 'transcribing'
  audio_path: string
}

export interface UploadUrlResponse {
  upload_url: string
  storage_path: string
}

export interface AdminQueueResponse {
  reports: ReportListItem[]
  total: number
  page: number
  pages: number
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
