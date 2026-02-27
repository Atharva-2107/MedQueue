// src/hooks/useAuth.jsx
// ─────────────────────────────────────────────────────────────────
//  AuthContext — global user state used across all components.
//
//  Provides:
//   user          → full user object from public.users table
//   session       → raw Supabase auth session
//   loading       → true while auth state is being determined
//   logout()      → signs out from Supabase + clears state
//   refreshUser() → re-fetches user data from DB
//
//  How it works:
//   - On mount, listens to supabase.auth.onAuthStateChange
//   - When session exists, fetches the user's row from public.users
//   - This gives us the `role`, `hospital_id`, etc.
// ─────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);  // row from public.users
  const [session, setSession] = useState(null);  // Supabase auth session
  const [loading, setLoading] = useState(true);

  // ── Fetch user's DB profile ────────────────────────────────────
  const fetchUserProfile = async (authUserId) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, phone, role, hospital_id, is_active")
        .eq("id", authUserId)
        .single();

      if (error || !data) {
        console.warn("Could not fetch user profile:", error?.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  };

  // ── Listen for auth state changes ──────────────────────────────
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    // Subscribe to future changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        if (event === "SIGNED_IN" && session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        } else if (event === "USER_UPDATED" && session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("js_user_role");
    localStorage.removeItem("js_user_id");
    setUser(null);
    setSession(null);
  };

  // ── Refresh user data from DB ──────────────────────────────────
  const refreshUser = async () => {
    if (!session?.user) return;
    const profile = await fetchUserProfile(session.user.id);
    setUser(profile);
    return profile;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};