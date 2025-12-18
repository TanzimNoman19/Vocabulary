/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Tool, FunctionDeclaration, Type, Modality} from '@google/genai';
import { DICTIONARY_WORDS } from './dictionaryData';

// Initialize the client lazily or safely to prevent top-level crashes
let ai: GoogleGenAI;
const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error('API_KEY is missing.');
      ai = new GoogleGenAI({apiKey: 'MISSING_KEY'}); 
    } else {
      ai = new GoogleGenAI({apiKey: apiKey});
    }
  }
  return ai;
};

// Use gemini-3-flash-preview as recommended in coding guidelines for basic text tasks
const textModelName = 'gemini-3-flash-preview';
const chatModelName = 'gemini-3-flash-preview';

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

// Robust Quota Error Check
const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  // Check typical GoogleGenAI error structure
  if (error.status === 429 || error.code === 429) return true;
  if (error.status === 'RESOURCE_EXHAUSTED') return true;
  
  const msg = error.message || '';
  if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) return true;

  // Check nested error object if present (JSON response)
  try {
     const str = JSON.stringify(error);
     if (str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('Quota exceeded')) return true;
  } catch(e) {}
  
  return false;
};

export interface AsciiArtData {
    art: string;
    text?: string;
}

// --- Chat Tools ---
const addWordsTool: FunctionDeclaration = {
  name: 'addWordsToCollection',
  description: 'Add a list of words to the user\'s saved vocabulary collection.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      words: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['words'],
  },
};

const removeWordsTool: FunctionDeclaration = {
  name: 'removeWordsFromCollection',
  description: 'Remove a list of words from the user\'s saved vocabulary collection.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      words: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['words'],
  },
};

const navigateTool: FunctionDeclaration = {
  name: 'navigateToWord',
  description: 'Navigate the app to a specific word to show its definition.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
    },
    required: ['word'],
  },
};

const getSavedWordsTool: FunctionDeclaration = {
  name: 'getSavedWords',
  description: 'Get the list of words currently in the user\'s saved collection.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const vocabTools: Tool[] = [{
  functionDeclarations: [addWordsTool, removeWordsTool, navigateTool, getSavedWordsTool]
}];

export const createChatSession = () => {
  return getAiClient().chats.create({
    model: chatModelName,
    config: {
      tools: vocabTools,
      systemInstruction: `You are LexiFlow AI. Help user manage vocab.`,
    }
  });
};

/**
 * Searches for vocabulary words starting with the query string using the Datamuse API.
 * This replaces Gemini for search suggestions to avoid quota issues and provide instant results.
 */
export async function searchVocabulary(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];
  
  try {
    // Datamuse 'sug' endpoint is extremely fast and provides high-quality completions.
    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(cleanQuery)}&max=8`);
    if (!response.ok) throw new Error('Search API failed');
    
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    // Fallback to local dictionary if external API is down
    const lowerQuery = cleanQuery.toLowerCase();
    return DICTIONARY_WORDS
      .filter(w => w.toLowerCase().startsWith(lowerQuery))
      .slice(0, 8);
  }
}

/**
 * Streams a definition for a given topic from the Gemini API.
 */
export async function* streamDefinition(
  topic: string,
  concise: boolean = false
): AsyncGenerator<string, void, undefined> {
  if (!process.env.API_KEY) {
    yield 'Error: API_KEY is not configured.';
    return;
  }

  const prompt = `Define "${topic}" for a vocabulary flashcard.
  
  Format the response EXACTLY as follows using these headers:
  
  POS: [part of speech]
  IPA: [IPA pronunciation]
  DEFINITION: [Comprehensive and precise English definition, max 25 words]
  BENGALI: [Accurate Bengali meaning (Bangla Artho), providing multiple nuances if applicable]
  WORD FAMILY: [Related forms, e.g. serendipitous (adj), serendipitously (adv)]
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

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
        // Log warning instead of error to reduce noise
        console.warn('Quota exceeded in streamDefinition.');
        // Yield a fallback card
        yield `POS: system
IPA: /quota/
DEFINITION: The AI is taking a short break due to high traffic. Please try again in a moment.
BENGALI: সাময়িক বিরতি
WORD FAMILY: Patience (noun)
CONTEXT: Systems sometimes need a moment to recharge, just like us.
SYNONYMS: Wait, Pause
ANTONYMS: Rush
DIFFICULTY: Temporary`;
        return;
    }
    console.error('Error streaming:', error);
    yield `Error: ${error.message}`;
  }
}

