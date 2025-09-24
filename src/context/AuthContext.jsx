// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setLoading(false);
      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);
      });
      sub = listener.subscription;
    })();
    return () => sub?.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []); // email/password sign-in [web:143]

  const signUp = useCallback(async (email, password) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
  }, []); // email verification redirect [web:143]

  const signOut = useCallback(async () => supabase.auth.signOut(), []);

  return (
    <AuthCtx.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
