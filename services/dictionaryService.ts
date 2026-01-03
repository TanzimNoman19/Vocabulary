
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from '@google/genai';
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

/**
 * Robust JSON cleaner to handle markdown blocks sometimes returned by models
 */
const safeJsonParse = (text: string | undefined, fallback: any) => {
  if (!text) return fallback;
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse failed", e, text);
    return fallback;
  }
};

const cardSchema = {
  type: Type.OBJECT,
  properties: {
    pos: { type: Type.STRING },
    definition: { type: Type.STRING },
    bengali: { type: Type.STRING },
    family: { type: Type.STRING },
    context: { type: Type.STRING },
    synonyms: { type: Type.STRING },
    antonyms: { type: Type.STRING },
    difficulty: { type: Type.STRING },
    usage_notes: { type: Type.STRING }
  },
  required: ["pos", "definition", "bengali", "family", "context", "synonyms", "antonyms", "difficulty"]
};

export async function searchVocabulary(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];
  if (!navigator.onLine) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8).map(capitalize);
  }
  try {
    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(cleanQuery)}&max=8`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.map((item: any) => capitalize(item.word));
  } catch (error) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8).map(capitalize);
  }
}

export async function fetchWordData(word: string, definitionStyle: string = 'standard', retries = 1): Promise<CardData> {
  const normalizedWord = capitalize(word);
  const localFallback: CardData = {
    pos: 'word',
    definition: `Details for "${normalizedWord}" are pending.`,
    bengali: 'অফলাইন বা ত্রুটির কারণে বিস্তারিত পাওয়া যায়নি',
    family: 'N/A',
    context: `The word "${normalizedWord}" is in your library.`,
    synonyms: 'N/A',
    antonyms: 'N/A',
    difficulty: 'Standard',
    source: 'Local Cache',
    word: normalizedWord
  };

  if (!navigator.onLine) return localFallback;
  const ai = getAIClient();
  const styleInstruction = definitionStyle === 'concise' 
    ? 'Keep the definition brief (under 12 words).' 
    : (definitionStyle === 'detailed' ? 'Provide a detailed, nuanced definition.' : 'Provide a standard, clear definition.');
  
  const prompt = `Define the English word "${normalizedWord}" for a vocabulary card. 
  ${styleInstruction} 
  Rules: "family" must include POS in brackets (e.g. "happiness (n)"). "usage_notes" use [TRAP], [MNEMONIC], [VIBE], [TIP].`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: cardSchema,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const data = safeJsonParse(response.text, {});
    if (!data.definition) return localFallback;
    
    if (data.bengali) data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
    return { ...data, word: normalizedWord, source: 'Gemini AI' };
  } catch (error: any) {
    if (retries > 0) return fetchWordData(normalizedWord, definitionStyle, retries - 1);
    return localFallback;
  }
}

export async function generateSemanticClusters(words: string[], level: number = 2): Promise<SemanticCluster[]> {
    if (!navigator.onLine || words.length === 0) return [];
    const ai = getAIClient();
    
    const prompt = `Group these words by similarity (level ${level}/2): ${words.join(', ')}. 
    Return a list of clusters with a title, member words, and explanation.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    members: { type: Type.ARRAY, items: { type: Type.STRING } },
                    explanation: { type: Type.STRING }
                  },
                  required: ["title", "members", "explanation"]
                }
              },
              thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        const data = safeJsonParse(response.text, []);
        return data.map((item: any, idx: number) => ({
            ...item,
            id: `cluster-${idx}-${Date.now()}`,
            isAiGenerated: true
        }));
    } catch (e) {
        return [];
    }
}

export async function fetchExplorePack(level: VocabLevel = 'intermediate', count: number = 10, excludeWords: string[] = []): Promise<CardData[]> {
  if (!navigator.onLine) throw new Error("Offline");
  const ai = getAIClient();
  const excludeStr = excludeWords.length > 0 ? `Do NOT include: ${excludeWords.slice(-50).join(', ')}.` : '';
  
  const prompt = `Generate ${count} interesting ${level} level vocabulary words. ${excludeStr}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: cardSchema
        },
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const data = safeJsonParse(response.text, []);
    return data.map((item: any) => ({ 
      ...item, 
      word: capitalize(item.word || ''), 
      bengali: item.bengali?.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim(), 
      source: 'Gemini Explore' 
    }));
  } catch (error) {
    return [];
  }
}

export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  if (!navigator.onLine) throw new Error("Offline");
  const ai = getAIClient();
  const prompt = `Generate full card data for these words: ${words.join(', ')}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            ...cardSchema,
            properties: { ...cardSchema.properties, word: { type: Type.STRING } },
            required: [...cardSchema.required, "word"]
          }
        },
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const results = safeJsonParse(response.text, []);
    const finalCache: Record<string, CardData> = {};
    results.forEach((item: any) => {
      if (item.word) {
        const w = capitalize(item.word);
        finalCache[w] = { ...item, word: w, source: 'Gemini Bulk AI' };
      }
    });
    return finalCache;
  } catch (error) {
    throw error;
  }
}

export async function fetchContextSentence(word: string): Promise<string> {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Sentence for "${word}":`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.trim() || `Example using ${word}.`;
  } catch (error) {
    return `Could not generate sentence for "${word}".`;
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    const data = await fetchWordData(word);
    return `(${data.pos}) ${data.definition}\n${data.bengali}`;
  } catch (e) {
    return "Definition unavailable.";
  }
}
