// src/components/AddSongsDrawer.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AddSongsDrawer({ open, onClose, playlistId, onChanged }) {
  const [library, setLibrary] = useState([]);
  const [currentSet, setCurrentSet] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        // Fetch all songs for current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user');
        const { data: songs, error: sErr } = await supabase
          .from('songs')
          .select('id,title,artist,created_at')
          .order('created_at', { ascending: false });
        if (sErr) throw sErr;

        // Fetch existing membership for this playlist
        const { data: members, error: mErr } = await supabase
          .from('playlist_songs')
          .select('song_id')
          .eq('playlist_id', playlistId);
        if (mErr) throw mErr;

        setLibrary(songs || []);
        setCurrentSet(new Set((members || []).map(r => r.song_id)));
      } catch {
        setLibrary([]);
        setCurrentSet(new Set());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, playlistId]);

  const isChecked = (id) => currentSet.has(id);

  const toggle = async (song) => {
    try {
      if (!isChecked(song.id)) {
        // Add via upsert on composite key (playlist_id,song_id)
        const { error } = await supabase
          .from('playlist_songs')
          .upsert({ playlist_id: playlistId, song_id: song.id }, { onConflict: 'playlist_id,song_id', ignoreDuplicates: true })
          .select();
        if (error) throw error;
        setCurrentSet(prev => new Set([...prev, song.id]));
      } else {
        const { error } = await supabase
          .from('playlist_songs')
          .delete()
          .match({ playlist_id: playlistId, song_id: song.id });
        if (error) throw error;
        setCurrentSet(prev => {
          const next = new Set(prev);
          next.delete(song.id);
          return next;
        });
      }
      onChanged?.();
    } catch {
      // noop
    }
  };

  const filtered = library.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase()) ||
    (s.artist || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 transition-transform ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="rounded-t-2xl bg-white/10 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1.5 w-12 bg-white/40 rounded-full mx-auto" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              className="flex-1 px-4 py-3 rounded-xl bg-white/10 ring-1 ring-white/10 outline-none placeholder:text-gray-400"
              placeholder="Search songs…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button onClick={onClose} className="px-3 py-2 rounded-xl bg-white text-black">Done</button>
          </div>
          <div className="max-h-[50vh] overflow-auto custom-scrollbar">
            {loading ? (
              <div className="text-sm text-gray-300 p-3">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-gray-300 p-3">No songs found</div>
            ) : (
              <ul className="space-y-2">
                {filtered.map(song => (
                  <li key={song.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
                    <div className="truncate">
                      <div className="text-sm font-medium">{song.title}</div>
                      <div className="text-xs text-gray-300">{song.artist || 'Unknown'}</div>
                    </div>
                    <button
                      onClick={() => toggle(song)}
                      className={`px-3 py-1.5 rounded-lg ${isChecked(song.id) ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {isChecked(song.id) ? 'Added' : 'Add'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
