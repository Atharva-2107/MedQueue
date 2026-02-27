// src/hooks/useAuth.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch user's DB profile with Auto-Retry ────────────────────
  const fetchUserProfile = async (authUserId, retries = 3) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, phone, role, is_active")
        .eq("id", authUserId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      // If Strict Mode breaks the lock, wait and retry silently
      if (error.message?.includes("AbortError") || error.message?.includes("Lock") || retries > 0) {
        await new Promise(res => setTimeout(res, 500));
        return fetchUserProfile(authUserId, retries - 1);
      }
      console.warn("Could not fetch user profile:", error.message);
      return null;
    }
  };

  // ── Listen for auth state changes ──────────────────────────────
  useEffect(() => {
    let mounted = true; // Prevent state updates if component unmounts

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        // Only set user if profile exists, preventing AbortError from wiping it
        if (profile && mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);

        if (event === "SIGNED_IN" && currentSession?.user) {
          setLoading(true);
          const profile = await fetchUserProfile(currentSession.user.id);
          if (profile && mounted) setUser(profile);
          if (mounted) setLoading(false);
        } else if (event === "SIGNED_OUT") {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};