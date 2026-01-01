
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
  word?: string;
}

export type VocabLevel = 'basic' | 'intermediate' | 'gre' | 'ielts' | 'expert';

let aiInstance: GoogleGenAI | null = null;

// Fixed: Using process.env.API_KEY directly as per SDK guidelines
const getAIClient = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  
  RULES:
  1. "bengali": Provide an elaborative, descriptive Bengali definition. NO phonetic English in parentheses.
  2. "usage_notes": BE CREATIVE AND STRUCTURED. Use these labels: [TRAP], [MNEMONIC], [VIBE], [TIP].
  3. Format: Raw JSON only.`;

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
    
    if (data.bengali) {
      data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
    }

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

/**
 * Generates a pack of 10 unique, high-quality words in one API call.
 */
export async function fetchExplorePack(level: VocabLevel = 'intermediate'): Promise<CardData[]> {
  if (!navigator.onLine) throw new Error("Offline: Cannot explore new words.");

  const ai = getAIClient();
  const prompt = `Generate a pack of 10 unique, interesting English vocabulary words suitable for a ${level} level learner.
  Return a JSON array of objects. Each object must contain:
  "word", "pos", "ipa", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  RULES:
  1. Avoid extremely common words. Focus on descriptive, academic, or literary terms.
  2. "bengali": Precise meaning.
  3. "usage_notes": Use [TRAP], [MNEMONIC], [VIBE] labels.
  Format: Raw JSON array only.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const data = JSON.parse(response.text || '[]');
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      ...item,
      bengali: item.bengali?.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim(),
      source: 'Gemini Explore'
    }));
  } catch (error) {
    console.error("Explore pack error:", error);
    return [];
  }
}

/**
 * Batch generate data for multiple words.
 */
export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  if (!navigator.onLine) throw new Error("Offline: Cannot use AI bulk generation.");
  if (words.length === 0) return {};

  const ai = getAIClient();
  const prompt = `Generate comprehensive vocabulary flashcard data for: ${words.join(', ')}.
  Return a JSON array of objects. Each object must have a "word" key plus:
  "pos", "ipa", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  USAGE_NOTES RULE: Be creative and highly practical. Always use structured labels like [TRAP], [MNEMONIC], [VIBE], and [TIP] within the string to separate different types of advice.
  Example usage_note: "[TRAP]: Often confused with X. [MNEMONIC]: Remember Y."
  No markdown, just raw JSON array only.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const results = JSON.parse(response.text || '[]');
    const finalCache: Record<string, CardData> = {};

    if (Array.isArray(results)) {
      results.forEach((item: any) => {
        if (!item.word) return;
        const { word: w, ...data } = item;
        if (data.bengali) {
            data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
        }
        finalCache[w] = { ...data, source: 'Gemini Bulk AI' } as CardData;
      });
    }

    return finalCache;
  } catch (error: any) {
    console.error("Bulk AI Gen Error:", error);
    throw error;
  }
}

/**
 * Generates only a context sentence for a given word using Gemini AI.
 */
export async function fetchContextSentence(word: string): Promise<string> {
  if (!navigator.onLine) return `The word "${word}" is useful in many contexts.`;

  const ai = getAIClient();
  const prompt = `Generate one concise, illustrative example sentence for the word "${word}". No intro, just the sentence.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text.trim();
  } catch (error) {
    return `Could not generate sentence for "${word}".`;
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
