'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchCandidates } from '../lib/api';
import type { Candidate } from '../lib/types';

type Filters = {
  pipeline_stage: string | null;
  priority: string | null;
};

type Props = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  refreshToken: number;
};

const STAGES = ['sourcing', 'applied', 'screening', 'interview', 'offer', 'hired'];
const PRIORITIES = ['high', 'medium', 'low'];

export function PipelineView({ filters, onFiltersChange, refreshToken }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => ({
    pipeline_stage: filters.pipeline_stage ?? undefined,
    priority: filters.priority ?? undefined,
  }), [filters]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCandidates(query);
        setCandidates(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load candidates.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [query.pipeline_stage, query.priority, refreshToken]);

  function updateFilter(key: keyof Filters, value: string | null) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Stage</span>
            <select
              value={filters.pipeline_stage ?? ''}
              onChange={(event) => updateFilter('pipeline_stage', event.target.value || null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Priority</span>
            <select
              value={filters.priority ?? ''}
              onChange={(event) => updateFilter('priority', event.target.value || null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="text-sm text-gray-500">{candidates.length} candidates</span>
      </header>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-gray-500 text-sm">No candidates found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{candidate.name}</td>
                  <td className="px-4 py-3 text-gray-600">{candidate.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {candidate.pipeline_stage ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{candidate.priority ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
