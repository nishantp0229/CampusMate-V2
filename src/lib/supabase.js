// src/lib/supabase.js
//
// This file creates and exports the Supabase client.
// Every database operation in this project imports `supabase` from here.
//
// IMPORTANT:
//   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY come from your .env file.
//   - The anon key is safe to expose in the frontend because Row Level Security
//     (RLS) on the database enforces what each user is allowed to do.
//   - NEVER use the service-role key in frontend code.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // This warning appears in the browser console during development.
  // It reminds you to create your .env file before the app can connect to Supabase.
  console.warn(
    '[CampusMate] Supabase environment variables are missing.\n' +
    'Copy .env.example to .env and fill in your project credentials.'
  )
}

// createClient sets up the connection. We export one shared instance
// so the whole app reuses the same connection.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
