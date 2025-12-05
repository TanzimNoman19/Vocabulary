/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { streamDefinition, generateAsciiArt, AsciiArtData, getRandomWord } from './services/geminiService';
import { SRSItem, Grade, calculateSRS, initializeSRSItem } from './services/srsService';
import { supabase, saveUserData, getUserData } from './services/supabaseClient';
import ContentDisplay from './components/ContentDisplay';
import SearchBar from './components/SearchBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import AsciiArtDisplay from './components/AsciiArtDisplay';
import SavedWordsList from './components/SavedWordsList';
import ChatInterface from './components/ChatInterface';
import FlashcardView from './components/FlashcardView';
import AuthModal from './components/AuthModal';
import StoryView, { StoryState } from './components/StoryView';

// Curated sophisticated words for the random button fallback
const SOPHISTICATED_WORDS = [
  'Ephemeral', 'Serendipity', 'Obfuscate', 'Cacophony', 'Mellifluous', 'Labyrinthine', 'Quixotic', 'Ineffable', 'Petrichor', 'Sonder', 'Vellichor', 'Opia', 'Eccedentesiast', 'Phosphenes', 'Defenestration', 'Sycophant', 'Ubiquitous', 'Machiavellian', 'Narcissist', 'Stoic', 'Altruism', 'Pragmatic', 'Esoteric', 'Nefarious', 'Pernicious', 'Alacrity', 'Proclivity', 'Propensity', 'Penchant', 'Predilection', 'Anachronism', 'Iconoclast', 'Demagogue', 'Epiphany', 'Euphemism', 'Hyperbole', 'Metaphor', 'Oxymoron', 'Paradox', 'Rhetoric', 'Satire', 'Syntax', 'Vernacular', 'Zephyr', 'Zenith', 'Nadir', 'Apex', 'Apogee', 'Perigee'
];

const STORY_TOPIC = '___STORY___';

/**
 * Creates a simple ASCII art bounding box as a fallback.
 * @param topic The text to display inside the box.
 * @returns An AsciiArtData object with the generated art.
 */
const createFallbackArt = (topic: string): AsciiArtData => {
  const displayableTopic = topic.length > 20 ? topic.substring(0, 17) + '...' : topic;
  const paddedTopic = ` ${displayableTopic} `;
  const topBorder = `┌${'─'.repeat(paddedTopic.length)}┐`;
  const middle = `│${paddedTopic}│`;
  const bottomBorder = `└${'─'.repeat(paddedTopic.length)}┘`;
  return {
    art: `${topBorder}\n${middle}\n${bottomBorder}`
  };
};

