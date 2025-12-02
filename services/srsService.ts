/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SRSItem {
  word: string;
  masteryLevel: number; // 0 to 5
  nextReview: number; // Timestamp
}

export type Grade = 'know' | 'dont_know';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Intervals in days corresponding to mastery levels 0-5
// Level 0: 0 days (Due immediately)
// Level 1: 1 day
// Level 2: 3 days
// Level 3: 7 days
// Level 4: 14 days
// Level 5: 30 days
const INTERVALS = [0, 1, 3, 7, 14, 30];

export const initializeSRSItem = (word: string): SRSItem => ({
  word,
  masteryLevel: 0,
  nextReview: Date.now(), // Due immediately
});

/**
 * Calculates the next review parameters based on Mastery Level logic.
 */
export const calculateSRS = (item: SRSItem, grade: Grade): SRSItem => {
  let { masteryLevel } = item;

  if (grade === 'know') {
    // Increment level, max out at 5
    masteryLevel = Math.min(masteryLevel + 1, 5);
  } else {
    // Reset to 0 if unknown
    masteryLevel = 0;
  }

  const daysToAdd = INTERVALS[masteryLevel];
  
  return {
    word: item.word,
    masteryLevel,
    nextReview: Date.now() + (daysToAdd * DAY_IN_MS),
  };
};

export const getDueWords = (words: string[], srsData: Record<string, SRSItem>): string[] => {
  const now = Date.now();
  
  // 1. Find words that are actually due
  const due = words.filter(word => {
    const item = srsData[word];
    // If no data exists, it's new (Level 0) and due.
    return !item || item.nextReview <= now;
  });

  // 2. Shuffle (Fisher-Yates) to ensure randomness within same mastery level
  // This prevents alphabetical ordering when multiple words have the same level.
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [due[i], due[j]] = [due[j], due[i]];
  }

  // 3. Sort primarily by lowest mastery level (hardest words first)
  // Since sort is stable in modern JS, the shuffle order above is preserved for ties.
  return due.sort((a, b) => {
    const itemA = srsData[a] || initializeSRSItem(a);
    const itemB = srsData[b] || initializeSRSItem(b);
    return itemA.masteryLevel - itemB.masteryLevel; // Ascending: 0 before 5
  });
};

export const getMasteryColor = (level: number): string => {
  switch (level) {
    case 0: return '#e0e0e0'; // Gray
    case 1: return '#ffcdd2'; // Red-ish
    case 2: return '#ffcc80'; // Orange
    case 3: return '#fff9c4'; // Yellow
    case 4: return '#c8e6c9'; // Light Green
    case 5: return '#81c784'; // Green
    default: return '#e0e0e0';
  }
};