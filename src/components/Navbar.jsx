// src/components/Navbar.jsx
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-background to-background/60 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/playlists" className="text-2xl font-semibold tracking-tight">Echo</Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/playlists" className={({isActive}) => isActive ? 'text-white' : 'text-gray-300 hover:text-white'}>Playlists</NavLink>
          <NavLink to="/upload" className={({isActive}) => isActive ? 'text-white' : 'text-gray-300 hover:text-white'}>Upload</NavLink>
          {user && (
            <button onClick={signOut} className="ml-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Sign out</button>
          )}
        </nav>
      </div>
    </header>
  );
}
