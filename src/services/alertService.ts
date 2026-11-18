import type { AlertLevel } from '../types/gas';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Reproduce un aviso sonoro sintetizado con Web Audio API (sin archivos externos).
 */
export function playAlertChime(level: Exclude<AlertLevel, 'ok'>): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const tones =
      level === 'danger'
        ? [
            { freq: 880, start: 0, dur: 0.14 },
            { freq: 660, start: 0.18, dur: 0.14 },
            { freq: 880, start: 0.36, dur: 0.22 },
          ]
        : [
            { freq: 587.33, start: 0, dur: 0.14 },
            { freq: 783.99, start: 0.18, dur: 0.18 },
          ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = level === 'danger' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.16, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.02);
    }
  } catch {
    // El navegador puede bloquear audio antes de la primera interacción del usuario
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendBrowserNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'gas-zero-alert',
    });
  } catch {
    // Algunos contextos móviles restringen new Notification() sin Service Worker
  }
}
