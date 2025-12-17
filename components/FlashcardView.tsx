/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { streamDefinition, generateUsageExample, getRandomWord, CardData, parseFlashcardResponse } from '../services/geminiService';
import { Grade } from '../services/srsService';

interface FlashcardViewProps {
  topic: string;
  savedWords: string[];
  srsData: Record<string, any>;
  cardCache: Record<string, CardData>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onNavigate: (word: string) => void;
  onCacheUpdate: (word: string, data: CardData) => void;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
    topic, savedWords, srsData, cardCache, onUpdateSRS, onToggleSave, onNavigate, onCacheUpdate
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [data, setData] = useState<CardData>({
    pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const activeTopic = useRef(topic);

  useEffect(() => {
    if (topic) loadTopic(topic);
  }, [topic]);

  const loadTopic = async (word: string, forceRefresh = false) => {
    activeTopic.current = word;
    setIsFlipped(false);

    // Check Cache First
    if (!forceRefresh && cardCache[word]) {
        setData(cardCache[word]);
        setIsLoading(false);
        return;
    }

    // If not in cache or forced refresh, load from API
    setIsLoading(true);
    setData({ pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: '' });
    
    try {
      let fullText = '';
      for await (const chunk of streamDefinition(word)) {
        if (activeTopic.current !== word) return;
        fullText += chunk;
      }
      if (activeTopic.current === word) {
        const parsed = parseFlashcardResponse(fullText);
        setData(parsed);
        setIsLoading(false);
        // Save to cache
        onCacheUpdate(word, parsed);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    loadTopic(topic, true);
  };

  const handleRefreshContext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newContext = await generateUsageExample(topic);
    setData(prev => ({ ...prev, context: newContext }));
  };
  
  const handleSkip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const nextWord = await getRandomWord();
        onNavigate(nextWord);
    } catch (e) {
        onNavigate('Serendipity');
    }
  };

  const handleKnow = async (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateSRS(topic, 'know');
  };

  const isSaved = savedWords.includes(topic);
  const srsItem = srsData[topic];
  const isLearning = srsItem && srsItem.masteryLevel > 0;
  const badgeText = isLearning ? 'LEARNING' : 'NEW';

  // Speak function
  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(topic);
    window.speechSynthesis.speak(utterance);
  };

  // Process synonyms and antonyms into arrays
  const synonymsList = data.synonyms && data.synonyms !== 'N/A' 
    ? data.synonyms.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a') 
    : [];
  
  const antonymsList = data.antonyms && data.antonyms !== 'N/A' 
    ? data.antonyms.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a') 
    : [];

  return (
    <div className="flashcard-container">
      <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => !isFlipped && setIsFlipped(true)}>
        
        {/* Front Face */}
        <div className="card-face card-front">
           <button 
             className={`like-btn ${isSaved ? 'liked' : ''}`} 
             onClick={(e) => { e.stopPropagation(); onToggleSave(topic); }}
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
           </button>

           <div className="word-display">{topic}</div>
           <div className="pos-tag">{data.pos || '...'}</div>
           
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className="status-badge">{badgeText}</div>
                {data.difficulty && (
                    <div className="status-badge" style={{ 
                        background: 'transparent', 
                        color: 'var(--text-secondary)', 
                        border: '1px solid var(--border-color)',
                        boxShadow: 'none' 
                    }}>
                        {data.difficulty}
                    </div>
                )}
           </div>
           
           <div className="tap-hint">Tap to flip</div>
        </div>

        {/* Back Face - Structured with Fixed Header/Footer */}
        <div className="card-face card-back">
           
           {/* Fixed Header: Word, IPA, Save */}
           <div className="card-back-header">
             <div style={{ display: 'flex', alignItems: 'center' }}>
               <h2 className="word-small">{topic}</h2>
               <button onClick={speak} style={{ marginLeft: '10px', opacity: 0.7, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  🔊
               </button>
               {/* Refresh Button */}
               <button className="refresh-icon-btn" onClick={handleRefresh} title="Regenerate Definition">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
               </button>
             </div>
             <button 
                className={`like-btn ${isSaved ? 'liked' : ''}`} 
                onClick={(e) => { e.stopPropagation(); onToggleSave(topic); }}
                style={{ position: 'relative', top: 0, right: 0 }}
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </button>
           </div>

           {/* Scrollable Content: Definitions, Context */}
           <div className="card-back-scrollable">
                <div className="section-label">DEFINITION</div>
                <div className="def-text">
                    {data.definition || <span className="loading-dots">Loading</span>}
                    {data.bengali && <span className="bengali-def">[{data.bengali}]</span>}
                </div>

                {data.family && data.family !== 'N/A' && (
                    <>
                        <div className="section-label">WORD FAMILY</div>
                        <div className="def-sub">{data.family}</div>
                    </>
                )}

                <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    CONTEXT 
                    <button onClick={handleRefreshContext} style={{ color: 'var(--accent-primary)' }}>↻</button>
                </div>
                <div className="context-box">
                    "{data.context || '...'}"
                </div>

                {/* Synonyms & Antonyms Section */}
                {(synonymsList.length > 0 || antonymsList.length > 0) && (
                    <div className="synonyms-antonyms-container">
                        {synonymsList.length > 0 && (
                            <div className="sa-column">
                                <div className="section-label">SYNONYMS</div>
                                <div className="chip-container">
                                    {synonymsList.map((word, i) => (
                                        <span key={i} className="chip" onClick={(e) => { e.stopPropagation(); onNavigate(word); }}>{word}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {antonymsList.length > 0 && (
                            <div className="sa-column">
                                <div className="section-label">ANTONYMS</div>
                                <div className="chip-container">
                                    {antonymsList.map((word, i) => (
                                        <span key={i} className="chip" onClick={(e) => { e.stopPropagation(); onNavigate(word); }}>{word}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
           </div>

           {/* Fixed Footer: Only Review Again button remaining inside card back */}
           <div className="card-back-footer">
               <div className="srs-actions">
                  <button className="action-btn btn-again" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'dont_know'); }}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                     Review Again
                  </button>
               </div>
           </div>

        </div>
      </div>
      
      {/* External Action Buttons (Always Visible) */}
      <div className="external-actions">
          <button className="skip-action-btn know-btn" onClick={handleKnow}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>I Know</span>
          </button>
          
          <button className="skip-action-btn next-btn" onClick={handleSkip}>
            <span>Next Word</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
      </div>

    </div>
  );
};

export default FlashcardView;