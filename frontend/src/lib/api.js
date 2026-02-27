// // src/lib/api.js
// // Central axios instance — auto-attaches JWT token from localStorage
// import axios from "axios";

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
//   timeout: 15000,
// });

// // Attach token on every request
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// // Auto-logout on 401
// api.interceptors.response.use(
//   (res) => res,
//   (err) => {
//     if (err.response?.status === 401) {
//       localStorage.removeItem("token");
//       localStorage.removeItem("user");
//       window.location.href = "/login";
//     }
//     return Promise.reject(err);
//   }
// );

// export default api;
import axios from "axios";
import { supabase } from "../supabaseClient"; // Import your Supabase client

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000,
});

// Attach Supabase token on every request
api.interceptors.request.use(async (config) => {
  // Wait for Supabase to give us the current active session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  // If a session exists, grab the secure JWT access token
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      console.warn("Unauthorized API call. Signing out via Supabase...");
      await supabase.auth.signOut(); // Properly clear the Supabase session
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;