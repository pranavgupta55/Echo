// src/pages/UploadPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UploadPage() {
  const [rows, setRows] = useState([]); // [{file, title, artist, addTo: Set(playlistId)}]
  const [playlists, setPlaylists] = useState([]);
  const [artists, setArtists] = useState([]);
  const [status, setStatus] = useState('');
  const [library, setLibrary] = useState([]);
  const [loadingLib, setLoadingLib] = useState(true);

  const loadPlaylistsAndArtists = async () => {
    const [{ data: pls }, { data: songs }] = await Promise.all([
      supabase.from('playlists').select('id,name').order('created_at', { ascending: false }),
      supabase.from('songs').select('artist').order('artist', { ascending: true })
    ]);
    setPlaylists(pls || []);
    const uniq = Array.from(new Set((songs || []).map(s => (s.artist || '').trim()).filter(Boolean)));
    setArtists(uniq);
  };

  const loadLibrary = async () => {
    setLoadingLib(true);
    try {
      const { data, error } = await supabase.from('songs').select('id,title,artist,storage_path,created_at').order('created_at', { ascending: false });
      if (error) throw error;
      setLibrary(data || []);
    } catch {
      setLibrary([]);
    } finally {
      setLoadingLib(false);
    }
  };

  useEffect(() => { loadPlaylistsAndArtists(); loadLibrary(); }, []);

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setRows(files.map(f => ({ file: f, title: f.name.replace(/\.[^/.]+$/, ''), artist: '', addTo: new Set() })));
  };

  const toggleAddTo = (idx, pid) => {
    setRows((rs) => {
      const next = [...rs];
      const set = new Set(next[idx].addTo);
      set.has(pid) ? set.delete(pid) : set.add(pid);
      next[idx] = { ...next[idx], addTo: set };
      return next;
    });
  };

  const uploadAll = async () => {
    if (!rows.length) return;
    setStatus('Uploading…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      for (const r of rows) {
        const key = `${user.id}/${crypto.randomUUID()}-${r.file.name}`;
        const { error: upErr } = await supabase.storage.from('songs').upload(key, r.file, { upsert: true });
        if (upErr) throw upErr;
        const { data: inserted, error: dbErr } = await supabase.from('songs').insert({
          user_id: user.id, title: r.title || r.file.name, artist: r.artist || '', storage_path: key
        }).select('id').single();
        if (dbErr) throw dbErr;
        // add to selected playlists
        if (r.addTo.size) {
          const payload = Array.from(r.addTo).map(pid => ({ playlist_id: pid, song_id: inserted.id }));
          const { error: jErr } = await supabase.from('playlist_songs').upsert(payload, { onConflict: 'playlist_id,song_id', ignoreDuplicates: true });
          if (jErr) throw jErr;
        }
      }
      setStatus('Upload complete');
      setRows([]);
      await Promise.all([loadPlaylistsAndArtists(), loadLibrary()]);
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`);
    }
  };

  const onRename = async (song, title, artist) => {
    const { error } = await supabase.from('songs').update({ title, artist }).eq('id', song.id);
    if (!error) await loadLibrary();
  };

  const onDelete = async (song) => {
    if (!confirm(`Remove "${song.title}" from account? This deletes the file as well.`)) return;
    const { error: delDb } = await supabase.from('songs').delete().eq('id', song.id);
    const { error: delObj } = await supabase.storage.from('songs').remove([song.storage_path]);
    if (!delDb && !delObj) await loadLibrary();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Upload to Library</h1>

      <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer">
            <input type="file" multiple accept="audio/*" className="hidden" onChange={onPick} />
            Select audio files
          </label>
          <button onClick={uploadAll} className="px-4 py-2 rounded-xl bg-white text-black shadow-lg">Upload</button>
          <div className="text-sm text-gray-300">{status}</div>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-300">
                <tr>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Artist</th>
                  <th className="py-2 pr-4">Add to playlists</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-2 pr-4">
                      <input value={r.title} onChange={(e) => {
                        const v = e.target.value; setRows((rs) => { const n = [...rs]; n[idx] = { ...n[idx], title: v }; return n; });
                      }} className="w-full px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10 outline-none" />
                    </td>
                    <td className="py-2 pr-4">
                      <input list="artist-list" value={r.artist} onChange={(e) => {
                        const v = e.target.value; setRows((rs) => { const n = [...rs]; n[idx] = { ...n[idx], artist: v }; return n; });
                      }} className="w-full px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10 outline-none" placeholder="Type or choose" />
                      <datalist id="artist-list">
                        {artists.map(a => <option key={a} value={a} />)}
                      </datalist>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {playlists.map(pl => (
                          <button
                            key={pl.id}
                            onClick={() => toggleAddTo(idx, pl.id)}
                            className={`px-3 py-1.5 rounded-lg ${r.addTo.has(pl.id) ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
                          >
                            {pl.name}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Library</div>
          <button onClick={loadLibrary} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Refresh</button>
        </div>
        {loadingLib ? (
          <div className="text-sm text-gray-300">Loading…</div>
        ) : library.length === 0 ? (
          <div className="text-sm text-gray-300">No songs yet</div>
        ) : (
          <ul className="space-y-2">
            {library.map(song => (
              <li key={song.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
                <div className="min-w-0 truncate">
                  <input defaultValue={song.title} onBlur={(e) => onRename(song, e.target.value, song.artist)} className="bg-transparent outline-none text-sm font-medium" />
                  <div className="text-xs text-gray-300">
                    <input defaultValue={song.artist || ''} onBlur={(e) => onRename(song, song.title, e.target.value)} className="bg-transparent outline-none" placeholder="Artist" />
                  </div>
                </div>
                <button onClick={() => onDelete(song)} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
