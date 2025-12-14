'use client';

import { useEffect, useState } from 'react';
import { CandidateUpload } from '../../components/CandidateUpload';
import { BulkResumeUpload } from '../../components/BulkResumeUpload';
import { deleteCandidate, fetchCandidates, fetchCandidate } from '../../lib/api';

type Note = {
  type: string;
  job_id?: string;
  job_title?: string;
  questions?: Array<{
    question: string;
    evaluates: string;
    good_signal: string;
  }>;
  content?: string;
  created_at?: string;
};

type Candidate = {
  id: string;
  short_id?: number;
  name: string;
  email: string;
  pipeline_stage?: string | null;
  priority?: string | null;
  resume_text?: string;
  notes?: Note[];
  created_at?: string;
};

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  sourcing: { bg: 'bg-gray-100', text: 'text-gray-700' },
  applied: { bg: 'bg-blue-100', text: 'text-blue-700' },
  screening: { bg: 'bg-amber-100', text: 'text-amber-700' },
  interview: { bg: 'bg-purple-100', text: 'text-purple-700' },
  offer: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  hired: { bg: 'bg-green-100', text: 'text-green-700' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function extractResumeHighlights(resumeText: string): {
  skills: string[];
  experience: string[];
  education: string[];
  achievements: string[];
} {
  const text = resumeText.toLowerCase();
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract skills (common tech keywords) - case-insensitive matching
  const skillKeywords = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'C++', 'C', 'Go', 'Rust',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL', 'Redis',
    'Machine Learning', 'Deep Learning', 'AI', 'FastAPI', 'Django', 'Flask', 'Next.js', 'Vue', 'Angular',
    'Git', 'Linux', 'GraphQL', 'REST API', 'WebSockets', 'CI/CD', 'PyTorch', 'TensorFlow',
    'LangChain', 'RAG', 'NLP', 'Computer Vision', 'OCaml', 'Twilio', 'YOLO'
  ];
  const skills = skillKeywords.filter(skill => text.includes(skill.toLowerCase()));

  // Extract bullet points (lines starting with • or -)
  const bulletPoints = lines.filter(line =>
    (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) &&
    line.length > 30
  ).map(line => line.replace(/^[•\-*]\s*/, '').trim());

  // Filter experience bullets (action verbs)
  const experienceVerbs = ['developed', 'built', 'engineered', 'designed', 'created', 'led', 'managed',
    'implemented', 'spearheaded', 'constructed', 'orchestrated', 'integrated', 'delivered', 'reduced',
    'achieved', 'fine-tuned', 'optimized'];
  const experience = bulletPoints
    .filter(b => experienceVerbs.some(v => b.toLowerCase().includes(v)))
    .slice(0, 5);

  // Extract education - look for university/degree patterns
  const eduPatterns = [
    /university\s+of\s+[\w\s]+/i,
    /b\.?s\.?\s+in\s+[\w\s]+/i,
    /m\.?s\.?\s+in\s+[\w\s]+/i,
    /bachelor['']?s?\s+(?:of\s+)?[\w\s]+/i,
    /master['']?s?\s+(?:of\s+)?[\w\s]+/i,
  ];
  const education: string[] = [];
  for (const line of lines) {
    if (line.toLowerCase().includes('university') ||
      line.toLowerCase().includes('college') ||
      line.match(/b\.?s\.?\s+in/i) ||
      line.match(/m\.?s\.?\s+in/i)) {
      // Get this line and maybe the next for context
      const idx = lines.indexOf(line);
      let eduLine = line;
      if (idx + 1 < lines.length && !lines[idx + 1].startsWith('•')) {
        eduLine += ' - ' + lines[idx + 1];
      }
      if (eduLine.length > 20 && !education.some(e => e.includes(line.substring(0, 20)))) {
        education.push(eduLine);
      }
    }
  }

  // Extract achievements (hackathon wins, awards, percentages)
  const achievementPatterns = ['1st place', '2nd place', '3rd place', 'winner', 'award', 'best',
    'reduced', 'increased', 'achieved', '%', 'accuracy'];
  const achievements = bulletPoints
    .filter(b => achievementPatterns.some(p => b.toLowerCase().includes(p)))
    .slice(0, 4);

  return {
    skills: [...new Set(skills)].slice(0, 12),
    experience: experience.slice(0, 4),
    education: education.slice(0, 2),
    achievements: achievements.length > 0 ? achievements : []
  };
}

