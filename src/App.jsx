// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import PlaylistsPage from './pages/PlaylistsPage.jsx';
import PlaylistPage from './pages/PlaylistPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import { AudioProvider } from './context/AudioContext.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <AudioProvider>
          <main className="flex-grow">
            <Routes>
              <Route path="/signin" element={<SignInPage />} />
              <Route
                path="/"
                element={<Navigate to="/playlists" replace />}
              />
              <Route
                path="/playlists"
                element={
                  <RequireAuth>
                    <PlaylistsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/playlist/:id"
                element={
                  <RequireAuth>
                    <PlaylistPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/upload"
                element={
                  <RequireAuth>
                    <UploadPage />
                  </RequireAuth>
                }
              />
            </Routes>
          </main>
        </AudioProvider>
      </div>
    </BrowserRouter>
  );
}