const App: React.FC = () => {
  // Navigation State
  // History stack initialized with '' (Home)
  const [history, setHistory] = useState<string[]>(['']);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  // Derived state
  const currentTopic = history[currentIndex];

  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [asciiArt, setAsciiArt] = useState<AsciiArtData | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
  });

  // Saved Words State
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedWords');
    return saved ? JSON.parse(saved) : [];
  });

  // View History State (All words opened)
  const [viewHistory, setViewHistory] = useState<string[]>(() => {
    const viewed = localStorage.getItem('viewHistory');
    return viewed ? JSON.parse(viewed) : [];
  });
  
  // SRS Data State
  const [srsData, setSrsData] = useState<Record<string, SRSItem>>(() => {
    const data = localStorage.getItem('srsData');
    return data ? JSON.parse(data) : {};
  });

  // Story Mode Persistent State
  const [storyState, setStoryState] = useState<StoryState>({
    prompt: '',
    hasStarted: false,
    segments: [],
    currentIndex: 0
  });

  const updateStoryState = (newState: Partial<StoryState>) => {
    setStoryState(prev => ({ ...prev, ...newState }));
  };

  // Refs to hold current state for async auth callbacks to avoid stale closures
  const savedWordsRef = useRef(savedWords);
  const srsDataRef = useRef(srsData);
  const viewHistoryRef = useRef(viewHistory);

  // Update refs on every render
  savedWordsRef.current = savedWords;
  srsDataRef.current = srsData;
  viewHistoryRef.current = viewHistory;

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const syncTimeoutRef = useRef<number | null>(null);

  const [isSavedListOpen, setIsSavedListOpen] = useState<boolean>(false);
  const [listMode, setListMode] = useState<'saved' | 'history'>('saved');

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isFlashcardsOpen, setIsFlashcardsOpen] = useState<boolean>(false);

  // Derive Display Name (Username > Email)
  const userDisplayName = useMemo(() => {
    if (!user) return null;
    return user.user_metadata?.username || user.email;
  }, [user]);

  // Fetch Data on Login
  const loadDataFromSupabase = async (userId: string) => {
    setIsLoading(true);
    const cloudData = await getUserData(userId);
    
    if (cloudData) {
      // User has data in cloud, overwrite local state
      if (cloudData.savedWords) setSavedWords(cloudData.savedWords);
      if (cloudData.srsData) setSrsData(cloudData.srsData);
      if (cloudData.viewHistory) setViewHistory(cloudData.viewHistory);
    } else {
      // User is new or has no data.
      // Explicitly RESET local state to start fresh, as per user request.
      // Do not sync guest data.
      setSavedWords([]);
      setSrsData({});
      setViewHistory([]);
      
      // Save this empty state to initialize the cloud row
      saveToSupabase(userId, { 
          savedWords: [], 
          srsData: {}, 
          viewHistory: [] 
      });
    }
    setIsLoading(false);
  };

  const resetLocalState = () => {
      setUser(null);
      setSavedWords([]);
      setSrsData({});
      setViewHistory([]);
      setHistory(['']); // Reset navigation history
      setCurrentIndex(0);
      
      localStorage.removeItem('savedWords');
      localStorage.removeItem('srsData');
      localStorage.removeItem('viewHistory');
      localStorage.removeItem('sb-oiegbafyoddklymbiuza-auth-token'); // Clear Supabase specific token if needed
  };

  // Auth Session Init
  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
         console.warn("Session Init Error (likely invalid token):", error.message);
         // If token is invalid (Refresh Token Not Found), clear local storage to fix the loop
         resetLocalState();
         return;
      }
      
      setUser(session?.user ?? null);
      if (session?.user) {
        loadDataFromSupabase(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
         resetLocalState();
      } else if (session?.user && event === 'SIGNED_IN') {
         setUser(session.user);
         loadDataFromSupabase(session.user.id);
      } else if (session?.user) {
         setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync Data to Supabase (Debounced)
  const saveToSupabase = (userId: string, data: any) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      saveUserData(userId, data);
    }, 2000); // 2 second debounce
  };

  // Local Persistence & Cloud Sync effects
  useEffect(() => {
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
    if (user) saveToSupabase(user.id, { savedWords, srsData, viewHistory });
  }, [savedWords, user]);
  
  useEffect(() => {
    localStorage.setItem('srsData', JSON.stringify(srsData));
    if (user) saveToSupabase(user.id, { savedWords, srsData, viewHistory });
  }, [srsData, user]);

  useEffect(() => {
    localStorage.setItem('viewHistory', JSON.stringify(viewHistory));
    if (user) saveToSupabase(user.id, { savedWords, srsData, viewHistory });
  }, [viewHistory, user]);

  // Theme effect
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    resetLocalState();
    setIsAuthOpen(false);
  };

  const addToViewHistory = useCallback((word: string) => {
    if (!word || word === STORY_TOPIC) return;
    setViewHistory(prev => {
      // Remove word if it exists, then add to top
      const filtered = prev.filter(w => w.toLowerCase() !== word.toLowerCase());
      return [word, ...filtered];
    });
  }, []);
  
  const removeFromHistory = useCallback((word: string) => {
    setViewHistory(prev => prev.filter(w => w !== word));
  }, []);

  const restoreToHistory = useCallback((word: string) => {
    // Restore to top of history
    setViewHistory(prev => [word, ...prev]);
  }, []);

  // Navigation Handlers
  const navigateTo = useCallback((topic: string) => {
    const newTopic = topic.trim();
    // If the new topic is the same as the current one, do nothing (unless it's empty/home reset)
    if (newTopic.toLowerCase() === currentTopic.toLowerCase() && newTopic !== '') {
        return;
    }
    
    if (newTopic !== '' && newTopic !== STORY_TOPIC) {
        addToViewHistory(newTopic);
    }

    setHistory(prev => {
        // Truncate forward history if we are in the middle of the stack
        const newHistory = prev.slice(0, currentIndex + 1);
        return [...newHistory, newTopic];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, currentTopic, addToViewHistory]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleForward = useCallback(() => {
    if (currentIndex < history.length - 1) {
        setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, history.length]);

  const handleHome = useCallback(() => {
    navigateTo('');
  }, [navigateTo]);

  useEffect(() => {
    if (!currentTopic || currentTopic === STORY_TOPIC) {
        setContent('');
        setAsciiArt(null);
        return;
    }

    let isCancelled = false;

    const fetchContentAndArt = async () => {
      // Set initial state for a clean page load
      setIsLoading(true);
      setError(null);
      setContent(''); // Clear previous content immediately
      setAsciiArt(null);
      setGenerationTime(null);
      const startTime = performance.now();

      // Kick off ASCII art generation, but don't wait for it.
      generateAsciiArt(currentTopic)
        .then(art => {
          if (!isCancelled) {
            setAsciiArt(art);
          }
        })
        .catch(err => {
          if (!isCancelled) {
            // Check for rate limit errors and suppress them
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                console.warn("ASCII Art generation skipped due to rate limit.");
            } else {
                console.warn("Failed to generate ASCII art (fallback used):", err);
            }
            const fallbackArt = createFallbackArt(currentTopic);
            setAsciiArt(fallbackArt);
          }
        });

      let accumulatedContent = '';
      try {
        for await (const chunk of streamDefinition(currentTopic)) {
          if (isCancelled) break;
          
          if (chunk.startsWith('Error:')) {
            throw new Error(chunk);
          }
          accumulatedContent += chunk;
          if (!isCancelled) {
            setContent(accumulatedContent);
          }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
          setError(errorMessage);
          setContent('');
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          const endTime = performance.now();
          setGenerationTime(endTime - startTime);
          setIsLoading(false);
        }
      }
    };

    fetchContentAndArt();
    
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTopic]);

  const handleSearch = useCallback((topic: string) => {
    navigateTo(topic);
  }, [navigateTo]);

  const handleRandom = useCallback(async () => {
    if (isLoading) return;

    // Use AI generation for true randomness (consistent with Flashcards)
    // Fallback to local list if needed
    try {
        // We set a temporary loading state by calling getRandomWord first
        // Note: We don't want to set global isLoading to true immediately because 
        // that triggers the skeleton on the home page which might look glitchy if it fails fast.
        // But navigateTo will trigger the real loading state.
        
        const randomWord = await getRandomWord();
        navigateTo(randomWord);
    } catch (error) {
        console.error("AI Random failed, using local backup", error);
        const randomIndex = Math.floor(Math.random() * SOPHISTICATED_WORDS.length);
        const randomWord = SOPHISTICATED_WORDS[randomIndex];
        navigateTo(randomWord);
    }
  }, [navigateTo, isLoading]);

  // Generic toggle save function
  const handleToggleSave = useCallback((word: string) => {
    const normalizedTopic = word.toLowerCase();
    const exists = savedWords.some(w => w.toLowerCase() === normalizedTopic);

    if (exists) {
      setSavedWords(prev => prev.filter(w => w.toLowerCase() !== normalizedTopic));
      // Remove SRS data
      setSrsData(prevSRS => {
        const newData = { ...prevSRS };
        Object.keys(newData).forEach(key => {
          if (key.toLowerCase() === normalizedTopic) {
            delete newData[key];
          }
        });
        return newData;
      });
    } else {
      setSavedWords(prev => [word, ...prev]);
      // Initialize SRS data
      setSrsData(prevSRS => ({
        ...prevSRS,
        [word]: initializeSRSItem(word)
      }));
    }
  }, [savedWords]);

  const toggleSaveCurrentWord = useCallback(() => {
    if (currentTopic && currentTopic !== STORY_TOPIC) handleToggleSave(currentTopic);
  }, [currentTopic, handleToggleSave]);

  const removeSavedWord = useCallback((wordToRemove: string) => {
    setSavedWords(prev => prev.filter(w => w !== wordToRemove));
    setSrsData(prev => {
      const newData = { ...prev };
      delete newData[wordToRemove];
      return newData;
    });
  }, []);

  const handleEditWord = useCallback((oldWord: string, newWord: string) => {
    if (oldWord === newWord) return;
    if (savedWords.some(w => w.toLowerCase() === newWord.toLowerCase())) {
        alert('Word already exists in your list.');
        return;
    }

    setSavedWords(prev => prev.map(w => w === oldWord ? newWord : w));
    setSrsData(prev => {
        const newData = { ...prev };
        if (newData[oldWord]) {
            newData[newWord] = { ...newData[oldWord], word: newWord };
            delete newData[oldWord];
        } else {
            newData[newWord] = initializeSRSItem(newWord);
        }
        return newData;
    });
  }, [savedWords]);

  const handleRestoreWord = useCallback((word: string, srsItem: SRSItem) => {
    setSavedWords(prev => {
        if (prev.includes(word)) return prev;
        return [word, ...prev];
    });
    setSrsData(prev => ({
        ...prev,
        [word]: srsItem
    }));
  }, []);
  
  const handleImportData = useCallback((data: { savedWords: string[], srsData: Record<string, SRSItem> }) => {
    setSavedWords(prev => {
      const existingLower = new Set(prev.map(w => w.toLowerCase()));
      const newUnique = data.savedWords.filter(w => !existingLower.has(w.toLowerCase()));
      return [...newUnique, ...prev];
    });

    setSrsData(prevSRS => {
      const newData = { ...prevSRS };
      data.savedWords.forEach(word => {
        if (data.srsData && data.srsData[word]) {
          newData[word] = data.srsData[word];
        } else if (!newData[word]) {
          newData[word] = initializeSRSItem(word);
        }
      });
      return newData;
    });
  }, []);

  const handleUpdateSRS = useCallback((word: string, grade: Grade) => {
    setSrsData(prev => {
      const item = prev[word] || initializeSRSItem(word);
      return {
        ...prev,
        [word]: calculateSRS(item, grade)
      };
    });
  }, []);

  const openList = (mode: 'saved' | 'history') => {
    setListMode(mode);
    setIsSavedListOpen(true);
  };

  const isCurrentWordSaved = savedWords.some(w => w.toLowerCase() === currentTopic.toLowerCase());
  
  const isHomeView = !currentTopic;
  const isStoryView = currentTopic === STORY_TOPIC;
  const isContentView = currentTopic && currentTopic !== STORY_TOPIC;

  return (
    <div>
      <SearchBar 
        onSearch={handleSearch} 
        isLoading={isLoading}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={handleBack}
        onForward={handleForward}
        onHome={handleHome}
        canBack={currentIndex > 0}
        canForward={currentIndex < history.length - 1}
        isAtHome={!currentTopic}
        savedWords={savedWords}
        onOpenAuth={() => setIsAuthOpen(true)}
        userDisplayName={userDisplayName}
      />

      {isAuthOpen && (
        <AuthModal 
          onClose={() => setIsAuthOpen(false)} 
          userDisplayName={userDisplayName}
          userEmail={user?.email}
          onSignOut={handleSignOut}
        />
      )}

      {isSavedListOpen && (
        <SavedWordsList 
          mode={listMode}
          words={listMode === 'saved' ? savedWords : viewHistory}
          savedWordsList={savedWords} // Pass saved list to check status in history mode
          srsData={srsData}
          onSelect={(word) => navigateTo(word)} 
          onRemove={listMode === 'saved' ? removeSavedWord : removeFromHistory} 
          onEdit={handleEditWord}
          onRestore={listMode === 'saved' ? handleRestoreWord : (word) => restoreToHistory(word)}
          onToggleSave={handleToggleSave}
          onClose={() => setIsSavedListOpen(false)}
          onImport={handleImportData}
        />
      )}

      {isChatOpen && (
        <ChatInterface 
          onClose={() => setIsChatOpen(false)}
          onNavigate={(word) => {
            navigateTo(word);
          }}
          savedWords={savedWords}
          setSavedWords={setSavedWords}
        />
      )}

      {isFlashcardsOpen && (
        <FlashcardView 
          onClose={() => setIsFlashcardsOpen(false)}
          savedWords={savedWords}
          srsData={srsData}
          onUpdateSRS={handleUpdateSRS}
          onToggleSave={handleToggleSave}
          onNavigate={(word) => {
            navigateTo(word);
            setIsFlashcardsOpen(false);
          }}
          onView={addToViewHistory}
        />
      )}

      {/* RENDER VIEW BASED ON TOPIC */}

      {isStoryView && (
        <StoryView 
            onClose={() => navigateTo('')} // Exit to Home
            onNavigate={(word) => navigateTo(word)}
            state={storyState}
            onUpdateState={updateStoryState}
        />
      )}

      {isHomeView && (
        /* Home View */
        <div className="home-view">
            <h1 className="app-title-large">INFINITE VOCABULARY</h1>
            <div className="home-buttons">
                <button className="home-btn" onClick={() => navigateTo(STORY_TOPIC)}>
                    Story Mode
                </button>
                <button className="home-btn" onClick={handleRandom} disabled={isLoading}>
                    Random Word
                </button>
                <button className="home-btn" onClick={() => setIsFlashcardsOpen(true)}>
                    Flashcards
                </button>
                <button className="home-btn" onClick={() => openList('saved')}>
                    Saved ({savedWords.length})
                </button>
                <button className="home-btn" onClick={() => openList('history')}>
                    History
                </button>
            </div>
        </div>
      )}

      {isContentView && (
        /* Content View */
        <>
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 
                style={{ letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}
                onClick={() => navigateTo('')}
                title="Back to Home"
            >
              INFINITE VOCABULARY
            </h1>
            <AsciiArtDisplay artData={asciiArt} topic={currentTopic} />
          </header>
          
          <main>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                <h2 style={{ margin: 0, textTransform: 'capitalize' }}>
                  {currentTopic}
                </h2>
                <button 
                  onClick={toggleSaveCurrentWord}
                  className={`save-star-btn ${isCurrentWordSaved ? 'saved' : ''}`}
                  aria-label={isCurrentWordSaved ? 'Remove from saved words' : 'Save word'}
                  disabled={isLoading}
                  title={isCurrentWordSaved ? 'Remove from saved words' : 'Save word'}
                >
                  {isCurrentWordSaved ? '★' : '☆'}
                </button>
              </div>

              {error && (
                <div style={{ border: '1px solid var(--warning-color)', padding: '1rem', color: 'var(--warning-color)' }}>
                  <p style={{ margin: 0 }}>An Error Occurred</p>
                  <p style={{ marginTop: '0.5rem', margin: 0 }}>{error}</p>
                </div>
              )}
              
              {isLoading && content.length === 0 && !error && (
                <LoadingSkeleton />
              )}

              {content.length > 0 && !error && (
                <ContentDisplay 
                  content={content} 
                  isLoading={isLoading} 
                  onWordClick={(word) => navigateTo(word)} 
                />
              )}

              {!isLoading && !error && content.length === 0 && (
                <div style={{ color: 'var(--text-color-muted)', padding: '2rem 0' }}>
                  <p>Content could not be generated.</p>
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {/* Floating AI Assistant Button (Hidden in Story and Flashcards mode) */}
      {!isStoryView && !isFlashcardsOpen && (
        <button 
          className="ai-fab" 
          onClick={() => setIsChatOpen(true)}
          aria-label="AI Assistant"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      )}

    </div>
  );
};

export default App;