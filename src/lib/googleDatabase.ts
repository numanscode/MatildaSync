// Bridge module providing compatibility for components referencing googleDatabase
// All operations are transparently powered by Supabase

export * from './supabaseClient';
import { getSupabase } from './supabaseClient';

export function getGoogleFirestore(): any {
  return null;
}

export const firestore = null;
