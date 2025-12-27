/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oiegbafyoddklymbiuza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWdiYWZ5b2Rka2x5bWJpdXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjAwMTAsImV4cCI6MjA4MDIzNjAxMH0.RFHTsIkGvqaW2TEBx6k8QF6egH0rqbaVNpeYMa4v7VM';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface UserHistoryItem {
  word: string;
  timestamp: number;
}

/**
 * NOTE: To use global caching, you must create a table named 'word_definitions' 
 * with 'word' (text, primary key), 'data' (jsonb), and 'created_at' (timestamptz).
 */
let isGlobalCacheAvailable = true;

/**
 * Saves user-specific data (saved words, SRS, history, etc.)
 */
export const saveUserData = async (userId: string, data: any) => {
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
    
    if (error) {
      // Only log if it's not a standard network failure
      if (!error.message?.includes('fetch')) {
        console.error('Supabase error (user_data):', error.message);
      }
    }
  } catch (e) {
    // Silent fail for network errors
  }
};

/**
 * Fetches user-specific data
 */
export const getUserData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return null;
    }
    return data?.data || null;
  } catch (e) {
    return null;
  }
};

/**
 * Global Cache for word definitions to share across all users.
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
      // Detect if the table doesn't exist to prevent repeated errors
      if (error.message?.includes('word_definitions') && (error.message?.includes('not find') || error.code === '42P01')) {
        console.warn('Global cache table missing. Falling back to AI-only mode.');
        isGlobalCacheAvailable = false;
      }
      return null;
    }
    return data?.data || null;
  } catch (e) {
    // If fetch failed, assume network issue and return null silently
    return null;
  }
};

/**
 * Saves a generated definition to the global cache.
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
    
    if (error) {
      // Check for table missing error
      if (error.message?.includes('word_definitions') && (error.message?.includes('not find') || error.code === '42P01')) {
        isGlobalCacheAvailable = false;
        return;
      }
      
      // Ignore duplicate key errors (23505) and generic fetch errors
      const isNetworkError = error.message?.toLowerCase().includes('fetch');
      if (error.code !== '23505' && !isNetworkError) { 
        console.error('Error caching definition:', error.message);
      }
    }
  } catch (e: any) {
    // Catch-all for TypeError: Failed to fetch and other browser-level network errors
    // We treat these as silent failures because caching is an optimization, not a requirement.
  }
};