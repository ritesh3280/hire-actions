'use client';

import { useEffect, useState } from 'react';
import { fetchActionLogs } from '../../lib/api';

type ActionLog = {
  id: string;
  action_type: string;
  params: Record<string, unknown>;
  status: string;
  output: Record<string, unknown>;
  created_at: string;
};

const ACTION_ICONS: Record<string, string> = {
  create_job: '📋',
  search_candidates: '🔍',
  score_candidate: '⭐',
  generate_screening_questions: '❓',
  email_candidate: '✉️',
  move_candidate: '📂',
  navigate_dashboard: '🧭',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getSummary(log: ActionLog): string {
  const output = log.output || {};
  const params = log.params || {};
  
  switch (log.action_type) {
    case 'create_job':
      return `Created "${output.title || params.title}"`;
    case 'search_candidates':
      const count = Array.isArray(output.candidates) ? output.candidates.length : 0;
      return `Found ${count} candidates`;
    case 'score_candidate':
      const candidateName = (output.candidate as Record<string, unknown>)?.name || 'candidate';
      return `Scored ${candidateName}: ${output.overall_score}/100`;
    case 'generate_screening_questions':
      const qCount = Array.isArray(output.questions) ? output.questions.length : 0;
      return `Generated ${qCount} questions`;
    case 'email_candidate':
      return `Email ${output.sent ? 'sent' : 'failed'}${output.auto_moved_to ? ' → ' + output.auto_moved_to : ''}`;
    case 'move_candidate':
      return `Moved ${output.candidate_name || 'candidate'} to ${output.to_stage || 'unknown'}`;
    case 'navigate_dashboard':
      return `Navigated to ${output.view || 'dashboard'}`;
    default:
      return log.action_type?.replace(/_/g, ' ') || 'Unknown';
  }
}

export default function ActionLogsPage() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      const data = await fetchActionLogs({ limit: 50, action_type: filter || null });
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const filters = ['', 'create_job', 'search_candidates', 'score_candidate', 'move_candidate', 'email_candidate'];
  const filterLabels: Record<string, string> = {
    '': 'All',
    create_job: 'Jobs',
    search_candidates: 'Search',
    score_candidate: 'Scores',
    move_candidate: 'Moves',
    email_candidate: 'Emails',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="mx-auto max-w-4xl px-6 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Activity</h1>
            <p className="text-gray-500 text-sm mt-1">{logs.length} recent actions</p>
          </div>
          <button
            onClick={loadLogs}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-600 font-medium">No activity yet</p>
            <p className="text-gray-500 text-sm mt-1">Voice commands will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <span className="text-xl">{ACTION_ICONS[log.action_type] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{getSummary(log)}</p>
                    <p className="text-xs text-gray-500">{formatTime(log.created_at)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    log.status === 'ok' || log.status === 'sent'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {log.status}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expanded === log.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Input</p>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto max-h-40">
                          {JSON.stringify(log.params, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Output</p>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto max-h-40">
                          {JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
