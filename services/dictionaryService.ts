
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from '@google/genai';
import { DICTIONARY_WORDS } from './dictionaryData';
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

const DEFAULT_MODEL = 'gemini-3-flash-preview';

export const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

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
    pos: { type: Type.STRING, description: "Part of speech, e.g., 'noun', 'adjective'." },
    definition: { type: Type.STRING, description: "Clear academic definition in English." },
    bengali: { type: Type.STRING, description: "Precise Bengali translation." },
    family: { type: Type.STRING, description: "Related words with POS in brackets." },
    context: { type: Type.STRING, description: "A sentence showing usage." },
    synonyms: { type: Type.STRING, description: "Comma separated synonyms." },
    antonyms: { type: Type.STRING, description: "Comma separated antonyms." },
    difficulty: { type: Type.STRING, description: "Level, e.g., 'Basic', 'Advanced'." },
    usage_notes: { type: Type.STRING, description: "Include [TRAP], [MNEMONIC], [VIBE], [TIP] tags." }
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
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    return data.map((item: any) => capitalize(item.word));
  } catch (error) {
    return DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(cleanQuery.toLowerCase())).slice(0, 8).map(capitalize);
  }
}

export async function fetchWordData(word: string, definitionStyle: string = 'standard'): Promise<CardData> {
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const styleInstruction = definitionStyle === 'concise' 
    ? 'Keep it very brief.' 
    : (definitionStyle === 'detailed' ? 'Provide a nuanced, detailed definition.' : 'Standard definition.');
  
  const prompt = `Define the English word "${normalizedWord}" for a study flashcard. ${styleInstruction}`;
  
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: cardSchema
      }
    });
    const data = safeJsonParse(response.text, {});
    if (!data.definition) return localFallback;
    return { ...data, word: normalizedWord, source: 'Gemini Flash' };
  } catch (error: any) {
    console.error("fetchWordData failed", error);
    return localFallback;
  }
}

export async function generateSemanticClusters(words: string[], level: number = 1): Promise<SemanticCluster[]> {
    if (!navigator.onLine || words.length === 0) return [];
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Group these vocabulary words into semantic clusters: ${words.join(', ')}. Complexity level: ${level}/2.`;

    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
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
              }
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

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const excludeStr = excludeWords.length > 0 ? `Do NOT include: ${excludeWords.slice(-50).join(', ')}.` : '';
  const prompt = `Generate ${count} distinct English vocabulary words for level: ${level}. ${excludeStr}`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
              ...cardSchema,
              properties: { 
                ...cardSchema.properties, 
                word: { type: Type.STRING } 
              },
              required: [...cardSchema.required, "word"]
          }
        }
      }
    });
    const data = safeJsonParse(response.text, []);
    return data.map((item: any) => ({ 
      ...item, 
      word: capitalize(item.word || ''), 
      source: 'Gemini Discovery' 
    }));
  } catch (error) {
    console.error("fetchExplorePack failed", error);
    return [];
  }
}

export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Create flashcard data for these words: ${words.join(', ')}.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
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
        }
      }
    });
    const results = safeJsonParse(response.text, []);
    const finalCache: Record<string, CardData> = {};
    results.forEach((item: any) => {
      if (item.word) finalCache[capitalize(item.word)] = { ...item, word: capitalize(item.word), source: 'Gemini Bulk' };
    });
    return finalCache;
  } catch (error) {
    console.error("Bulk generation failed", error);
    return {};
  }
}

export async function fetchContextSentence(word: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Generate one sophisticated academic example sentence for "${word}":`
    });
    return response.text?.trim() || `Example sentence for ${word}.`;
  } catch (error) {
    return `Could not generate sentence for "${word}".`;
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Short definition for "${word}" (pos, English definition, Bengali meaning):`
    });
    return response.text?.trim() || "Definition unavailable.";
  } catch (e) {
    return "Definition unavailable.";
  }
}

export const createChatSession = () => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { 
      systemInstruction: "You are LexiFlow AI, a vocabulary expert. Help users manage their word lists."
    }
  });
};
