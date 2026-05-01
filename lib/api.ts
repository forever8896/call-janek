// REST client for the Bun/Hono worker. Uses Supabase JWT (admin) for /admin/*.
// Public reporter endpoints are unauthenticated.

import { supabase } from './supabase';
import { ENV } from './env';
import type {
  AdminQueueResponse,
  AdminSearchResponse,
  AudioUploadResponse,
  ReportDetail,
  ReportListItem,
  SubmitReportBody,
  SubmitReportResponse,
  TranscribeResponse,
  UploadUrlResponse,
  Category,
} from './types';

class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { admin?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (init.admin) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new ApiError('UNAUTHORIZED', 'Not signed in as admin', 401);
    }
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${ENV.API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(code, message, res.status);
  }
  return body as T;
}

// ─── Reporter (public) ───────────────────────────────────────
export async function submitReport(body: SubmitReportBody): Promise<SubmitReportResponse> {
  return request<SubmitReportResponse>('/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Whisper-only call. Uploads audio, returns transcript + storage path so
// the reporter can review/edit before submission via POST /reports.
export async function transcribeAudio(opts: {
  uri: string;
  mimeType: string;
  fileName: string;
}): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append('audio', {
    uri: opts.uri,
    name: opts.fileName,
    type: opts.mimeType,
  } as unknown as Blob);

  const res = await fetch(`${ENV.API_URL}/reports/transcribe`, {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(code, message, res.status);
  }
  return body as TranscribeResponse;
}

// Legacy: submit audio + auto-trigger pipeline without review. Kept for
// backwards-compat; prefer transcribeAudio + submitReport.
export async function submitAudioReport(opts: {
  uri: string;
  mimeType: string;
  fileName: string;
  reporterId?: string;
}): Promise<AudioUploadResponse> {
  const form = new FormData();
  // RN multipart pattern: pass an object with uri/name/type instead of a Blob.
  form.append('audio', {
    uri: opts.uri,
    name: opts.fileName,
    type: opts.mimeType,
  } as unknown as Blob);
  if (opts.reporterId) form.append('reporter_id', opts.reporterId);

  const res = await fetch(`${ENV.API_URL}/reports/audio`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type — fetch sets the multipart boundary.
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(code, message, res.status);
  }
  return body as AudioUploadResponse;
}

export async function getUploadUrl(
  mimeType: string,
  kind: 'image' | 'video',
): Promise<UploadUrlResponse> {
  const qs = new URLSearchParams({ mime_type: mimeType, kind });
  return request<UploadUrlResponse>(`/reports/upload-url?${qs.toString()}`);
}

// Two-step attachment upload:
//   1. ask the worker for a signed Supabase Storage URL,
//   2. PUT the file bytes there directly.
// Returns the storage_path to pass in `media_paths` on POST /reports.
export async function uploadAttachment(opts: {
  uri: string;
  mimeType: string;
  kind: 'image' | 'video';
}): Promise<string> {
  const { upload_url, storage_path } = await getUploadUrl(opts.mimeType, opts.kind);

  // RN's fetch supports converting a local file URI to a Blob.
  const fileRes = await fetch(opts.uri);
  const blob = await fileRes.blob();

  const putRes = await fetch(upload_url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': opts.mimeType },
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new ApiError('UPLOAD_FAILED', `Storage upload failed: ${putRes.status} ${text}`, putRes.status);
  }
  return storage_path;
}

// ─── Admin (JWT required) ───────────────────────────────────
export async function getAdminQueue(opts: {
  category?: Category;
  status?: 'ready' | 'actioned' | 'archived' | 'spam' | 'quarantine';
  sort?: 'urgency' | 'time';
  page?: number;
  limit?: number;
} = {}): Promise<AdminQueueResponse> {
  const qs = new URLSearchParams();
  if (opts.category) qs.set('category', opts.category);
  if (opts.status) qs.set('status', opts.status);
  if (opts.sort) qs.set('sort', opts.sort);
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const path = qs.toString() ? `/admin/reports?${qs}` : '/admin/reports';
  return request<AdminQueueResponse>(path, { admin: true });
}

export async function getAdminReport(id: string): Promise<ReportDetail> {
  return request<ReportDetail>(`/admin/reports/${id}`, { admin: true });
}

export async function patchAdminReport(
  id: string,
  status: 'actioned' | 'archived' | 'ready',
): Promise<{ id: string; status: string }> {
  return request(`/admin/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    admin: true,
  });
}

export async function addReportNote(
  id: string,
  body: string,
): Promise<{ id: string; body: string; created_at: string; author: string | null }> {
  return request(`/admin/reports/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
    admin: true,
  });
}

export async function getQuarantine(): Promise<{ reports: ReportListItem[]; total: number }> {
  return request('/admin/quarantine', { admin: true });
}

export async function adminSearch(query: string): Promise<AdminSearchResponse> {
  return request<AdminSearchResponse>('/admin/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
    admin: true,
  });
}

export { ApiError };
