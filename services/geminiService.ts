/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Tool, FunctionDeclaration, Type} from '@google/genai';
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

const textModelName = 'gemini-2.5-flash-lite';
const chatModelName = 'gemini-2.5-flash';

// Helper to detect quota errors
const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  try {
     const str = JSON.stringify(error);
     if (str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('Quota exceeded')) return true;
  } catch(e) {}
  
  const msg = error?.message || '';
  const status = error?.status || '';
  const code = error?.code || '';
  
  return msg.includes('429') || 
         msg.includes('RESOURCE_EXHAUSTED') || 
         status === 'RESOURCE_EXHAUSTED' ||
         code === 429;
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
  DEFINITION: [Clear English definition, max 15 words]
  BENGALI: [Bengali translation of the word]
  WORD FAMILY: [Related forms, e.g. serendipitous (adj), serendipitously (adv)]
  CONTEXT: [One illustrative sentence using the word]
  SYNONYMS: [Comma separated list]
  ANTONYMS: [Comma separated list or N/A]
  
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
    console.error('Error streaming:', error);
    if (isQuotaError(error)) {
        yield `POS: noun
IPA: /429/
DEFINITION: Service unavailable due to quota.
BENGALI: কোটা অতিক্রান্ত
WORD FAMILY: N/A
CONTEXT: N/A
SYNONYMS: N/A
ANTONYMS: N/A`;
        return;
    }
    yield `Error: ${error.message}`;
  }
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
  const prompt = `Define "${word}". Output strictly: "(pos) English Definition."`;
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
    return "Story generation unavailable.";
  }
}

export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  // Minimal stub implementation for legacy support if needed
  return { art: `[ASCII Art for ${topic}]` };
}
