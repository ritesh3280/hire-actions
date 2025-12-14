'use client';

import type { ReactElement } from 'react';
import type { VoiceActionResponse } from '../lib/types';

function renderSearch(result: any) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {candidates.map((candidate: any) => (
          <article key={candidate.candidate_id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">{candidate.name}</h4>
            <p className="text-xs text-slate-500">Similarity: {(candidate.similarity ?? 0).toFixed(2)}</p>
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{candidate.snippet}</p>
            {candidate.matched_skills?.length ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {candidate.matched_skills.map((skill: string) => (
                  <span key={skill} className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {result?.summary && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{result.summary}</p>
      )}
    </div>
  );
}

function renderScore(result: any) {
  // Check for error first
  if (result?.error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <p className="font-medium text-rose-800">⚠ Unable to score candidate</p>
        <p className="mt-1 text-sm text-rose-600">{result.error}</p>
        <p className="mt-2 text-xs text-rose-500">
          Tip: Make sure to reference a specific job when scoring. Try: "Score this candidate for the Senior Software Engineer role"
        </p>
      </div>
    );
  }

  const candidate = result?.candidate;
  const job = result?.job;
  const rubric = result?.rubric ?? {};
  const strengths = Array.isArray(result?.strengths) ? result.strengths : [];
  const concerns = Array.isArray(result?.concerns) ? result.concerns : [];
  const score = result?.overall_score;

  // Determine score color and badge
  let scoreColor = 'text-slate-900';
  let scoreBg = 'bg-slate-100';
  let scoreLabel = 'Average';
  if (typeof score === 'number') {
    if (score >= 80) {
      scoreColor = 'text-emerald-600';
      scoreBg = 'bg-emerald-50 ring-2 ring-emerald-200';
      scoreLabel = 'Excellent';
    } else if (score >= 70) {
      scoreColor = 'text-emerald-600';
      scoreBg = 'bg-emerald-50';
      scoreLabel = 'Good';
    } else if (score >= 50) {
      scoreColor = 'text-amber-600';
      scoreBg = 'bg-amber-50';
      scoreLabel = 'Fair';
    } else {
      scoreColor = 'text-rose-600';
      scoreBg = 'bg-rose-50';
      scoreLabel = 'Poor';
    }
  }

  return (
    <div className="space-y-4 text-sm text-slate-700">
      {/* Candidate & Job Header */}
      {(candidate || job) && (
        <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Candidate Info */}
            {candidate && (
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Candidate</p>
                <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
                <p className="text-sm text-slate-600">{candidate.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidate.pipeline_stage && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {candidate.pipeline_stage}
                    </span>
                  )}
                  {candidate.priority && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${candidate.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                      candidate.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                      {candidate.priority} priority
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Job Info */}
            {job && (
              <div className="flex-1 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scored Against</p>
                <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                {job.short_id && <p className="text-sm text-slate-500">Job #{job.short_id}</p>}
                {Array.isArray(job.required_skills) && job.required_skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-end gap-1">
                    {job.required_skills.slice(0, 4).map((skill: string) => (
                      <span key={skill} className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">
                        {skill}
                      </span>
                    ))}
                    {job.required_skills.length > 4 && (
                      <span className="text-xs text-slate-400">+{job.required_skills.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-full ${scoreBg}`}>
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {score ?? '—'}
          </span>
          <span className={`text-xs font-medium ${scoreColor}`}>{scoreLabel}</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">Overall Score</p>
          <p className="text-sm text-slate-500">out of 100 points</p>
        </div>
      </div>

      {/* Rubric Breakdown */}
      {Object.keys(rubric).length > 0 && (
        <div>
          <p className="mb-2 font-medium text-slate-900">Scoring Rubric</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(rubric).map(([key, value]) => {
              const numValue = typeof value === 'number' ? value : 0;
              const barWidth = Math.min(100, (numValue / 25) * 100);
              return (
                <div key={key} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{String(value)}/25</p>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-emerald-700">✓ Strengths</p>
          <ul className="space-y-1">
            {strengths.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <span className="mt-0.5 text-emerald-500">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-amber-700">⚠ Concerns</p>
          <ul className="space-y-1">
            {concerns.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="mt-0.5 text-amber-500">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final Explanation */}
      {result?.final_explanation && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Assessment</p>
          <p className="text-sm text-slate-700">{result.final_explanation}</p>
        </div>
      )}
    </div>
  );
}

function renderQuestions(result: any) {
  // Check for error first
  if (result?.error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <p className="font-medium text-rose-800">⚠ Unable to generate questions</p>
        <p className="mt-1 text-sm text-rose-600">{result.error}</p>
      </div>
    );
  }

  const questions = Array.isArray(result?.questions) ? result.questions : [];
  const candidate = result?.candidate;
  const job = result?.job;

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-700">No questions generated. Try specifying a candidate and job.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-slate-700">
      {/* Candidate & Job Header */}
      {(candidate || job) && (
        <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Candidate Info */}
            {candidate && (
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Screening</p>
                <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
                <p className="text-sm text-slate-600">{candidate.email}</p>
              </div>
            )}
            {/* Job Info */}
            {job && (
              <div className="flex-1 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">For Position</p>
                <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                {job.short_id && <p className="text-sm text-slate-500">Job #{job.short_id}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions List */}
      <ol className="space-y-3">
        {questions.map((q: any, index: number) => (
          <li key={index} className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-slate-900">{q.question}</p>
                <p className="mt-2 text-xs text-slate-500"><span className="font-medium">Evaluates:</span> {q.evaluates}</p>
                <p className="mt-1 text-xs text-emerald-600"><span className="font-medium">Good signal:</span> {q.good_signal}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Explanation */}
      {result?.explanation && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">About these questions</p>
          <p className="text-sm text-slate-700">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

function renderEmail(result: any) {
  // Check for error first
  if (result?.error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <p className="font-medium text-rose-800">⚠ Unable to send email</p>
        <p className="mt-1 text-sm text-rose-600">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${result?.sent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {result?.sent ? '✓ Email Sent' : '⏸ Draft (not sent)'}
      </div>
      <div>
        <p className="font-medium text-slate-900">To</p>
        <p className="rounded-md border border-slate-100 bg-slate-50 p-3">{result?.to}</p>
      </div>
      <div>
        <p className="font-medium text-slate-900">Subject</p>
        <p className="rounded-md border border-slate-100 bg-slate-50 p-3">{result?.subject}</p>
      </div>
      <div>
        <p className="font-medium text-slate-900">Body</p>
        <pre className="whitespace-pre-wrap rounded-md border border-slate-100 bg-white p-4 text-sm shadow-sm">{result?.body}</pre>
      </div>
      {/* Auto-move notification */}
      {result?.auto_moved_to && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3">
          <span className="text-indigo-500">📋</span>
          <p className="text-sm text-indigo-700">
            Candidate automatically moved to <strong>{result.auto_moved_to}</strong> stage
          </p>
        </div>
      )}
    </div>
  );
}

function renderMoveCandidate(result: any) {
  if (result?.error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <p className="font-medium text-rose-800">⚠ Unable to move candidate</p>
        <p className="mt-1 text-sm text-rose-600">{result.error}</p>
      </div>
    );
  }

  const stageColors: Record<string, { bg: string; text: string }> = {
    sourcing: { bg: 'bg-gray-100', text: 'text-gray-700' },
    applied: { bg: 'bg-blue-100', text: 'text-blue-700' },
    screening: { bg: 'bg-amber-100', text: 'text-amber-700' },
    interview: { bg: 'bg-purple-100', text: 'text-purple-700' },
    offer: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    hired: { bg: 'bg-green-100', text: 'text-green-700' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  };

  const fromStage = result?.from_stage || 'none';
  const toStage = result?.to_stage || 'unknown';
  const fromStyle = stageColors[fromStage] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const toStyle = stageColors[toStage] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  return (
    <div className="space-y-4 text-sm text-slate-700">
      {/* Success Header */}
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-lg">✓</span>
        </div>
        <div>
          <p className="font-semibold text-emerald-800">Candidate Moved</p>
          <p className="text-sm text-emerald-600">{result?.candidate_name}</p>
        </div>
      </div>

      {/* Stage Transition */}
      <div className="flex items-center justify-center gap-4 rounded-lg border border-slate-200 p-4">
        <div className={`rounded-full px-4 py-2 font-medium ${fromStyle.bg} ${fromStyle.text}`}>
          {fromStage}
        </div>
        <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className={`rounded-full px-4 py-2 font-medium ${toStyle.bg} ${toStyle.text}`}>
          {toStage}
        </div>
      </div>

      {/* Explanation */}
      {result?.explanation && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{result.explanation}</p>
      )}
    </div>
  );
}

function renderNavigate(result: any) {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p className="font-medium text-slate-900">View: {result?.view ?? 'pipeline'}</p>
      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Filters</p>
        <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result?.filters ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}

function renderCreateJob(result: any) {
  const skills = Array.isArray(result?.required_skills) ? result.required_skills : [];
  return (
    <div className="space-y-4 text-sm text-slate-700">
      {/* Success Header */}
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-lg">✓</span>
        </div>
        <div>
          <p className="font-semibold text-emerald-800">Job Created Successfully</p>
          <p className="text-sm text-emerald-600">ID: #{result?.short_id}</p>
        </div>
      </div>

      {/* Job Details */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="text-lg font-semibold text-slate-900">{result?.title}</h4>
        {result?.description && (
          <p className="mt-2 text-sm text-slate-600">{result.description}</p>
        )}
      </div>

      {/* Required Skills */}
      {skills.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Auto-extracted Skills ({skills.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill: string) => (
              <span
                key={skill}
                className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  response: VoiceActionResponse | null;
};

export function ExecutionResult({ response }: Props) {
  if (!response) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Voice action results will appear here.
      </div>
    );
  }

  const action = response.intent_json?.action;
  const execution = response.execution_result;

  let rendered: ReactElement | null = null;
  switch (action) {
    case 'create_job':
      rendered = renderCreateJob(execution);
      break;
    case 'search_candidates':
      rendered = renderSearch(execution);
      break;
    case 'score_candidate':
      rendered = renderScore(execution);
      break;
    case 'generate_screening_questions':
      rendered = renderQuestions(execution);
      break;
    case 'email_candidate':
      rendered = renderEmail(execution);
      break;
    case 'move_candidate':
      rendered = renderMoveCandidate(execution);
      break;
    case 'navigate_dashboard':
      rendered = renderNavigate(execution);
      break;
    default:
      rendered = (
        <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          {JSON.stringify(execution, null, 2)}
        </pre>
      );
  }

  // Render chained actions if present
  const chainedActions = execution?.chained_actions;
  const chainedRender = chainedActions && Array.isArray(chainedActions) ? (
    <div className="mt-6 space-y-4 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-700">Chained Actions</h3>
      {chainedActions.map((chained: any, idx: number) => {
        const chainedAction = chained?.action;
        const chainedResult = chained?.result;
        let chainedRendered: ReactElement | null = null;

        switch (chainedAction) {
          case 'create_job':
            chainedRendered = renderCreateJob(chainedResult);
            break;
          case 'search_candidates':
            chainedRendered = renderSearch(chainedResult);
            break;
          case 'score_candidate':
            chainedRendered = renderScore(chainedResult);
            break;
          case 'generate_screening_questions':
            chainedRendered = renderQuestions(chainedResult);
            break;
          case 'email_candidate':
            chainedRendered = renderEmail(chainedResult);
            break;
          case 'move_candidate':
            chainedRendered = renderMoveCandidate(chainedResult);
            break;
          case 'navigate_dashboard':
            chainedRendered = renderNavigate(chainedResult);
            break;
          default:
            chainedRendered = (
              <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                {JSON.stringify(chainedResult, null, 2)}
              </pre>
            );
        }

        return (
          <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">→ {chainedAction}</p>
            {chainedRendered}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Voice Execution Result</h2>
        <p className="mt-1 text-sm text-slate-500">Action: {action}</p>
      </header>
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Transcript</p>
        <p className="rounded-md border border-slate-100 bg-slate-50 p-3">{response.transcript}</p>
        <details className="rounded-md border border-slate-100 bg-white p-3 text-sm shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-600">Intent JSON</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(response.intent_json, null, 2)}</pre>
        </details>
      </div>
      <div>{rendered}</div>
      {chainedRender}
    </div>
  );
}
