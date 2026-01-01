
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import { DICTIONARY_WORDS, VOCAB_LEVELS } from './dictionaryData';

export interface CardData {
  pos: string;
  // Added optional ipa property to support phonetic transcription during bulk import
  ipa?: string;
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

const getAIClient = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiInstance;
};

/**
 * Utility to ensure the first letter is always capital
 */
export const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export async function searchVocabulary(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  if (!navigator.onLine) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8).map(capitalize);
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
    return data.map((item: any) => capitalize(item.word));
  } catch (error) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8).map(capitalize);
  }
}

export async function fetchWordData(word: string, definitionStyle: string = 'standard', retries = 1): Promise<CardData> {
  const normalizedWord = capitalize(word);
  const isLocalWord = DICTIONARY_WORDS.some(w => w.toLowerCase() === word.toLowerCase());
  
  const localFallback: CardData = {
    pos: isLocalWord ? 'common word' : 'word',
    definition: `Full AI-enhanced details for "${normalizedWord}" are pending download.`,
    bengali: 'অফলাইন থাকার কারণে বিস্তারিত পাওয়া যায়নি',
    family: 'N/A',
    context: `The term "${normalizedWord}" is currently saved in your offline library.`,
    synonyms: 'N/A',
    antonyms: 'N/A',
    difficulty: 'Standard',
    source: 'Local Cache',
    word: normalizedWord
  };

  if (!navigator.onLine) return localFallback;

  const styleInstruction = definitionStyle === 'concise' 
    ? 'Keep the definition very brief (under 12 words).' 
    : (definitionStyle === 'detailed' ? 'Provide a rich, nuanced definition (approx 30-40 words).' : 'Provide a standard, clear definition.');

  const ai = getAIClient();
  const prompt = `Define the English word "${normalizedWord}" for a vocabulary flashcard.
  ${styleInstruction}
  Return a JSON object with the following keys:
  "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  RULES:
  1. "family": IMPORTANT: Include related forms WITH their part of speech in brackets. Example: "Creation (n), Creative (adj), Creatively (adv)".
  2. "bengali": Provide an elaborative, descriptive Bengali definition. NO phonetic English in parentheses.
  3. "usage_notes": BE CREATIVE AND STRUCTURED. Use these labels: [TRAP], [MNEMONIC], [VIBE], [TIP].
  4. Format: Raw JSON only.`;

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
      word: normalizedWord,
      source: 'Gemini AI'
    };
  } catch (error: any) {
    const errorMsg = error.message || '';
    if (retries > 0 && (errorMsg.includes('fetch') || errorMsg.includes('Network'))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWordData(normalizedWord, definitionStyle, retries - 1);
    }
    return localFallback;
  }
}

export async function fetchExplorePack(level: VocabLevel = 'intermediate', count: number = 10): Promise<CardData[]> {
  if (!navigator.onLine) throw new Error("Offline: Cannot explore new words.");

  const ai = getAIClient();
  const prompt = `Generate a pack of ${count} unique, interesting English vocabulary words suitable for a ${level} level learner.
  Return a JSON array of objects. Each object must contain:
  "word", "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  RULES:
  1. Avoid extremely common words. Focus on descriptive, academic, or literary terms.
  2. "family": Include related forms WITH their part of speech in brackets. Example: "Creation (n), Creative (adj)".
  3. "bengali": Precise meaning.
  4. "usage_notes": Use [TRAP], [MNEMONIC], [VIBE] labels.
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
      word: capitalize(item.word),
      bengali: item.bengali?.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim(),
      source: 'Gemini Explore'
    }));
  } catch (error) {
    console.error("Explore pack error:", error);
    return [];
  }
}

export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  if (!navigator.onLine) throw new Error("Offline: Cannot use AI bulk generation.");
  if (words.length === 0) return {};

  const ai = getAIClient();
  const capitalizedInput = words.map(capitalize);
  const prompt = `Generate comprehensive vocabulary flashcard data for: ${capitalizedInput.join(', ')}.
  Return a JSON array of objects. Each object must have a "word" key plus:
  "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  RULES:
  1. "family": Include related forms WITH their part of speech in brackets. Example: "Ephemeral (adj), Ephemerality (n)".
  2. USAGE_NOTES RULE: Be creative and highly practical. Always use structured labels like [TRAP], [MNEMONIC], [VIBE], and [TIP] within the string to separate different types of advice.
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
        const normalizedW = capitalize(item.word);
        const { word: w, ...data } = item;
        if (data.bengali) {
            data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
        }
        finalCache[normalizedW] = { ...data, word: normalizedW, source: 'Gemini Bulk AI' } as CardData;
      });
    }

    return finalCache;
  } catch (error: any) {
    console.error("Bulk AI Gen Error:", error);
    throw error;
  }
}

export async function fetchContextSentence(word: string): Promise<string> {
  const normalizedWord = capitalize(word);
  if (!navigator.onLine) return `The word "${normalizedWord}" is useful in many contexts.`;

  const ai = getAIClient();
  const prompt = `Generate one concise, illustrative example sentence for the word "${normalizedWord}". No intro, just the sentence.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text.trim();
  } catch (error) {
    return `Could not generate sentence for "${normalizedWord}".`;
  }
}

export function getLocalRandomWord(level: VocabLevel = 'intermediate'): string {
    const pool = VOCAB_LEVELS[level] || DICTIONARY_WORDS;
    return capitalize(pool[Math.floor(Math.random() * pool.length)]);
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    const data = await fetchWordData(word);
    return `(${data.pos}) ${data.definition}\n${data.bengali}`;
  } catch (e) {
    return "Definition unavailable offline.";
  }
}
