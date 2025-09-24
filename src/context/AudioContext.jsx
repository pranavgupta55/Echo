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

  // History for UI (previous songs) and navigation
  const [previousTracks, setPreviousTracks] = useState([]); // [{id,title,artist,url}]
  const watchdogRef = useRef(null);

  const currentTrack = queue[currentIndex];

  const loadCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;
    const track = queue[currentIndex];
    if (!track) return;
    if (audio.src !== track.url) {
      audio.src = track.url;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.load();
    }
  }, [queue, currentIndex]);

  useEffect(() => { loadCurrent(); }, [loadCurrent]); // load only on source change [web:214]

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      const dur = audio.duration || 0;
      setDuration(dur);
      // Near-end watchdog for iOS background regressions
      if (dur && audio.currentTime >= dur - 0.25 && isPlaying) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
          if (!audio.paused && audio.currentTime >= dur - 0.25) handleEnded();
        }, 500);
      }
    };

    const handleEnded = () => {
      next(true);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', handleEnded);
      clearTimeout(watchdogRef.current);
    };
  }, [isPlaying]); // iOS background mitigation [web:233]

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { await audio.play(); setIsPlaying(true); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; } catch {}
  }, []); // Media Session state keeps OS controls in sync [web:213]

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []); // Media Session playbackState update [web:213]

  const toggle = useCallback(() => { isPlaying ? pause() : play(); }, [isPlaying, play, pause]); // toggle [web:214]

  const seek = useCallback((t) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safeDur = Number.isFinite(duration) && duration > 0 ? duration : (audio.duration || 0);
    audio.currentTime = Math.max(0, Math.min(t, safeDur));
  }, [duration]); // bounded seek [web:214]

  const rewind = useCallback((seconds = 10) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, (audio.currentTime || 0) - seconds);
  }, []); // seekbackward action target [web:213]

  const recordPrevious = useCallback((idx) => {
    const t = queue[idx];
    if (!t) return;
    setPreviousTracks((arr) => {
      const next = [...arr, t];
      return next.slice(-50); // keep last 50
    });
  }, [queue]); // keep limited history for UI [web:214]

  const next = useCallback((auto = false) => {
    if (!queue.length) return;
    recordPrevious(currentIndex);
    setCurrentIndex((i) => (i + 1 < queue.length ? i + 1 : 0));
    setTimeout(() => {
      if (auto || isPlaying) {
        audioRef.current?.play().catch(() => {});
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    }, 0);
  }, [queue.length, currentIndex, isPlaying, recordPrevious]); // advance and auto-play [web:214]

  const prev = useCallback(() => {
    // Prefer last item from history if present
    setPreviousTracks((arr) => {
      if (!arr.length) {
        setCurrentIndex((i) => (i - 1 >= 0 ? i - 1 : Math.max(0, queue.length - 1)));
        setTimeout(() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }, 0);
        return arr;
      }
      const prior = arr[arr.length - 1];
      const idxInQueue = queue.findIndex((t) => t.id === prior.id);
      if (idxInQueue >= 0) {
        setCurrentIndex(idxInQueue);
        setTimeout(() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }, 0);
        return arr.slice(0, -1);
      }
      // If not in queue, insert just before current and jump
      setQueueState((q) => {
        const clone = [...q];
        clone.splice(Math.max(0, currentIndex), 0, prior);
        setCurrentIndex(Math.max(0, currentIndex));
        setTimeout(() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }, 0);
        return clone;
      });
      return arr.slice(0, -1);
    });
  }, [queue, isPlaying, currentIndex]); // true previous behavior for hardware button [web:213]

  useEffect(() => { if (!queue.length || !isPlaying) return; audioRef.current?.play().catch(() => {}); }, [currentIndex, queue, isPlaying]); // play when track changes [web:214]

  const setQueue = useCallback((tracks, startIndex = 0) => {
    setQueueState(tracks || []);
    setCurrentIndex(startIndex);
  }, []); // passive set [web:214]

  const setQueueAndStart = useCallback((tracks, startIndex = 0) => {
    setQueueState(tracks || []);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
  }, []); // auto-start [web:214]

  const addToQueue = useCallback((track) => { setQueueState((q) => [...q, track]); }, []); // append [web:214]

  const insertNextAndPlay = useCallback((track) => {
    setQueueState((q) => {
      const exists = q.findIndex((t) => t.id === track.id);
      let arr = [...q];
      // Move if exists, else insert after current
      if (exists >= 0) {
        const [m] = arr.splice(exists, 1);
        arr.splice(currentIndex + 1, 0, m);
      } else {
        arr.splice(currentIndex + 1, 0, track);
      }
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
      setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 0);
      return arr;
    });
  }, [currentIndex]); // click to play & add to queue [web:214]

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
  }, []); // maintain index after removal [web:214]

  const reorderQueue = useCallback((from, to) => {
    setQueueState((q) => {
      const arr = [...q];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      setCurrentIndex((i) => {
        if (from === i) return to;
        if (from < i && to >= i) return i - 1;
        if (from > i && to <= i) return i + 1;
        return i;
      });
      return arr;
    });
  }, []); // drag/drop reorder [web:214]

  // Media Session metadata + action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const t = currentTrack;
    if (t) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || 'Unknown', artist: t.artist || '', album: 'Echo' });
        navigator.mediaSession.setPositionState?.({ duration: duration || 0, playbackRate: 1, position: currentTime || 0 });
      } catch {}
    }
  }, [currentTrack, currentTime, duration]); // show correct track to OS [web:213]

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch {} };
    set('play', async () => { await play(); navigator.mediaSession.playbackState = 'playing'; });
    set('pause', () => { pause(); navigator.mediaSession.playbackState = 'paused'; });
    set('nexttrack', () => next());
    set('previoustrack', () => prev());
    set('seekbackward', (e) => { const off = e?.seekOffset || 10; seek(Math.max(0, (audioRef.current?.currentTime || 0) - off)); });
    set('seekforward', (e) => { const off = e?.seekOffset || 10; seek((audioRef.current?.currentTime || 0) + off); });
    set('seekto', (e) => { if (typeof e?.seekTime === 'number') seek(e.seekTime); });
  }, [play, pause, next, prev, seek]); // hardware control support [web:213]

  const playAt = useCallback((idx) => {
    if (!queue.length) return;
    const prevIdx = currentIndex;
    const prevTrack = queue[prevIdx];
    if (prevTrack) setPreviousTracks((arr) => [...arr, prevTrack].slice(-50));
    setCurrentIndex(Math.max(0, Math.min(idx, queue.length - 1)));
    setIsPlaying(true);
    setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 0);
  }, [queue.length, currentIndex]); // tap to play [web:214]

  const value = useMemo(() => ({
    queue, currentIndex, isPlaying, currentTime, duration, shuffle, currentTrack, previousTracks,
    play, pause, toggle, next, prev, seek, rewind,
    setQueue, setQueueAndStart, addToQueue, insertNextAndPlay, removeFromQueue, reorderQueue, shuffleQueue, setShuffle,
    playAt
  }), [queue, currentIndex, isPlaying, currentTime, duration, shuffle, currentTrack, previousTracks, play, pause, toggle, next, prev, seek, rewind, setQueue, setQueueAndStart, addToQueue, insertNextAndPlay, removeFromQueue, reorderQueue, shuffleQueue, playAt]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
