import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAudio } from '../context/AudioContext.jsx';
import PlayerControls from '../components/PlayerControls.jsx';
import QueuePanel from '../components/QueuePanel.jsx';
import AddSongsDrawer from '../components/AddSongsDrawer.jsx';

export default function PlaylistPage() {
  const { id: playlistId } = useParams();
  const { startContext, addToQueue } = useAudio();
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

      // Filter out any rows where the song join failed (safety against broken refs)
      const validRows = (rows || []).filter(r => r.songs);
      
      const paths = validRows.map(r => r.songs.storage_path);
      if (!paths.length) { 
        setTracks([]); 
        setLoading(false); 
        return; 
      }
      
      const { data: signed } = await supabase.storage.from('songs').createSignedUrls(paths, 3600);
      
      const ts = validRows.map((r, i) => ({ 
        id: r.songs.id, 
        title: r.songs.title, 
        artist: r.songs.artist || 'Unknown', 
        url: signed?.[i]?.signedUrl || ''
      })).filter(t => t.url); // Only keep tracks with valid signed URLs

      setTracks(ts);
    } catch (err) {
      console.error("Failed to load playlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (playlistId) load(); }, [playlistId]);

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <PlayerControls floating />
        
        <section className="glass-pane p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Tracks</h2>
            <button 
              onClick={() => setDrawerOpen(true)}
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:scale-105 transition-transform"
            >
              ADD SONGS
            </button>
          </div>
          
          {loading ? (
            <div className="text-sm text-gray-400">Loading playlist...</div>
          ) : tracks.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-10 text-center">This playlist is empty</div>
          ) : (
            <ul className="space-y-1">
              {tracks.map((t, i) => (
                <li key={t.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => startContext(tracks, i)}>
                    <span className="w-4 text-xs text-gray-500 group-hover:text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{t.title}</div>
                      <div className="text-xs text-gray-400 truncate">{t.artist}</div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); addToQueue(t); }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-gray-400 hover:text-white border border-white/20 px-2 py-1 rounded"
                  >
                    ADD TO QUEUE
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="lg:col-span-1">
        <QueuePanel />
      </div>

      <AddSongsDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        playlistId={playlistId} 
        onChanged={load}
      />
    </div>
  );
}
