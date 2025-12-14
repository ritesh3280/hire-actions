'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { invokeVoiceAction } from '../lib/api';
import type { VoiceActionResponse } from '../lib/types';

type Props = {
  onResult: (response: VoiceActionResponse) => void;
};

export function VoiceConsole({ onResult }: Props) {
  const [transcript, setTranscript] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaSupported, setMediaSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setMediaSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const fileToBase64 = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const binary = new Uint8Array(buffer);
    let base64 = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < binary.length; i += chunkSize) {
      const chunk = binary.subarray(i, i + chunkSize);
      base64 += String.fromCharCode(...chunk);
    }
    return btoa(base64);
  }, []);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setAudioBase64(null);
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setAudioBase64(base64);
      setError(null);
    } catch (err) {
      setError('Unable to process audio file.');
    }
  }

  function resetRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setRecording(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const base64 = await fileToBase64(new File([blob], 'recording.webm'));
        setAudioBase64(base64);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError('Could not access microphone.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transcript && !audioBase64) {
      setError('Provide a transcript or recording.');
      return;
    }
    setError(null);
    setPendingRequests((count) => count + 1);
    
    const payload: { transcript?: string; audio_base64?: string } = {};
    if (transcript.trim()) {
      payload.transcript = transcript.trim();
    }
    if (!payload.transcript && audioBase64) {
      payload.audio_base64 = audioBase64;
    }

    // Clear inputs immediately to allow new submissions
    setTranscript('');
    setAudioBase64(null);

    // Run in background
    invokeVoiceAction(payload)
      .then((response) => {
        onResult(response);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Voice action failed.');
      })
      .finally(() => {
        setPendingRequests((count) => count - 1);
      });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Voice Actions Console</h2>
      <p className="mt-1 text-sm text-slate-500">Record audio or type a transcript to drive Hire Actions.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Manual Transcript
            <textarea
              rows={3}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Describe the action you want to take..."
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <p className="text-xs text-slate-500">If a transcript is supplied it takes priority over audio.</p>
        </div>
        <div className="space-y-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Upload Audio
            <input type="file" accept="audio/*" onChange={handleFile} className="mt-1 text-sm" />
          </label>
          {audioBase64 && <p className="text-xs text-emerald-600">Audio ready for transcription.</p>}
        </div>
        {mediaSupported && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow ${
                  recording ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {recording ? 'Stop Recording' : 'Record Voice'}
            </button>
            {recording && <span className="text-xs font-semibold text-rose-600">Recording...</span>}
            {!recording && audioBase64 && (
              <button
                type="button"
                onClick={() => {
                  setAudioBase64(null);
                  resetRecording();
                }}
                className="text-xs font-medium text-slate-500 underline"
              >
                Clear audio
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            Send to Hire Actions
          </button>
          {pendingRequests > 0 && (
            <span className="text-xs font-medium text-indigo-600">
              {pendingRequests} request{pendingRequests > 1 ? 's' : ''} in progress...
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </section>
  );
}
