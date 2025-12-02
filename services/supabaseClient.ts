/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oiegbafyoddklymbiuza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZWdiYWZ5b2Rka2x5bWJpdXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjAwMTAsImV4cCI6MjA4MDIzNjAxMH0.RFHTsIkGvqaW2TEBx6k8QF6egH0rqbaVNpeYMa4v7VM';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const saveUserData = async (userId: string, data: any) => {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: data, updated_at: new Date() }, { onConflict: 'user_id' });
  
  if (error) console.error('Error saving data:', error);
};

export const getUserData = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" which is fine for new users
    console.error('Error fetching data:', error);
    return null;
  }
  return data?.data || null;
};