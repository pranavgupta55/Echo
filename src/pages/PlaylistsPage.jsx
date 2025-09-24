// src/pages/PlaylistsPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import PlaylistFormModal from '../components/PlaylistFormModal.jsx';
import { Link } from 'react-router-dom';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id,name,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPlaylists(data || []);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createPlaylist = async (name) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('playlists').insert({ user_id: user.id, name });
      if (error) throw error;
      setModalOpen(false);
      await load();
    } catch {
      // noop
    }
  };

  const renamePlaylist = async (name) => {
    if (!renameTarget) return;
    try {
      const { error } = await supabase.from('playlists').update({ name }).eq('id', renameTarget.id);
      if (error) throw error;
      setRenameOpen(false);
      setRenameTarget(null);
      await load();
    } catch {
      // noop
    }
  };

  const deletePlaylist = async (pl) => {
    if (!confirm(`Delete playlist "${pl.name}"?`)) return;
    try {
      const { error } = await supabase.from('playlists').delete().eq('id', pl.id);
      if (error) throw error;
      await load();
    } catch {
      // noop
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Playlists</h1>
        <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-xl bg-white text-black shadow-lg">New playlist</button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-300">Loading…</div>
      ) : playlists.length === 0 ? (
        <div className="glass-pane ring-1 ring-white/10 p-6 rounded-2xl text-sm text-gray-300">
          No playlists yet. Create one to get started.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {playlists.map(pl => (
            <div
              key={pl.id}
              className="group relative rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl hover:translate-y-[-2px] transition-transform"
            >
              <Link to={`/playlist/${pl.id}`} className="block p-5">
                <div className="text-xl font-semibold truncate">{pl.name}</div>
                <div className="text-xs text-gray-300 mt-1">Tap to open</div>
              </Link>
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setRenameTarget(pl); setRenameOpen(true); }}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                >Rename</button>
                <button
                  onClick={() => deletePlaylist(pl)}
                  className="px-2 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-xs text-white"
                >Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlaylistFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createPlaylist} title="New Playlist" />
      <PlaylistFormModal
        open={renameOpen}
        onClose={() => { setRenameOpen(false); setRenameTarget(null); }}
        onSubmit={renamePlaylist}
        defaultName={renameTarget?.name || ''}
        title="Rename Playlist"
      />
    </div>
  );
}
