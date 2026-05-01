// Re-export the canonical contract from the worker so the FE has a single
// source of truth without duplicating shapes.
export type {
  ReportStatus,
  Category,
  EntityType,
  MediaKind,
  PipelineStep,
  PipelineStepStatus,
  Entity,
  MediaItem,
  EvidenceItem,
  PipelineRun,
  ReportListItem,
  ReportNote,
  ReportDetail,
  SubmitReportBody,
  SubmitReportResponse,
  AudioUploadResponse,
  TranscribeResponse,
  UploadUrlResponse,
  AdminQueueResponse,
  ApiError,
} from '../worker/src/types/shared';