/**
 * Helper to fetch full definition string without streaming logic exposed.
 * Useful for background pre-fetching.
 */
export async function fetchFullDefinition(topic: string): Promise<string> {
  let fullText = '';
  // This loop consumes the generator
  for await (const chunk of streamDefinition(topic)) {
    fullText += chunk;
  }
  return fullText;
}

/**
 * Parses the raw text response from Gemini into a structured CardData object.
 */
export function parseFlashcardResponse(text: string): CardData {
  const extract = (key: string) => {
    // Modified Regex to allow spaces in headers (e.g., WORD FAMILY)
    // The 's' flag enables dotAll mode, allowing . to match newlines
    const regex = new RegExp(`${key}:\\s*(.*?)(?=\\n[A-Z ]+:|$)`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    pos: extract('POS'),
    ipa: extract('IPA'),
    definition: extract('DEFINITION'),
    bengali: extract('BENGALI'),
    family: extract('WORD FAMILY'),
    context: extract('CONTEXT'),
    synonyms: extract('SYNONYMS'),
    antonyms: extract('ANTONYMS'),
    difficulty: extract('DIFFICULTY')
  };
}

export async function getRandomWord(): Promise<string> {
  if (!process.env.API_KEY) {
     const randomIndex = Math.floor(Math.random() * DICTIONARY_WORDS.length);
     return DICTIONARY_WORDS[randomIndex];
  }

  const randomSeed = Math.floor(Math.random() * 100000);
  const prompt = `Generate a single, sophisticated English vocabulary word (SAT/GRE level). 
  Random seed: ${randomSeed}. Respond with only the word.`;

  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 1.2 },
    });
    return response.text.trim();
  } catch (error) {
    // Silently fall back to dictionary on error
    const randomIndex = Math.floor(Math.random() * DICTIONARY_WORDS.length);
    return DICTIONARY_WORDS[randomIndex];
  }
}

export async function generateUsageExample(word: string): Promise<string> {
  if (!process.env.API_KEY) return "Example unavailable.";
  const prompt = `Write a single, unique sentence using the word "${word}".`;
  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    return `Usage example unavailable.`;
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  if (!process.env.API_KEY) return "Definition unavailable";
  // Strict format prompt for tooltips
  const prompt = `Define "${word}". Output strictly 2 lines in this format:
(part_of_speech) Short English definition.
[Short Bengali definition]`;
  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    return "Definition unavailable.";
  }
}

export async function generateCreativePrompt(): Promise<string> {
  if (!process.env.API_KEY) return "A mystery in an ancient library...";
  const prompt = `Generate a creative short story prompt. One sentence.`;
  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    return "A sudden storm changes everything.";
  }
}

export async function generateStorySegment(promptContext: string, previousText: string = ''): Promise<string> {
  if (!process.env.API_KEY) throw new Error('API_KEY missing');

  let prompt = '';
  if (!previousText) {
    prompt = `Write the opening paragraph (100 words) of a story based on: "${promptContext}". Sophisticated vocab.`;
  } else {
    prompt = `Continue this story: "${previousText.slice(-500)}". Context: "${promptContext}". Next 100 words.`;
  }

  try {
    const response = await getAiClient().models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    if (isQuotaError(error)) {
        return "Story generation paused due to high traffic. Please try again in a minute.";
    }
    return "Story generation unavailable.";
  }
}

export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  return { art: `[ASCII Art for ${topic}]` };
}
