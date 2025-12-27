
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

let aiInstance: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiInstance) {
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

  if (!navigator.onLine) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(cleanQuery)}&max=8`, {
        signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8);
  }
}

/**
 * Fetches data using Gemini API with retry logic and enhanced local fallback
 */
export async function fetchWordData(word: string, retries = 1): Promise<CardData> {
  const isLocalWord = DICTIONARY_WORDS.some(w => w.toLowerCase() === word.toLowerCase());
  
  const localFallback: CardData = {
    pos: isLocalWord ? 'common word' : 'word',
    ipa: 'N/A',
    definition: `Full AI-enhanced details for "${word}" are pending download.`,
    bengali: 'অফলাইন থাকার কারণে বিস্তারিত পাওয়া যায়নি',
    family: 'N/A',
    context: `The term "${word}" is currently saved in your offline library.`,
    synonyms: 'N/A',
    antonyms: 'N/A',
    difficulty: 'Standard',
    source: 'Local Cache'
  };

  if (!navigator.onLine) return localFallback;

  const ai = getAIClient();
  const prompt = `Define the English word "${word}" for a vocabulary flashcard.
  Return a JSON object with the following keys:
  "pos", "ipa", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
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
    if (retries > 0 && (errorMsg.includes('fetch') || errorMsg.includes('Network'))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWordData(word, retries - 1);
    }
    return localFallback;
  }
}

export function getLocalRandomWord(level: VocabLevel = 'intermediate'): string {
    const pool = VOCAB_LEVELS[level] || DICTIONARY_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    const data = await fetchWordData(word);
    return `(${data.pos}) ${data.definition}\n${data.bengali}`;
  } catch (e) {
    return "Definition unavailable offline.";
  }
}
