// src/pages/UploadPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Utilities
const sanitize = (name) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalize = (s) => (s || '').toLowerCase().trim();

export default function UploadPage() {
  // Pending uploads (not yet sent)
  const [rows, setRows] = useState([]); // [{ file, title, artist, wantName, addTo:Set, duplicate:boolean, dupReason:string }]
  const [skipDupes, setSkipDupes] = useState(true);

  // Library (persisted songs)
  const [library, setLibrary] = useState([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [selectedLib, setSelectedLib] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [confirmId, setConfirmId] = useState(null); // per-item confirm

  // Playlists and artist suggestions
  const [playlists, setPlaylists] = useState([]);
  const [artists, setArtists] = useState([]);

  // Status line
  const [status, setStatus] = useState('');

  // 1. Safety Measure: Client-side Alphabetical Sort
  // This ensures the UI stays sorted even during local state transitions
  const sortedLibrary = useMemo(() => {
    return [...library].sort((a, b) => 
      (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [library]);

  // Load playlists and artist suggestions
  const loadMeta = async () => {
    const [{ data: pls }, { data: arts }] = await Promise.all([
      supabase.from('playlists').select('id,name').order('created_at', { ascending: false }),
      supabase.from('songs').select('artist').order('artist', { ascending: true }),
    ]);
    setPlaylists(pls || []);
    const uniq = Array.from(new Set((arts || []).map((a) => (a.artist || '').trim()).filter(Boolean)));
    setArtists(uniq);
  };

  // Load library
  const loadLibrary = async () => {
    setLoadingLib(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id,title,artist,storage_path,created_at')
        // 2. Safety Measure: Database-level sort
        .order('title', { ascending: true }); 
      if (error) throw error;
      setLibrary(data || []);
    } catch {
      setLibrary([]);
    } finally {
      setLoadingLib(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadLibrary();
  }, []);

  // Duplicate detection against library and within batch
  const existingSig = useMemo(() => {
    const set = new Set();
    for (const s of library) set.add(`${normalize(s.title)}|${normalize(s.artist)}`);
    return set;
  }, [library]);

  const detectDuplicates = (incoming) => {
    const seen = new Set();
    return incoming.map((r) => {
      const sig = `${normalize(r.title)}|${normalize(r.artist)}`;
      const dupLib = existingSig.has(sig);
      const dupBatch = seen.has(sig);
      seen.add(sig);
      return {
        ...r,
        duplicate: dupLib || dupBatch,
        dupReason: dupLib ? 'exists in library' : dupBatch ? 'duplicate in selection' : '',
      };
    });
  };

  // When picking files
  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const mapped = files.map((f) => ({
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''),
      artist: '',
      wantName: sanitize(f.name.replace(/\.[^/.]+$/, '')),
      addTo: new Set(),
      duplicate: false,
      dupReason: '',
    }));
    setRows((prev) => detectDuplicates([...prev, ...mapped]));
    e.target.value = '';
  };

  // Remove a pending row before upload
  const removeRow = (idx) => {
    setRows((prev) => detectDuplicates(prev.filter((_, i) => i !== idx)));
  };

  // Toggle playlist chip for a pending row
  const toggleAddTo = (idx, pid) => {
    setRows((rs) => {
      const next = [...rs];
      const set = new Set(next[idx].addTo);
      set.has(pid) ? set.delete(pid) : set.add(pid);
      next[idx] = { ...next[idx], addTo: set };
      return next;
    });
  };

  const buildKey = (userId, file, wantName) => {
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const safe = sanitize(wantName || '');
    return `${userId}/${crypto.randomUUID()}${safe ? '-' + safe : ''}${ext}`;
  };

  const uploadAll = async () => {
    if (!rows.length) return;
    setStatus('Uploading…');
    const results = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      for (const r of rows) {
        if (skipDupes && r.duplicate) {
          results.push({ file: r.file.name, ok: true, skipped: true });
          continue;
        }
        try {
          const key = buildKey(user.id, r.file, r.wantName);
          const { error: upErr } = await supabase.storage.from('songs').upload(key, r.file, { upsert: true });
          if (upErr) throw upErr;

          const title = r.title || r.file.name.replace(/\.[^/.]+$/, '');
          const artist = r.artist || '';
          const { data: inserted, error: dbErr } = await supabase
            .from('songs')
            .insert({ user_id: user.id, title, artist, storage_path: key })
            .select('id')
            .single();
          if (dbErr) throw dbErr;

          if (r.addTo?.size) {
            const payload = Array.from(r.addTo).map((pid) => ({ playlist_id: pid, song_id: inserted.id }));
            const { error: linkErr } = await supabase
              .from('playlist_songs')
              .upsert(payload, { onConflict: 'playlist_id,song_id', ignoreDuplicates: true });
            if (linkErr) throw linkErr;
          }
          results.push({ file: r.file.name, ok: true });
        } catch (e) {
          results.push({ file: r.file.name, ok: false, msg: e.message });
        }
      }

      await Promise.all([loadMeta(), loadLibrary()]);
      setRows([]);
      const failed = results.filter((r) => !r.ok);
      setStatus(failed.length ? `Done with ${failed.length} error(s)` : 'Upload complete');
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedLib((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelectedLib(new Set(library.map((s) => s.id)));
  const clearSelection = () => setSelectedLib(new Set());

  const requestDeleteOne = (id) => setConfirmId((prev) => (prev === id ? null : id));
  const deleteOne = async (song) => {
    try {
      await supabase.from('songs').delete().eq('id', song.id);
      await supabase.storage.from('songs').remove([song.storage_path]);
      setConfirmId(null);
      await loadLibrary();
    } catch {}
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedLib);
    if (!ids.length) return;
    const paths = library.filter((s) => selectedLib.has(s.id)).map((s) => s.storage_path);
    try {
      await supabase.from('songs').delete().in('id', ids);
      if (paths.length) await supabase.storage.from('songs').remove(paths);
      setBulkConfirm(false);
      setSelectedLib(new Set());
      await loadLibrary();
    } catch {}
  };

  const onRename = async (song, title, artist) => {
    // Optimization: Only update if something actually changed
    if (song.title === title && song.artist === artist) return;
    try {
      await supabase.from('songs').update({ title, artist }).eq('id', song.id);
      await loadLibrary();
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 text-white">
      <h1 className="text-3xl font-semibold tracking-tight">Upload to Library</h1>

      {/* Uploader Section */}
      <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer">
            <input type="file" multiple accept="audio/*" className="hidden" onChange={onPick} />
            Select audio files
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} />
            Skip detected duplicates
          </label>
          <button onClick={uploadAll} className="px-4 py-2 rounded-xl bg-white text-black shadow-lg font-medium">Upload</button>
          <div className="text-sm text-gray-300">{status}</div>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-300">
                <tr>
                  <th className="py-2 pr-4">Remove</th>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Artist</th>
                  <th className="py-2 pr-4">Filename (optional)</th>
                  <th className="py-2 pr-4">Add to playlists</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-2 pr-4">
                      <button onClick={() => removeRow(idx)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Remove</button>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        value={r.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) => detectDuplicates(rs.map((x, i) => (i === idx ? { ...x, title: v } : x))));
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10 outline-none focus:ring-white/30"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        list="artist-list"
                        value={r.artist}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) => detectDuplicates(rs.map((x, i) => (i === idx ? { ...x, artist: v } : x))));
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10 outline-none focus:ring-white/30"
                        placeholder="Type or choose"
                      />
                      <datalist id="artist-list">
                        {artists.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        value={r.wantName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) => {
                            const n = [...rs];
                            n[idx] = { ...n[idx], wantName: v };
                            return n;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10 outline-none focus:ring-white/30"
                        placeholder="Optional file name piece"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => toggleAddTo(idx, pl.id)}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${r.addTo.has(pl.id) ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
                          >
                            {pl.name}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {r.duplicate ? (
                        <span className="inline-block px-2 py-1 rounded bg-yellow-400/20 text-yellow-200 ring-1 ring-yellow-400/30">
                          Duplicate
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/30">
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Library Section */}
      <div className="rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="text-xl font-medium">Library ({library.length})</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={loadLibrary} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Refresh</button>
            <button onClick={selectAll} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Select all</button>
            <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Clear</button>
            {!bulkConfirm ? (
              <button 
                onClick={() => setBulkConfirm(true)} 
                disabled={selectedLib.size === 0}
                className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete selected ({selectedLib.size})
              </button>
            ) : (
              <button onClick={bulkDelete} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold">
                Confirm deletion
              </button>
            )}
          </div>
        </div>

        {loadingLib ? (
          <div className="py-10 text-center text-gray-400">Loading library...</div>
        ) : sortedLibrary.length === 0 ? (
          <div className="py-10 text-center text-gray-400">No songs found in your library.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {sortedLibrary.map((song) => {
              const selected = selectedLib.has(song.id);
              const inConfirm = confirmId === song.id;
              return (
                <li 
                  key={song.id} 
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    selected ? 'bg-white/20 ring-1 ring-white/30' : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-white/20 bg-white/10"
                      checked={selected} 
                      onChange={() => toggleSelectOne(song.id)} 
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        defaultValue={song.title}
                        onBlur={(e) => onRename(song, e.target.value, song.artist)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-semibold w-full p-0 overflow-hidden text-ellipsis whitespace-nowrap"
                        placeholder="Song Title"
                      />
                      <input
                        defaultValue={song.artist || ''}
                        onBlur={(e) => onRename(song, song.title, e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-xs text-gray-400 w-full p-0 overflow-hidden text-ellipsis whitespace-nowrap"
                        placeholder="Add Artist"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!inConfirm ? (
                      <button 
                        onClick={() => requestDeleteOne(song.id)} 
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setConfirmId(null)} className="text-[10px] px-2 py-1 underline text-gray-400">Cancel</button>
                        <button onClick={() => deleteOne(song)} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium">
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
