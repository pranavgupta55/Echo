// src/pages/PlaylistPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAudio } from '../context/AudioContext.jsx';
import PlayerControls from '../components/PlayerControls.jsx';
import QueuePanel from '../components/QueuePanel.jsx';

export default function PlaylistPage() {
  const { id: playlistId } = useParams();
  const { setQueue, insertAtVisibleSlotAndPlay } = useAudio();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('playlist_songs')
        .select(`position, songs ( id, title, artist, storage_path )`)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
      if (error) throw error;

      const paths = rows.map(r => r.songs.storage_path);
      if (!paths.length) { setTracks([]); setQueue([], 0); setLoading(false); return; }
      const { data: signed } = await supabase.storage.from('songs').createSignedUrls(paths, 3600);
      const ts = rows.map((r, i) => ({ id: r.songs.id, title: r.songs.title, artist: r.songs.artist || '', url: signed[i].signedUrl }));
      setTracks(ts);
      setQueue(ts, 0); // seed window (current + up to NEXT_MAX)
    } catch {
      setTracks([]);
      setQueue([], 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (playlistId) load(); }, [playlistId]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <section><PlayerControls floating /></section>
      <section><QueuePanel /></section>
      <section className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
        <div className="text-sm font-medium mb-3">Tracks</div>
        {loading ? (
          <div className="text-sm text-gray-300">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="text-sm text-gray-300">No songs in this playlist</div>
        ) : (
          <ul className="space-y-2">
            {tracks.map((t, i) => (
              <li key={t.id} className="group flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/5" onClick={() => insertAtVisibleSlotAndPlay(t)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-6 text-xs text-gray-300 text-right">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
                  </div>
                </div>
                <button className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Add to Queue</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
