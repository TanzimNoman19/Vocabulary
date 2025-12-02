/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  canBack: boolean;
  canForward: boolean;
  isAtHome: boolean;
  suggestionWords: string[]; // List of words for autocomplete
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  isLoading, 
  theme,
  onToggleTheme,
  onBack,
  onForward,
  onHome,
  canBack,
  canForward,
  isAtHome,
  suggestionWords
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter suggestions when query changes
  useEffect(() => {
    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      // Filter words that start with the query, limit to 8 results
      const matches = suggestionWords
        .filter(word => word.toLowerCase().startsWith(lowerQuery))
        .slice(0, 8);
      
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, suggestionWords]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
      setQuery('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (word: string) => {
    onSearch(word);
    setQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="search-container" ref={wrapperRef}>
      <div className="nav-controls">
        <button 
            className="nav-btn" 
            onClick={onHome} 
            aria-label="Go to Home"
            title="Home"
            disabled={isAtHome}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
        </button>
        <button 
            className="nav-btn" 
            onClick={onBack} 
            aria-label="Go Back"
            disabled={!canBack}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
        <button 
            className="nav-btn" 
            onClick={onForward} 
            aria-label="Go Forward"
            disabled={!canForward}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
      </div>

      <div style={{ flexGrow: 1, position: 'relative' }}>
        <form onSubmit={handleSubmit} className="search-form" role="search">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Search vocabulary..."
            className="search-input"
            aria-label="Search for a topic"
            disabled={isLoading}
            autoComplete="off"
          />
        </form>
        
        {/* Autocomplete Dropdown */}
        {showSuggestions && (
          <ul className="suggestions-dropdown">
            {suggestions.map((word) => (
              <li key={word}>
                <button 
                  className="suggestion-item" 
                  onClick={() => handleSuggestionClick(word)}
                >
                  {word}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={onToggleTheme} className="theme-toggle-btn" aria-label="Toggle Dark Mode" title="Toggle Theme">
        {theme === 'light' ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
        )}
      </button>
    </div>
  );
};

export default SearchBar;