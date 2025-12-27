
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { fetchWordData, CardData } from './services/dictionaryService';
import { SRSItem, calculateSRS, initializeSRSItem, getDueWords } from './services/srsService';
import { supabase, saveUserData, getUserData, UserHistoryItem } from './services/supabaseClient';
import FlashcardView from './components/FlashcardView';
import SavedWordsList from './components/SavedWordsList';
import ProfileView from './components/ProfileView';
import SearchBar from './components/SearchBar';
import BulkImportModal from './components/BulkImportModal';
import HistoryView from './components/HistoryView';
import CardSettingsModal from './components/CardSettingsModal';

type Tab = 'home' | 'saved' | 'search' | 'profile';

export interface VisibilitySettings {
  ipa: boolean;
  definition: boolean;
  bengali: boolean;
  context: boolean;
  synonyms: boolean;
  antonyms: boolean;
  family: boolean;
  etymology: boolean;
  usageNotes: boolean;
}

const DEFAULT_VISIBILITY: VisibilitySettings = {
  ipa: true,
  definition: true,
  bengali: true,
  context: true,
  synonyms: true,
  antonyms: true,
  family: true,
  etymology: true,
  usageNotes: true
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('theme') as 'light' | 'dark' || 'light');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [savedWords, setSavedWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('savedWords') || '[]'));
  const [favoriteWords, setFavoriteWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('favoriteWords') || '[]'));
  const [trashedWords, setTrashedWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('trashedWords') || '[]'));
  const [srsData, setSrsData] = useState<Record<string, SRSItem>>(() => JSON.parse(localStorage.getItem('srsData') || '{}'));
  const [cardCache, setCardCache] = useState<Record<string, CardData>>(() => JSON.parse(localStorage.getItem('cardCache') || '{}'));
  const [history, setHistory] = useState<UserHistoryItem[]>(() => JSON.parse(localStorage.getItem('history') || '[]'));

  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(() => {
    const saved = localStorage.getItem('visibilitySettings');
    return saved ? JSON.parse(saved) : DEFAULT_VISIBILITY;
  });

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentTopic) handleRandom();
  }, []);

  useEffect(() => {
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
    localStorage.setItem('favoriteWords', JSON.stringify(favoriteWords));
    localStorage.setItem('trashedWords', JSON.stringify(trashedWords));
    localStorage.setItem('srsData', JSON.stringify(srsData));
    localStorage.setItem('cardCache', JSON.stringify(cardCache));
    localStorage.setItem('history', JSON.stringify(history));
    localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
    if (user && isOnline) saveUserData(user.id, { savedWords, favoriteWords, trashedWords, srsData, cardCache, history });
  }, [savedWords, favoriteWords, trashedWords, srsData, cardCache, history, user, isOnline, visibilitySettings]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && isOnline) loadDataFromSupabase(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && isOnline) loadDataFromSupabase(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [isOnline]);

  const loadDataFromSupabase = async (userId: string) => {
    const cloudData = await getUserData(userId);
    if (cloudData) {
        setSavedWords(cloudData.savedWords || []);
        setFavoriteWords(cloudData.favoriteWords || []);
        setTrashedWords(cloudData.trashedWords || []);
        setSrsData(cloudData.srsData || {});
        setCardCache(prev => ({ ...prev, ...(cloudData.cardCache || {}) }));
        setHistory(cloudData.history || []);
    }
  };

  const handleRandom = () => {
      if (savedWords.length > 0) {
          const dueCached = getDueWords(savedWords, srsData);
          setCurrentTopic(dueCached[0] || savedWords[Math.floor(Math.random() * savedWords.length)]);
      } else {
          setCurrentTopic("__EMPTY_FALLBACK__");
      }
  };

  const handleSearch = (word: string) => {
      if (word === '__RANDOM__') {
          handleRandom();
      } else {
          setCurrentTopic(word);
      }
      setActiveTab('home');
      setIsHistoryOpen(false);
  };

  const handleToggleSave = (word: string) => {
      const exists = savedWords.some(w => w.toLowerCase() === word.toLowerCase());
      if (exists) {
          handleMoveToTrash([word]);
      } else {
          // If restoring from trash via save toggle
          if (trashedWords.includes(word)) {
              handleRestoreFromTrash([word]);
          } else {
              setSavedWords(prev => [word, ...prev]);
              if (!srsData[word]) setSrsData(prev => ({ ...prev, [word]: initializeSRSItem(word) }));
          }
      }
  };

  const handleMoveToTrash = (words: string[]) => {
      const wordSet = new Set(words.map(w => w.toLowerCase()));
      setSavedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setFavoriteWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setTrashedWords(prev => [...new Set([...words, ...prev])]);
      if (wordSet.has(currentTopic.toLowerCase())) handleRandom();
  };

  const handleRestoreFromTrash = (words: string[]) => {
      const wordSet = new Set(words.map(w => w.toLowerCase()));
      setTrashedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setSavedWords(prev => [...new Set([...words, ...prev])]);
  };

  const handlePermanentDelete = (words: string[]) => {
      const wordSet = new Set(words.map(w => w.toLowerCase()));
      setTrashedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setSrsData(prev => {
          const next = { ...prev };
          words.forEach(w => delete next[w]);
          return next;
      });
  };

  const handleToggleFavorite = (word: string) => {
      const isFav = favoriteWords.some(w => w.toLowerCase() === word.toLowerCase());
      if (isFav) {
          setFavoriteWords(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
      } else {
          setFavoriteWords(prev => [word, ...prev]);
          if (!savedWords.includes(word)) setSavedWords(prev => [word, ...prev]);
          if (!srsData[word]) setSrsData(prev => ({ ...prev, [word]: initializeSRSItem(word) }));
          // If it was in trash, restore it
          if (trashedWords.includes(word)) {
              setTrashedWords(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
          }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-text">LexiFlow</div>
          {!isOnline && <span className="offline-badge">Offline</span>}
        </div>
        <div className="header-actions">
            <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Card Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <button className="icon-btn" onClick={() => setIsBulkImportOpen(true)} title="Import Library">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
      </header>

      {isBulkImportOpen && <BulkImportModal onClose={() => setIsBulkImportOpen(false)} onImport={(w) => { setCardCache(prev => ({...prev, ...w})); setSavedWords(p => [...Object.keys(w), ...p]); }} />}
      {isHistoryOpen && <HistoryView history={history} setHistory={setHistory} savedWords={savedWords} onToggleSave={handleToggleSave} onNavigate={handleSearch} onClose={() => setIsHistoryOpen(false)} cardCache={cardCache} />}
      {isSettingsOpen && <CardSettingsModal settings={visibilitySettings} onUpdate={setVisibilitySettings} onClose={() => setIsSettingsOpen(false)} />}

      <main className="main-content">
        {activeTab === 'home' && (
            <FlashcardView topic={currentTopic} savedWords={savedWords} favoriteWords={favoriteWords} srsData={srsData} cardCache={cardCache} onUpdateSRS={handleSRSUpdate} onToggleSave={handleToggleSave} onToggleFavorite={handleToggleFavorite} onNavigate={handleSearch} onCacheUpdate={(w, d) => setCardCache(prev => ({ ...prev, [w]: d }))} onOpenImport={() => setIsBulkImportOpen(true)} isOnline={isOnline} visibilitySettings={visibilitySettings} />
        )}
        {activeTab === 'saved' && <SavedWordsList savedWords={savedWords} favoriteWords={favoriteWords} trashedWords={trashedWords} srsData={srsData} cardCache={cardCache} onNavigate={handleSearch} onDeleteMultiple={handleMoveToTrash} onRestoreFromTrash={handleRestoreFromTrash} onPermanentDelete={handlePermanentDelete} />}
        {activeTab === 'search' && <div className="search-view"><SearchBar onSearch={handleSearch} savedWords={savedWords} isOnline={isOnline} /></div>}
        {activeTab === 'profile' && <ProfileView user={user} savedCount={savedWords.length} srsData={srsData} onSignOut={() => supabase.auth.signOut()} onLogin={() => {}} onOpenHistory={() => setIsHistoryOpen(true)} isOnline={isOnline} />}
      </main>

      <div className="bottom-nav-container">
        <nav className="bottom-nav">
            <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                {activeTab === 'home' && <span>Study</span>}
            </button>
            <button className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                {activeTab === 'saved' && <span>Library</span>}
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
