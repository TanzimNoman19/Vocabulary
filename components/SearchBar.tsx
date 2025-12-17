/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { DICTIONARY_WORDS } from '../services/dictionaryData';
import { searchVocabulary } from '../services/geminiService';

interface SearchBarProps {
  onSearch: (query: string) => void;
  savedWords: string[];
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, savedWords }) => {
  const [query, setQuery] = useState('');
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce API calls
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (query.trim().length >= 2) {
            setIsSearching(true);
            try {
                const results = await searchVocabulary(query);
                setApiSuggestions(results);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        } else {
            setApiSuggestions([]);
        }
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const getSuggestions = () => {
    if (!query) return [];
    
    const lowerQuery = query.toLowerCase();
    
    // 1. Saved Matches
    const savedMatches = savedWords.filter(w => w.toLowerCase().startsWith(lowerQuery));

    // 2. Local Dictionary Matches
    // Create a Set of saved words for quick exclusion
    const savedSet = new Set(savedWords.map(w => w.toLowerCase()));
    
    const localMatches = DICTIONARY_WORDS.filter(
        w => w.toLowerCase().startsWith(lowerQuery) && !savedSet.has(w.toLowerCase())
    ).slice(0, 5); // Limit local

    // 3. API Matches
    // Filter out words already in saved or local to avoid duplicates
    const localSet = new Set(localMatches.map(w => w.toLowerCase()));
    const validApiMatches = apiSuggestions.filter(
        w => w.toLowerCase().startsWith(lowerQuery) && 
             !savedSet.has(w.toLowerCase()) && 
             !localSet.has(w.toLowerCase())
    );

    return [...savedMatches, ...localMatches, ...validApiMatches].slice(0, 10);
  };

  const suggestions = getSuggestions();

  return (
    <div className="search-container">
        <form onSubmit={handleSubmit}>
            <div className="search-input-wrapper">
                <span className="search-icon">
                    {isSearching ? (
                        <div className="spinner-small" style={{ width: '20px', height: '20px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    )}
                </span>
                <input 
                    className="search-page-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search dictionary..."
                    autoFocus
                />
            </div>
        </form>

        <ul className="search-suggestions">
            {suggestions.map((word, index) => {
                const isSaved = savedWords.some(w => w.toLowerCase() === word.toLowerCase());
                return (
                    <li 
                        key={`${word}-${index}`} 
                        className="suggestion-item"
                        onClick={() => onSearch(word)}
                    >
                        <span className="suggestion-text">{word}</span>
                        {isSaved && <span className="saved-tag">SAVED</span>}
                    </li>
                );
            })}
            {suggestions.length === 0 && query.length > 1 && !isSearching && (
                 <li 
                    className="suggestion-item"
                    onClick={() => onSearch(query)}
                    style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}
                 >
                    Search for "{query}"
                 </li>
            )}
        </ul>
        <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
    </div>
  );
};

export default SearchBar;