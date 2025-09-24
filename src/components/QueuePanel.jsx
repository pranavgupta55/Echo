// src/components/QueuePanel.jsx
import { useAudio } from '../context/AudioContext.jsx';
import { useRef, useState, useEffect } from 'react';

export default function QueuePanel() {
  const { queue, currentIndex, previousTracks, reorderQueue, removeFromQueue, playAt, VISIBLE_NEXT } = useAudio();
  const [drag, setDrag] = useState({ idx: null, over: null });
  const itemRefs = useRef({});

  // Visible subset for 'Up next' (but store keeps more)
  const nextListAll = queue.slice(1);             // all upcoming in window
  const nextVisible = nextListAll.slice(0, VISIBLE_NEXT); // only first 5 rendered

  // Drag only within visible next subset (absolute indices start at 1)
  const startDrag = (absIdx) => {
    setDrag({ idx: absIdx, over: absIdx });
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

  useEffect(() => () => { itemRefs.current = {}; }, [currentIndex]); // reset refs when queue shifts [attached_file:259]

  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
      <div className="max-h-[45vh] overflow-auto custom-scrollbar">
        {/* Previous (greyed, capped in context) */}
        <div className="text-sm font-medium mb-2">Previously</div>
        <ul className="space-y-2 mb-4">
          {previousTracks.slice().reverse().map((t, i) => (
            <li key={`${t.id}-prev-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/5 opacity-60">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Up next (only VISIBLE_NEXT shown) */}
        <div className="text-sm font-medium mb-2">Up next</div>
        <ul className="space-y-2">
          {nextVisible.map((t, i) => {
            const absIndex = 1 + i; // absolute within window
            const dragging = drag.idx === absIndex;
            return (
              <li
                key={t.id}
                ref={(el) => { itemRefs.current[absIndex] = el; }}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/5 select-none touch-none ${dragging ? 'outline outline-2 outline-white/30' : ''}`}
                onPointerDown={() => startDrag(absIndex)}
                onTouchStart={() => startDrag(absIndex)}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => playAt(absIndex)} className="text-xs px-2 py-1.5 rounded bg-white/10 hover:bg-white/20">Play</button>
                  <button onClick={() => removeFromQueue(t.id)} className="text-xs px-2 py-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white">Remove</button>
                </div>
              </li>
            );
          })}
          {nextVisible.length === 0 && <li className="text-xs text-gray-400">No upcoming songs</li>}
        </ul>
      </div>
    </div>
  );
}
