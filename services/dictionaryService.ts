
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import { DICTIONARY_WORDS, VOCAB_LEVELS } from './dictionaryData';
import { SemanticCluster } from '../App';

export interface CardData {
  pos: string;
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

export const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

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
  const ai = getAIClient();
  const styleInstruction = definitionStyle === 'concise' 
    ? 'Keep the definition very brief (under 12 words).' 
    : (definitionStyle === 'detailed' ? 'Provide a rich, nuanced definition (approx 30-40 words).' : 'Provide a standard, clear definition.');
  
  const prompt = `Define the English word "${normalizedWord}" for a vocabulary flashcard.
  ${styleInstruction}
  Return a JSON object with the following keys:
  "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  RULES:
  1. "family": Include related forms WITH their part of speech in brackets. Example: "happily (adv), happiness (n)".
  2. "bengali": Provide an elaborative definition.
  3. "usage_notes": Use [TRAP], [MNEMONIC], [VIBE], [TIP].
  Format: Raw JSON only.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    const data = JSON.parse(response.text || '{}');
    if (data.bengali) data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
    return { ...data, word: normalizedWord, source: 'Gemini AI' };
  } catch (error: any) {
    if (retries > 0) return fetchWordData(normalizedWord, definitionStyle, retries - 1);
    return localFallback;
  }
}

export async function generateSemanticClusters(words: string[], level: number = 2): Promise<SemanticCluster[]> {
    if (!navigator.onLine) return [];
    const ai = getAIClient();
    
    let levelInstruction = "";
    if (level === 0) {
        levelInstruction = "Level: STRICT. Only group words that are direct synonyms or share the exact same definition. If a word has no perfect synonym in the list, leave it alone.";
    } else if (level === 1) {
        levelInstruction = "Level: RELATED. Group words that are close in meaning, share a common root idea, or belong to the same specific semantic field (e.g., 'fleeting' and 'temporary').";
    } else {
        levelInstruction = "Level: THEMATIC. Group words by broad conceptual themes, contexts, or abstract domains (e.g., 'Scientific Discovery', 'States of Mind', 'Beauty and Art').";
    }

    const prompt = `Organize these English words into meaningful groups based on the requested similarity level: ${words.join(', ')}.
    ${levelInstruction}
    
    Return a JSON array of objects with:
    "title": A creative name for the group.
    "members": Array of words from the input belonging to this group.
    "explanation": A 1-sentence summary. For STRICT/RELATED levels, explain the 'Common Meaning'. For THEMATIC level, explain the 'Theme'.
    
    RULES:
    1. Every input word must belong to exactly one group.
    2. Format: Raw JSON array only.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        });
        const data = JSON.parse(response.text || '[]');
        return data.map((item: any, idx: number) => ({
            ...item,
            id: `cluster-lvl${level}-${idx}-${Date.now()}`,
            isAiGenerated: true,
            level: level // Track which level this was generated for
        }));
    } catch (e) {
        console.error("Clustering failed", e);
        return [];
    }
}

export async function fetchExplorePack(level: VocabLevel = 'intermediate', count: number = 10, excludeWords: string[] = []): Promise<CardData[]> {
  if (!navigator.onLine) throw new Error("Offline: Cannot explore new words.");
  const ai = getAIClient();
  const excludeInstruction = excludeWords.length > 0 
    ? `CRITICAL MANDATORY RULE: Do NOT include any of these words in the output: ${excludeWords.slice(-300).join(', ')}. No exceptions.` 
    : '';
  
  const prompt = `Generate a pack of ${count} unique, interesting English vocabulary words suitable for a ${level} level learner.
  ${excludeInstruction}
  
  MANDATORY: For EVERY word, provide the COMPREHENSIVE details. You MUST not skip "definition" or "pos".
  
  Return a JSON array of objects with the following EXACT keys for each word:
  "word", "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  RULES:
  1. "family": You MUST include related forms WITH their part of speech in brackets. Example: "happily (adv), happiness (n), happy (adj)".
  2. "definition": Provide a clear, dictionary-grade English meaning.
  3. "bengali": Provide an accurate Bangla meaning.
  
  Format: Raw JSON array only. No markdown formatting or extra text.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    const data = JSON.parse(response.text || '[]');
    return data.map(item => ({ 
      ...item, 
      word: capitalize(item.word || ''), 
      bengali: item.bengali?.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim(), 
      source: 'Gemini Explore' 
    }));
  } catch (error) {
    console.error("Explore fetch failed", error);
    return [];
  }
}

export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  if (!navigator.onLine) throw new Error("Offline: Cannot use AI bulk generation.");
  const ai = getAIClient();
  
  const prompt = `Generate comprehensive vocabulary flashcard data for the following words: ${words.join(', ')}.
  
  For EACH word, return an object with EXACTLY these keys:
  "word", "pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty", "etymology", "usage_notes".
  
  CRITICAL REQUIREMENTS:
  1. "word": The input word capitalized (first letter only, rest lowercase).
  2. "family": List related forms WITH POS in brackets (e.g. "happily (adv), happiness (n)").
  3. "usage_notes": Provide 1-2 creative tips using [TRAP], [MNEMONIC], [VIBE], or [TIP] tags.
  4. "etymology": Brief origin story.
  5. "bengali": Accurate Bengali meaning without phonetic brackets.
  
  Return as a raw JSON array of objects only. No markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    const results = JSON.parse(response.text || '[]');
    const finalCache: Record<string, CardData> = {};
    if (Array.isArray(results)) {
      results.forEach((item: any) => {
        if (!item.word) return;
        const normalizedW = capitalize(item.word);
        finalCache[normalizedW] = { 
            ...item, 
            word: normalizedW, 
            bengali: item.bengali?.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim(),
            source: 'Gemini Bulk AI' 
        } as CardData;
      });
    }
    return finalCache;
  } catch (error: any) {
    console.error("Bulk generation failed", error);
    throw error;
  }
}

export async function fetchContextSentence(word: string): Promise<string> {
  const normalizedWord = capitalize(word);
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
