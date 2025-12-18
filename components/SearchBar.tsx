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

  // Debounce API calls (using shorter delay for responsive Dictionary API)
  useEffect(() => {
    const timer = setTimeout(async () => {
        const trimmed = query.trim();
        if (trimmed.length >= 2) {
            setIsSearching(true);
            try {
                const results = await searchVocabulary(trimmed);
                setApiSuggestions(results);
            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setIsSearching(false);
            }
        } else {
            setApiSuggestions([]);
        }
    }, 250); // Faster debounce since Datamuse is quick

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const getSuggestions = () => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    
    const lowerQuery = trimmed.toLowerCase();
    
    // 1. Saved Matches
    const savedMatches = savedWords.filter(w => w.toLowerCase().startsWith(lowerQuery));

    // 2. Dictionary API & Local Matches
    // Use a Set to avoid duplicates
    const seen = new Set(savedMatches.map(w => w.toLowerCase()));
    const finalSuggestions: string[] = [...savedMatches];

    // Combine API results and local Dictionary data
    const combinedSource = [...apiSuggestions];
    
    // Add local dictionary matches if API has few results
    if (combinedSource.length < 5) {
        const localMatches = DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(lowerQuery));
        combinedSource.push(...localMatches);
    }

    for (const word of combinedSource) {
        if (!seen.has(word.toLowerCase())) {
            finalSuggestions.push(word);
            seen.add(word.toLowerCase());
        }
        if (finalSuggestions.length >= 10) break;
    }

    return finalSuggestions;
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
            {suggestions.length === 0 && query.trim().length > 1 && !isSearching && (
                 <li 
                    className="suggestion-item"
                    onClick={() => onSearch(query.trim())}
                    style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}
                 >
                    Search for "{query.trim()}"
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