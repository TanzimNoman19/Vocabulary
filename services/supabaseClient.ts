
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Define and export UserHistoryItem interface used in HistoryView.tsx
export interface UserHistoryItem {
  word: string;
  timestamp: number;
}

const supabaseUrl = 'https://oiegbafyoddklymbiuza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWdiYWZ5b2Rka2x5bWJpdXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjAwMTAsImV4cCI6MjA4MDIzNjAxMH0.RFHTsIkGvqaW2TEBx6k8QF6egH0rqbaVNpeYMa4v7VM';

// Initialize Supabase Client with standard options
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce' 
  }
});

/**
 * Health check for the Supabase API.
 * Uses the settings endpoint which is usually public.
 */
export const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        // Attempt to fetch a minimal endpoint to check project status
        const response = await fetch(`${supabaseUrl}/auth/v1/health`, { 
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e) {
        console.error("Supabase connection check failed:", e);
        return false;
    }
};

let isGlobalCacheAvailable = true;

/**
 * Saves user-specific data to the cloud.
 */
export const saveUserData = async (userId: string, data: any) => {
  if (!navigator.onLine) return;
  
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { 
          user_id: userId, 
          data: data, 
          updated_at: new Date().toISOString() 
        }, 
        { onConflict: 'user_id' }
      );
    
    if (error && !error.message?.includes('fetch')) {
      console.warn('Sync error:', error.message);
    }
  } catch (e) {}
};

/**
 * Loads user data from the cloud.
 */
export const getUserData = async (userId: string) => {
  if (!navigator.onLine) return null;

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('Data fetch error:', error);
        }
        return null;
    }
    return data?.data || null;
  } catch (e) {
    return null;
  }
};

/**
 * Checks for a word definition in the global cache.
 */
export const getCachedDefinition = async (word: string) => {
  if (!word || !isGlobalCacheAvailable || !navigator.onLine) return null;
  
  try {
    const { data, error } = await supabase
      .from('word_definitions')
      .select('data')
      .eq('word', word.toLowerCase())
      .single();
    
    if (error) {
      if (error.code === '42P01') { 
        isGlobalCacheAvailable = false;
      }
      return null;
    }
    return data?.data || null;
  } catch (e) {
    return null;
  }
};

/**
 * Caches a word definition for all users to see.
 */
export const saveCachedDefinition = async (word: string, definitionData: any) => {
  if (!word || !definitionData || !isGlobalCacheAvailable || !navigator.onLine) return;

  try {
    const { error } = await supabase
      .from('word_definitions')
      .upsert(
        { 
          word: word.toLowerCase(), 
          data: definitionData, 
          created_at: new Date().toISOString() 
        },
        { onConflict: 'word' }
      );
    
    if (error && error.code !== '23505') { 
      console.warn('Cache save error:', error.message);
    }
  } catch (e: any) {}
};