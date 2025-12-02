/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Tool, FunctionDeclaration, Type} from '@google/genai';

// This check is for development-time feedback.
if (!process.env.API_KEY) {
  console.error(
    'API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.',
  );
}

// The "!" asserts API_KEY is non-null after the check.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});
const artModelName = 'gemini-2.5-flash';
const textModelName = 'gemini-2.5-flash-lite';
const chatModelName = 'gemini-2.5-flash';

/**
 * Art-direction toggle for ASCII art generation.
 * `true`: Slower, higher-quality results (allows the model to "think").
 * `false`: Faster, potentially lower-quality results (skips thinking).
 */
const ENABLE_THINKING_FOR_ASCII_ART = false;

/**
 * Art-direction toggle for blocky ASCII text generation.
 * `true`: Generates both creative art and blocky text for the topic name.
 * `false`: Generates only the creative ASCII art.
 */
const ENABLE_ASCII_TEXT_GENERATION = false;

export interface AsciiArtData {
  art: string;
  text?: string; // Text is now optional
}

// --- Chat & Tool Definitions ---

const addWordsTool: FunctionDeclaration = {
  name: 'addWordsToCollection',
  description: 'Add a list of words to the user\'s saved vocabulary collection. Use this when the user wants to save multiple words at once.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      words: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'The list of words to add.',
      },
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
      words: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'The list of words to remove.',
      },
    },
    required: ['words'],
  },
};

const navigateTool: FunctionDeclaration = {
  name: 'navigateToWord',
  description: 'Navigate the app to a specific word to show its definition. Use this when the user asks to "define", "show", or "go to" a word.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      word: {
        type: Type.STRING,
        description: 'The word to navigate to.',
      },
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
  return ai.chats.create({
    model: chatModelName,
    config: {
      tools: vocabTools,
      systemInstruction: `You are the "Infinite Vocabulary Assistant". 
      You have full control over the user's vocabulary list and the app navigation.
      
      Capabilities:
      1. You can bulk add or remove words from their saved list using tools.
      2. You can navigate the app to define specific words.
      3. You can answer questions about etymology, usage, or nuance directly in the chat.
      
      Tone: Helpful, sophisticated, yet concise.
      
      If the user asks to "save these words: X, Y, Z", call the addWordsToCollection tool immediately.
      If the user asks "what is in my list?", call the getSavedWords tool.`,
    }
  });
};


/**
 * Streams a definition for a given topic from the Gemini API.
 * @param topic The word or term to define.
 * @returns An async generator that yields text chunks of the definition.
 */
export async function* streamDefinition(
  topic: string,
): AsyncGenerator<string, void, undefined> {
  if (!process.env.API_KEY) {
    yield 'Error: API_KEY is not configured. Please check your environment variables to continue.';
    return;
  }

  const prompt = `Define the word "${topic}" for a vocabulary learner. 
  
  Format the response exactly as follows using ### headers:
  
  /${topic}/ (part of speech) [IPA pronunciation]
  
  ### DEFINITION
  [Clear, memorable definition]
  
  ### ETYMOLOGY
  [Brief origin/root info]

  ### WORD FAMILY & FORMS
  [List related parts of speech, derivatives, prefix/suffix variations. E.g. "Noun: X", "Adjective: Y", "Prefix origin: ..."]
  
  ### SYNONYMS
  [List of 3-5 synonyms, comma separated]
  
  ### ANTONYMS
  [List of 3-5 antonyms, comma separated, or "N/A"]
  
  ### USAGE
  "[A single example sentence using the word]"
  
  ### MNEMONIC
  [A short, helpful memory aid]`;

  try {
    const response = await ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: {
        // Disable thinking for the lowest possible latency, as requested.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield `Error: Could not generate content for "${topic}". ${errorMessage}`;
    // Re-throwing allows the caller to handle the error state definitively.
    throw new Error(errorMessage);
  }
}

/**
 * Generates a single random word or concept using the Gemini API.
 * @returns A promise that resolves to a single random word.
 */
export async function getRandomWord(): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is not configured.');
  }

  const prompt = `Generate a single, interesting, sophisticated English vocabulary word (SAT/GRE level). Examples: "Ephemeral", "Obfuscate", "Serendipity", "Petrichor". Respond with only the word itself, no punctuation.`;

  try {
    const response = await ai.models.generateContent({
      model: textModelName,
      contents: prompt,
      config: {
        // Disable thinking for low latency.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error('Error getting random word from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Could not get random word: ${errorMessage}`);
  }
}

/**
 * Generates a fresh usage sentence for a given word.
 */
export async function generateUsageExample(word: string): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is not configured.');
  }

  const prompt = `Write a single, unique, and illustrative sentence using the word "${word}". 
  Make it different from standard dictionary examples. Do not define the word, just use it.`;

  try {
    const response = await ai.models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text.trim();
  } catch (error) {
    return `Could not generate usage example for ${word}.`;
  }
}

