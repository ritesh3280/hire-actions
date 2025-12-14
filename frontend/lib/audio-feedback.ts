/**
 * Audio feedback utilities for voice assistant UX polish
 * Uses Web Audio API to generate sounds without external files
 */

type AudioFeedbackType = 'startRecording' | 'gotIt' | 'error';

// AudioContext singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a beep tone when recording starts
 */
function playStartBeep(): void {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Rising tone: 440Hz to 880Hz (A4 to A5)
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
  
  // Quick fade in/out
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.15);
}

/**
 * Play "Got it" confirmation sound - two ascending tones
 */
function playGotIt(): void {
  const ctx = getAudioContext();
  
  // First tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  gain1.gain.setValueAtTime(0, ctx.currentTime);
  gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.12);
  
  // Second tone (higher)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
  gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
  gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.12);
  gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
  osc2.start(ctx.currentTime + 0.1);
  osc2.stop(ctx.currentTime + 0.25);
}

/**
 * Play error sound - descending tone
 */
function playError(): void {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Descending tone: 400Hz to 200Hz
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(400, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.2);
}

/**
 * Play audio feedback based on type
 */
export function playAudioFeedback(type: AudioFeedbackType): void {
  try {
    switch (type) {
      case 'startRecording':
        playStartBeep();
        break;
      case 'gotIt':
        playGotIt();
        break;
      case 'error':
        playError();
        break;
    }
  } catch (err) {
    // Silently fail - audio feedback is optional UX polish
    console.debug('Audio feedback failed:', err);
  }
}

/**
 * Speak text using Web Speech API
 */
export function speakText(text: string): void {
  try {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.debug('Speech synthesis failed:', err);
  }
}
