
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { DICTIONARY_WORDS } from '../services/dictionaryData';
import { searchVocabulary } from '../services/dictionaryService';

interface SearchBarProps {
  onSearch: (query: string) => void;
  savedWords: string[];
  isOnline: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, savedWords, isOnline }) => {
  const [query, setQuery] = useState('');
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
        const trimmed = query.trim();
        if (trimmed.length >= 2 && isOnline) {
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
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOnline]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const getSuggestions = () => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    
    const lowerQuery = trimmed.toLowerCase();
    const savedMatches = savedWords.filter(w => w.toLowerCase().startsWith(lowerQuery));

    const seen = new Set(savedMatches.map(w => w.toLowerCase()));
    const finalSuggestions: string[] = [...savedMatches];

    if (isOnline) {
        for (const word of apiSuggestions) {
            if (!seen.has(word.toLowerCase())) {
                finalSuggestions.push(word);
                seen.add(word.toLowerCase());
            }
            if (finalSuggestions.length >= 10) break;
        }
    } else {
        // Local fallback when offline
        const localMatches = DICTIONARY_WORDS.filter(w => w.toLowerCase().startsWith(lowerQuery));
        for (const word of localMatches) {
            if (!seen.has(word.toLowerCase())) {
                finalSuggestions.push(word);
                seen.add(word.toLowerCase());
            }
            if (finalSuggestions.length >= 10) break;
        }
    }

    return finalSuggestions;
  };

  const suggestions = getSuggestions();

  return (
    <div className="search-container">
        {!isOnline && (
            <div style={{ marginBottom: '1rem', padding: '10px', background: 'rgba(255, 59, 48, 0.1)', borderRadius: '12px', fontSize: '0.8rem', color: '#ff3b30', fontWeight: 600 }}>
                ⚠️ You are offline. Searching your library and common words.
            </div>
        )}
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
                    placeholder={isOnline ? "Search dictionary..." : "Search library..."}
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
