
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
// Import CardData from dictionaryService to re-export it here
import { getShortDefinition as getShortDefShared, createChatSession as createChatShared, CardData } from './dictionaryService';

// Re-export CardData for components that expect it in this module
export { CardData };

// Define AsciiArtData interface used in AsciiArtDisplay component
export interface AsciiArtData {
  art: string;
  text?: string;
}

const DEFAULT_MODEL = 'gemini-3-flash-preview';

export async function getShortDefinition(word: string): Promise<string> {
  return getShortDefShared(word);
}

export const createChatSession = () => {
  return createChatShared();
};

export async function generateCreativePrompt(): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: "Suggest a creative story writing prompt for vocabulary learning."
    });
    return res.text || "A mystery in an ancient library...";
  } catch (e) {
    return "A high-stakes debate in a futuristic city...";
  }
}

export async function generateStorySegment(p: string, prev: string = ''): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Write a vocabulary-rich segment for this story. Prompt: ${p}. Previous segment: ${prev}`
    });
    return res.text || "The journey continued into the unknown...";
  } catch (e) {
    return "Error generating story segment.";
  }
}

// Update return type to use the defined AsciiArtData interface
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  return { art: `[AI visualization of ${topic}]` };
}
