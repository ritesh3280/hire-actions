'use client';

import { useState } from 'react';
import { uploadCandidate } from '../lib/api';
import type { Candidate } from '../lib/types';

type Props = {
  onCreated?: (candidate: Candidate) => void;
};

export function CandidateUpload({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCandidate, setLastCandidate] = useState<Candidate | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resumeFile) {
      setError('Please attach a resume file.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('resume', resumeFile);
      formData.append('pipeline_stage', 'applied');
      const candidate = await uploadCandidate(formData);
      setLastCandidate(candidate);
      onCreated?.(candidate);
      setName('');
      setEmail('');
      setResumeFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload candidate.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Candidate Upload</h2>
      <p className="mt-1 text-sm text-slate-500">Upload a new candidate with name, email, and resume.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Resume
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            required
            onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
            className="mt-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Saving...' : 'Save Candidate'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      {lastCandidate && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium">Candidate saved</p>
          <p>{lastCandidate.name} · {lastCandidate.email}</p>
          <p className="text-xs text-slate-500">Short ID: {lastCandidate.short_id ?? '—'}</p>
        </div>
      )}
    </section>
  );
}
