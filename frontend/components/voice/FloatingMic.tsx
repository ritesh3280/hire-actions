'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceAssistant } from './VoiceAssistantProvider';
import { playAudioFeedback } from '../../lib/audio-feedback';

type MediaState = 'idle' | 'recording' | 'processing' | 'error';

const SPEECH_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1200;
const VAD_SAMPLE_INTERVAL_MS = 200;

export function FloatingMic() {
  const { runVoiceCommand, pendingCount } = useVoiceAssistant();
  const [mediaState, setMediaState] = useState<MediaState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cleanupStreamRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const lastSpeechRef = useRef<number>(0);
  const hasDetectedSpeechRef = useRef<boolean>(false);

  const resetState = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    if (cleanupStreamRef.current) {
      cleanupStreamRef.current();
      cleanupStreamRef.current = null;
    }
    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    hasDetectedSpeechRef.current = false;
    setMediaState('idle');
  }, []);

  useEffect(() => () => resetState(), [resetState]);

  const blobToBase64 = useCallback(async (blob: Blob) => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    hasDetectedSpeechRef.current = false;
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Microphone not supported in this browser.');
      setMediaState('error');
      playAudioFeedback('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Play start recording beep
      playAudioFeedback('startRecording');

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        try {
          setMediaState('processing');
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const audioBase64 = await blobToBase64(blob);
          const result = await runVoiceCommand({ audio_base64: audioBase64 });

          // Play "Got it" confirmation after successful processing
          if (result) {
            playAudioFeedback('gotIt');
          }
        } catch (error) {
          console.error(error);
          setMessage('Voice command failed.');
          playAudioFeedback('error');
        } finally {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          cleanupStreamRef.current = null;
          if (vadIntervalRef.current) {
            window.clearInterval(vadIntervalRef.current);
            vadIntervalRef.current = null;
          }
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => undefined);
            audioContextRef.current = null;
          }
          analyserRef.current = null;
          setMediaState('idle');
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      hasDetectedSpeechRef.current = false;
      lastSpeechRef.current = performance.now();

      vadIntervalRef.current = window.setInterval(() => {
        const analyserNode = analyserRef.current;
        if (!analyserNode || mediaRecorderRef.current?.state !== 'recording') {
          return;
        }
        const buffer = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const sample = buffer[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        const now = performance.now();
        if (rms > SPEECH_THRESHOLD) {
          hasDetectedSpeechRef.current = true;
          lastSpeechRef.current = now;
        } else if (hasDetectedSpeechRef.current && now - lastSpeechRef.current > SILENCE_DURATION_MS) {
          stopRecording();
        }
      }, VAD_SAMPLE_INTERVAL_MS);

      cleanupStreamRef.current = () => {
        if (vadIntervalRef.current) {
          window.clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => undefined);
          audioContextRef.current = null;
        }
        analyserRef.current = null;
      };
      setMediaState('recording');
      setMessage(null);
    } catch (error) {
      console.error(error);
      setMediaState('error');
      setMessage('Microphone access was denied.');
      playAudioFeedback('error');
    }
  }, [blobToBase64, runVoiceCommand, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (mediaState === 'processing') {
      return;
    }
    if (mediaState === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  }, [mediaState, startRecording, stopRecording]);

  // Keyboard shortcut: Ctrl/Cmd + Shift + Space to toggle recording
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Check for Ctrl+Shift+Space or Cmd+Shift+Space
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault();
        toggleRecording();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  const stateLabel = mediaState === 'recording' ? 'Listening... (⌘⇧Space to stop)' : 'Tap or ⌘⇧Space to speak';
  const pendingLabel = pendingCount > 0 ? `${pendingCount} processing...` : null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {(message || pendingLabel || mediaState === 'recording') && (
        <div className="pointer-events-auto rounded-lg bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-100 shadow-lg">
          {mediaState === 'recording' ? stateLabel : pendingLabel ?? message}
        </div>
      )}
      <button
        type="button"
        onClick={toggleRecording}
        className={`pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${mediaState === 'recording' ? 'scale-110 bg-rose-600 text-white hover:bg-rose-700 animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        aria-pressed={mediaState === 'recording'}
        aria-label={mediaState === 'recording' ? 'Stop listening' : 'Start voice command'}
      >
        {mediaState === 'recording' ? (
          /* Stop/Recording icon */
          <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : mediaState === 'processing' ? (
          /* Loading spinner */
          <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          /* Microphone icon */
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
