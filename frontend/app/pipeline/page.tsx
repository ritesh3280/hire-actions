'use client';

import { PipelineView } from '../../components/PipelineView';
import { useVoiceAssistant } from '../../components/voice/VoiceAssistantProvider';

export default function PipelinePage() {
  const { pipelineFilters, setPipelineFilters, pipelineFiltersVersion } = useVoiceAssistant();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="mx-auto max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Track candidates through your hiring stages</p>
        </div>
        <PipelineView
          filters={pipelineFilters}
          onFiltersChange={setPipelineFilters}
          refreshToken={pipelineFiltersVersion}
        />
      </main>
    </div>
  );
}
