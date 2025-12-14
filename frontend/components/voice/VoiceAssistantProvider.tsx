'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invokeVoiceAction } from '../../lib/api';
import type { ConversationTurn, VoiceActionResponse } from '../../lib/types';

type PipelineFilters = {
  pipeline_stage: string | null;
  priority: string | null;
};

type VoiceAssistantContextValue = {
  lastResponse: VoiceActionResponse | null;
  responseLog: VoiceActionResponse[];
  conversationHistory: ConversationTurn[];
  pendingCount: number;
  runVoiceCommand: (payload: { transcript?: string; audio_base64?: string }) => Promise<VoiceActionResponse | null>;
  pipelineFilters: PipelineFilters;
  setPipelineFilters: (filters: PipelineFilters) => void;
  pipelineFiltersVersion: number;
  clearConversation: () => void;
  clearHistory: () => void;
};

const VoiceAssistantContext = createContext<VoiceAssistantContextValue | undefined>(undefined);

function normalizePipelineFilters(filters: unknown): PipelineFilters {
  if (!filters || typeof filters !== 'object') {
    return { pipeline_stage: null, priority: null };
  }
  const data = filters as Record<string, unknown>;
  return {
    pipeline_stage: typeof data.pipeline_stage === 'string' ? data.pipeline_stage : null,
    priority: typeof data.priority === 'string' ? data.priority : null,
  };
}

