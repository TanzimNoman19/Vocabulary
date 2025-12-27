
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWordData, CardData } from './services/dictionaryService';
import { SRSItem, calculateSRS, initializeSRSItem, getDueWords } from './services/srsService';
import { supabase, saveUserData, getUserData } from './services/supabaseClient';
import FlashcardView from './components/FlashcardView';
import SavedWordsList from './components/SavedWordsList';
import ProfileView from './components/ProfileView';
import BulkImportModal from './components/BulkImportModal';
import CardSettingsModal from './components/CardSettingsModal';
import TrashModal from './components/TrashModal';

type Tab = 'home' | 'saved' | 'profile';

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
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [savedWords, setSavedWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('savedWords') || '[]'));
  const [favoriteWords, setFavoriteWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('favoriteWords') || '[]'));
  const [trashedWords, setTrashedWords] = useState<string[]>(() => JSON.parse(localStorage.getItem('trashedWords') || '[]'));
  const [srsData, setSrsData] = useState<Record<string, SRSItem>>(() => JSON.parse(localStorage.getItem('srsData') || '{}'));
  const [cardCache, setCardCache] = useState<Record<string, CardData>>(() => JSON.parse(localStorage.getItem('cardCache') || '{}'));

  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(() => {
    const saved = localStorage.getItem('visibilitySettings');
    return saved ? JSON.parse(saved) : DEFAULT_VISIBILITY;
  });

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Background Sync Queue
  const syncQueue = useRef<string[]>([]);
  const isSyncProcessing = useRef(false);

  const processSyncQueue = async () => {
    if (isSyncProcessing.current || !isOnline || syncQueue.current.length === 0) return;
    
    isSyncProcessing.current = true;
    setIsSyncing(true);

    while (syncQueue.current.length > 0 && isOnline) {
      const word = syncQueue.current.shift();
      if (word && !cardCache[word]) {
        try {
          const data = await fetchWordData(word);
          setCardCache(prev => ({ ...prev, [word]: data }));
          // Throttling to respect API quotas
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
          console.warn(`Background sync failed for ${word}`);
        }
      }
    }

    isSyncProcessing.current = false;
    setIsSyncing(false);
  };

  // Trigger sync when online or library changes
  useEffect(() => {
    const missing = savedWords.filter(w => !cardCache[w]);
    if (missing.length > 0 && isOnline) {
      syncQueue.current = [...new Set([...syncQueue.current, ...missing])];
      processSyncQueue();
    }
  }, [savedWords, isOnline, cardCache]);

  const loadDataFromSupabase = useCallback(async (userId: string) => {
    if (!navigator.onLine) return;
    const cloudData = await getUserData(userId);
    if (cloudData) {
        setSavedWords(cloudData.savedWords || []);
        setFavoriteWords(cloudData.favoriteWords || []);
        setTrashedWords(cloudData.trashedWords || []);
        setSrsData(cloudData.srsData || {});
        setCardCache(prev => ({ ...prev, ...(cloudData.cardCache || {}) }));
    }
  }, []);

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
    localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
    if (user && isOnline) saveUserData(user.id, { savedWords, favoriteWords, trashedWords, srsData, cardCache });
  }, [savedWords, favoriteWords, trashedWords, srsData, cardCache, user, isOnline, visibilitySettings]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser && isOnline) loadDataFromSupabase(activeUser.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser && isOnline) loadDataFromSupabase(activeUser.id);
    });

    return () => subscription.unsubscribe();
  }, [isOnline, loadDataFromSupabase]);

  const handleRandom = () => {
      if (savedWords.length > 0) {
          const dueCached = getDueWords(savedWords, srsData);
          setCurrentTopic(dueCached[0] || savedWords[Math.floor(Math.random() * savedWords.length)]);
      } else {
          setCurrentTopic("__EMPTY_FALLBACK__");
      }
  };

  const handleNavigate = (word: string) => {
      if (word === '__RANDOM__') {
          handleRandom();
      } else {
          setCurrentTopic(word);
      }
      setActiveTab('home');
  };

  const handleToggleSave = (word: string) => {
      const exists = savedWords.some(w => w.toLowerCase() === word.toLowerCase());
      if (exists) {
          handleMoveToTrash([word]);
      } else {
          if (trashedWords.includes(word)) {
              handleRestoreFromTrash([word]);
          } else {
              setSavedWords(prev => [word, ...prev]);
              if (!srsData[word]) setSrsData(prev => ({ ...prev, [word]: initializeSRSItem(word) }));
          }
      }
  };

  const handleImportWords = (importedCache: Record<string, CardData>) => {
      const importedWordList = Object.keys(importedCache);
      const existingWordSet = new Set(savedWords.map(w => w.toLowerCase()));
      const trashedWordSet = new Set(trashedWords.map(w => w.toLowerCase()));
      
      const newWords: string[] = [];
      const updatedWords: string[] = [];

      importedWordList.forEach(word => {
          const lowerWord = word.toLowerCase();
          if (existingWordSet.has(lowerWord)) {
              updatedWords.push(word);
          } else {
              newWords.push(word);
              if (trashedWordSet.has(lowerWord)) {
                  setTrashedWords(prev => prev.filter(w => w.toLowerCase() !== lowerWord));
              }
          }
      });

      setCardCache(prev => ({ ...prev, ...importedCache }));

      if (newWords.length > 0) {
          setSavedWords(prev => [...newWords, ...prev]);
          setSrsData(prev => {
              const next = { ...prev };
              newWords.forEach(w => {
                  if (!next[w]) next[w] = initializeSRSItem(w);
              });
              return next;
          });
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

  const handleResetSRS = () => {
    setSrsData(prev => {
      const next: Record<string, SRSItem> = {};
      Object.keys(prev).forEach(word => {
        next[word] = initializeSRSItem(word);
      });
      return next;
    });
  };

  const cachedCount = savedWords.filter(w => cardCache[w]).length;

  return (
    <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-text">LexiFlow</div>
          {isSyncing && <div className="sync-spinner" title="Syncing library for offline use..."></div>}
        </div>
        <div className="header-actions">
            {!isOnline && <span className="offline-badge-pill">OFFLINE</span>}
            
            {activeTab === 'saved' && (
              <div className="header-dynamic-actions" style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn header-import-btn" onClick={() => setIsBulkImportOpen(true)} title="Bulk Import JSON">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <button className={`icon-btn header-trash-btn ${trashedWords.length > 0 ? 'not-empty' : ''}`} onClick={() => setIsTrashOpen(true)} title="View Trash">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            )}

            <button className="icon-btn header-settings-btn" onClick={() => setIsSettingsOpen(true)} title="Card Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1-1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
            <button className="icon-btn header-theme-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Toggle Theme">
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                )}
            </button>
        </div>
      </header>

      {isBulkImportOpen && <BulkImportModal onClose={() => setIsBulkImportOpen(false)} onImport={handleImportWords} />}
      {isSettingsOpen && <CardSettingsModal settings={visibilitySettings} onUpdate={setVisibilitySettings} onClose={() => setIsSettingsOpen(false)} />}
      {isTrashOpen && (
          <TrashModal 
            trashedWords={trashedWords} 
            cardCache={cardCache}
            onClose={() => setIsTrashOpen(false)} 
            onRestore={handleRestoreFromTrash} 
            onPermanentDelete={handlePermanentDelete}
          />
      )}

      <main className="main-content">
        {!isOnline && (
            <div className="offline-banner">
                You're studying offline. {cachedCount}/{savedWords.length} words are ready for review.
            </div>
        )}
        
        {activeTab === 'home' && (
            <FlashcardView topic={currentTopic} savedWords={savedWords} favoriteWords={favoriteWords} srsData={srsData} cardCache={cardCache} onUpdateSRS={handleSRSUpdate} onToggleSave={handleToggleSave} onToggleFavorite={handleToggleFavorite} onNavigate={handleNavigate} onCacheUpdate={(w, d) => setCardCache(prev => ({ ...prev, [w]: d }))} onOpenImport={() => setIsBulkImportOpen(true)} isOnline={isOnline} visibilitySettings={visibilitySettings} />
        )}
        {activeTab === 'saved' && (
            <SavedWordsList 
                savedWords={savedWords} 
                favoriteWords={favoriteWords} 
                trashedWords={trashedWords} 
                srsData={srsData} 
                cardCache={cardCache} 
                onNavigate={handleNavigate} 
                onDeleteMultiple={handleMoveToTrash} 
                onRestoreFromTrash={handleRestoreFromTrash} 
                onPermanentDelete={handlePermanentDelete} 
                onOpenImport={() => setIsBulkImportOpen(true)}
            />
        )}
        {activeTab === 'profile' && <ProfileView user={user} savedCount={savedWords.length} cachedCount={cachedCount} srsData={srsData} onSignOut={() => supabase.auth.signOut()} onLogin={() => {}} isOnline={isOnline} onResetSRS={handleResetSRS} />}
      </main>

      <div className="bottom-nav-container">
        <nav className="bottom-nav">
            {/* Sliding Liquid Indicator */}
            <div className={`nav-indicator pos-${activeTab}`} />
            
            <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                <span>Study</span>
            </button>
            <button className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                <span>Library</span>
            </button>
            <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Profile</span>
            </button>
        </nav>
      </div>

      <style>{`
        .icon-btn {
          width: 40px;
          height: 40px;
          background: var(--accent-secondary);
          color: var(--text-primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          flex-shrink: 0;
        }
        .icon-btn:hover {
          background: var(--border-color);
          border-color: var(--accent-primary);
        }
        .icon-btn:active {
          transform: scale(0.92);
          background: var(--accent-secondary);
        }
        .header-trash-btn.not-empty {
          position: relative;
        }
        .header-trash-btn.not-empty::after {
          content: '';
          position: absolute;
          top: 6px;
          right: 6px;
          width: 8px;
          height: 8px;
          background: var(--danger-color);
          border-radius: 50%;
          border: 2.5px solid var(--bg-color);
        }
      `}</style>
    </div>
  );
};

export default App;
