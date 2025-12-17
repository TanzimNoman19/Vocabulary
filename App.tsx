/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRandomWord, CardData, fetchFullDefinition, parseFlashcardResponse } from './services/geminiService';
import { SRSItem, calculateSRS, initializeSRSItem } from './services/srsService';
import { supabase, saveUserData, getUserData } from './services/supabaseClient';
import FlashcardView from './components/FlashcardView';
import SavedWordsList from './components/SavedWordsList';
import ProfileView from './components/ProfileView';
import ChatInterface from './components/ChatInterface';
import DiscoverySettings from './components/DiscoverySettings';
import SearchBar from './components/SearchBar';

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

  // Card Cache State (Full Flashcard Data)
  const [cardCache, setCardCache] = useState<Record<string, CardData>>(() => {
    const cache = localStorage.getItem('cardCache');
    return cache ? JSON.parse(cache) : {};
  });

  // Background Fetching Queue
  const [wordQueue, setWordQueue] = useState<string[]>([]);
  const isFetchingRef = useRef(false);

  // UI State
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Auth
  const [user, setUser] = useState<any>(null);

  // --- Effects ---
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Initial Random Word
  useEffect(() => {
    if (!currentTopic) handleRandom();
  }, []);

  // Background Pre-fetching Effect
  useEffect(() => {
    const replenishQueue = async () => {
        // Maintain a small buffer of 2 words
        if (wordQueue.length < 2 && !isFetchingRef.current) {
            isFetchingRef.current = true;
            try {
                const nextWord = await getRandomWord();
                
                // If we already have it in cache or it's already in queue, skip generating
                if (cardCache[nextWord] || wordQueue.includes(nextWord)) {
                   if (!wordQueue.includes(nextWord)) {
                       setWordQueue(prev => [...prev, nextWord]);
                   }
                } else {
                   // Generate data in background
                   const fullText = await fetchFullDefinition(nextWord);
                   const parsedData = parseFlashcardResponse(fullText);
                   
                   // Update Cache and Queue
                   setCardCache(prev => ({ ...prev, [nextWord]: parsedData }));
                   setWordQueue(prev => [...prev, nextWord]);
                }
            } catch (e) {
                console.error("Background fetch failed", e);
            } finally {
                isFetchingRef.current = false;
            }
        }
    };

    // Check periodically or when queue changes
    const timer = setTimeout(replenishQueue, 1000);
    return () => clearTimeout(timer);
  }, [wordQueue, cardCache]);

  // Sync with Supabase
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

  // Persistence (LocalStorage & Cloud)
  useEffect(() => {
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
    localStorage.setItem('srsData', JSON.stringify(srsData));
    localStorage.setItem('cardCache', JSON.stringify(cardCache));
    
    if (user) {
        // Note: For a production app, cardCache should be in a separate table 
        // as user_data column size might grow too large.
        saveUserData(user.id, { savedWords, srsData, cardCache });
    }
  }, [savedWords, srsData, cardCache, user]);

  const loadDataFromSupabase = async (userId: string) => {
    const cloudData = await getUserData(userId);
    if (cloudData) {
        setSavedWords(cloudData.savedWords || []);
        setSrsData(cloudData.srsData || {});
        if (cloudData.cardCache) {
            // Merge cloud cache with local cache to avoid overwriting recent updates
            setCardCache(prev => ({ ...prev, ...cloudData.cardCache }));
        }
    }
  };

  // --- Handlers ---
  const handleRandom = async () => {
      if (wordQueue.length > 0) {
          // Use pre-fetched word
          const next = wordQueue[0];
          setWordQueue(prev => prev.slice(1));
          setCurrentTopic(next);
      } else {
          // Fallback if queue empty
          try {
              const word = await getRandomWord();
              setCurrentTopic(word);
          } catch (e) {
              setCurrentTopic("Serendipity");
          }
      }
  };

  const handleSearch = (word: string) => {
      setCurrentTopic(word);
      setActiveTab('home'); // Switch to home to show the card
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
      
      // Auto-save if not saved
      if (!savedWords.includes(word)) {
          setSavedWords(prev => [word, ...prev]);
      }
      
      // Fetch next word (using queue if available)
      handleRandom();
  };

  const handleUpdateCache = (word: string, data: CardData) => {
      setCardCache(prev => ({ ...prev, [word]: data }));
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // --- Render ---
  return (
    <div className="app-container">
      {/* 1. Header */}
      <header className="app-header">
        <div className="logo-text">LexiFlow</div>
        <div className="header-actions">
            <button className="icon-btn" onClick={() => setIsDiscoveryOpen(!isDiscoveryOpen)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsChatOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </button>
            <button className="icon-btn" onClick={toggleTheme}>
                {theme === 'light' ? 
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> 
                   : 
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                }
            </button>
        </div>
      </header>

      {/* 2. Overlays */}
      {isDiscoveryOpen && <DiscoverySettings onClose={() => setIsDiscoveryOpen(false)} />}
      
      {isChatOpen && (
          <ChatInterface 
            onClose={() => setIsChatOpen(false)} 
            onNavigate={(word) => { setIsChatOpen(false); handleSearch(word); }}
            savedWords={savedWords}
            setSavedWords={setSavedWords}
          />
      )}

      {/* 3. Main Content */}
      <main className="main-content">
        {activeTab === 'home' && (
            <FlashcardView 
                topic={currentTopic} 
                savedWords={savedWords}
                srsData={srsData}
                cardCache={cardCache}
                onUpdateSRS={handleSRSUpdate}
                onToggleSave={handleToggleSave}
                onNavigate={handleSearch}
                onCacheUpdate={handleUpdateCache}
            />
        )}
        
        {activeTab === 'saved' && (
            <SavedWordsList 
                savedWords={savedWords} 
                srsData={srsData} 
                onNavigate={handleSearch}
            />
        )}
        
        {activeTab === 'search' && (
            <SearchBar onSearch={handleSearch} savedWords={savedWords} />
        )}

        {activeTab === 'profile' && (
            <ProfileView 
                user={user} 
                savedCount={savedWords.length}
                srsData={srsData}
                onSignOut={() => { supabase.auth.signOut(); setUser(null); }}
                onLogin={() => {/* handled inside ProfileView if needed, or simple redirect */}}
            />
        )}
      </main>

      {/* 4. Bottom Nav */}
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