// src/components/PlayerControls.jsx
import { useAudio } from '../context/AudioContext.jsx';
import { HiBackward, HiForward, HiPlay, HiPause, HiArrowsRightLeft } from 'react-icons/hi2';

const fmt = (t) => {
  const s = Math.max(0, Math.floor(t || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export default function PlayerControls({ floating = false }) {
  const { queue, currentIndex, isPlaying, currentTime, duration, toggle, next, prev, seek, rewind, shuffle, shuffleQueue } = useAudio();

  return (
    <div className={`${floating ? 'rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl' : ''} p-4`}>
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <button onClick={() => rewind(10)} className="p-2 sm:p-3 rounded-xl hover:bg-white/10" title="Rewind 10s">
          <HiBackward className="w-6 h-6 sm:w-7 sm:h-7 rotate-180" />
        </button>
        <button onClick={prev} className="p-2 sm:p-3 rounded-xl hover:bg-white/10" title="Previous">
          <HiBackward className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
        <button onClick={toggle} className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-white text-black shadow-lg" title="Play/Pause">
          {isPlaying ? <HiPause className="w-6 h-6" /> : <HiPlay className="w-6 h-6 translate-x-0.5" />}
        </button>
        <button onClick={next} className="p-2 sm:p-3 rounded-xl hover:bg-white/10" title="Next">
          <HiForward className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
        <button onClick={shuffleQueue} className={`p-2 sm:p-3 rounded-xl hover:bg-white/10 ${shuffle ? 'text-white' : 'text-gray-400'}`} title="Shuffle">
          <HiArrowsRightLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="w-10 text-xs tabular-nums text-gray-300">{fmt(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime || 0}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full accent-white"
        />
        <span className="w-10 text-xs tabular-nums text-gray-300">{fmt(duration)}</span>
      </div>
      <div className="text-sm text-gray-300 text-center mt-2 truncate">
        {queue[currentIndex]?.title || 'No track selected'}
      </div>
    </div>
  );
}
