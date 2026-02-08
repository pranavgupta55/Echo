// src/context/AudioContext.jsx
import { createContext, useContext, useRef, useState, useEffect, useCallback, useMemo } from 'react';

const AudioContextState = createContext(null);
export const useAudio = () => useContext(AudioContextState);

export function AudioProvider({ children }) {
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  
  // State for Spotify-style logic
  const [currentTrack, setCurrentTrack] = useState(null);
  const [manualQueue, setManualQueue] = useState([]); // User-added "Add to Queue"
  const [contextTracks, setContextTracks] = useState([]); // Current sequence (shuffled or ordered)
  const [originalContext, setOriginalContext] = useState([]); // Backup for un-shuffling
  const [contextIndex, setContextIndex] = useState(-1); // Pointer within contextTracks
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);

  // Sync HTML5 Audio element with currentTrack state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      if (isPlaying) audio.play().catch(() => {});
    }
  }, [currentTrack]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    const onEnded = () => next();
    
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [manualQueue, contextTracks, contextIndex]);

  const play = () => { audioRef.current?.play(); setIsPlaying(true); };
  const pause = () => { audioRef.current?.pause(); setIsPlaying(false); };
  const toggle = () => isPlaying ? pause() : play();
  const seek = (t) => { if (audioRef.current) audioRef.current.currentTime = t; };

  // NAVIGATION LOGIC
  const next = useCallback(() => {
    if (manualQueue.length > 0) {
      // 1. Priority: Play from Manual Queue
      const nextTrack = manualQueue[0];
      setManualQueue(prev => prev.slice(1));
      setCurrentTrack(nextTrack);
    } else {
      // 2. Fallback: Play from Context
      const nextIdx = contextIndex + 1;
      if (nextIdx < contextTracks.length) {
        setContextIndex(nextIdx);
        setCurrentTrack(contextTracks[nextIdx]);
      } else {
        setIsPlaying(false);
      }
    }
  }, [manualQueue, contextTracks, contextIndex]);

  const prev = useCallback(() => {
    // Spotify logic: back button usually ignores manual queue and moves in context
    const prevIdx = contextIndex - 1;
    if (prevIdx >= 0) {
      setContextIndex(prevIdx);
      setCurrentTrack(contextTracks[prevIdx]);
    }
  }, [contextTracks, contextIndex]);

  // QUEUE OPERATIONS
  const startContext = useCallback((tracks, startIndex = 0) => {
    setOriginalContext(tracks);
    setContextTracks(tracks);
    setContextIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
    setManualQueue([]); // Clearing manual queue on new playlist start
    setIsShuffle(false);
    setIsPlaying(true);
  }, []);

  const addToQueue = (track) => {
    setManualQueue(prev => [...prev, track]);
  };

  const playNext = (track) => {
    setManualQueue(prev => [track, ...prev]);
  };

  const removeFromManual = (id) => {
    setManualQueue(prev => prev.filter(t => t.id !== id));
  };

  const clearManualQueue = () => setManualQueue([]);

  // SHUFFLE LOGIC
  const toggleShuffle = useCallback(() => {
    if (!isShuffle) {
      // Turn Shuffle ON
      const remaining = [...contextTracks.slice(contextIndex + 1)];
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const newSequence = [...contextTracks.slice(0, contextIndex + 1), ...remaining];
      setContextTracks(newSequence);
      setIsShuffle(true);
    } else {
      // Turn Shuffle OFF
      const currentId = currentTrack?.id;
      const originalIdx = originalContext.findIndex(t => t.id === currentId);
      setContextTracks(originalContext);
      setContextIndex(originalIdx);
      setIsShuffle(false);
    }
  }, [isShuffle, contextTracks, contextIndex, originalContext, currentTrack]);

  const value = useMemo(() => ({
    currentTrack, manualQueue, contextTracks, contextIndex,
    isPlaying, currentTime, duration, isShuffle,
    play, pause, toggle, next, prev, seek,
    startContext, addToQueue, playNext, removeFromManual, clearManualQueue, toggleShuffle
  }), [currentTrack, manualQueue, contextTracks, contextIndex, isPlaying, currentTime, duration, isShuffle, next, prev, toggleShuffle]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
