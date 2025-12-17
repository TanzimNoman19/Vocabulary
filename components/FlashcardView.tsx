/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { streamDefinition, generateUsageExample } from '../services/geminiService';
import { Grade } from '../services/srsService';

interface FlashcardViewProps {
  topic: string;
  savedWords: string[];
  srsData: Record<string, any>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onNavigate: (word: string) => void;
}

interface CardData {
  pos: string;
  ipa: string;
  definition: string;
  bengali: string;
  family: string;
  context: string;
  synonyms: string;
  antonyms: string;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
    topic, savedWords, srsData, onUpdateSRS, onToggleSave, onNavigate 
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [data, setData] = useState<CardData>({
    pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const activeTopic = useRef(topic);

  useEffect(() => {
    if (topic) loadTopic(topic);
  }, [topic]);

  const loadTopic = async (word: string) => {
    activeTopic.current = word;
    setIsFlipped(false);
    setIsLoading(true);
    setData({ pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '' });
    
    try {
      let fullText = '';
      for await (const chunk of streamDefinition(word)) {
        if (activeTopic.current !== word) return;
        fullText += chunk;
      }
      if (activeTopic.current === word) {
        parseData(fullText);
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const parseData = (text: string) => {
    const extract = (key: string) => {
      const regex = new RegExp(`${key}:\\s*(.*?)(?=\\n[A-Z]+:|$)`, 's');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    setData({
      pos: extract('POS'),
      ipa: extract('IPA'),
      definition: extract('DEFINITION'),
      bengali: extract('BENGALI'),
      family: extract('WORD FAMILY'),
      context: extract('CONTEXT'),
      synonyms: extract('SYNONYMS'),
      antonyms: extract('ANTONYMS')
    });
  };

  const handleRefreshContext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newContext = await generateUsageExample(topic);
    setData(prev => ({ ...prev, context: newContext }));
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
           <div className="status-badge">{badgeText}</div>
           
           <div className="tap-hint">Tap to flip</div>
        </div>

        {/* Back Face */}
        <div className="card-face card-back">
           <div className="back-header">
             <div>
               <h2 className="word-small">{topic}</h2>
               <div className="ipa-text">
                  {data.ipa} 
                  <button onClick={speak} style={{ marginLeft: '8px', verticalAlign: 'middle', opacity: 0.7 }}>
                     🔊
                  </button>
               </div>
             </div>
             <button 
                className={`like-btn ${isSaved ? 'liked' : ''}`} 
                onClick={(e) => { e.stopPropagation(); onToggleSave(topic); }}
                style={{ position: 'relative', top: 0, right: 0 }}
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </button>
           </div>

           <div className="section-label">DEFINITION</div>
           <div className="def-text">{data.definition || <span className="loading-dots">Loading</span>}</div>
           <div className="def-sub">{data.bengali}</div>

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

           {(data.synonyms || data.antonyms) && (
              <div style={{ marginTop: '1rem' }}>
                <span className="section-label">SYNONYMS: </span>
                <span className="def-sub">{data.synonyms}</span>
              </div>
           )}

           <div className="srs-actions">
              <button className="action-btn btn-again" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'dont_know'); }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                 Again
              </button>
              <button className="action-btn btn-got-it" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'know'); }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                 Got it
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardView;
