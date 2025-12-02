
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { streamDefinition, getRandomWord, generateUsageExample } from '../services/geminiService';
import { Grade, getDueWords } from '../services/srsService';

interface FlashcardViewProps {
  onClose: () => void;
  savedWords: string[];
  srsData: Record<string, any>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onNavigate: (word: string) => void;
  onView: (word: string) => void;
}

type Mode = 'saved' | 'random';

// Helper component to render text as clickable buttons
const InteractiveText: React.FC<{ text: string; onNavigate: (word: string) => void }> = ({ text, onNavigate }) => {
  const words = text.split(/(\s+)/).filter(Boolean);
  return (
    <>
      {words.map((word, index) => {
        if (/\S/.test(word)) {
          const cleanWord = word.replace(/[.,!?;:()"']/g, '');
          if (cleanWord) {
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(cleanWord);
                }}
                className="interactive-word"
                aria-label={`Learn more about ${cleanWord}`}
              >
                {word}
              </button>
            );
          }
        }
        return <span key={index}>{word}</span>;
      })}
    </>
  );
};

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actionButton?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, isOpen, onToggle, children, actionButton }) => {
  return (
    <div className={`section collapsible-section ${isOpen ? 'open' : ''}`}>
      <div className="section-header" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`arrow ${isOpen ? 'down' : 'right'}`}>▶</span>
          <h4>{title}</h4>
        </div>
        {actionButton}
      </div>
      {isOpen && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  );
};

