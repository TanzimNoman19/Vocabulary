/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRandomWord, CardData, fetchFullDefinition, parseFlashcardResponse } from './services/geminiService';
import { SRSItem, calculateSRS, initializeSRSItem, getDueWords } from './services/srsService';
import { supabase, saveUserData, getUserData } from './services/supabaseClient';
import FlashcardView from './components/FlashcardView';
import SavedWordsList from './components/SavedWordsList';
import ProfileView from './components/ProfileView';
import ChatInterface from './components/ChatInterface';
import DiscoverySettings from './components/DiscoverySettings';
import SearchBar from './components/SearchBar';
import BulkImportModal from './components/BulkImportModal';

type Tab = 'home' | 'saved' | 'search' | 'profile';

const App: React.FC = () => {
  // --- Global State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
  });

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  
  // Data State
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedWords');
    return saved ? JSON.parse(saved) : [];
  });
  const [srsData, setSrsData] = useState<Record<string, SRSItem>>(() => {
    const data = localStorage.getItem('srsData');
    return data ? JSON.parse(data) : {};
  });

  // Card Cache State
  const [cardCache, setCardCache] = useState<Record<string, CardData>>(() => {
    const cache = localStorage.getItem('cardCache');
    return cache ? JSON.parse(cache) : {};
  });

  // Quota Status
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Background Queue
  const [wordQueue, setWordQueue] = useState<string[]>([]);
  const isFetchingRef = useRef(false);

  // UI State
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // --- Effects ---
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentTopic) handleRandom();
  }, []);

  // Background Pre-fetching Effect (Only if API is up)
  useEffect(() => {
    if (isQuotaExceeded) return;

    const replenishQueue = async () => {
        if (wordQueue.length < 2 && !isFetchingRef.current) {
            isFetchingRef.current = true;
            try {
                const nextWord = await getRandomWord();
                if (cardCache[nextWord]) {
                   setWordQueue(prev => [...prev, nextWord]);
                } else {
                   const fullText = await fetchFullDefinition(nextWord);
                   if (fullText.includes("quota") || fullText.includes("429")) {
                       setIsQuotaExceeded(true);
                       return;
                   }
                   const parsedData = parseFlashcardResponse(fullText);
                   setCardCache(prev => ({ ...prev, [nextWord]: parsedData }));
                   setWordQueue(prev => [...prev, nextWord]);
                }
            } catch (e) {
                // Silently check for quota
                setIsQuotaExceeded(true);
            } finally {
                isFetchingRef.current = false;
            }
        }
    };

    const timer = setTimeout(replenishQueue, 1500);
    return () => clearTimeout(timer);
  }, [wordQueue, cardCache, isQuotaExceeded]);

  // Sync Persistence
  useEffect(() => {
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
    localStorage.setItem('srsData', JSON.stringify(srsData));
    localStorage.setItem('cardCache', JSON.stringify(cardCache));
    if (user) saveUserData(user.id, { savedWords, srsData, cardCache });
  }, [savedWords, srsData, cardCache, user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadDataFromSupabase(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadDataFromSupabase(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadDataFromSupabase = async (userId: string) => {
    const cloudData = await getUserData(userId);
    if (cloudData) {
        setSavedWords(cloudData.savedWords || []);
        setSrsData(cloudData.srsData || {});
        setCardCache(prev => ({ ...prev, ...(cloudData.cardCache || {}) }));
    }
  };

  // --- Core Navigation Logic ---
  const handleRandom = async () => {
      // If API is up, try to get a new word
      if (!isQuotaExceeded) {
          if (wordQueue.length > 0) {
              const next = wordQueue[0];
              setWordQueue(prev => prev.slice(1));
              setCurrentTopic(next);
              return;
          }
      }

      // If API is down OR queue empty, try to show a saved word with a valid cache
      const cachedSavedWords = savedWords.filter(w => cardCache[w]);
      if (cachedSavedWords.length > 0) {
          // Use SRS to pick the best due word from those that are cached
          const dueCached = getDueWords(cachedSavedWords, srsData);
          setCurrentTopic(dueCached[0] || cachedSavedWords[0]);
      } else {
          // Absolute fallback: We have no cached data and API is gone
          setCurrentTopic("__EMPTY_FALLBACK__");
      }
  };

  const handleSearch = (word: string) => {
      setCurrentTopic(word);
      setActiveTab('home');
      setIsQuotaExceeded(false); // Try resetting quota check on explicit search
  };

  const handleToggleSave = (word: string) => {
      const exists = savedWords.some(w => w.toLowerCase() === word.toLowerCase());
      if (exists) {
          setSavedWords(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
          const newSrs = { ...srsData };
          delete newSrs[word];
          setSrsData(newSrs);
      } else {
          setSavedWords(prev => [word, ...prev]);
          setSrsData(prev => ({ ...prev, [word]: initializeSRSItem(word) }));
      }
  };

  const handleSRSUpdate = (word: string, grade: 'know' | 'dont_know') => {
      const currentItem = srsData[word] || initializeSRSItem(word);
      const newItem = calculateSRS(currentItem, grade);
      setSrsData(prev => ({ ...prev, [word]: newItem }));
      if (!savedWords.includes(word)) setSavedWords(prev => [word, ...prev]);
      handleRandom();
  };

  const handleBulkImport = (newWords: Record<string, CardData>) => {
      setCardCache(prev => ({ ...prev, ...newWords }));
      setSavedWords(prev => {
          const wordsToAdd = Object.keys(newWords).filter(w => !prev.includes(w));
          return [...wordsToAdd, ...prev];
      });
      setSrsData(prev => {
          const updated = { ...prev };
          Object.keys(newWords).forEach(w => {
              if (!updated[w]) updated[w] = initializeSRSItem(w);
          });
          return updated;
      });
      // Navigate to first imported word
      const firstWord = Object.keys(newWords)[0];
      if (firstWord) handleSearch(firstWord);
  };

  // --- Render ---
  return (
    <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div className="logo-text">LexiFlow</div>
        <div className="header-actions">
            <button 
                className={`icon-btn ${isQuotaExceeded ? 'disabled' : ''}`} 
                onClick={() => !isQuotaExceeded && setIsDiscoveryOpen(true)} 
                title={isQuotaExceeded ? "Discovery restricted in local mode" : "Randomness Settings"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsBulkImportOpen(true)} title="Bulk Import">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsChatOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </button>
            <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
      </header>

      {isBulkImportOpen && <BulkImportModal onClose={() => setIsBulkImportOpen(false)} onImport={handleBulkImport} />}
      {isDiscoveryOpen && <DiscoverySettings onClose={() => setIsDiscoveryOpen(false)} />}
      
      {isChatOpen && (
          <ChatInterface 
            onClose={() => setIsChatOpen(false)} 
            onNavigate={handleSearch}
            savedWords={savedWords}
            setSavedWords={setSavedWords}
          />
      )}

      <main className="main-content">
        {isQuotaExceeded && activeTab === 'home' && currentTopic !== '__EMPTY_FALLBACK__' && (
            <div style={{ background: 'var(--accent-secondary)', color: 'var(--accent-primary)', padding: '8px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                LOCAL MODE: Browsing saved words while AI rests.
            </div>
        )}

        {activeTab === 'home' && (
            <FlashcardView 
                topic={currentTopic} 
                savedWords={savedWords}
                srsData={srsData}
                cardCache={cardCache}
                onUpdateSRS={handleSRSUpdate}
                onToggleSave={handleToggleSave}
                onNavigate={handleSearch}
                onCacheUpdate={(w, d) => setCardCache(prev => ({ ...prev, [w]: d }))}
                onOpenImport={() => setIsBulkImportOpen(true)}
            />
        )}
        
        {activeTab === 'saved' && (
            <SavedWordsList savedWords={savedWords} srsData={srsData} onNavigate={handleSearch} />
        )}
        
        {activeTab === 'search' && (
            <div className="search-view">
                <SearchBar onSearch={handleSearch} savedWords={savedWords} />
            </div>
        )}

        {activeTab === 'profile' && (
            <ProfileView 
                user={user} 
                savedCount={savedWords.length}
                srsData={srsData}
                onSignOut={() => supabase.auth.signOut()}
                onLogin={() => {}}
            />
        )}
      </main>

      <div className="bottom-nav-container">
        <nav className="bottom-nav">
            <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                {activeTab === 'home' && <span>Home</span>}
            </button>
            <button className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                {activeTab === 'saved' && <span>Saved</span>}
            </button>
            <button className={`nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                {activeTab === 'search' && <span>Search</span>}
            </button>
            <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {activeTab === 'profile' && <span>Profile</span>}
            </button>
        </nav>
      </div>
    </div>
  );
};

export default App;