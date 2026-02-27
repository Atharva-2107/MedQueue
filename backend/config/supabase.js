// config/supabase.js
// Uses SERVICE ROLE key on the backend to bypass RLS
// (anon key on backend would get blocked by RLS policies)
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("❌  SUPABASE_URL or SUPABASE_ANON_KEY missing in backend .env");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY not set — backend will be blocked by RLS on some tables.");
  console.warn("    Get it from: Supabase Dashboard → Settings → API → service_role key");
}

// Service role client: bypasses all RLS (safe on backend only — never expose to frontend)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;