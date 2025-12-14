'use client';

import { ExecutionResult } from '../../components/ExecutionResult';
import { useVoiceAssistant } from '../../components/voice/VoiceAssistantProvider';

export default function VoiceConsolePage() {
  const { responseLog, pendingCount, clearHistory } = useVoiceAssistant();

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Voice Console</h1>
            <p className="mt-1 text-sm text-slate-500">
              {responseLog.length} commands executed
            </p>
          </div>
          {responseLog.length > 0 && (
            <button
              onClick={clearHistory}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              Clear history
            </button>
          )}
        </div>
        
        {pendingCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <span className="text-sm font-medium text-indigo-700">
              Processing {pendingCount} command{pendingCount > 1 ? 's' : ''}...
            </span>
          </div>
        )}
        
        {responseLog.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900">No commands yet</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              Tap the microphone button in the bottom right corner and speak a command to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {responseLog.map((response, index) => (
              <ExecutionResult 
                key={`${response.intent_json?.action ?? 'response'}-${index}`} 
                response={response} 
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
