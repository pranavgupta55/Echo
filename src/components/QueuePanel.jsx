// src/components/QueuePanel.jsx
import { useAudio } from '../context/AudioContext.jsx';

export default function QueuePanel() {
  const { queue, currentIndex, removeFromQueue } = useAudio();
  return (
    <aside className="glass-pane p-4 sticky top-16 max-h-[30vh] sm:max-h-80 overflow-auto custom-scrollbar">
      <div className="text-sm font-medium mb-2">Queue</div>
      <ul className="space-y-2">
        {queue.map((t, i) => (
          <li key={t.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl ${i === currentIndex ? 'bg-white/10' : 'bg-white/5'} ring-1 ring-white/10`}>
            <div className="min-w-0 truncate">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
            </div>
            <button onClick={() => removeFromQueue(t.id)} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
