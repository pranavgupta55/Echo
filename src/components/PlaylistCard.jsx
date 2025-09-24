// src/components/PlaylistCard.jsx
import { Link } from 'react-router-dom';

export default function PlaylistCard({ id, name, count }) {
  return (
    <Link to={`/playlist/${id}`} className="glass-pane p-4 hover:bg-card/80 transition-colors rounded-lg">
      <div className="text-lg font-medium">{name}</div>
      <div className="text-sm text-muted-foreground">{count} songs</div>
    </Link>
  );
}
