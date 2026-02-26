/**
 * AudioManager — singleton for managing voting session sound effects.
 *
 * Preloads all sounds on first import, handles play/mute/toggle,
 * persists mute state to localStorage, and unlocks browser autoplay
 * on first user gesture.
 */

// ============================================================================
// Types
// ============================================================================

export type SoundName =
  | "turn-start"
  | "timer-warning"
  | "timeout-buzzer"
  | "vote-click"
  | "map-banned"
  | "winner-fanfare";

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "wtcs-audio-muted";

const SOUND_FILES: Record<SoundName, string> = {
  "turn-start": "/sounds/turn-start.mp3",
  "timer-warning": "/sounds/timer-warning.mp3",
  "timeout-buzzer": "/sounds/timeout-buzzer.mp3",
  "vote-click": "/sounds/vote-click.mp3",
  "map-banned": "/sounds/map-banned.mp3",
  "winner-fanfare": "/sounds/winner-fanfare.mp3",
};

// ============================================================================
// AudioManager Class
// ============================================================================

class AudioManager {
  private sounds = new Map<SoundName, HTMLAudioElement>();
  private _muted: boolean;
  private unlocked = false;

  constructor() {
    this._muted = this.loadMuteState();
    this.preloadAll();
    this.setupUnlock();
  }

  /** Whether audio is currently muted */
  get muted(): boolean {
    return this._muted;
  }

  /**
   * Play a named sound. Resets to the beginning if already playing.
   * Silently swallows autoplay policy errors.
   */
  play(name: SoundName): void {
    if (this._muted || !this.unlocked) return;

    const audio = this.sounds.get(name);
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — silently skip
    });
  }

  /** Set muted state and persist to localStorage */
  setMuted(muted: boolean): void {
    this._muted = muted;
    this.saveMuteState();
  }

  /** Toggle mute and return the new muted state */
  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private preloadAll(): void {
    for (const [name, src] of Object.entries(SOUND_FILES) as [SoundName, string][]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 0.5;
      audio.load();
      this.sounds.set(name, audio);
    }
  }

  private setupUnlock(): void {
    if (typeof document === "undefined") return;

    const events = ["click", "touchstart", "keydown"] as const;

    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;

      // Play a silent data URI to unlock iOS Safari audio context
      const silent = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      );
      silent.play().then(() => {
        silent.pause();
      }).catch(() => {});
    };

    for (const e of events) {
      document.addEventListener(e, unlock, { capture: true, once: true });
    }
  }

  private loadMuteState(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false; // Default: unmuted
    }
  }

  private saveMuteState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(this._muted));
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const audioManager = new AudioManager();
