// src/context/AudioContext.jsx
import { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';

const AudioContextState = createContext(null);
export const useAudio = () => useContext(AudioContextState);

// Windowing caps
const PREV_MAX = 20;        // keep last 20 previously played
const NEXT_MAX = 20;        // keep at most 20 upcoming
const VISIBLE_NEXT = 5;     // show only next 5 in UI (store up to 20)

export function AudioProvider({ children }) {
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);

  const [queue, setQueueState] = useState([]); // windowed: [current, next...<=20]
  const [currentIndex, setCurrentIndex] = useState(0); // always 0 after windowing
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);

  const [previousTracks, setPreviousTracks] = useState([]); // capped to PREV_MAX
  const watchdogRef = useRef(null);

  const currentTrack = queue[currentIndex];

  // Helpers to maintain the window: keep current at index 0, then up to NEXT_MAX upcoming
  const enforceWindow = useCallback((arr, curIdx) => {
    if (!arr.length) return [];
    const cur = arr[curIdx] ?? arr[0];
    const next = arr.slice(curIdx + 1, curIdx + 1 + NEXT_MAX);
    return [cur, ...next];
  }, []);

  // Safe load of current track into the audio element
  const loadCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;
    const track = queue[0]; // after windowing current is at 0
    if (!track) return;
    if (audio.src !== track.url) {
      audio.src = track.url;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.load();
    }
  }, [queue]);

  useEffect(() => { loadCurrent(); }, [loadCurrent]); // load only on source change

  // Core media events + iOS near-end watchdog
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      const dur = audio.duration || 0;
      setDuration(dur);
      if (dur && audio.currentTime >= dur - 0.25 && isPlaying) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
          if (!audio.paused && audio.currentTime >= dur - 0.25) handleEnded();
        }, 500);
      }
    };

    const handleEnded = () => { next(true); };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', handleEnded);
      clearTimeout(watchdogRef.current);
    };
  }, [isPlaying]); // mitigates iOS background “ended” gaps

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { await audio.play(); setIsPlaying(true); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; } catch {}
  }, []); // keep OS controls synced

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []); // OS controls state

  const toggle = useCallback(() => { isPlaying ? pause() : play(); }, [isPlaying, play, pause]);

  const seek = useCallback((t) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safeDur = Number.isFinite(duration) && duration > 0 ? duration : (audio.duration || 0);
    audio.currentTime = Math.max(0, Math.min(t, safeDur));
  }, [duration]); // bounded seek

  const rewind = useCallback((seconds = 10) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, (audio.currentTime || 0) - seconds);
  }, []);

  // Advance: push current into previous (cap PREV_MAX), shift next window
  const next = useCallback((auto = false) => {
    if (!queue.length) return;
    const cur = queue[0];
    setPreviousTracks((arr) => [...arr, cur].slice(-PREV_MAX));
    setQueueState((q) => {
      const upcoming = q.slice(1); // already windowed
      const newArr = enforceWindow(upcoming, 0); // next becomes current at index 0
      return newArr;
    });
    setCurrentIndex(0);
    setTimeout(() => {
      if (auto || isPlaying) {
        audioRef.current?.play().catch(() => {});
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    }, 0);
  }, [queue, isPlaying, enforceWindow]);

  // Previous: pop from history (cap PREV_MAX), insert back as current
  const prev = useCallback(() => {
    setPreviousTracks((arr) => {
      if (!arr.length) return arr;
      const prior = arr[arr.length - 1];
      setQueueState((q) => {
        const rest = q.length ? q.slice(0) : [];
        // Put prior back as current, shift existing current/right window down (trim tail to NEXT_MAX)
        const combined = [prior, ...rest].slice(0, 1 + NEXT_MAX);
        return combined;
      });
      setCurrentIndex(0);
      setTimeout(() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }, 0);
      return arr.slice(0, -1);
    });
  }, [isPlaying]); // true previous using history

  // Play if already playing when current changes
  useEffect(() => { if (!queue.length || !isPlaying) return; audioRef.current?.play().catch(() => {}); }, [queue, isPlaying]);

  // Initialize windowed queue (take current + up to NEXT_MAX next)
  const setQueue = useCallback((tracks, startIndex = 0) => {
    if (!tracks?.length) { setQueueState([]); setCurrentIndex(0); return; }
    const bounded = enforceWindow(tracks, Math.max(0, Math.min(startIndex, tracks.length - 1)));
    setQueueState(bounded);
    setCurrentIndex(0);
  }, [enforceWindow]);

  const setQueueAndStart = useCallback((tracks, startIndex = 0) => {
    setQueue(tracks, startIndex);
    setIsPlaying(true);
  }, [setQueue]); // auto-start

  // Append to tail (still trimmed to NEXT_MAX)
  const addToQueue = useCallback((track) => {
    setQueueState((q) => {
      if (!q.length) return [track];
      const cur = q[0];
      const upcoming = q.slice(1);
      const unique = upcoming.filter((t) => t.id !== track.id);
      const next = [...unique, track].slice(0, NEXT_MAX);
      return [cur, ...next];
    });
  }, []); // bounded append

  // Insert at visible slot and play it immediately; discard old 20th
  const insertAtVisibleSlotAndPlay = useCallback((track) => {
    setQueueState((q) => {
      if (!q.length) return [track];
      const cur = q[0];
      const upcoming = q.slice(1);
      const filtered = upcoming.filter((t) => t.id !== track.id);
      const insertPos = Math.min(VISIBLE_NEXT, filtered.length); // 0..5 within upcoming
      const next = [...filtered.slice(0, insertPos), track, ...filtered.slice(insertPos)].slice(0, NEXT_MAX);
      setCurrentIndex(0);     // current stays at 0; we want the inserted item to be next to play
      setIsPlaying(true);
      // Jump to the inserted item if wanting immediate playback:
      setTimeout(() => {
        // Make inserted item the new current by rebuilding the window
        const rest = next.filter((t) => t.id !== track.id);
        setQueueState([track, ...rest.slice(0, NEXT_MAX)]);
        audioRef.current?.play().catch(() => {});
      }, 0);
      return [cur, ...next];
    });
  }, []); // windowed insert & promote

  // Remove an item from upcoming window
  const removeFromQueue = useCallback((id) => {
    setQueueState((q) => {
      if (!q.length) return q;
      const cur = q[0];
      const filtered = q.slice(1).filter((t) => t.id !== id);
      return [cur, ...filtered];
    });
  }, []);

  // Drag & drop reorder within upcoming window
  const reorderQueue = useCallback((fromAbs, toAbs) => {
    // Absolute indices relative to full window where 0 is current; we only support >=1 moves
    if (fromAbs === 0 || toAbs === 0) return;
    setQueueState((q) => {
      const cur = q[0];
      const up = q.slice(1);
      const from = fromAbs - 1;
      const to = toAbs - 1;
      const arr = [...up];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return [cur, ...arr];
    });
  }, []);

  // Shuffle upcoming (keep current at index 0)
  const shuffleQueue = useCallback(() => {
    setQueueState((q) => {
      if (q.length <= 2) return q;
      const cur = q[0];
      const up = [...q.slice(1)];
      for (let i = up.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [up[i], up[j]] = [up[j], up[i]];
      }
      return [cur, ...up];
    });
    setShuffle(true);
  }, []); // keep window size

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
  }, [currentTrack, currentTime, duration]);

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
  }, [play, pause, next, prev, seek]); // hardware controls

  // Tap to immediately play a specific item (rebuild window)
  const playAt = useCallback((idxInWindow) => {
    setQueueState((q) => {
      if (!q.length) return q;
      const picked = q[idxInWindow] ?? q[0];
      const others = q.filter((_, i) => i !== idxInWindow);
      const newQ = [picked, ...others.slice(0, NEXT_MAX)];
      setIsPlaying(true);
      setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 0);
      return newQ;
    });
    setCurrentIndex(0);
  }, []); // tap-to-play within window

  const value = useMemo(() => ({
    queue, currentIndex, isPlaying, currentTime, duration, shuffle, currentTrack, previousTracks,
    play, pause, toggle, next, prev, seek, rewind,
    setQueue, setQueueAndStart, addToQueue, insertAtVisibleSlotAndPlay, removeFromQueue, reorderQueue, shuffleQueue, setShuffle,
    playAt, VISIBLE_NEXT, NEXT_MAX, PREV_MAX
  }), [queue, currentIndex, isPlaying, currentTime, duration, shuffle, currentTrack, previousTracks, play, pause, toggle, next, prev, seek, rewind, setQueue, setQueueAndStart, addToQueue, insertAtVisibleSlotAndPlay, removeFromQueue, reorderQueue, shuffleQueue, playAt]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