function CandidateCard({ candidate, onClick, onDelete, isDeleting }: { candidate: Candidate; onClick: () => void; onDelete: () => void; isDeleting: boolean }) {
  const stageStyle = STAGE_COLORS[candidate.pipeline_stage || ''] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const priorityStyle = PRIORITY_COLORS[candidate.priority || ''] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  const highlights = extractResumeHighlights(candidate.resume_text || '');

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer relative group"
      onClick={onClick}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={isDeleting}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
        title="Delete candidate"
      >
        {isDeleting ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>

      <div className="flex items-start justify-between pr-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{candidate.name}</h3>
            {candidate.short_id && (
              <span className="text-xs text-gray-400">#{candidate.short_id}</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{candidate.email}</p>
        </div>
        <div className="flex gap-2">
          {candidate.pipeline_stage && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageStyle.bg} ${stageStyle.text}`}>
              {candidate.pipeline_stage}
            </span>
          )}
          {candidate.priority && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
              {candidate.priority}
            </span>
          )}
        </div>
      </div>

      {/* Skills preview */}
      {highlights.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {highlights.skills.slice(0, 5).map(skill => (
            <span key={skill} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
              {skill}
            </span>
          ))}
          {highlights.skills.length > 5 && (
            <span className="text-xs text-gray-400">+{highlights.skills.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateModal({ candidate: initialCandidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [showFullResume, setShowFullResume] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const highlights = extractResumeHighlights(candidate.resume_text || '');
  const stageStyle = STAGE_COLORS[candidate.pipeline_stage || ''] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const priorityStyle = PRIORITY_COLORS[candidate.priority || ''] || { bg: 'bg-gray-100', text: 'text-gray-600' };

  // Fetch full candidate details (including notes) when modal opens
  useEffect(() => {
    async function loadFullCandidate() {
      try {
        const fullData = await fetchCandidate(initialCandidate.id);
        setCandidate(fullData);
      } catch (err) {
        console.error('Failed to load candidate details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
    loadFullCandidate();
  }, [initialCandidate.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">{candidate.name}</h2>
                {candidate.short_id && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-500">
                    #{candidate.short_id}
                  </span>
                )}
              </div>
              <p className="mt-1 text-gray-600">{candidate.email}</p>
              <div className="mt-2 flex gap-2">
                {candidate.pipeline_stage && (
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${stageStyle.bg} ${stageStyle.text}`}>
                    {candidate.pipeline_stage}
                  </span>
                )}
                {candidate.priority && (
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                    {candidate.priority} priority
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Skills */}
          {highlights.skills.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {highlights.skills.map(skill => (
                  <span key={skill} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Experience */}
          {highlights.experience.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Experience</h3>
              <ul className="space-y-2">
                {highlights.experience.map((exp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-indigo-500 flex-shrink-0">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Achievements */}
          {highlights.achievements && highlights.achievements.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Achievements</h3>
              <ul className="space-y-2">
                {highlights.achievements.map((ach, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-amber-500 flex-shrink-0">🏆</span>
                    <span>{ach}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Education */}
          {highlights.education.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Education</h3>
              <ul className="space-y-2">
                {highlights.education.map((edu, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-emerald-500">🎓</span>
                    <span>{edu}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Screening Questions / Notes */}
          {candidate.notes && candidate.notes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">📝 Notes & Questions</h3>
              <div className="space-y-4">
                {candidate.notes.map((note, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {note.type === 'screening_questions' && note.questions && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-purple-600">💬</span>
                          <span className="text-sm font-medium text-gray-700">
                            Screening Questions for {note.job_title || 'Job'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {note.created_at ? new Date(note.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {note.questions.map((q, qi) => (
                            <li key={qi} className="text-sm">
                              <p className="font-medium text-gray-800">{qi + 1}. {q.question}</p>
                              <p className="text-gray-500 text-xs mt-1">Evaluates: {q.evaluates}</p>
                              <p className="text-green-600 text-xs">✓ Good signal: {q.good_signal}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Resume Toggle */}
          <div>
            <button
              onClick={() => setShowFullResume(!showFullResume)}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {showFullResume ? 'Hide Resume' : 'View Full Resume'}
            </button>

            {showFullResume && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                  {candidate.resume_text}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Added Date */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <p className="text-xs text-gray-500">
            Added {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }) : 'Unknown date'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('bulk');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCandidates = async () => {
    try {
      const data = await fetchCandidates({});
      setCandidates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  async function handleDelete(candidateId: string) {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    setDeletingId(candidateId);
    try {
      await deleteCandidate(candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCandidates = candidates.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.resume_text || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="mx-auto max-w-5xl px-6 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
            <p className="text-gray-500 text-sm mt-1">{candidates.length} total</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Add Candidate
          </button>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="mb-6 space-y-4">
            {/* Upload Mode Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setUploadMode('single')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${uploadMode === 'single'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Single Upload
              </button>
              <button
                onClick={() => setUploadMode('bulk')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${uploadMode === 'bulk'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                📁 Bulk Upload
              </button>
            </div>

            {uploadMode === 'single' ? (
              <CandidateUpload onCreated={() => { loadCandidates(); setShowUpload(false); }} />
            ) : (
              <BulkResumeUpload onComplete={() => { loadCandidates(); }} />
            )}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading candidates...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-gray-600 font-medium">
              {searchQuery ? 'No candidates match your search' : 'No candidates yet'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first candidate to get started'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredCandidates.map(candidate => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onClick={() => setSelectedCandidate(candidate)}
                onDelete={() => handleDelete(candidate.id)}
                isDeleting={deletingId === candidate.id}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        {selectedCandidate && (
          <CandidateModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        )}
      </main>
    </div>
  );
}
