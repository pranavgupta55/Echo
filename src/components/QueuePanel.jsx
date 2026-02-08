// src/components/QueuePanel.jsx
import { useAudio } from '../context/AudioContext.jsx';

export default function QueuePanel() {
  const { currentTrack, manualQueue, contextTracks, contextIndex, removeFromManual, clearManualQueue } = useAudio();

  const nextUpContext = contextTracks.slice(contextIndex + 1);

  const TrackRow = ({ track, isManual, index }) => (
    <li className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/5 bg-white/5 group">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{track.title}</div>
        <div className="text-xs text-gray-400 truncate">{track.artist || 'Unknown Artist'}</div>
      </div>
      {isManual && (
        <button 
          onClick={() => removeFromManual(track.id)}
          className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
        >
          Remove
        </button>
      )}
    </li>
  );

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-6 space-y-8">
      {/* 1. NOW PLAYING */}
      <section>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Now Playing</h3>
        {currentTrack ? (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-white/10 ring-1 ring-white/20">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-black rounded flex items-center justify-center text-xl">
              🎵
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold truncate text-white">{currentTrack.title}</div>
              <div className="text-sm text-gray-400 truncate">{currentTrack.artist}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">No track selected</div>
        )}
      </section>

      {/* 2. MANUAL QUEUE */}
      {manualQueue.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Next in Queue</h3>
            <button onClick={clearManualQueue} className="text-[10px] text-gray-400 hover:text-white uppercase font-bold">Clear All</button>
          </div>
          <ul className="space-y-2">
            {manualQueue.map((t, i) => <TrackRow key={`manual-${t.id}-${i}`} track={t} isManual />)}
          </ul>
        </section>
      )}

      {/* 3. CONTEXT QUEUE */}
      <section>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Next From Playlist</h3>
        <ul className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
          {nextUpContext.length > 0 ? (
            nextUpContext.map((t, i) => <TrackRow key={`context-${t.id}-${i}`} track={t} />)
          ) : (
            <div className="text-xs text-gray-600 italic">End of playlist</div>
          )}
        </ul>
      </section>
    </div>
  );
}
