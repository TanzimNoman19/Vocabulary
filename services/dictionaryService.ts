
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { DICTIONARY_WORDS, VOCAB_LEVELS } from './dictionaryData';

export interface CardData {
  pos: string;
  ipa: string;
  definition: string;
  bengali: string;
  family: string;
  context: string;
  synonyms: string;
  antonyms: string;
  difficulty: string;
  etymology?: string;
  usage_notes?: string;
  source?: string;
}

export type VocabLevel = 'basic' | 'intermediate' | 'gre' | 'ielts' | 'expert';

/**
 * Searches for vocabulary suggestions using Datamuse API
 */
export async function searchVocabulary(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];
  try {
    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(cleanQuery)}&max=8`);
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8);
  }
}

/**
 * Fetches data from Free Dictionary API
 */
export async function fetchWordData(word: string): Promise<CardData> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!response.ok) throw new Error('Word not found');
    
    const data = await response.json();
    const entry = data[0];
    const meaning = entry.meanings[0];
    const definition = meaning.definitions[0];
    
    // Determine level based on local data if available
    let difficulty = 'Standard';
    for (const [lvl, words] of Object.entries(VOCAB_LEVELS)) {
        if (words.includes(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())) {
            difficulty = lvl.toUpperCase();
            break;
        }
    }

    return {
      pos: meaning.partOfSpeech || 'word',
      ipa: entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text) || 'N/A',
      definition: definition.definition || 'No definition available.',
      bengali: '', 
      family: meaning.partOfSpeech || 'N/A',
      context: definition.example || `The word "${word}" is commonly used in English literature.`,
      synonyms: meaning.synonyms?.slice(0, 4).join(', ') || 'N/A',
      antonyms: meaning.antonyms?.slice(0, 4).join(', ') || 'N/A',
      difficulty: difficulty,
      etymology: 'Refer to library for historical context.',
      usage_notes: '',
      source: 'Free Dictionary API'
    };
  } catch (error) {
    return {
      pos: 'word',
      ipa: 'N/A',
      definition: 'Definition temporarily unavailable from public API.',
      bengali: '',
      family: 'N/A',
      context: '',
      synonyms: 'N/A',
      antonyms: 'N/A',
      difficulty: 'Unknown',
      source: 'Local Cache'
    };
  }
}

export function getLocalRandomWord(level: VocabLevel = 'intermediate'): string {
    const pool = VOCAB_LEVELS[level] || DICTIONARY_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (res.ok) {
        const data = await res.json();
        const m = data[0].meanings[0];
        return `(${m.partOfSpeech}) ${m.definitions[0].definition}`;
    }
  } catch (e) {}
  return "Definition unavailable.";
}
