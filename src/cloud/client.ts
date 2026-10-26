import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase connection. The project's URL and anon key come from the build
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); without them the studio
 * runs as before, entirely on this device, with no sign-in.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const cloudEnabled = supabase !== null

/** Where links in sign-in and invitation emails lead back to: this page. */
export const appUrl = () => window.location.origin + import.meta.env.BASE_URL

export const MEDIA_BUCKET = 'team-media'
export const MEDIA_CATEGORY = 'Team uploads'
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

export type TeamRole = 'owner' | 'admin' | 'member'

export interface Team {
  id: string
  name: string
  role: TeamRole
}
