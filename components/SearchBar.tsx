/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

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

  const suggestions = query 
    ? savedWords.filter(w => w.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5) 
    : [];

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
                    placeholder="Search or add word..."
                    autoFocus
                    style={{ paddingLeft: '2.5rem' }}
                />
            </div>
        </form>

        <ul style={{ listStyle: 'none', padding: 0, marginTop: '2rem' }}>
            {suggestions.map(word => (
                <li key={word} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '1.1rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => onSearch(word)}>
                    {word}
                </li>
            ))}
        </ul>
    </div>
  );
};

export default SearchBar;
