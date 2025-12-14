'use client';

import { Navigation } from '../components/Navigation';
import { FloatingMic } from '../components/voice/FloatingMic';
import { VoiceOverlay } from '../components/voice/VoiceOverlay';
import { VoiceAssistantProvider } from '../components/voice/VoiceAssistantProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <VoiceAssistantProvider>
      <Navigation />
      {children}
      <FloatingMic />
      <VoiceOverlay />
    </VoiceAssistantProvider>
  );
}
