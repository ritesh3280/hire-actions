'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCandidates, fetchJobs, fetchActionLogs, type ActionLog } from '../lib/api';
import type { Candidate, Job } from '../lib/types';
import { useVoiceAssistant } from '../components/voice/VoiceAssistantProvider';

type Stats = {
  totalCandidates: number;
  totalJobs: number;
  recentActions: number;
  byStage: Record<string, number>;
};

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
  );
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { conversationHistory, clearConversation } = useVoiceAssistant();

  useEffect(() => {
    async function loadStats() {
      try {
        const [candidates, jobs, logs] = await Promise.all([
          fetchCandidates({}),
          fetchJobs(),
          fetchActionLogs({ limit: 5 }),
        ]);

        const byStage: Record<string, number> = {};
        candidates.forEach((c: Candidate) => {
          const stage = c.pipeline_stage || 'unassigned';
          byStage[stage] = (byStage[stage] || 0) + 1;
        });

        setStats({
          totalCandidates: candidates.length,
          totalJobs: jobs.length,
          recentActions: logs.length,
          byStage,
        });
        setRecentLogs(logs.slice(0, 3));
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const quickActions = [
    { label: '🔍 Search candidates', example: '"Find React developers with 3 years experience"', alt: '"Search for senior engineers in California"' },
    { label: '💼 Create a job', example: '"Create a Senior Frontend Engineer position"', alt: '"Open a new Backend Developer role"' },
    { label: '📊 Score a candidate', example: '"Score candidate 5 for the Backend role"', alt: '"Rate John against job 1"' },
    { label: '📝 Screening questions', example: '"Generate interview questions for candidate 3"', alt: '"Create screening questions for Taylor"' },
    { label: '📧 Email candidate', example: '"Email candidate 2 about an interview next Monday"', alt: '"Send interview invite to Sarah for tomorrow at 2pm"' },
    { label: '📋 Move to stage', example: '"Move candidate 4 to interview"', alt: '"I like this candidate" or "Reject candidate 6"' },
    { label: '🔗 Chained commands', example: '"Find Python devs and move the top one to screening"', alt: '"Search React developers and score the best one"' },
    { label: '🧠 Smart context', example: '"Score them for the Senior role"', alt: '"Generate questions for the top candidate"' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
            </h1>
            <p className="mt-1 text-slate-500">
              Voice-powered recruiting at your fingertips
            </p>
          </div>
          {/* Clear conversation button */}
          {conversationHistory.length > 0 && (
            <button
              onClick={clearConversation}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Clear conversation ({conversationHistory.length / 2} exchanges)
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
            <p className="text-sm font-medium text-slate-500">Candidates</p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-16" />
            ) : (
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {stats?.totalCandidates ?? 0}
              </p>
            )}
            <Link href="/candidates" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700">
              View all →
            </Link>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
            <p className="text-sm font-medium text-slate-500">Open Jobs</p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-12" />
            ) : (
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {stats?.totalJobs ?? 0}
              </p>
            )}
            <Link href="/jobs" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700">
              Manage jobs →
            </Link>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
            <p className="text-sm font-medium text-slate-500">In Pipeline</p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-10" />
            ) : (
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {(stats?.byStage?.['screening'] ?? 0) + (stats?.byStage?.['interview'] ?? 0)}
              </p>
            )}
            <Link href="/pipeline" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700">
              View pipeline →
            </Link>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50">
            <p className="text-sm font-medium text-slate-500">Actions Today</p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-8" />
            ) : (
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {stats?.recentActions ?? 0}
              </p>
            )}
            <Link href="/logs" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700">
              View logs →
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Voice Commands */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Voice Commands</h2>
                <p className="text-sm text-slate-500">Try these with the mic button</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickActions.map((action, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                  <p className="text-sm font-medium text-slate-700">{action.label}</p>
                  <p className="mt-1 text-xs text-indigo-600 font-mono">{action.example}</p>
                  {action.alt && (
                    <p className="mt-0.5 text-xs text-slate-400 font-mono">{action.alt}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              <Link href="/logs" className="text-sm text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-500">No recent actions</p>
                <p className="mt-1 text-xs text-slate-400">Use voice commands to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <div className={`h-2 w-2 rounded-full ${log.status === 'ok' || log.status === 'sent' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {log.action_type?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Overview */}
        {stats && Object.keys(stats.byStage).length > 0 && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
            <h2 className="font-semibold text-slate-900 mb-4">Pipeline Overview</h2>
            <div className="flex gap-2">
              {['applied', 'screening', 'interview', 'offer', 'hired'].map(stage => {
                const count = stats.byStage[stage] || 0;
                return (
                  <Link
                    key={stage}
                    href={`/pipeline?stage=${stage}`}
                    className="flex-1 rounded-lg bg-slate-50 p-3 text-center hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-2xl font-semibold text-slate-900">{count}</p>
                    <p className="text-xs text-slate-500 capitalize">{stage}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