function mapViewToRoute(view: string | undefined): string {
  switch (view) {
    case 'jobs':
      return '/jobs';
    case 'candidates':
      return '/candidates';
    default:
      return '/pipeline';
  }
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [lastResponse, setLastResponse] = useState<VoiceActionResponse | null>(null);
  const [responseLog, setResponseLog] = useState<VoiceActionResponse[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pipelineFilters, setPipelineFiltersState] = useState<PipelineFilters>({ pipeline_stage: null, priority: null });
  const [pipelineFiltersVersion, setPipelineFiltersVersion] = useState(0);

  const updatePipelineFilters = useCallback((nextFilters: PipelineFilters) => {
    setPipelineFiltersState((current) => {
      if (current.pipeline_stage === nextFilters.pipeline_stage && current.priority === nextFilters.priority) {
        return current;
      }
      setPipelineFiltersVersion((version) => version + 1);
      return nextFilters;
    });
  }, []);

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
  }, []);

  const handleVoiceResponse = useCallback(
    (response: VoiceActionResponse, userTranscript: string) => {
      setLastResponse(response);
      setResponseLog((prev) => [response, ...prev].slice(0, 10));

      // Build assistant response summary for conversation history
      const action = response.intent_json?.action;
      const params = response.intent_json?.params as Record<string, unknown> | undefined;
      const execution = response.execution_result as Record<string, unknown> | undefined;

      let assistantContent = `Action: ${action}`;

      // Include job details for context
      if (action === 'create_job' && execution?.short_id) {
        assistantContent += `. Created job "${execution.title}" with ID #${execution.short_id}`;
        if (Array.isArray(execution.required_skills)) {
          assistantContent += `. Skills: ${(execution.required_skills as string[]).slice(0, 5).join(', ')}`;
        }
      }

      // Include search results with candidate names and IDs
      if (action === 'search_candidates' && Array.isArray(execution?.candidates)) {
        const candidates = execution.candidates as Array<{ name: string; candidate_id?: string; similarity?: number }>;
        if (candidates.length > 0) {
          const topCandidates = candidates.slice(0, 5).map((c, i) =>
            `${i + 1}. ${c.name} (ID: ${c.candidate_id || 'unknown'}, score: ${(c.similarity || 0).toFixed(2)})`
          ).join('; ');
          assistantContent += `. Found ${candidates.length} candidates. Top results: ${topCandidates}`;
        }
        // Include job_id that was used for the search
        if (params?.job_id) {
          assistantContent += `. Searched against job ID #${params.job_id}`;
        }
      }

      // Include score results
      if (action === 'score_candidate' && execution?.overall_score) {
        const candidateInfo = execution.candidate as { name?: string; id?: string } | undefined;
        const jobInfo = execution.job as { title?: string; short_id?: number } | undefined;
        assistantContent += `. Scored ${candidateInfo?.name || 'candidate'} with ${execution.overall_score}/100`;
        if (jobInfo?.title) {
          assistantContent += ` for ${jobInfo.title} (Job #${jobInfo.short_id})`;
        }
      }

      // Include screening questions results
      if (action === 'generate_screening_questions' && Array.isArray(execution?.questions)) {
        const candidateInfo = execution.candidate as { name?: string; id?: string } | undefined;
        const jobInfo = execution.job as { title?: string; short_id?: number } | undefined;
        assistantContent += `. Generated ${(execution.questions as unknown[]).length} screening questions`;
        if (candidateInfo?.name) {
          assistantContent += ` for ${candidateInfo.name}`;
        }
        if (jobInfo?.title) {
          assistantContent += ` (${jobInfo.title}, Job #${jobInfo.short_id})`;
        }
      }

      // Include email results
      if (action === 'email_candidate') {
        const sent = execution?.sent;
        const to = execution?.to;
        assistantContent += sent ? `. Email sent to ${to}` : `. Draft email prepared for ${to}`;
        if (execution?.auto_moved_to) {
          assistantContent += `. Candidate moved to ${execution.auto_moved_to} stage`;
        }
      }

      // Include move candidate results
      if (action === 'move_candidate') {
        const candidateName = execution?.candidate_name;
        const fromStage = execution?.from_stage;
        const toStage = execution?.to_stage;
        assistantContent += `. Moved ${candidateName || 'candidate'} from ${fromStage || 'unknown'} to ${toStage || 'unknown'}`;
      }

      if (execution?.summary) {
        assistantContent += `. ${execution.summary}`;
      }
      if (execution?.explanation) {
        assistantContent += ` ${execution.explanation}`;
      }

      // Handle chained actions in context
      const chainedActions = execution?.chained_actions as Array<{ action: string; result: Record<string, unknown> }> | undefined;
      if (chainedActions && chainedActions.length > 0) {
        assistantContent += `. Chained actions: `;
        chainedActions.forEach((chained, idx) => {
          if (chained.action === 'generate_screening_questions' && chained.result?.questions) {
            const questions = chained.result.questions as unknown[];
            assistantContent += `Generated ${questions.length} screening questions`;
          } else if (chained.action === 'move_candidate' && chained.result?.to_stage) {
            assistantContent += `Moved to ${chained.result.to_stage}`;
          } else if (chained.action === 'score_candidate' && chained.result?.overall_score) {
            assistantContent += `Scored ${chained.result.overall_score}/100`;
          }
          if (idx < chainedActions.length - 1) assistantContent += '; ';
        });
      }

      // Add to conversation history (keep last 6 turns = 3 exchanges)
      setConversationHistory((prev) => {
        const newHistory = [
          ...prev,
          { role: 'user' as const, content: userTranscript },
          { role: 'assistant' as const, content: assistantContent },
        ];
        return newHistory.slice(-6);
      });

      if (action === 'navigate_dashboard') {
        const view = typeof execution?.view === 'string' ? execution.view : 'pipeline';
        const filters = normalizePipelineFilters(execution?.filters);
        updatePipelineFilters(filters);
        router.push(mapViewToRoute(view));
      }
    },
    [router, updatePipelineFilters],
  );

  const runVoiceCommand = useCallback(
    async (payload: { transcript?: string; audio_base64?: string }) => {
      if (!payload.transcript && !payload.audio_base64) {
        return null;
      }
      setPendingCount((count) => count + 1);
      try {
        // Pass last 3 exchanges (6 turns) as context
        const response = await invokeVoiceAction({
          ...payload,
          conversation_history: conversationHistory,
        });
        if (response) {
          handleVoiceResponse(response, response.transcript || payload.transcript || '');
        }
        return response;
      } finally {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [handleVoiceResponse, conversationHistory],
  );

  const clearHistory = useCallback(() => {
    setResponseLog([]);
    setLastResponse(null);
  }, []);

  const value = useMemo(
    () => ({
      lastResponse,
      responseLog,
      conversationHistory,
      pendingCount,
      runVoiceCommand,
      pipelineFilters,
      setPipelineFilters: updatePipelineFilters,
      pipelineFiltersVersion,
      clearConversation,
      clearHistory,
    }),
    [lastResponse, responseLog, conversationHistory, pendingCount, runVoiceCommand, pipelineFilters, updatePipelineFilters, pipelineFiltersVersion, clearConversation, clearHistory],
  );

  return <VoiceAssistantContext.Provider value={value}>{children}</VoiceAssistantContext.Provider>;
}

export function useVoiceAssistant(): VoiceAssistantContextValue {
  const ctx = useContext(VoiceAssistantContext);
  if (!ctx) {
    throw new Error('useVoiceAssistant must be used within VoiceAssistantProvider');
  }
  return ctx;
}
