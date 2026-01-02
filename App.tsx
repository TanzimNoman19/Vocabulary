
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWordData, CardData, fetchExplorePack, capitalize } from './services/dictionaryService';
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
  definition: boolean;
  bengali: boolean;
  context: boolean;
  synonyms: boolean;
  antonyms: boolean;
  family: boolean;
  etymology: boolean;
  usageNotes: boolean;
}

export interface SemanticCluster {
    id: string;
    title: string;
    members: string[];
    explanation: string;
    isAiGenerated: boolean;
}

const DEFAULT_VISIBILITY: VisibilitySettings = {
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
  
  // Clusters and Settings
  const [semanticClusters, setSemanticClusters] = useState<SemanticCluster[]>(() => JSON.parse(localStorage.getItem('semanticClusters') || '[]'));
  const [clusterSimilarity, setClusterSimilarity] = useState<number>(() => Number(localStorage.getItem('clusterSimilarity')) || 1);

  // Migration Effect
  useEffect(() => {
    let hasChanged = false;
    const sanitizeList = (list: string[]) => {
      const newList = list.map(capitalize);
      if (JSON.stringify(newList) !== JSON.stringify(list)) {
        hasChanged = true;
        return newList;
      }
      return list;
    };
    const sanitizeObjectKeys = <T,>(obj: Record<string, T>) => {
      const next: Record<string, T> = {};
      let changed = false;
      Object.entries(obj).forEach(([key, value]) => {
        const capitalizedKey = capitalize(key);
        if (capitalizedKey !== key) changed = true;
        next[capitalizedKey] = value;
      });
      if (changed) {
        hasChanged = true;
        return next;
      }
      return obj;
    };

    const newSaved = sanitizeList(savedWords);
    const newFavs = sanitizeList(favoriteWords);
    const newTrash = sanitizeList(trashedWords);
    const newSRS = sanitizeObjectKeys(srsData);
    const newCache = sanitizeObjectKeys(cardCache);

    if (hasChanged) {
      setSavedWords(newSaved);
      setFavoriteWords(newFavs);
      setTrashedWords(newTrash);
      setSrsData(newSRS as Record<string, SRSItem>);
      setCardCache(newCache as Record<string, CardData>);
      if (currentTopic && currentTopic !== "__EMPTY_FALLBACK__") {
        setCurrentTopic(capitalize(currentTopic));
      }
    }
  }, []);

  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(() => {
    const saved = localStorage.getItem('visibilitySettings');
    return saved ? JSON.parse(saved) : DEFAULT_VISIBILITY;
  });
  const [explorePackSize, setExplorePackSize] = useState<number>(() => Number(localStorage.getItem('explorePackSize')) || 10);
  const [definitionStyle, setDefinitionStyle] = useState<string>(() => localStorage.getItem('definitionStyle') || 'standard');

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [shouldStartFlipped, setShouldStartFlipped] = useState(false);

  const [isExploreMode, setIsExploreMode] = useState(false);
  const [explorePack, setExplorePack] = useState<string[]>([]);
  const [exploreIndex, setExploreIndex] = useState(-1);
  const [isExploring, setIsExploring] = useState(false);

  const syncQueue = useRef<string[]>([]);
  const isSyncProcessing = useRef(false);

  const processSyncQueue = async () => {
    if (isSyncProcessing.current || !isOnline || syncQueue.current.length === 0) return;
    isSyncProcessing.current = true;
    setIsSyncing(true);
    while (syncQueue.current.length > 0 && isOnline) {
      const word = syncQueue.current.shift();
      const capitalizedWord = word ? capitalize(word) : null;
      if (capitalizedWord && !cardCache[capitalizedWord]) {
        try {
          const data = await fetchWordData(capitalizedWord, definitionStyle);
          handleCacheUpdate(capitalizedWord, data);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
          console.warn(`Background sync failed for ${capitalizedWord}`);
        }
      }
    }
    isSyncProcessing.current = false;
    setIsSyncing(false);
  };

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
        setSavedWords((cloudData.savedWords || []).map(capitalize));
        setFavoriteWords((cloudData.favoriteWords || []).map(capitalize));
        setTrashedWords((cloudData.trashedWords || []).map(capitalize));
        setSemanticClusters(cloudData.semanticClusters || []);
        if (cloudData.clusterSimilarity !== undefined) setClusterSimilarity(cloudData.clusterSimilarity);
        
        const srs: Record<string, SRSItem> = {};
        Object.entries(cloudData.srsData || {}).forEach(([k, v]) => { srs[capitalize(k)] = v as SRSItem; });
        setSrsData(srs);

        const cache: Record<string, CardData> = {};
        Object.entries(cloudData.cardCache || {}).forEach(([k, v]) => { cache[capitalize(k)] = v as CardData; });
        setCardCache(prev => ({ ...prev, ...cache }));
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
    localStorage.setItem('explorePackSize', String(explorePackSize));
    localStorage.setItem('definitionStyle', definitionStyle);
    localStorage.setItem('semanticClusters', JSON.stringify(semanticClusters));
    localStorage.setItem('clusterSimilarity', String(clusterSimilarity));

    if (user && isOnline) saveUserData(user.id, { savedWords, favoriteWords, trashedWords, srsData, cardCache, semanticClusters, clusterSimilarity });
  }, [savedWords, favoriteWords, trashedWords, srsData, cardCache, user, isOnline, visibilitySettings, explorePackSize, definitionStyle, semanticClusters, clusterSimilarity]);

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
      if (isExploreMode && explorePack.length > 0) {
          const nextIdx = exploreIndex + 1;
          if (nextIdx < explorePack.length) {
              setExploreIndex(nextIdx);
              setShouldStartFlipped(false);
              setCurrentTopic(capitalize(explorePack[nextIdx]));
          } else {
              handleToggleExplore(true);
          }
          return;
      }
      if (savedWords.length > 0) {
          const dueCached = getDueWords(savedWords, srsData);
          const nextWord = dueCached[0] || savedWords[Math.floor(Math.random() * savedWords.length)];
          setShouldStartFlipped(false);
          setCurrentTopic(capitalize(nextWord));
      } else {
          setCurrentTopic("__EMPTY_FALLBACK__");
      }
  };

  const handleNavigate = (word: string, initialFlipped: boolean = false) => {
      if (word === '__RANDOM__') {
          handleRandom();
      } else if (word === '__PREV__') {
          if (isExploreMode && exploreIndex > 0) {
            const prevIdx = exploreIndex - 1;
            setExploreIndex(prevIdx);
            setShouldStartFlipped(true);
            setCurrentTopic(capitalize(explorePack[prevIdx]));
          }
      } else if (word === '__GENERATE__') {
          handleToggleExplore(true);
      } else {
          setShouldStartFlipped(initialFlipped);
          setCurrentTopic(capitalize(word));
      }
      setActiveTab('home');
  };

  const handleToggleSave = (word: string) => {
      const capitalizedWord = capitalize(word);
      const exists = savedWords.some(w => w.toLowerCase() === capitalizedWord.toLowerCase());
      if (exists) {
          handleMoveToTrash([capitalizedWord]);
      } else {
          if (trashedWords.includes(capitalizedWord)) {
              handleRestoreFromTrash([capitalizedWord]);
          } else {
              setSavedWords(prev => [capitalizedWord, ...prev]);
              if (!srsData[capitalizedWord]) setSrsData(prev => ({ ...prev, [capitalizedWord]: initializeSRSItem(capitalizedWord) }));
          }
      }
  };

  const handleCacheUpdate = (word: string, data: CardData) => {
    if (!data.definition || data.definition.includes("pending download")) return;
    const capitalizedWord = capitalize(word);
    setCardCache(prev => ({ ...prev, [capitalizedWord]: { ...data, word: capitalizedWord } }));
    if (capitalizedWord !== "__EMPTY_FALLBACK__" && !savedWords.includes(capitalizedWord)) {
      setSavedWords(prev => [capitalizedWord, ...prev]);
      if (!srsData[capitalizedWord]) setSrsData(prev => ({ ...prev, [capitalizedWord]: initializeSRSItem(capitalizedWord) }));
    }
  };

  const handleToggleExplore = async (forceNext: boolean = false) => {
    if (isExploreMode && !forceNext) {
      setIsExploreMode(false);
      setExplorePack([]);
      setExploreIndex(-1);
      handleRandom();
    } else {
      if (!isOnline) {
        alert("Connect to the internet to use Explore mode.");
        return;
      }
      setIsExploring(true);
      try {
        const wordsToExclude = [...savedWords, ...explorePack];
        const pack = await fetchExplorePack('intermediate', explorePackSize, wordsToExclude);
        if (pack.length > 0) {
          const newPackWords = pack
            .map(p => capitalize(p.word!))
            .filter(w => w && !savedWords.includes(w) && !explorePack.includes(w));
          if (newPackWords.length === 0) {
              alert("Gemini couldn't find unique words that aren't already in your library.");
              setIsExploring(false);
              return;
          }
          const newCache = { ...cardCache };
          pack.forEach(p => { 
            if(p.word) {
              const capWord = capitalize(p.word);
              newCache[capWord] = { ...p, word: capWord }; 
            }
          });
          setCardCache(newCache);
          if (forceNext && isExploreMode) {
              const nextIdx = explorePack.length;
              setExplorePack(prev => [...prev, ...newPackWords]);
              setExploreIndex(nextIdx);
              setCurrentTopic(newPackWords[0]);
          } else {
              setExplorePack(newPackWords);
              setExploreIndex(0);
              setIsExploreMode(true);
              setCurrentTopic(newPackWords[0]);
          }
          setShouldStartFlipped(false);
          handleCacheUpdate(newPackWords[0], pack.find(p => capitalize(p.word!) === newPackWords[0]) || pack[0]);
        }
      } catch (e) {
        alert("Failed to fetch explore pack. Try again later.");
      } finally {
        setIsExploring(false);
      }
    }
  };

  const handleImportWords = (importedCache: Record<string, CardData>) => {
      const importedWordList = Object.keys(importedCache);
      const sanitizedCache: Record<string, CardData> = {};
      const newWords: string[] = [];
      const existingWordSet = new Set(savedWords.map(w => w.toLowerCase()));
      const trashedWordSet = new Set(trashedWords.map(w => w.toLowerCase()));
      importedWordList.forEach(word => {
          const capWord = capitalize(word);
          const lowerWord = word.toLowerCase();
          sanitizedCache[capWord] = { ...importedCache[word], word: capWord };
          if (!existingWordSet.has(lowerWord)) {
              newWords.push(capWord);
              if (trashedWordSet.has(lowerWord)) {
                  setTrashedWords(prev => prev.filter(w => w.toLowerCase() !== lowerWord));
              }
          }
      });
      setCardCache(prev => ({ ...prev, ...sanitizedCache }));
      if (newWords.length > 0) {
          setSavedWords(prev => [...newWords, ...prev]);
          setSrsData(prev => {
              const next = { ...prev };
              newWords.forEach(w => { if (!next[w]) next[w] = initializeSRSItem(w); });
              return next;
          });
      }
  };

  const handleUpdateWordData = (oldWord: string, newWord: string, newData: CardData) => {
    const capOld = capitalize(oldWord);
    const capNew = capitalize(newWord);
    const sanitizedData = { ...newData, word: capNew };
    if (capOld === capNew) {
      setCardCache(prev => ({ ...prev, [capNew]: sanitizedData }));
      return;
    }
    setCardCache(prev => {
      const next = { ...prev, [capNew]: sanitizedData };
      delete next[capOld];
      return next;
    });
    setSrsData(prev => {
      const next = { ...prev };
      if (next[capOld]) {
        next[capNew] = { ...next[capOld], word: capNew };
        delete next[capOld];
      }
      return next;
    });
    setSavedWords(prev => prev.map(w => capitalize(w) === capOld ? capNew : capitalize(w)));
    setFavoriteWords(prev => prev.map(w => capitalize(w) === capOld ? capNew : capitalize(w)));
    if (capitalize(currentTopic) === capOld) setCurrentTopic(capNew);
  };

  const handleMoveToTrash = (words: string[]) => {
      const capWords = words.map(capitalize);
      const wordSet = new Set(capWords.map(w => w.toLowerCase()));
      setSavedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setFavoriteWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setTrashedWords(prev => [...new Set([...capWords, ...prev])]);
      if (wordSet.has(currentTopic.toLowerCase())) handleRandom();
  };

  const handleRestoreFromTrash = (words: string[]) => {
      const capWords = words.map(capitalize);
      const wordSet = new Set(capWords.map(w => w.toLowerCase()));
      setTrashedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setSavedWords(prev => [...new Set([...capWords, ...prev])]);
  };

  const handlePermanentDelete = (words: string[]) => {
      const capWords = words.map(capitalize);
      const wordSet = new Set(capWords.map(w => w.toLowerCase()));
      setTrashedWords(prev => prev.filter(w => !wordSet.has(w.toLowerCase())));
      setSrsData(prev => {
          const next = { ...prev };
          capWords.forEach(w => delete next[w]);
          return next;
      });
  };

  const handleToggleFavorite = (word: string) => {
      const capWord = capitalize(word);
      const lowerWord = capWord.toLowerCase();
      const isFav = favoriteWords.some(w => w.toLowerCase() === lowerWord);
      if (isFav) {
          setFavoriteWords(prev => prev.filter(w => w.toLowerCase() !== lowerWord));
      } else {
          setFavoriteWords(prev => [capWord, ...prev]);
          if (!savedWords.includes(capWord)) setSavedWords(prev => [capWord, ...prev]);
          if (!srsData[capWord]) setSrsData(prev => ({ ...prev, [capWord]: initializeSRSItem(capWord) }));
          if (trashedWords.includes(capWord)) {
              setTrashedWords(prev => prev.filter(w => w.toLowerCase() !== lowerWord));
          }
      }
  };

  const handleSRSUpdate = (word: string, grade: 'know' | 'dont_know') => {
      const capWord = capitalize(word);
      const currentItem = srsData[capWord] || initializeSRSItem(capWord);
      const newItem = calculateSRS(currentItem, grade);
      setSrsData(prev => ({ ...prev, [capWord]: newItem }));
      if (!savedWords.includes(capWord)) setSavedWords(prev => [capWord, ...prev]);
      handleRandom();
  };

  const handleResetSRS = () => {
    setSrsData(prev => {
      const next: Record<string, SRSItem> = {};
      Object.keys(prev).forEach(word => { next[capitalize(word)] = initializeSRSItem(capitalize(word)); });
      return next;
    });
  };

  const cachedCount = savedWords.filter(w => cardCache[capitalize(w)]).length;

  return (
    <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-text">LexiFlow</div>
          {(isSyncing || isExploring) && <div className="sync-spinner"></div>}
        </div>
        <div className="header-actions">
            {!isOnline && <span className="offline-badge-pill">OFFLINE</span>}
            
            {activeTab === 'home' && (
               <button 
                className={`header-explore-btn ${isExploreMode ? 'active' : ''}`} 
                onClick={() => handleToggleExplore()}
               >
                 <svg className="sparkle-icon-colorful" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M3 5h4M21 17v4M19 19h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                 <span>Explore</span>
               </button>
            )}

            {activeTab === 'saved' && (
              <div className="header-dynamic-actions" style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn header-import-btn" onClick={() => setIsBulkImportOpen(true)} title="Import Words">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <button className={`icon-btn header-trash-btn ${trashedWords.length > 0 ? 'not-empty' : ''}`} onClick={() => setIsTrashOpen(true)} title="View Trash">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            )}

            <button className="icon-btn header-settings-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
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
      {isSettingsOpen && (
        <CardSettingsModal 
            visibility={visibilitySettings} 
            onUpdateVisibility={setVisibilitySettings}
            explorePackSize={explorePackSize}
            onUpdatePackSize={setExplorePackSize}
            definitionStyle={definitionStyle}
            onUpdateDefinitionStyle={setDefinitionStyle}
            onClose={() => setIsSettingsOpen(false)} 
        />
      )}
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
            <FlashcardView 
              topic={capitalize(currentTopic)} 
              initialFlipped={shouldStartFlipped} 
              savedWords={savedWords} 
              favoriteWords={favoriteWords} 
              srsData={srsData} 
              cardCache={cardCache} 
              onUpdateSRS={handleSRSUpdate} 
              onToggleSave={handleToggleSave} 
              onToggleFavorite={handleToggleFavorite} 
              onNavigate={handleNavigate} 
              onCacheUpdate={handleCacheUpdate} 
              onOpenImport={() => setIsBulkImportOpen(true)} 
              isOnline={isOnline} 
              visibilitySettings={visibilitySettings}
              isExploreMode={isExploreMode}
              exploreProgress={isExploreMode ? { current: exploreIndex + 1, total: explorePack.length } : undefined}
            />
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
                onUpdateWordData={handleUpdateWordData}
                semanticClusters={semanticClusters}
                setSemanticClusters={setSemanticClusters}
                clusterSimilarity={clusterSimilarity}
                setClusterSimilarity={setClusterSimilarity}
                isOnline={isOnline}
            />
        )}
        {activeTab === 'profile' && <ProfileView user={user} savedCount={savedWords.length} cachedCount={cachedCount} srsData={srsData} onSignOut={() => supabase.auth.signOut()} onLogin={() => {}} isOnline={isOnline} onResetSRS={handleResetSRS} />}
      </main>

      <div className="bottom-nav-container">
        <nav className="bottom-nav">
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
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .header-explore-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: 12px;
            background: var(--accent-secondary);
            color: var(--accent-primary);
            font-size: 0.75rem;
            font-weight: 800;
            border: 1.5px solid var(--border-color);
            transition: all 0.2s;
            margin-right: 4px;
        }
        .header-explore-btn.active {
            background: var(--accent-primary);
            color: white;
            border-color: var(--accent-primary);
            box-shadow: 0 4px 12px rgba(88, 86, 214, 0.2);
        }
        .sparkle-icon-colorful {
            color: #FFD700;
            filter: drop-shadow(0 0 2px rgba(255, 215, 0, 0.3));
        }
        .header-explore-btn.active .sparkle-icon-colorful {
            color: #FFF;
        }
        .icon-btn:hover, .header-explore-btn:hover {
          background: var(--border-color);
          border-color: var(--accent-primary);
        }
        .icon-btn:active, .header-explore-btn:active {
          transform: scale(0.92);
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
        .sync-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(88, 86, 214, 0.1);
          border-top: 2px solid var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
