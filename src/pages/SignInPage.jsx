// src/pages/SignInPage.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

export default function SignInPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/playlists';

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate(from, { replace: true });
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setMsg('Check email to confirm sign-up.');
      }
    } catch (err) {
      setMsg(err.message || 'Auth error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <form onSubmit={onSubmit} className="glass-pane p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h1>
        <input className="input-style" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input-style" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="w-full py-2 rounded bg-white text-black">Continue</button>
        <div className="text-xs text-muted-foreground">{msg}</div>
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-xs text-gray-300 hover:text-white">
          {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
