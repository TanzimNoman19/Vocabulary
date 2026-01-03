
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from '@google/genai';
import { DICTIONARY_WORDS } from './dictionaryData';
import { getCachedDefinition, saveCachedDefinition } from './supabaseClient';

export type WordSource = 'ai' | 'free' | 'local';

let aiInstance: GoogleGenAI | null = null;
const getAiClient = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiInstance;
};

const textModelName = 'gemini-3-flash-preview';

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

export interface AsciiArtData {
  art: string;
  text?: string;
}

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

export async function* streamDefinition(
  topic: string,
  source: WordSource = 'ai'
): AsyncGenerator<string, void, undefined> {
  try {
    const cached = await getCachedDefinition(topic);
    if (cached) {
      yield `POS: ${cached.pos}\nDEFINITION: ${cached.definition}\nBENGALI: ${cached.bengali}\nWORD FAMILY: ${cached.family}\nCONTEXT: ${cached.context}\nSYNONYMS: ${cached.synonyms}\nANTONYMS: ${cached.antonyms}\nDIFFICULTY: ${cached.difficulty}`;
      return;
    }
  } catch (e) {}

  if (!process.env.API_KEY) {
    yield 'Error: API key missing.';
    return;
  }

  const prompt = `Define "${topic}" for a vocabulary flashcard.
  Format headers exactly:
  POS: [part of speech]
  DEFINITION: [meaning]
  BENGALI: [meaning]
  WORD FAMILY: [related forms]
  CONTEXT: [sentence]
  SYNONYMS: [list]
  ANTONYMS: [list]
  DIFFICULTY: [rating]`;

  try {
    const response = await getAiClient().models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    let fullResult = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResult += chunk.text;
        yield chunk.text;
      }
    }

    if (fullResult) {
      const parsed = parseFlashcardResponse(fullResult);
      if (parsed.definition) {
        await saveCachedDefinition(topic, parsed);
      }
    }
  } catch (error: any) {
    yield `Error: Service unreachable.`;
  }
}

export function parseFlashcardResponse(text: string): CardData {
  const extract = (key: string) => {
    const regex = new RegExp(`${key}:\\s*(.*?)(?=\\s*\\n\\s*[A-Z ]+:|$)`, 'si');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  return {
    pos: extract('POS'), 
    definition: extract('DEFINITION'),
    bengali: extract('BENGALI'), 
    family: extract('WORD FAMILY'), 
    context: extract('CONTEXT'),
    synonyms: extract('SYNONYMS'), 
    antonyms: extract('ANTONYMS'), 
    difficulty: extract('DIFFICULTY'),
    source: 'Gemini AI'
  };
}

export async function getShortDefinition(word: string): Promise<string> {
  const cached = await getCachedDefinition(word);
  if (cached) return `(${cached.pos}) ${cached.definition}\n${cached.bengali}`;
  
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: textModelName,
      contents: `Short definition for "${word}" (pos, meaning, bengali meaning):`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || "Definition unavailable.";
  } catch (e) {
    return "Definition unavailable.";
  }
}

export const createChatSession = () => {
  return getAiClient().chats.create({
    model: textModelName,
    config: { 
      systemInstruction: `You are LexiFlow AI, a vocabulary expert. Use tools to add words to the user's list.`,
    }
  });
};

export async function generateCreativePrompt(): Promise<string> {
  const ai = getAiClient();
  const res = await ai.models.generateContent({
    model: textModelName,
    contents: "Suggest a creative story writing prompt for vocabulary learning.",
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return res.text || "A mystery in an ancient library...";
}

export async function generateStorySegment(p: string, prev: string = ''): Promise<string> {
  const ai = getAiClient();
  const res = await ai.models.generateContent({
    model: textModelName,
    contents: `Prompt: ${p}. ${prev ? `Previous: ${prev}` : ''}. Write a short segment using sophisticated vocabulary.`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return res.text || "Story content...";
}

export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  return { art: `[ASCII Art for ${topic}]` };
}
