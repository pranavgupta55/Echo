import { createContext, useContext, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

const AudioContextState = createContext(null);
export const useAudio = () => useContext(AudioContextState);

// Helper to shuffle an array
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function AudioProvider({ children }) {
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  
  const [currentTrack, setCurrentTrack] = useState(null);
  const [manualQueue, setManualQueue] = useState([]);
  const [contextTracks, setContextTracks] = useState([]); 
  const [originalContext, setOriginalContext] = useState([]); 
  const [contextIndex, setContextIndex] = useState(-1);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(true); // Default to true per request
  
  const [repeatCount, setRepeatCount] = useState(0);

  const play = useCallback(() => { 
    audioRef.current?.play().catch(e => console.error("Play error:", e)); 
    setIsPlaying(true); 
  }, []);

  const pause = useCallback(() => { 
    audioRef.current?.pause(); 
    setIsPlaying(false); 
  }, []);

  const toggle = useCallback(() => isPlaying ? pause() : play(), [isPlaying, pause, play]);
  
  const seek = useCallback((t) => { 
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  // --- QUEUE MANAGEMENT & REFILL LOGIC ---
  const next = useCallback(() => {
    // 1. Check Manual Queue
    if (manualQueue.length > 0) {
      const nextTrack = manualQueue[0];
      setManualQueue(prev => prev.slice(1));
      setCurrentTrack(nextTrack);
      return;
    } 

    // 2. Determine next index in Context
    const nextIdx = contextIndex + 1;

    // 3. REFILL LOGIC: If running low on songs, append shuffled copy of original
    // Use functional state to ensure we have latest tracks if called rapidly
    setContextTracks(currentContext => {
      const remaining = currentContext.length - nextIdx;
      if (remaining < 20 && originalContext.length > 0) {
        // Refill with a shuffled copy of the original playlist
        const freshBatch = shuffleArray(originalContext);
        return [...currentContext, ...freshBatch];
      }
      return currentContext;
    });

    // 4. Advance
    // Note: We read from state here, but since we just triggered a state update 
    // for refill, we trust React/logic flow. If contextTracks updates, the index 
    // is still valid relative to the start.
    if (nextIdx < contextTracks.length + (originalContext.length > 0 ? originalContext.length : 0)) {
        setContextIndex(nextIdx);
        // If we just refilled, contextTracks isn't updated in this closure yet, 
        // but we can grab from original logic or just rely on the fact that 
        // we likely have enough tracks anyway if refill logic triggers.
        // To be safe, we access the track via effect or wait for render, 
        // but typically setting state works. For safety with async state:
        const trackToPlay = contextTracks[nextIdx] || originalContext[0]; // Fallback safety
        setCurrentTrack(trackToPlay);
    } else {
      setIsPlaying(false);
    }
  }, [manualQueue, contextIndex, contextTracks, originalContext]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.currentTime > 5) {
      seek(0);
    } else {
      const prevIdx = contextIndex - 1;
      if (prevIdx >= 0) {
        setContextIndex(prevIdx);
        setCurrentTrack(contextTracks[prevIdx]);
      } else {
        seek(0);
      }
    }
  }, [contextIndex, contextTracks, seek]);

  // --- REPEAT BUTTON LOGIC ---
  const incrementRepeat = useCallback(() => {
    setRepeatCount(c => c + 1);
  }, []);

  // --- HANDLE ENDED EVENT ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatCount > 0) {
        // Repeat mode active: rewind, play, decrement
        setRepeatCount(c => c - 1);
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Replay error:", e));
      } else {
        // Normal mode
        next();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [repeatCount, next]); // Re-bind when repeatCount changes

  // --- JIT URL SIGNING (Fixes 30min freeze) ---
  useEffect(() => {
    let active = true;
    
    const loadTrackSrc = async () => {
      if (!currentTrack) return;

      let srcToPlay = currentTrack.url;

      // If no pre-signed URL, generate one now
      if (!srcToPlay && currentTrack.storage_path) {
        const { data, error } = await supabase.storage
          .from('songs')
          .createSignedUrls([currentTrack.storage_path], 3600); // Valid for 1 hour
        
        if (!error && data && data[0]) {
          srcToPlay = data[0].signedUrl;
        }
      }

      if (active && audioRef.current && srcToPlay) {
        // Only reload if the source actually changed to avoid blips
        if (audioRef.current.src !== srcToPlay) {
          audioRef.current.src = srcToPlay;
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(e => console.error("JIT Play error:", e));
          }
        }
      }
    };

    loadTrackSrc();
    return () => { active = false; };
  }, [currentTrack]); // Only run when the track object changes

  // --- MEDIA SESSION HANDLERS ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Untitled',
        artist: currentTrack.artist || 'Unknown Artist',
        album: 'Echo',
        artwork: [{ src: '/Logo.png', sizes: '512x512', type: 'image/png' }]
      });

      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekto', (d) => seek(d.seekTime));

      return () => {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      };
    }
  }, [currentTrack, play, pause, next, prev, seek]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // --- TIME UPDATE HANDLER ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    audio.addEventListener('timeupdate', onTime);
    return () => audio.removeEventListener('timeupdate', onTime);
  }, []);

  const startContext = useCallback((tracks, startIndex = 0, autoPlay = true) => {
    if (!tracks || tracks.length === 0) return;
    
    setOriginalContext(tracks);
    setContextTracks(tracks);
    setContextIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
    setManualQueue([]); 
    setIsShuffle(true); // Default to shuffle on new context
    setRepeatCount(0); // Reset repeat on new playlist
    
    if (autoPlay) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, []);

  const addToQueue = (track) => { if (track) setManualQueue(prev => [...prev, track]); };
  const playNext = (track) => { if (track) setManualQueue(prev => [track, ...prev]); };
  const removeFromManual = (id) => setManualQueue(prev => prev.filter(t => t.id !== id));
  const clearManualQueue = () => setManualQueue([]);

  const toggleShuffle = useCallback(() => {
    if (!isShuffle) {
      // Turn Shuffle ON
      const remaining = [...contextTracks.slice(contextIndex + 1)];
      const shuffled = shuffleArray(remaining);
      const newSequence = [...contextTracks.slice(0, contextIndex + 1), ...shuffled];
      setContextTracks(newSequence);
      setIsShuffle(true);
    } else {
      // Turn Shuffle OFF (Revert to original order relative to current song)
      const currentId = currentTrack?.id;
      const originalIdx = originalContext.findIndex(t => t.id === currentId);
      setContextTracks(originalContext);
      setContextIndex(originalIdx !== -1 ? originalIdx : 0);
      setIsShuffle(false);
    }
  }, [isShuffle, contextTracks, contextIndex, originalContext, currentTrack]);

  const value = useMemo(() => ({
    currentTrack, manualQueue, contextTracks, contextIndex,
    isPlaying, currentTime, duration, isShuffle, repeatCount,
    play, pause, toggle, next, prev, seek,
    startContext, addToQueue, playNext, removeFromManual, clearManualQueue, toggleShuffle, incrementRepeat
  }), [currentTrack, manualQueue, contextTracks, contextIndex, isPlaying, currentTime, duration, isShuffle, repeatCount, next, prev, toggleShuffle, play, pause, toggle, seek, startContext, incrementRepeat]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