interface FlashcardData {
  definition: string;
  etymology: string;
  synonyms: string;
  antonyms: string;
  usage: string;
  mnemonic: string;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ onClose, savedWords, srsData, onUpdateSRS, onToggleSave, onNavigate, onView }) => {
  const [mode, setMode] = useState<Mode>('saved');
  const [currentWord, setCurrentWord] = useState<string>('');
  const [isFlipped, setIsFlipped] = useState(false);
  
  // History stack for "Previous" navigation
  const [history, setHistory] = useState<string[]>([]);

  // Persistent section states (preference preserved across cards)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    definition: true,
    etymology: false,
    synonyms: false,
    antonyms: false,
    usage: true,
    mnemonic: false
  });

  const [cardData, setCardData] = useState<FlashcardData>({
    definition: '',
    etymology: '',
    synonyms: '',
    antonyms: '',
    usage: '',
    mnemonic: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  
  // Refs for gesture handling and async cancellation
  const touchStartY = useRef<number | null>(null);
  const activeWordRef = useRef<string>('');
  const wasSwipeRef = useRef<boolean>(false);

  useEffect(() => {
    // Initialize queue based on mode
    setHistory([]); // Clear history on mode switch
    
    if (mode === 'saved') {
      const dueWords = getDueWords(savedWords, srsData);
      setQueue(dueWords);
      
      if (dueWords.length > 0) {
        loadWord(dueWords[0]);
      } else {
        setCurrentWord('');
        setCardData({} as FlashcardData);
      }
    } else if (mode === 'random') {
      loadRandomWord();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, savedWords]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const loadRandomWord = async () => {
    setIsLoading(true);
    try {
      const word = await getRandomWord();
      loadWord(word);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const loadWord = async (word: string) => {
    activeWordRef.current = word; // Track active request to prevent race conditions
    setCurrentWord(word);
    setIsFlipped(false);
    setIsLoading(true);
    setCardData({
      definition: '',
      etymology: '',
      synonyms: '',
      antonyms: '',
      usage: '',
      mnemonic: ''
    });
    
    // Add to app history
    onView(word);

    try {
      let fullText = '';
      for await (const chunk of streamDefinition(word)) {
        if (activeWordRef.current !== word) return; // Cancel if user switched words
        fullText += chunk;
      }
      
      if (activeWordRef.current === word) {
        parseContent(fullText);
      }
    } catch (e) {
      console.error(e);
      if (activeWordRef.current === word) {
        setCardData(prev => ({ ...prev, definition: 'Failed to load definition.' }));
      }
    } finally {
      if (activeWordRef.current === word) {
        setIsLoading(false);
      }
    }
  };

  const parseContent = (text: string) => {
    const sections: FlashcardData = {
      definition: '',
      etymology: '',
      synonyms: '',
      antonyms: '',
      usage: '',
      mnemonic: ''
    };

    const extract = (headerName: string) => {
      const regex = new RegExp(`(?:###\\s*${headerName}|${headerName})\\s*\\n([\\s\\S]*?)(?=(?:###\\s*|DEFINITION|ETYMOLOGY|SYNONYMS|ANTONYMS|USAGE|MNEMONIC)|$)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    sections.definition = extract('DEFINITION');
    sections.etymology = extract('ETYMOLOGY');
    sections.synonyms = extract('SYNONYMS');
    sections.antonyms = extract('ANTONYMS');
    sections.usage = extract('USAGE');
    sections.mnemonic = extract('MNEMONIC');

    if (!sections.definition && !sections.usage) {
       const defMatch = text.match(/DEFINITION\s*\n([\s\S]*?)(?=\n\n(?:ETYMOLOGY|SYNONYMS|ANTONYMS|USAGE|MNEMONIC)|$)/i);
       if (defMatch) sections.definition = defMatch[1].trim();
    }

    sections.usage = sections.usage.replace(/^"|"$/g, '').trim();
    setCardData(sections);
  };

  const handleNext = () => {
    if (currentWord) {
      setHistory(prev => [...prev, currentWord]);
    }

    if (mode === 'saved') {
      // In saved mode, we consume the queue
      const nextQueue = queue.length > 0 && queue[0] === currentWord ? queue.slice(1) : queue;
      
      if (nextQueue.length > 0) {
        setQueue(nextQueue);
        loadWord(nextQueue[0]);
      } else {
        setQueue([]);
        setCurrentWord(''); // Finished queue
      }
    } else {
      loadRandomWord();
    }
  };

  const handlePrevious = () => {
    if (history.length === 0) return;
    const previousWord = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);

    // If in saved mode, put the current word back into queue so it can be seen again if we go forward
    if (mode === 'saved' && currentWord) {
      setQueue(prev => [currentWord, ...prev]);
    }
    
    loadWord(previousWord);
  };

  // Handles clicking a word inside the flashcard (definition, synonyms, etc.)
  // This keeps navigation inside the flashcard view instead of exiting to the main app.
  const handleInternalNavigate = (word: string) => {
    if (currentWord) {
      setHistory(prev => [...prev, currentWord]);
    }
    loadWord(word);
  };

  const handleGrade = (grade: Grade) => {
    if (currentWord) {
      onUpdateSRS(currentWord, grade);
    }
    handleNext();
  };

  const refreshUsage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWord) return;
    const oldUsage = cardData.usage;
    setCardData(prev => ({ ...prev, usage: 'Generating new example...' }));
    const newSentence = await generateUsageExample(currentWord);
    setCardData(prev => ({ ...prev, usage: newSentence || oldUsage }));
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    wasSwipeRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;

    // Threshold for swipe
    if (Math.abs(deltaY) > 50) { 
      // ONLY perform swipe actions if the card is NOT flipped (revealed)
      if (!isFlipped) {
        wasSwipeRef.current = true;
        if (deltaY > 0) {
          handleNext(); // Swipe UP -> Next
        } else {
          handlePrevious(); // Swipe DOWN -> Previous
        }
      }
    }
    touchStartY.current = null;
  };

  const handleCardClick = () => {
    // If a swipe just happened, don't interpret it as a click/flip
    if (wasSwipeRef.current) {
      wasSwipeRef.current = false;
      return;
    }
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const isSaved = savedWords.some(w => w.toLowerCase() === currentWord.toLowerCase());

  if (!currentWord && !isLoading && mode === 'saved') {
    return (
      <div className="flashcard-overlay">
        <div className="flashcard-container empty">
          <div className="flashcard-header">
            <button onClick={onClose} className="close-button">Close</button>
          </div>
          <h2>All caught up!</h2>
          <p>You have mastered all due words for now.</p>
          <p className="card-instruction">Review later to increase mastery.</p>
          <button onClick={() => setMode('random')} className="mode-toggle-btn">
            Practice Random Words
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-overlay" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flashcard-container">
        <div className="flashcard-header">
          <div className="mode-toggle">
            <button 
              className={mode === 'saved' ? 'active' : ''} 
              onClick={() => setMode('saved')}
            >Saved</button>
            <button 
              className={mode === 'random' ? 'active' : ''} 
              onClick={() => setMode('random')}
            >Random</button>
          </div>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className={`card ${isFlipped ? 'flipped' : ''}`} onClick={handleCardClick}>
          <div className="card-inner">
            {/* Front */}
            <div className="card-front">
               {isLoading ? (
                 <div className="loading-spinner">Loading...</div>
               ) : (
                 <>
                   <h1 className="card-word">{currentWord}</h1>
                   <p className="card-instruction">Tap to reveal</p>
                 </>
               )}
            </div>

            {/* Back */}
            <div className="card-back">
              <div className="card-content" style={{ width: '100%' }}>
                <div className="card-header-back">
                  <h2 
                    className="card-word-small interactive-word" 
                    onClick={(e) => { e.stopPropagation(); handleInternalNavigate(currentWord); }}
                    style={{ cursor: 'pointer', marginRight: 'auto' }}
                  >
                    {currentWord}
                  </h2>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleSave(currentWord); }}
                    className={`save-icon-btn ${isSaved ? 'saved' : ''}`}
                    title={isSaved ? "Remove from saved" : "Save word"}
                  >
                    {isSaved ? '★' : '☆'}
                  </button>
                </div>
                
                {/* Collapsible Sections */}
                
                {cardData.definition && (
                  <CollapsibleSection 
                    title="Definition" 
                    isOpen={expandedSections.definition} 
                    onToggle={() => toggleSection('definition')}
                  >
                    <p><InteractiveText text={cardData.definition} onNavigate={handleInternalNavigate} /></p>
                  </CollapsibleSection>
                )}

                {cardData.etymology && (
                  <CollapsibleSection 
                    title="Etymology" 
                    isOpen={expandedSections.etymology} 
                    onToggle={() => toggleSection('etymology')}
                  >
                     <p><InteractiveText text={cardData.etymology} onNavigate={handleInternalNavigate} /></p>
                  </CollapsibleSection>
                )}

                {cardData.synonyms && (
                  <CollapsibleSection 
                    title="Synonyms" 
                    isOpen={expandedSections.synonyms} 
                    onToggle={() => toggleSection('synonyms')}
                  >
                     <p><InteractiveText text={cardData.synonyms} onNavigate={handleInternalNavigate} /></p>
                  </CollapsibleSection>
                )}

                {cardData.antonyms && cardData.antonyms !== "N/A" && (
                  <CollapsibleSection 
                    title="Antonyms" 
                    isOpen={expandedSections.antonyms} 
                    onToggle={() => toggleSection('antonyms')}
                  >
                     <p><InteractiveText text={cardData.antonyms} onNavigate={handleInternalNavigate} /></p>
                  </CollapsibleSection>
                )}

                {cardData.usage && (
                  <CollapsibleSection 
                    title="Usage" 
                    isOpen={expandedSections.usage} 
                    onToggle={() => toggleSection('usage')}
                    actionButton={
                      <button className="refresh-icon" onClick={refreshUsage} title="Get another example">
                        ↻
                      </button>
                    }
                  >
                     <p>"<InteractiveText text={cardData.usage} onNavigate={handleInternalNavigate} />"</p>
                  </CollapsibleSection>
                )}

                {cardData.mnemonic && (
                  <CollapsibleSection 
                    title="Mnemonic" 
                    isOpen={expandedSections.mnemonic} 
                    onToggle={() => toggleSection('mnemonic')}
                  >
                     <p><InteractiveText text={cardData.mnemonic} onNavigate={handleInternalNavigate} /></p>
                  </CollapsibleSection>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Controls Area */}
        <div className="flashcard-controls">
          {!isFlipped ? (
             <button className="reveal-btn" onClick={() => setIsFlipped(true)} disabled={isLoading}>
               Reveal
             </button>
          ) : (
             mode === 'saved' ? (
               <div className="srs-buttons simple">
                 <button className="srs-btn dont-know" onClick={() => handleGrade('dont_know')}>Don't Know</button>
                 <button className="srs-btn know" onClick={() => handleGrade('know')}>Know</button>
               </div>
             ) : (
               <button className="next-btn" onClick={handleNext}>Next Word</button>
             )
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardView;
