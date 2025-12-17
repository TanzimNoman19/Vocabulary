/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { DICTIONARY_WORDS } from '../services/dictionaryData';

interface SearchBarProps {
  onSearch: (query: string) => void;
  savedWords: string[];
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, savedWords }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  // Combine saved words and dictionary words, de-duplicate, and filter
  const getSuggestions = () => {
    if (!query) return [];
    
    const lowerQuery = query.toLowerCase();
    
    // Create a Set of saved words for quick lookup
    const savedSet = new Set(savedWords.map(w => w.toLowerCase()));
    
    // Filter dictionary words that start with query and are NOT in saved list
    const dictMatches = DICTIONARY_WORDS.filter(
        w => w.toLowerCase().startsWith(lowerQuery) && !savedSet.has(w.toLowerCase())
    );

    // Filter saved words that start with query
    const savedMatches = savedWords.filter(w => w.toLowerCase().startsWith(lowerQuery));

    // Combine: Saved matches first, then dictionary matches. Limit to 8 total.
    return [...savedMatches, ...dictMatches].slice(0, 8);
  };

  const suggestions = getSuggestions();

  return (
    <div style={{ padding: '2rem 1rem' }}>
        <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: '15px', color: 'var(--accent-primary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input 
                    className="search-page-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search dictionary..."
                    autoFocus
                    style={{ paddingLeft: '2.5rem' }}
                />
            </div>
        </form>

        <ul style={{ listStyle: 'none', padding: 0, marginTop: '2rem' }}>
            {suggestions.map((word, index) => {
                const isSaved = savedWords.some(w => w.toLowerCase() === word.toLowerCase());
                return (
                    <li 
                        key={`${word}-${index}`} 
                        style={{ 
                            padding: '1rem 0', 
                            borderBottom: '1px solid var(--border-color)', 
                            fontSize: '1.1rem', 
                            color: 'var(--text-primary)', 
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }} 
                        onClick={() => onSearch(word)}
                    >
                        <span>{word}</span>
                        {isSaved && (
                            <span style={{ fontSize: '0.7rem', background: 'var(--accent-secondary)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                                SAVED
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    </div>
  );
};

export default SearchBar;