// src/hooks/useAuth.jsx
// Bulletproof auth — session=undefined while initializing, null when confirmed no session
// Falls back to Supabase auth user if DB profile query fails (e.g. table not set up yet)
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

// Build a minimal user object from the Supabase auth user (fallback when DB is missing)
const buildFallbackUser = (authUser) => ({
  id: authUser.id,
  email: authUser.email,
  full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
  phone: authUser.user_metadata?.phone_number || "",
  role: authUser.user_metadata?.user_role || "patient",
  hospital_id: null,
  is_active: true,
  _isFallback: true, // flag so we know this came from auth, not DB
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = still initializing
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) return null;
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, phone, role, hospital_id, is_active")
        .eq("id", authUser.id)
        .maybeSingle(); // maybeSingle: won't throw if 0 rows

      if (error) {
        console.warn("[useAuth] DB query failed:", error.message, "— using auth metadata fallback");
        return buildFallbackUser(authUser);
      }
      if (!data) {
        console.warn("[useAuth] No profile row in DB — using auth metadata fallback");
        return buildFallbackUser(authUser);
      }
      return data;
    } catch (err) {
      console.warn("[useAuth] fetchProfile exception:", err.message);
      return buildFallbackUser(authUser);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── Bootstrap from existing session on page load ───────────────
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s ?? null);
      if (s?.user) {
        const profile = await fetchProfile(s.user);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    });

    // ── Listen for auth changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) ─
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null); setUser(null); setLoading(false);
          return;
        }
        // TOKEN_REFRESHED: just update session token, don't re-fetch profile
        if (event === "TOKEN_REFRESHED") {
          setSession(currentSession);
          return;
        }
        // SIGNED_IN / INITIAL_SESSION
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(prev => {
            if (prev && prev.id === currentSession.user.id) return prev;
            // async fetch, sets state when done
            fetchProfile(currentSession.user).then(profile => {
              if (mounted && profile) { setUser(profile); setLoading(false); }
            });
            return prev;
          });
          setLoading(false);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchProfile]);

  // Explicit call from Login/Signup after signInWithPassword —
  // guarantees profile is in context BEFORE navigate("/dashboard")
  const loadUserProfile = useCallback(async (authUserId) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const profile = await fetchProfile(authUser || { id: authUserId });
    if (profile) setUser(profile);
    return profile;
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null); setSession(null); setLoading(false);
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