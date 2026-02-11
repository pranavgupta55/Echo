import { createContext, useContext, useRef, useState, useEffect, useCallback, useMemo } from 'react';

const AudioContextState = createContext(null);
export const useAudio = () => useContext(AudioContextState);

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
  const [isShuffle, setIsShuffle] = useState(false);

  const play = useCallback(() => { 
    audioRef.current?.play(); 
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

  const next = useCallback(() => {
    if (manualQueue.length > 0) {
      const nextTrack = manualQueue[0];
      setManualQueue(prev => prev.slice(1));
      setCurrentTrack(nextTrack);
    } else {
      const nextIdx = contextIndex + 1;
      if (nextIdx < contextTracks.length) {
        setContextIndex(nextIdx);
        setCurrentTrack(contextTracks[nextIdx]);
      } else {
        setIsPlaying(false);
      }
    }
  }, [manualQueue, contextTracks, contextIndex]);

  // --- MODIFIED: SMART REWIND LOGIC ---
  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Logic: If track is past 5s, restart it. 
    // If before 5s, go to actual previous track.
    if (audio.currentTime > 5) {
      seek(0);
    } else {
      const prevIdx = contextIndex - 1;
      if (prevIdx >= 0) {
        setContextIndex(prevIdx);
        setCurrentTrack(contextTracks[prevIdx]);
      } else {
        // Optional: restart song anyway if it's the first song in playlist
        seek(0);
      }
    }
  }, [contextIndex, contextTracks, seek]);

  // --- NEW: MEDIA SESSION HANDLING (Hardware/Headphone buttons) ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      // Update the UI on the user's OS/Headphones
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Untitled',
        artist: currentTrack.artist || 'Unknown Artist',
        album: 'Echo',
        artwork: [
          { src: '/Logo.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      // Link hardware buttons to our functions
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekto', (details) => seek(details.seekTime));

      // Clean up handlers on unmount or track change
      return () => {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      };
    }
  }, [currentTrack, play, pause, next, prev, seek]);

  // Update Media Session Playback State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.url) return;
    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      if (isPlaying) audio.play().catch(() => {});
    }
  }, [currentTrack]);

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
  }, [next]);

  const startContext = useCallback((tracks, startIndex = 0) => {
    if (!tracks || tracks.length === 0) return;
    setOriginalContext(tracks);
    setContextTracks(tracks);
    setContextIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
    setManualQueue([]); 
    setIsShuffle(false);
    setIsPlaying(true);
  }, []);

  const addToQueue = (track) => {
    if (!track) return;
    setManualQueue(prev => [...prev, track]);
  };

  const playNext = (track) => {
    if (!track) return;
    setManualQueue(prev => [track, ...prev]);
  };

  const removeFromManual = (id) => {
    setManualQueue(prev => prev.filter(t => t.id !== id));
  };

  const clearManualQueue = () => setManualQueue([]);

  const toggleShuffle = useCallback(() => {
    if (!isShuffle) {
      const remaining = [...contextTracks.slice(contextIndex + 1)];
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const newSequence = [...contextTracks.slice(0, contextIndex + 1), ...remaining];
      setContextTracks(newSequence);
      setIsShuffle(true);
    } else {
      const currentId = currentTrack?.id;
      const originalIdx = originalContext.findIndex(t => t.id === currentId);
      setContextTracks(originalContext);
      setContextIndex(originalIdx !== -1 ? originalIdx : 0);
      setIsShuffle(false);
    }
  }, [isShuffle, contextTracks, contextIndex, originalContext, currentTrack]);

  const value = useMemo(() => ({
    currentTrack, manualQueue, contextTracks, contextIndex,
    isPlaying, currentTime, duration, isShuffle,
    play, pause, toggle, next, prev, seek,
    startContext, addToQueue, playNext, removeFromManual, clearManualQueue, toggleShuffle
  }), [currentTrack, manualQueue, contextTracks, contextIndex, isPlaying, currentTime, duration, isShuffle, next, prev, toggleShuffle, play, pause, toggle, seek, startContext]);

  return <AudioContextState.Provider value={value}>{children}</AudioContextState.Provider>;
}
