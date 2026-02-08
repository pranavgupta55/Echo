import { useAudio } from '../context/AudioContext.jsx';
import { HiBackward, HiForward, HiPlay, HiPause, HiArrowsRightLeft } from 'react-icons/hi2';

const fmt = (t) => {
  const s = Math.max(0, Math.floor(t || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export default function PlayerControls({ floating = false }) {
  const { currentTrack, isPlaying, currentTime, duration, toggle, next, prev, seek, isShuffle, toggleShuffle } = useAudio();

  return (
    <div className={`${floating ? 'rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl' : ''} p-6`}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-6 sm:gap-8">
          <button 
            onClick={toggleShuffle} 
            className={`p-2 transition-colors ${isShuffle ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
            title="Toggle Shuffle"
          >
            <HiArrowsRightLeft className="w-5 h-5" />
          </button>
          
          <button onClick={prev} className="p-2 text-gray-300 hover:text-white transition-colors" title="Previous">
            <HiBackward className="w-7 h-7" />
          </button>
          
          <button onClick={toggle} className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg" title="Play/Pause">
            {isPlaying ? <HiPause className="w-6 h-6" /> : <HiPlay className="w-6 h-6 translate-x-0.5" />}
          </button>
          
          <button onClick={next} className="p-2 text-gray-300 hover:text-white transition-colors" title="Next">
            <HiForward className="w-7 h-7" />
          </button>
        </div>

        <div className="w-full space-y-1">
          <div className="flex items-center gap-3">
            <span className="w-10 text-[10px] tabular-nums text-gray-500 text-right">{fmt(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime || 0}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-10 text-[10px] tabular-nums text-gray-500">{fmt(duration)}</span>
          </div>
          {currentTrack ? (
            <div className="text-center">
              <div className="text-sm font-semibold text-white truncate px-4">{currentTrack.title || 'Untitled'}</div>
              <div className="text-[11px] text-gray-500 truncate px-4">{currentTrack.artist || 'Unknown Artist'}</div>
            </div>
          ) : (
            <div className="text-center text-[11px] text-gray-500 italic">No track playing</div>
          )}
        </div>
      </div>
    </div>
  );
}
