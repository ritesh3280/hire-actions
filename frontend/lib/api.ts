import type { Candidate, ConversationTurn, Job, VoiceActionResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ActionLog = {
  id: string;
  action_type: string;
  params: Record<string, unknown>;
  status: string;
  output: Record<string, unknown>;
  created_at: string;
};

export async function uploadCandidate(formData: FormData): Promise<Candidate> {
  const res = await fetch(`${API_URL}/candidates`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function createJob(payload: { title: string; description: string }): Promise<Job> {
  const res = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${API_URL}/jobs`);
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function invokeVoiceAction(payload: {
  transcript?: string;
  audio_base64?: string;
  conversation_history?: ConversationTurn[];
}): Promise<VoiceActionResponse> {
  const res = await fetch(`${API_URL}/actions/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function fetchCandidates(params: { pipeline_stage?: string | null; priority?: string | null }): Promise<Candidate[]> {
  const query = new URLSearchParams();
  if (params.pipeline_stage) {
    query.set("pipeline_stage", params.pipeline_stage);
  }
  if (params.priority) {
    query.set("priority", params.priority);
  }
  const res = await fetch(`${API_URL}/candidates${query.toString() ? `?${query.toString()}` : ""}`);
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function fetchCandidate(identifier: string): Promise<Candidate> {
  const res = await fetch(`${API_URL}/candidates/${encodeURIComponent(identifier)}`);
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function fetchActionLogs(params: { limit?: number; action_type?: string | null } = {}): Promise<ActionLog[]> {
  const query = new URLSearchParams();
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  if (params.action_type) {
    query.set("action_type", params.action_type);
  }
  const res = await fetch(`${API_URL}/action-logs${query.toString() ? `?${query.toString()}` : ""}`);
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function deleteCandidate(candidateId: string) {
  const res = await fetch(`${API_URL}/candidates/${candidateId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function deleteJob(jobId: string) {
  const res = await fetch(`${API_URL}/jobs/${jobId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

export type BulkUploadResult = {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    status: 'success' | 'error';
    filename: string;
    candidate?: {
      id: string;
      short_id: number;
      name: string;
      email: string;
    };
    error?: string;
  }>;
};

export async function bulkUploadResumes(files: File[]): Promise<BulkUploadResult> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('resumes', file);
  });

  const res = await fetch(`${API_URL}/candidates/bulk`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

async function extractError(res: Response) {
  try {
    const data = await res.json();
    return data.detail || data.message || res.statusText;
  } catch (err) {
    return res.statusText;
  }
}
