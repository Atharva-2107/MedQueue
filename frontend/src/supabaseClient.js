// // src/supabaseClient.js
// import { createClient } from '@supabase/supabase-js';

// // IMPORTANT: These are public keys, so it's safe to use them in the frontend.
// // In Vite, environment variables must start with VITE_
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// src/supabaseClient.js
// ─────────────────────────────────────────────
//  Single Supabase client for the entire frontend.
//  Uses the ANON key — safe for browser use.
//  The SERVICE ROLE key stays only in the backend.
// ─────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);