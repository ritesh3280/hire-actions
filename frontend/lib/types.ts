export type Candidate = {
  id: string;
  short_id?: number;
  name: string;
  email: string;
  pipeline_stage?: string | null;
  priority?: string | null;
  created_at?: string;
  updated_at?: string;
  resume_text?: string;
  notes?: Array<{
    type: string;
    content?: string;
    created_at?: string;
  }>;
  score_history?: Array<{
    job_id: string;
    score: number;
    created_at: string;
  }>;
  stage_history?: Array<{
    from_stage: string;
    to_stage: string;
    reason?: string;
    created_at: string;
  }>;
};

export type Job = {
  id: string;
  short_id?: number;
  title: string;
  description: string;
  required_skills: string[];
  created_at?: string;
};

export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type VoiceIntent = {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  reasoning?: string;
};

export type VoiceExecutionResult = Record<string, unknown> | undefined;

export type VoiceActionResponse = {
  intent_json: VoiceIntent;
  execution_result: VoiceExecutionResult;
  transcript: string;
};