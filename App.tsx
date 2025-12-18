
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { getRandomWord, CardData, fetchFullDefinition, parseFlashcardResponse } from './services/geminiService';
import { SRSItem, calculateSRS, initializeSRSItem, getDueWords } from './services/srsService';
import { supabase, saveUserData, getUserData, UserHistoryItem } from './services/supabaseClient';
import FlashcardView from './components/FlashcardView';
import SavedWordsList from './components/SavedWordsList';
import ProfileView from './components/ProfileView';
import ChatInterface from './components/ChatInterface';
import DiscoverySettings from './components/DiscoverySettings';
import SearchBar from './components/SearchBar';
import BulkImportModal from './components/BulkImportModal';
import HistoryView from './components/HistoryView';

type Tab = 'home' | 'saved' | 'search' | 'profile';
type QuotaStatus = 'available' | 'exceeded' | 'checking';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('theme') as 'light' | 'dark' || 'light');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [nextPrefetchedWord, setNextPrefetchedWord] = useState<string | null>(null);
  
  const [savedWords, setSavedWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('savedWords') || '[]'));
  const [srsData, setSrsData] = useState<Record<string, SRSItem>>(() => JSON.parse(localStorage.getItem('srsData') || '{}'));
  const [cardCache, setCardCache] = useState<Record<string, CardData>>(() => JSON.parse(localStorage.getItem('cardCache') || '{}'));
  const [history, setHistory] = useState<UserHistoryItem[]>(() => JSON.parse(localStorage.getItem('history') || '[]'));

  const [discoveryMix, setDiscoveryMix] = useState<number>(() => Number(localStorage.getItem('discoveryMix')) || 50);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus>('available');
  
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [wordQueue, setWordQueue] = useState<string[]>([]);

  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentTopic) handleRandom();
  }, []);

  // Sync quota statuses
  useEffect(() => {
    setQuotaStatus(isQuotaExceeded ? 'exceeded' : 'available');
  }, [isQuotaExceeded]);

  // Background Pre-fetching logic
  useEffect(() => {
    if (currentTopic && !nextPrefetchedWord && !isQuotaExceeded) {
        prefetchNext();
    }
  }, [currentTopic, nextPrefetchedWord, isQuotaExceeded]);

  const prefetchNext = async () => {
      try {
          const w = await getRandomWord();
          setNextPrefetchedWord(w);
          // Kick off the definition fetch silently
          fetchFullDefinition(w).then(fullText => {
              if (fullText && !fullText.includes("ERROR")) {
                  const parsed = parseFlashcardResponse(fullText);
                  setCardCache(prev => ({ ...prev, [w]: parsed }));
              }
          });
      } catch (e) {
          console.debug("Prefetch failed", e);
      }
  };

  // Track history whenever currentTopic changes
  useEffect(() => {
    if (currentTopic && currentTopic !== "__RANDOM__" && currentTopic !== "__EMPTY_FALLBACK__") {
      setHistory(prev => {
        const filtered = prev.filter(h => h.word.toLowerCase() !== currentTopic.toLowerCase());
        const newItem = { word: currentTopic, timestamp: Date.now() };
        return [newItem, ...filtered].slice(0, 500); // Keep last 500
      });
    }
  }, [currentTopic]);

  useEffect(() => {
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
    localStorage.setItem('srsData', JSON.stringify(srsData));
    localStorage.setItem('cardCache', JSON.stringify(cardCache));
    localStorage.setItem('history', JSON.stringify(history));
    if (user) saveUserData(user.id, { savedWords, srsData, cardCache, history });
  }, [savedWords, srsData, cardCache, history, user]);

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
        setHistory(cloudData.history || []);
    }
  };

  const handleRandom = async () => {
      const cachedSavedWords = savedWords.filter(w => cardCache[w]);

      // If Quota is exceeded, only show saved/cached words
      if (isQuotaExceeded) {
          if (cachedSavedWords.length > 0) {
              const dueCached = getDueWords(cachedSavedWords, srsData);
              setCurrentTopic(dueCached[0] || cachedSavedWords[Math.floor(Math.random() * cachedSavedWords.length)]);
          } else {
              setCurrentTopic("__EMPTY_FALLBACK__");
          }
          return;
      }

      const roll = Math.random() * 100;
      const preferSaved = roll > discoveryMix;

      if (preferSaved && cachedSavedWords.length > 0) {
          const dueCached = getDueWords(cachedSavedWords, srsData);
          setCurrentTopic(dueCached[0] || cachedSavedWords[Math.floor(Math.random() * cachedSavedWords.length)]);
      } else if (nextPrefetchedWord) {
          // Use prefetched word
          setCurrentTopic(nextPrefetchedWord);
          setNextPrefetchedWord(null);
      } else if (wordQueue.length > 0) {
          const next = wordQueue[0];
          setWordQueue(prev => prev.slice(1));
          setCurrentTopic(next);
      } else {
          try {
            const w = await getRandomWord();
            setCurrentTopic(w);
          } catch(e: any) {
            // Check if error is quota related
            const msg = e.message || '';
            if (msg.includes('429') || msg.includes('quota') || msg.includes('limit')) {
                setIsQuotaExceeded(true);
                // Try to fallback immediately
                if (cachedSavedWords.length > 0) {
                   setCurrentTopic(cachedSavedWords[0]);
                } else {
                   setCurrentTopic("__EMPTY_FALLBACK__");
                }
            } else {
                setCurrentTopic("__EMPTY_FALLBACK__");
            }
          }
      }
  };

  const handleSearch = (word: string) => {
      if (word === '__RANDOM__') {
          handleRandom();
          return;
      }
      setCurrentTopic(word);
      setActiveTab('home');
      setIsQuotaExceeded(false); 
      setIsHistoryOpen(false);
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

  return (
    <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div className="logo-text">LexiFlow</div>
        <div className="header-actions">
            <div className={`ai-status-pill ${quotaStatus}`} title="Gemini AI Status">
                <div className="dot"></div>
                <span>{quotaStatus === 'available' ? 'AI Ready' : quotaStatus}</span>
            </div>
            <button className="icon-btn" onClick={() => setIsDiscoveryOpen(true)} title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsBulkImportOpen(true)} title="Import">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsChatOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </button>
            <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
      </header>

      {isBulkImportOpen && <BulkImportModal onClose={() => setIsBulkImportOpen(false)} onImport={(w) => { setCardCache(prev => ({...prev, ...w})); setSavedWords(p => [...Object.keys(w), ...p]); }} />}
      {isDiscoveryOpen && <DiscoverySettings value={discoveryMix} onChange={setDiscoveryMix} onClose={() => setIsDiscoveryOpen(false)} />}
      {isChatOpen && <ChatInterface onClose={() => setIsChatOpen(false)} onNavigate={handleSearch} savedWords={savedWords} setSavedWords={setSavedWords} />}
      {isHistoryOpen && <HistoryView history={history} setHistory={setHistory} savedWords={savedWords} onToggleSave={handleToggleSave} onNavigate={handleSearch} onClose={() => setIsHistoryOpen(false)} cardCache={cardCache} />}

      <main className="main-content">
        {activeTab === 'home' && (
            <FlashcardView topic={currentTopic} savedWords={savedWords} srsData={srsData} cardCache={cardCache} onUpdateSRS={handleSRSUpdate} onToggleSave={handleToggleSave} onNavigate={handleSearch} onCacheUpdate={(w, d) => setCardCache(prev => ({ ...prev, [w]: d }))} onOpenImport={() => setIsBulkImportOpen(true)} isQuotaExceeded={isQuotaExceeded} setIsQuotaExceeded={setIsQuotaExceeded} />
        )}
        {activeTab === 'saved' && <SavedWordsList savedWords={savedWords} srsData={srsData} cardCache={cardCache} onNavigate={handleSearch} />}
        {activeTab === 'search' && <div className="search-view"><SearchBar onSearch={handleSearch} savedWords={savedWords} /></div>}
        {activeTab === 'profile' && <ProfileView user={user} savedCount={savedWords.length} srsData={srsData} onSignOut={() => supabase.auth.signOut()} onLogin={() => {}} onOpenHistory={() => setIsHistoryOpen(true)} />}
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
