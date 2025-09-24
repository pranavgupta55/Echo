// src/components/QueuePanel.jsx
import { useAudio } from '../context/AudioContext.jsx';
import { useRef, useState } from 'react';

export default function QueuePanel({ showNext = 10 }) {
  const { queue, currentIndex, previousTracks, removeFromQueue, reorderQueue, playAt } = useAudio();
  const [drag, setDrag] = useState({ idx: null, over: null });
  const itemRefs = useRef({});

  const startDrag = (idx) => {
    setDrag({ idx, over: idx });
    const move = (ev) => {
      const y = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      let over = drag.over;
      for (const [k, el] of Object.entries(itemRefs.current)) {
        const rect = el?.getBoundingClientRect?.();
        if (!rect) continue;
        if (y >= rect.top && y <= rect.bottom) { over = Number(k); break; }
      }
      setDrag((d) => d.idx == null ? d : { ...d, over });
    };
    const end = () => {
      setDrag((d) => {
        if (d.idx != null && d.over != null && d.idx !== d.over) reorderQueue(d.idx, d.over);
        return { idx: null, over: null };
      });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
  };

  const nextList = queue.slice(currentIndex + 1, currentIndex + 1 + showNext);
  const prevList = previousTracks.slice(-showNext).reverse();

  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
      <div className="text-sm font-medium mb-2">Previously</div>
      <ul className="space-y-2 mb-4">
        {prevList.map((t, i) => (
          <li key={`${t.id}-prev-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/5 opacity-60">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
            </div>
          </li>
        ))}
        {prevList.length === 0 && <li className="text-xs text-gray-400">No previous songs</li>}
      </ul>

      <div className="text-sm font-medium mb-2">Up next</div>
      <ul className="space-y-2 max-h-[40vh] overflow-auto custom-scrollbar">
        {nextList.map((t, i) => {
          const absoluteIndex = currentIndex + 1 + i;
          const dragging = drag.idx === absoluteIndex;
          return (
            <li
              key={t.id}
              ref={(el) => { itemRefs.current[absoluteIndex] = el; }}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/5 select-none touch-none ${dragging ? 'outline outline-2 outline-white/30' : ''}`}
              onPointerDown={() => startDrag(absoluteIndex)}
              onTouchStart={() => startDrag(absoluteIndex)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => playAt(absoluteIndex)} className="text-xs px-2 py-1.5 rounded bg-white/10 hover:bg-white/20">Play</button>
                <button onClick={() => removeFromQueue(t.id)} className="text-xs px-2 py-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white">Remove</button>
              </div>
            </li>
          );
        })}
        {nextList.length === 0 && <li className="text-xs text-gray-400">No upcoming songs</li>}
      </ul>
    </div>
  );
}
