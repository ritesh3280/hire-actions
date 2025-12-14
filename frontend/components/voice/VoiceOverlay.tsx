'use client';

import { useEffect, useState } from 'react';
import { ExecutionResult } from '../ExecutionResult';
import { useVoiceAssistant } from './VoiceAssistantProvider';

export function VoiceOverlay() {
  const { lastResponse, pendingCount, conversationHistory, clearConversation } = useVoiceAssistant();
  const [isOpen, setIsOpen] = useState(false);
  const [currentResponse, setCurrentResponse] = useState(lastResponse);

  useEffect(() => {
    if (lastResponse) {
      setCurrentResponse(lastResponse);
      setIsOpen(true);
    }
  }, [lastResponse]);

  if (!currentResponse) {
    return null;
  }

  const reasoning = currentResponse.intent_json?.reasoning;
  const explanation = (currentResponse.execution_result as Record<string, unknown>)?.explanation as string | undefined;

  return (
    <div className={`pointer-events-none fixed bottom-6 left-6 z-50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className="pointer-events-auto w-[400px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Latest voice result</p>
            {pendingCount > 0 && <p className="text-xs text-indigo-600">{pendingCount} request{pendingCount > 1 ? 's' : ''} processing...</p>}
          </div>
          <div className="flex items-center gap-2">
            {conversationHistory.length > 0 && (
              <button
                type="button"
                onClick={clearConversation}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Clear conversation memory"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </header>
        
        {/* Why explanation section */}
        {(reasoning || explanation) && (
          <div className="border-b border-slate-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">Why I did this</p>
            {reasoning && (
              <p className="text-sm text-slate-700 mb-1">
                <span className="font-medium text-slate-500">Intent:</span> {reasoning}
              </p>
            )}
            {explanation && (
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-500">Action:</span> {explanation}
              </p>
            )}
          </div>
        )}
        
        {/* Conversation context indicator */}
        {conversationHistory.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-xs text-slate-500">
              <span className="font-medium">Context:</span> {Math.floor(conversationHistory.length / 2)} previous exchange{conversationHistory.length > 2 ? 's' : ''} in memory
            </p>
          </div>
        )}
        
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          <ExecutionResult response={currentResponse} />
        </div>
      </div>
    </div>
  );
}
