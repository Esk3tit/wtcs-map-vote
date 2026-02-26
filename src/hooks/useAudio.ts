import { useState, useCallback } from "react";
import { audioManager, type SoundName } from "@/lib/audio";

/**
 * React hook wrapping the AudioManager singleton.
 * Provides reactive muted state for rendering the toggle UI.
 */
export function useAudio() {
  const [muted, setMutedState] = useState(() => audioManager.muted);

  const play = useCallback((name: SoundName) => {
    audioManager.play(name);
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = audioManager.toggleMute();
    setMutedState(newMuted);
  }, []);

  return { play, muted, toggleMute };
}
