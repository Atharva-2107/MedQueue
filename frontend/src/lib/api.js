// src/lib/api.js
// Central axios instance — attaches Supabase JWT on every request.
// DOES NOT auto-logout on 401 — that was causing the redirect-to-login bug.
import axios from "axios";
import { supabase } from "../supabaseClient";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000,
});

// Attach Supabase token on every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Log errors but DO NOT sign out or redirect — let the component handle it
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.warn("[api] 401 Unauthorized:", err.config?.url);
      // Do NOT call signOut or redirect here — this was causing the login loop
    }
    return Promise.reject(err);
  }
);

export default api;