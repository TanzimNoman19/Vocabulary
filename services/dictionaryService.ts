
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
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

// Singleton instance to avoid re-initialization overhead
let aiInstance: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiInstance) {
    // API_KEY is guaranteed by the platform according to instructions
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  }
  return aiInstance;
};

/**
 * Searches for vocabulary suggestions using Datamuse API with safety fallback
 */
export async function searchVocabulary(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  // Proactive offline check
  if (!navigator.onLine) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for suggestions

    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(cleanQuery)}&max=8`, {
        signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    // Quietly fallback to local data for search suggestions
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8);
  }
}

/**
 * Fetches data using Gemini API with retry logic and silent local fallback for errors
 */
export async function fetchWordData(word: string, retries = 1): Promise<CardData> {
  const localFallback: CardData = {
    pos: 'word',
    ipa: 'N/A',
    definition: 'Full definition details are currently unavailable offline.',
    bengali: 'অফলাইন থাকার কারণে বিস্তারিত পাওয়া যায়নি',
    family: 'N/A',
    context: `The word "${word}" is frequently used in English.`,
    synonyms: 'N/A',
    antonyms: 'N/A',
    difficulty: 'Standard',
    source: 'Local Fallback'
  };

  if (!navigator.onLine) return localFallback;

  const ai = getAIClient();
  const prompt = `Define the English word "${word}" for a vocabulary flashcard.
  Return a JSON object with the following keys:
  "pos" (part of speech),
  "ipa" (phonetic pronunciation),
  "definition" (precise English meaning),
  "bengali" (accurate Bengali/Bangla translation),
  "family" (related forms),
  "context" (a natural example sentence),
  "synonyms" (comma separated string),
  "antonyms" (comma separated string),
  "difficulty" (Basic, Intermediate, Advanced, or Expert),
  "etymology" (short origin history),
  "usage_notes" (nuanced usage advice).
  No markdown, just raw JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const data = JSON.parse(response.text || '{}');
    return {
      ...data,
      source: 'Gemini AI'
    };
  } catch (error: any) {
    const errorMsg = error.message || '';
    
    // Retry once for network/fetch failures
    if (retries > 0 && (errorMsg.includes('fetch') || errorMsg.includes('Network') || errorMsg.includes('Failed'))) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return fetchWordData(word, retries - 1);
    }

    console.warn(`Dictionary fetch failed for "${word}":`, errorMsg);
    return localFallback;
  }
}

export function getLocalRandomWord(level: VocabLevel = 'intermediate'): string {
    const pool = VOCAB_LEVELS[level] || DICTIONARY_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    // Use a lightweight version or just rely on fetchWordData's internal safety
    const data = await fetchWordData(word);
    return `(${data.pos}) ${data.definition}\n${data.bengali}`;
  } catch (e) {
    return "Definition unavailable. Check your connection.";
  }
}
