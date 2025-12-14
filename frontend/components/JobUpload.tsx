'use client';

import { useEffect, useState } from 'react';
import { createJob, fetchJobs } from '../lib/api';
import type { Job } from '../lib/types';

type Props = {
  onCreated?: (job: Job) => void;
};

export function JobUpload({ onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await fetchJobs();
        setJobs(data);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load jobs.');
      } finally {
        setIsLoading(false);
      }
    }
    loadJobs();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const job = await createJob({ title, description });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      onCreated?.(job);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Job Upload</h2>
      <p className="mt-1 text-sm text-slate-500">Create a job and automatically extract required skills.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Title
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Description
          <textarea
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Saving...' : 'Save Job'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <div className="mt-6 space-y-3">
        <header className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Existing Jobs</p>
          {isLoading && <span className="text-xs text-slate-500">Loading...</span>}
        </header>
        {loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs yet.</p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{job.title}</p>
                  <span className="text-xs text-slate-500">Short ID: {job.short_id ?? '—'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {job.required_skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
