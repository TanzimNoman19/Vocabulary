/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Tool, FunctionDeclaration, Type, Modality} from '@google/genai';
import { DICTIONARY_WORDS } from './dictionaryData';
import { getCachedDefinition, saveCachedDefinition } from './supabaseClient';

let ai: GoogleGenAI;
const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      ai = new GoogleGenAI({apiKey: 'MISSING_KEY'}); 
    } else {
      ai = new GoogleGenAI({apiKey: apiKey});
    }
  }
  return ai;
};

const textModelName = 'gemini-3-flash-preview';

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
}

const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429 || error.code === 429) return true;
  const msg = error.message || '';
  if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) return true;
  return false;
};

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

/**
 * Streams a definition, checking Supabase first.
 */
export async function* streamDefinition(
  topic: string,
  concise: boolean = false
): AsyncGenerator<string, void, undefined> {
  // 1. Check Global Cache First
  try {
    const cached = await getCachedDefinition(topic);
    if (cached) {
      // Reconstruct the format expected by the parser
      const formatted = `POS: ${cached.pos}\nIPA: ${cached.ipa}\nDEFINITION: ${cached.definition}\nBENGALI: ${cached.bengali}\nWORD FAMILY: ${cached.family}\nCONTEXT: ${cached.context}\nSYNONYMS: ${cached.synonyms}\nANTONYMS: ${cached.antonyms}\nDIFFICULTY: ${cached.difficulty}`;
      yield formatted;
      return;
    }
  } catch (e) {
    console.warn("Cache check failed", e);
  }

  if (!process.env.API_KEY) {
    yield 'Error: API_KEY is not configured.';
    return;
  }

  const prompt = `Define "${topic}" for a vocabulary flashcard.
  Format the response EXACTLY as follows using these headers:
  POS: [part of speech]
  IPA: [IPA pronunciation]
  DEFINITION: [Comprehensive and precise English definition, max 25 words]
  BENGALI: [Accurate Bengali meaning (Bangla Artho)]
  WORD FAMILY: [Related forms]
  CONTEXT: [One illustrative sentence using the word]
  SYNONYMS: [Comma separated list]
  ANTONYMS: [Comma separated list or N/A]
  DIFFICULTY: [One word rating: Basic, Intermediate, Advanced, SAT, GRE, or Rare]
  Do not add markdown bolding like **. Just raw text after headers.`;

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

    // After successful stream, cache the result
    if (fullResult) {
      const parsed = parseFlashcardResponse(fullResult);
      if (parsed.definition && !fullResult.includes("quota")) {
        await saveCachedDefinition(topic, parsed);
      }
    }

  } catch (error: any) {
    if (isQuotaError(error)) {
        // Yield an error code that the UI can catch to set isQuotaExceeded
        yield `ERROR: QUOTA_EXCEEDED`;
        return;
    }
    yield `Error: ${error.message}`;
  }
}

export async function fetchFullDefinition(topic: string): Promise<string> {
  let fullText = '';
  for await (const chunk of streamDefinition(topic)) { fullText += chunk; }
  return fullText;
}

export function parseFlashcardResponse(text: string): CardData {
  const extract = (key: string) => {
    const regex = new RegExp(`${key}:\\s*(.*?)(?=\\n[A-Z ]+:|$)`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  return {
    pos: extract('POS'), ipa: extract('IPA'), definition: extract('DEFINITION'),
    bengali: extract('BENGALI'), family: extract('WORD FAMILY'), context: extract('CONTEXT'),
    synonyms: extract('SYNONYMS'), antonyms: extract('ANTONYMS'), difficulty: extract('DIFFICULTY')
  };
}

export async function getRandomWord(): Promise<string> {
  const randomSeed = Math.floor(Math.random() * 100000);
  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: `Generate one sophisticated English word (SAT/GRE). Seed: ${randomSeed}. Only word.`,
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 1.2 },
    });
    const word = response.text.trim();
    if (word.toLowerCase().includes('quota') || word.toLowerCase().includes('limit')) {
        throw new Error("QUOTA_EXCEEDED");
    }
    return word;
  } catch (error: any) {
    if (isQuotaError(error)) throw new Error("QUOTA_EXCEEDED");
    return DICTIONARY_WORDS[Math.floor(Math.random() * DICTIONARY_WORDS.length)];
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  const cached = await getCachedDefinition(word);
  if (cached) return `(${cached.pos}) ${cached.definition}\n${cached.bengali}`;
  
  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: `Define "${word}". Strictly 2 lines: (pos) English def.\n[Bengali def]`,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    return "Definition unavailable.";
  }
}

// Function Declarations for Chat Tooling
const addWordsToListDeclaration: FunctionDeclaration = {
  name: 'addWordsToList',
  parameters: {
    type: Type.OBJECT,
    description: 'Adds a list of English words to the user vocabulary list.',
    properties: {
      words: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of words to add (e.g. ["apple", "banana", "cherry"]).'
      }
    },
    required: ['words']
  }
};

export const createChatSession = () => {
  return getAiClient().chats.create({
    model: textModelName,
    config: { 
      systemInstruction: `You are LexiFlow AI, a world-class vocabulary expert. 
      You help users build their English vocabulary. 
      Users can ask you for suggestions like "30 GRE words", "50 common vegetable names", or "10 words for happy emotions".
      When a user asks for such a list or to "add" words, use the 'addWordsToList' tool. 
      Suggest high-quality, relevant words. After adding, confirm to the user what categories you covered.`,
      tools: [{ functionDeclarations: [addWordsToListDeclaration] }]
    }
  });
};

export async function generateCreativePrompt(): Promise<string> { return "A mystery in an ancient library..."; }
export async function generateStorySegment(p: string, prev: string = ''): Promise<string> { return "Story content..."; }
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> { return { art: `[ASCII Art for ${topic}]` }; }