/**
 * Generates ASCII art and optionally text for a given topic.
 * @param topic The topic to generate art for.
 * @returns A promise that resolves to an object with art and optional text.
 */
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is not configured.');
  }
  
  const artPromptPart = `1. "art": meta ASCII visualization of the meaning of the word "${topic}":
  - Palette: │─┌┐└┘├┤┬┴┼►◄▲▼○●◐◑░▒▓█▀▄■□▪▫★☆♦♠♣♥⟨⟩/\\_|
  - Shape mirrors definition - make the visual form embody the word's essence.
  - Examples: 
    * "Fragile" → thin lines, gaps
    * "Hierarchy" → pyramid structure
    * "Chaos" → scattered characters
  - Return as single string with \n for line breaks`;


  const keysDescription = `one key: "art"`;
  const promptBody = artPromptPart;

  const prompt = `For "${topic}", create a JSON object with ${keysDescription}.
${promptBody}

Return ONLY the raw JSON object, no additional text. The response must start with "{" and end with "}" and contain only the art property.`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // FIX: Construct config object conditionally to avoid spreading a boolean
      const config: any = {
        responseMimeType: 'application/json',
      };
      if (!ENABLE_THINKING_FOR_ASCII_ART) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await ai.models.generateContent({
        model: artModelName,
        contents: prompt,
        config: config,
      });

      let jsonStr = response.text.trim();
      
      // Robust extraction: Find the first { and last } to ignore potential markdown garbage
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      } else {
        // Fallback to removing markdown fences if braces aren't found normally
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[1]) {
          jsonStr = match[1].trim();
        }
      }

      // Ensure the string looks like an object
      if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
        throw new Error('Response is not a valid JSON object');
      }

      const parsedData = JSON.parse(jsonStr) as AsciiArtData;
      
      // Validate the response structure
      if (typeof parsedData.art !== 'string' || parsedData.art.trim().length === 0) {
        throw new Error('Invalid or empty ASCII art in response');
      }
      
      // If we get here, the validation passed
      const result: AsciiArtData = {
        art: parsedData.art,
      };

      if (ENABLE_ASCII_TEXT_GENERATION && parsedData.text) {
        result.text = parsedData.text;
      }
      
      return result;

    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      
      // Check specifically for Rate Limits (429) or Quota Exhaustion
      // These are not transient errors that retries will fix quickly.
      const msg = lastError.message || '';
      const status = error.status || '';
      
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || status === 'RESOURCE_EXHAUSTED') {
         // Stop retrying immediately to save resources and fallback gracefully
         throw lastError;
      }
      
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        // Do not log "console.error" here to avoid noise in the browser console.
        // The caller (App.tsx) handles the fallback.
        throw new Error(`Could not generate ASCII art after ${maxRetries} attempts: ${lastError.message}`);
      }
      // Continue to next attempt
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error('All retry attempts failed');
}