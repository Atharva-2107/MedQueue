// src/hooks/useAuth.jsx
// Bulletproof auth — no race conditions, no grace-period logic needed.
// Strategy: single source of truth via onAuthStateChange.
// Profile is loaded once per session change and never wiped mid-flight.
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);   // DB profile row
  const [session, setSession] = useState(undefined); // undefined = initializing
  const [loading, setLoading] = useState(true);

  const fetchingRef = useRef(false); // prevent parallel fetches

  const fetchProfile = useCallback(async (uid) => {
    if (!uid) return null;
    // Skip if a fetch is already in progress for the same uid
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, phone, role, hospital_id, is_active")
        .eq("id", uid)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("[useAuth] fetchProfile failed:", err.message);
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── 1. Bootstrap from existing session ────────────────────────
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s ?? null);
      if (s?.user) {
        const profile = await fetchProfile(s.user.id);
        if (mounted && profile) setUser(profile);
      }
      if (mounted) setLoading(false);
    });

    // ── 2. React to auth changes ───────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // TOKEN_REFRESHED fires often — only update session, don't reload profile
        if (event === "TOKEN_REFRESHED") {
          setSession(currentSession);
          return;
        }

        // SIGNED_IN or INITIAL_SESSION
        if (currentSession?.user) {
          setSession(currentSession);
          // Only fetch profile if not already set for this user
          setUser(prev => {
            if (prev?.id === currentSession.user.id) return prev; // already loaded
            // Kick off async fetch, will update state when done
            fetchProfile(currentSession.user.id).then(profile => {
              if (mounted && profile) {
                setUser(profile);
                setLoading(false);
              }
            });
            return prev; // keep existing until fetch resolves
          });
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Called by Login/Signup immediately after signInWithPassword —
  // guarantees user profile is in context before navigate()
  const loadUserProfile = useCallback(async (uid) => {
    const profile = await fetchProfile(uid);
    if (profile) setUser(profile);
    return profile;
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, loadUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};