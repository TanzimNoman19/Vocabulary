
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
    pos: { type: Type.STRING, description: "Part of speech, e.g., 'noun', 'adjective (v)', etc." },
    definition: { type: Type.STRING, description: "Clear academic definition in English." },
    bengali: { type: Type.STRING, description: "Accurate Bengali meaning." },
    family: { type: Type.STRING, description: "Comma separated related words with POS in brackets." },
    context: { type: Type.STRING, description: "A high-level sentence showing usage." },
    synonyms: { type: Type.STRING, description: "Comma separated synonyms." },
    antonyms: { type: Type.STRING, description: "Comma separated antonyms." },
    difficulty: { type: Type.STRING, description: "E.g., 'Medium', 'Advanced', 'SAT/GRE'." },
    usage_notes: { type: Type.STRING, description: "Include [TRAP], [MNEMONIC], [VIBE], [TIP] tags with explanations." }
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
    : (definitionStyle === 'detailed' ? 'Provide a detailed, nuanced definition with etymology hints.' : 'Provide a standard, clear definition.');
  
  const prompt = `Act as a world-class lexicographer and SAT/GRE tutor. 
  Define the English word "${normalizedWord}" for a high-quality study flashcard. 
  ${styleInstruction} 
  Specific Requirements:
  - BENGALI: Provide a natural, precise translation without transliterating the English word.
  - FAMILY: List 2-3 related forms with parts of speech, e.g., "happiness (n), happily (adv)".
  - USAGE NOTES: Create ultra-helpful tips using these tags:
    [TRAP]: Common confusion with similar words.
    [MNEMONIC]: A memory aid or word root.
    [VIBE]: The tone of the word (e.g., "Formal", "Pejorative", "Literary").
    [TIP]: A quick usage rule.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Use Pro for best quality word analysis
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: cardSchema,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const data = safeJsonParse(response.text, {});
    if (!data.definition) return localFallback;
    
    // Clean up Bengali if the model adds English brackets
    if (data.bengali) data.bengali = data.bengali.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, '').trim();
    
    return { ...data, word: normalizedWord, source: 'Gemini 3 Pro' };
  } catch (error: any) {
    if (retries > 0) return fetchWordData(normalizedWord, definitionStyle, retries - 1);
    return localFallback;
  }
}

export async function generateSemanticClusters(words: string[], level: number = 2): Promise<SemanticCluster[]> {
    if (!navigator.onLine || words.length === 0) return [];
    const ai = getAIClient();
    
    const prompt = `Group these vocabulary words into logical semantic clusters for better retention. 
    Complexity Level: ${level}/2.
    Words: ${words.join(', ')}. 
    Return a list where each cluster has a clear title and an explanation of the shared concept.`;

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

/**
 * Enhanced Explore Strategy:
 * Uses semantic discovery to find words the user likely doesn't know.
 */
export async function fetchExplorePack(level: VocabLevel = 'intermediate', count: number = 10, excludeWords: string[] = []): Promise<CardData[]> {
  if (!navigator.onLine) throw new Error("Offline");

  const topicPools: Record<VocabLevel, string[]> = {
    basic: ['everyday life', 'hobbies', 'family', 'simple emotions', 'places'],
    intermediate: ['career', 'technology', 'society', 'current events', 'travel'],
    gre: ['arcane adjectives', 'abstract nouns', 'logical fallacies', 'literary criticism', 'rare verbs'],
    ielts: ['academic discourse', 'environmental issues', 'economic trends', 'educational methodology'],
    expert: ['philosophical jargon', 'scientific nuance', 'obscure etymology', 'rhetorical devices']
  };

  const currentPool = topicPools[level] || topicPools.intermediate;
  const randomTopic = currentPool[Math.floor(Math.random() * currentPool.length)];

  try {
    // Phase 1: Try finding words from external dictionary pool for variety
    const datamuseRes = await fetch(`https://api.datamuse.com/words?topics=${encodeURIComponent(randomTopic)}&max=100`);
    const datamuseData = await datamuseRes.json();
    
    const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));
    const candidateWords = datamuseData
      .map((item: any) => item.word)
      .filter((word: string) => 
        word.length > 3 && 
        !word.includes(' ') && 
        !excludeSet.has(word.toLowerCase())
      );

    // Phase 2: If we have candidates, let the AI define them. Otherwise, let AI invent the list.
    if (candidateWords.length >= count) {
      const selected = candidateWords.sort(() => 0.5 - Math.random()).slice(0, count);
      return await generateBulkCardData(selected);
    } else {
      return await generateFallbackExplorePack(level, count, excludeWords);
    }
  } catch (e) {
    return await generateFallbackExplorePack(level, count, excludeWords);
  }
}

async function generateFallbackExplorePack(level: string, count: number, excludeWords: string[]): Promise<CardData[]> {
  const ai = getAIClient();
  const excludeStr = excludeWords.length > 0 ? `Do NOT include any of these words: ${excludeWords.slice(-50).join(', ')}.` : '';
  
  const prompt = `Generate ${count} sophisticated ${level}-level English vocabulary words that are highly relevant for exams like SAT, GRE, or IELTS. 
  ${excludeStr}
  Ensure the words are distinct and academically useful. Provide full flashcard details for each.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
              ...cardSchema,
              properties: { 
                ...cardSchema.properties, 
                word: { type: Type.STRING, description: "The English word itself." } 
              },
              required: [...cardSchema.required, "word"]
          }
        },
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const data = safeJsonParse(response.text, []);
    return data.map((item: any) => ({ 
      ...item, 
      word: capitalize(item.word || ''), 
      bengali: item.bengali?.replace(/\s*\([^)]*\)/g, '').trim(), 
      source: 'Gemini Pro Discovery' 
    }));
  } catch (error) {
    console.error("Explore fallback failed", error);
    return [];
  }
}

export async function generateBulkWordData(words: string[]): Promise<Record<string, CardData>> {
  const cards = await generateBulkCardData(words);
  const finalCache: Record<string, CardData> = {};
  cards.forEach((card) => {
    if (card.word) finalCache[card.word] = card;
  });
  return finalCache;
}

export async function generateBulkCardData(words: string[]): Promise<CardData[]> {
  if (!navigator.onLine || words.length === 0) return [];
  const ai = getAIClient();
  
  const prompt = `Act as a senior lexicographer. Create professional vocabulary flashcards for the following words: ${words.join(', ')}.
  For each word, ensure precise definitions and high-quality academic context. 
  Provide Bengali translations that accurately capture the nuance.`;

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
    return results.map((item: any) => ({
      ...item,
      word: capitalize(item.word || ''),
      bengali: item.bengali?.replace(/\s*\([^)]*\)/g, '').trim(),
      source: 'Gemini AI'
    }));
  } catch (error) {
    console.error("Bulk generation failed", error);
    throw error;
  }
}

export async function fetchContextSentence(word: string): Promise<string> {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a sophisticated, academic example sentence for the word "${word}" that clearly illustrates its meaning:`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.trim() || `Example using ${word}.`;
  } catch (error) {
    return `Could not generate sentence for "${word}".`;
  }
}

export async function getShortDefinition(word: string): Promise<string> {
  try {
    const data = await fetchWordData(word, 'concise');
    return `(${data.pos}) ${data.definition}\n${data.bengali}`;
  } catch (e) {
    return "Definition unavailable.";
  }
}
