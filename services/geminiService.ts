
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Tool, FunctionDeclaration, Type, Modality} from '@google/genai';
import { DICTIONARY_WORDS } from './dictionaryData';
import { getCachedDefinition, saveCachedDefinition } from './supabaseClient';

// Fix: Define WordSource locally as it is not exported from App.tsx
export type WordSource = 'ai' | 'free' | 'local';

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
  source?: string;
}

// Fixed missing interface: Added AsciiArtData for ASCII generation feature
export interface AsciiArtData {
  art: string;
  text?: string;
}

const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429 || error.code === 429) return true;
  const msg = error.message || '';
  if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) return true;
  return false;
};

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
 * Fetches data from Wiktionary - The highest quality free public linguistic resource.
 */
async function fetchFromWiktionary(word: string): Promise<CardData | null> {
    try {
        const response = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`);
        if (!response.ok) return null;
        const data = await response.json();
        
        // Pick English entries
        const enEntries = data.en || [];
        if (enEntries.length === 0) return null;

        const firstEntry = enEntries[0];
        const definitionItem = firstEntry.definitions[0];
        
        // Extract clean text from Wiktionary HTML
        const cleanHtml = (html: string) => html.replace(/<[^>]*>?/gm, '').trim();

        return {
            pos: firstEntry.partOfSpeech || 'word',
            ipa: 'N/A', // IPA is harder to get from the REST API v1
            definition: cleanHtml(definitionItem.definition),
            bengali: '[Switch to AI Mode for translation]',
            family: firstEntry.partOfSpeech,
            context: definitionItem.examples && definitionItem.examples[0] ? cleanHtml(definitionItem.examples[0]) : '',
            synonyms: 'N/A',
            antonyms: 'N/A',
            difficulty: 'Standard',
            source: 'Wiktionary'
        };
    } catch (e) {
        return null;
    }
}

/**
 * Fallback to the Free Dictionary API for metadata like IPA and Synonyms
 */
async function fetchFromDictionaryApi(word: string): Promise<CardData | null> {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!response.ok) return null;
        const data = await response.json();
        const entry = data[0];
        const meaning = entry.meanings[0];
        const definition = meaning.definitions.find((d: any) => d.example) || meaning.definitions[0];

        return {
            pos: meaning.partOfSpeech,
            ipa: entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text) || 'N/A',
            definition: definition.definition,
            bengali: '[Switch to AI Mode for translation]',
            family: meaning.partOfSpeech,
            context: definition.example || '',
            synonyms: meaning.synonyms?.slice(0, 3).join(', ') || 'N/A',
            antonyms: meaning.antonyms?.slice(0, 3).join(', ') || 'N/A',
            difficulty: 'Standard',
            source: 'Free Dictionary API'
        };
    } catch (e) {
        return null;
    }
}

/**
 * Master function for "Free" source - tries Wiktionary then falls back to DictAPI
 */
async function fetchFromPublicSources(word: string): Promise<string> {
    // 1. Try Wiktionary (Better definitions)
    const wiktiData = await fetchFromWiktionary(word);
    
    // 2. Try Dictionary API (Better IPA/Synonyms)
    const dictData = await fetchFromDictionaryApi(word);

    // Merge them: Priority to Wiktionary for Def, DictAPI for IPA/Syns
    const final: CardData = {
        pos: wiktiData?.pos || dictData?.pos || 'word',
        ipa: dictData?.ipa || 'N/A',
        definition: wiktiData?.definition || dictData?.definition || 'Definition unavailable.',
        bengali: '[Switch to AI Mode for translation]',
        family: wiktiData?.pos || dictData?.pos || 'N/A',
        context: wiktiData?.context || dictData?.context || `Commonly used as a ${wiktiData?.pos || 'term'} in English literature.`,
        synonyms: dictData?.synonyms || 'N/A',
        antonyms: dictData?.antonyms || 'N/A',
        difficulty: 'Standard',
        source: wiktiData ? 'Wiktionary' : (dictData ? 'Public API' : 'Local')
    };

    return `POS: ${final.pos}
IPA: ${final.ipa}
DEFINITION: ${final.definition}
BENGALI: ${final.bengali}
WORD FAMILY: ${final.family}
CONTEXT: ${final.context}
SYNONYMS: ${final.synonyms}
ANTONYMS: ${final.antonyms}
DIFFICULTY: ${final.difficulty}
SOURCE: ${final.source}`;
}

/**
 * Streams a definition, checking source preference.
 */
export async function* streamDefinition(
  topic: string,
  source: WordSource = 'ai'
): AsyncGenerator<string, void, undefined> {
  // 1. Check Global Cache First (Save bandwidth)
  try {
    const cached = await getCachedDefinition(topic);
    if (cached) {
      const formatted = `POS: ${cached.pos}\nIPA: ${cached.ipa}\nDEFINITION: ${cached.definition}\nBENGALI: ${cached.bengali}\nWORD FAMILY: ${cached.family}\nCONTEXT: ${cached.context}\nSYNONYMS: ${cached.synonyms}\nANTONYMS: ${cached.antonyms}\nDIFFICULTY: ${cached.difficulty}`;
      yield formatted;
      return;
    }
  } catch (e) {}

  // 2. If Source is "Free" or "Local" (while online), try public sources
  if (source === 'free' || (source === 'local' && navigator.onLine)) {
      const result = await fetchFromPublicSources(topic);
      if (!result.includes("ERROR")) {
          yield result;
          return;
      }
      if (source === 'free') {
          yield "Error: Public dictionary services are currently unreachable.";
          return;
      }
  }

  // 3. AI Mode (Requires API Key)
  if (!process.env.API_KEY) {
    yield 'Error: API_KEY is not configured for Gemini AI.';
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

    if (fullResult) {
      const parsed = parseFlashcardResponse(fullResult);
      if (parsed.definition && !fullResult.includes("quota")) {
        await saveCachedDefinition(topic, parsed);
      }
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
        yield `ERROR: QUOTA_EXCEEDED`;
        return;
    }
    yield `Error: ${error.message}`;
  }
}

export async function fetchFullDefinition(topic: string, source: WordSource = 'ai'): Promise<string> {
  let fullText = '';
  for await (const chunk of streamDefinition(topic, source)) { fullText += chunk; }
  return fullText;
}

export function parseFlashcardResponse(text: string): CardData {
  const extract = (key: string) => {
    const regex = new RegExp(`${key}:\\s*(.*?)(?=\\s*\\n\\s*[A-Z ]+:|$)`, 'si');
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
    difficulty: extract('DIFFICULTY'),
    source: extract('SOURCE') || 'External'
  };
}

export function getLocalRandomWord(): string {
    return DICTIONARY_WORDS[Math.floor(Math.random() * DICTIONARY_WORDS.length)];
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
    if (word.toLowerCase().includes('quota') || word.toLowerCase().includes('limit')) throw new Error("QUOTA_EXCEEDED");
    return word;
  } catch (error: any) {
    if (isQuotaError(error)) throw new Error("QUOTA_EXCEEDED");
    return getLocalRandomWord();
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  const cached = await getCachedDefinition(word);
  if (cached) return `(${cached.pos}) ${cached.definition}\n${cached.bengali}`;
  
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (res.ok) {
        const data = await res.json();
        const m = data[0].meanings[0];
        return `(${m.partOfSpeech}) ${m.definitions[0].definition}`;
    }
  } catch (e) {}

  return "Definition unavailable.";
}

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
      systemInstruction: `You are LexiFlow AI, a world-class vocabulary expert.`,
      tools: [{ functionDeclarations: [addWordsToListDeclaration] }]
    }
  });
};

export async function generateCreativePrompt(): Promise<string> { return "A mystery in an ancient library..."; }
export async function generateStorySegment(p: string, prev: string = ''): Promise<string> { return "Story content..."; }
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> { return { art: `[ASCII Art for ${topic}]` }; }
