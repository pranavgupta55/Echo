// src/context/AudioContext.jsx
import { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';

const AudioContextState = createContext(null);
export const useAudio = () => useContext(AudioContextState);

export function AudioProvider({ children }) {
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  const [queue, setQueueState] = useState([]); // [{ id, title, artist, url }]
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);

  const loadCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;
    const track = queue[currentIndex];
    if (!track) return;
    if (audio.src !== track.url) {
      audio.src = track.url;
      audio.load();
    }
  }, [queue, currentIndex]);

  // Load on track change (NOT on play/pause)
  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  // Wire media events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => next();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { await audio.play(); setIsPlaying(true); } catch {}
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    // Do NOT load(); keeps currentTime where it is
  }, []);

  const toggle = useCallback(() => { isPlaying ? pause() : play(); }, [isPlaying, play, pause]);

  const seek = useCallback((t) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safeDur = Number.isFinite(duration) && duration > 0 ? duration : (audio.duration || 0);
    audio.currentTime = Math.max(0, Math.min(t, safeDur));
  }, [duration]);

  const rewind = useCallback((seconds = 10) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, (audio.currentTime || 0) - seconds);
  }, []);

  const next = useCallback(() => {
    if (!queue.length) return;
    setCurrentIndex((i) => (i + 1 < queue.length ? i + 1 : 0));
  }, [queue.length]);

  const prev = useCallback(() => {
    if (!queue.length) return;
    setCurrentIndex((i) => (i - 1 >= 0 ? i - 1 : Math.max(0, queue.length - 1)));
  }, [queue.length]);

  // Auto-play only when track changes AND was already playing
  useEffect(() => {
    if (!queue.length || !isPlaying) return;
    (async () => { try { await audioRef.current?.play(); } catch {} })();
  }, [currentIndex, queue, isPlaying]);

  const setQueue = useCallback((tracks, startIndex = 0) => {
    setQueueState(tracks || []);
    setCurrentIndex(startIndex);
    // Do not change isPlaying; user decides
  }, []);

  const setQueueAndStart = useCallback((tracks, startIndex = 0) => {
    setQueueState(tracks || []);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
  }, []);

  const addToQueue = useCallback((track) => { setQueueState((q) => [...q, track]); }, []);

  const removeFromQueue = useCallback((id) => {
    setQueueState((q) => {
      const idx = q.findIndex((t) => t.id === id);
      const newQ = q.filter((t) => t.id !== id);
      if (idx === -1) return newQ;
      setCurrentIndex((i) => {
        if (newQ.length === 0) return 0;
        if (idx < i) return Math.max(0, i - 1);
        if (idx === i) return Math.min(i, newQ.length - 1);
        return i;
      });
      return newQ;
    });
  }, []);

  const shuffleQueue = useCallback(() => {
    setQueueState((q) => {
      if (q.length <= 1) return q;
      const current = q[currentIndex];
      const rest = q.filter((_, i) => i !== currentIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      setCurrentIndex(0);
      return [current, ...rest];
    });
    setShuffle(true);
  }, [currentIndex]);

  const value = useMemo(() => ({
    queue, currentIndex, isPlaying, currentTime, duration, shuffle,
    play, pause, toggle, next, prev, seek, rewind,
    setQueue, setQueueAndStart, addToQueue, removeFromQueue, shuffleQueue, setShuffle
  }), [queue, currentIndex, isPlaying, currentTime, duration, shuffle, play, pause, toggle, next, prev, seek, rewind, setQueue, setQueueAndStart, addToQueue, removeFromQueue, shuffleQueue]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
