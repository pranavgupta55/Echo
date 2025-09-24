// src/pages/PlaylistPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAudio } from '../context/AudioContext.jsx';
import PlayerControls from '../components/PlayerControls.jsx';
import QueuePanel from '../components/QueuePanel.jsx';
import AddSongsDrawer from '../components/AddSongsDrawer.jsx';

export default function PlaylistPage() {
  const { id: playlistId } = useParams();
  const { setQueue, shuffleQueue, playAt, addToQueue } = useAudio();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      if (paths.length === 0) {
        setTracks([]);
        setQueue([], 0);
        setLoading(false);
        return;
      }
      const { data: signed } = await supabase.storage.from('songs').createSignedUrls(paths, 3600);
      const ts = rows.map((r, i) => ({ id: r.songs.id, title: r.songs.title, artist: r.songs.artist || '', url: signed[i].signedUrl }));
      setTracks(ts);
      setQueue(ts, 0); // set but do NOT auto-play
    } catch {
      setTracks([]);
      setQueue([], 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (playlistId) load(); }, [playlistId]);

  const removeFromPlaylist = async (songId) => {
    try {
      const { error } = await supabase.from('playlist_songs').delete().match({ playlist_id: playlistId, song_id: songId });
      if (error) throw error;
      await load();
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Playlist</h1>
        <div className="flex gap-2">
          <button onClick={shuffleQueue} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20">Shuffle</button>
          <button onClick={() => setDrawerOpen(true)} className="px-4 py-2 rounded-xl bg-white text-black shadow-lg">Add songs</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
            <div className="text-sm font-medium mb-3">Tracks</div>
            {loading ? (
              <div className="text-sm text-gray-300">Loading…</div>
            ) : tracks.length === 0 ? (
              <div className="text-sm text-gray-300">No songs in this playlist</div>
            ) : (
              <ul className="space-y-2">
                {tracks.map((t, i) => (
                  <li
                    key={t.id}
                    className="group flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10"
                    onClick={() => playAt(i)}
                    onDoubleClick={() => addToQueue(t)}
                    onPointerDown={(e) => {
                      // long-press to add to queue (600ms)
                      e.currentTarget._lp = setTimeout(() => addToQueue(t), 600);
                    }}
                    onPointerUp={(e) => { clearTimeout(e.currentTarget._lp); }}
                    onPointerLeave={(e) => { clearTimeout(e.currentTarget._lp); }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-xs text-gray-300 text-right">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.title}</div>
                        <div className="text-xs text-gray-300 truncate">{t.artist || 'Unknown'}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromPlaylist(t.id); }}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <QueuePanel />
      </div>

      <AddSongsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} playlistId={playlistId} onChanged={load} />
      <PlayerControls />
    </div>
  );
}
