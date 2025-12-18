/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
// Fixed: Grade is exported from srsService, not geminiService
import { streamDefinition, CardData, parseFlashcardResponse, getShortDefinition } from '../services/geminiService';
import { Grade } from '../services/srsService';
import InteractiveText from './InteractiveText';
import WordTooltip from './WordTooltip';

interface FlashcardViewProps {
  topic: string;
  savedWords: string[];
  srsData: Record<string, any>;
  cardCache: Record<string, CardData>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onNavigate: (word: string) => void;
  onCacheUpdate: (word: string, data: CardData) => void;
  onOpenImport: () => void;
  isQuotaExceeded: boolean;
  setIsQuotaExceeded: (val: boolean) => void;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
    topic, savedWords, srsData, cardCache, onUpdateSRS, onToggleSave, onNavigate, onCacheUpdate, onOpenImport, isQuotaExceeded, setIsQuotaExceeded
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [data, setData] = useState<CardData>({
    pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const activeTopic = useRef(topic);
  const [tooltip, setTooltip] = useState<{ word: string, text: string, pos?: string, x: number, y: number } | null>(null);

  useEffect(() => {
    // Prevent rendering __RANDOM__ as a topic
    if (topic && topic !== "__RANDOM__" && topic !== "__EMPTY_FALLBACK__") {
        loadTopic(topic);
    }
    setTooltip(null);
  }, [topic]);

  const loadTopic = async (word: string, forceRefresh = false) => {
    activeTopic.current = word;
    setIsFlipped(false);

    if (!forceRefresh && cardCache[word]) {
        setData(cardCache[word]);
        setIsLoading(false);
        return;
    }

    // If quota is already known to be exceeded and not cached, don't even try
    if (isQuotaExceeded) {
        setData({ pos: 'Unavailable', ipa: '', definition: 'AI Quota exceeded. Browsing saved words.', bengali: 'সাময়িক বিরতি', family: '', context: '', synonyms: '', antonyms: '', difficulty: '' });
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setData({ pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: '' });
    
    try {
      let fullText = '';
      for await (const chunk of streamDefinition(word)) {
        if (activeTopic.current !== word) return;
        fullText += chunk;
      }
      if (activeTopic.current === word) {
        if (fullText.includes("QUOTA_EXCEEDED") || fullText.includes("quota") || fullText.includes("429")) {
            setIsQuotaExceeded(true);
            // Trigger a re-navigation to a cached word if available
            onNavigate('__RANDOM__');
            return;
        }
        const parsed = parseFlashcardResponse(fullText);
        setData(parsed);
        setIsLoading(false);
        onCacheUpdate(word, parsed);
      }
    } catch (e: any) {
      if (e.message?.includes('QUOTA_EXCEEDED')) {
          setIsQuotaExceeded(true);
          onNavigate('__RANDOM__');
      }
      setIsLoading(false);
    }
  };

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;
    setTooltip({ word, text: 'Loading...', x: clientX, y: clientY });
    try {
        const fullDef = await getShortDefinition(word);
        const match = fullDef.match(/^(\([a-z.]+\))\s*([\s\S]*)/i);
        let pos = '';
        let defText = fullDef;
        if (match) { pos = match[1]; defText = match[2]; }
        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: defText, pos: pos } : prev));
    } catch (err) {
        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: "Definition unavailable" } : prev));
    }
  };

  if (topic === "__EMPTY_FALLBACK__") {
      return (
          <div className="flashcard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <div className="card-face card-front" style={{ position: 'relative', height: 'auto', minHeight: '350px', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📭</div>
                  <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Low on Vocabulary</h2>
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '0 1rem', lineHeight: '1.5', fontSize: '0.95rem' }}>
                      {isQuotaExceeded 
                        ? "The AI is resting and you have no saved words cached." 
                        : "You haven't saved enough words yet to browse focused mix."}
                  </p>
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
                      Import a word list or use Search to add more.
                  </p>
                  <button className="auth-btn primary" style={{ marginTop: '2rem' }} onClick={onOpenImport}>
                      Bulk Import Words
                  </button>
              </div>
          </div>
      );
  }

  const isSaved = savedWords.includes(topic);
  const srsItem = srsData[topic];
  const isLearning = srsItem && srsItem.masteryLevel > 0;
  const synonymsList = data.synonyms && data.synonyms !== 'N/A' ? data.synonyms.split(',').map(s => s.trim()) : [];
  const antonymsList = data.antonyms && data.antonyms !== 'N/A' ? data.antonyms.split(',').map(s => s.trim()) : [];

  return (
    <div className="flashcard-container" onClick={() => setTooltip(null)}>
      <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('interactive-word-span')) return;
          if (!isFlipped) setIsFlipped(true);
      }}>
        <div className="card-face card-front">
           <button className={`like-btn ${isSaved ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleSave(topic); }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
           </button>
           <div className="word-display">{topic}</div>
           <div className="pos-tag">{data.pos || '...'}</div>
           <div className="status-badge">{isLearning ? 'LEARNING' : 'NEW'}</div>
           <div className="tap-hint">{isLoading ? 'Loading...' : 'Tap to flip'}</div>
        </div>

        <div className="card-face card-back">
           <div className="card-back-header">
             <div style={{ display: 'flex', alignItems: 'center' }}>
               <h2 className="word-small">{topic}</h2>
             </div>
             <button className={`like-btn ${isSaved ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleSave(topic); }} style={{ position: 'relative', top: 0, right: 0 }}>
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </button>
           </div>
           <div className="card-back-scrollable">
                <div className="section-label">DEFINITION</div>
                <div className="def-text">
                    <InteractiveText text={data.definition || 'Loading...'} onWordClick={handleWordClick} />
                    {data.bengali && <span className="bengali-text">{data.bengali}</span>}
                </div>
                {data.family && <><div className="section-label">WORD FAMILY</div><div className="def-sub">{data.family}</div></>}
                <div className="section-label">CONTEXT</div>
                <div className="context-box">"<InteractiveText text={data.context || '...'} onWordClick={handleWordClick} />"</div>
                <div className="synonyms-antonyms-container">
                    {synonymsList.length > 0 && <div className="sa-column"><div className="section-label">SYNONYMS</div><div className="chip-container">{synonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s); }}>{s}</span>)}</div></div>}
                    {antonymsList.length > 0 && <div className="sa-column"><div className="section-label">ANTONYMS</div><div className="chip-container">{antonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s); }}>{s}</span>)}</div></div>}
                </div>
           </div>
           <div className="card-back-footer">
               <button className="action-btn btn-again" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'dont_know'); }}>Review Again</button>
           </div>
        </div>
      </div>
      
      <div className="external-actions">
          <button className="skip-action-btn know-btn" onClick={() => onUpdateSRS(topic, 'know')}>I Know</button>
          <button className="skip-action-btn next-btn" onClick={() => onNavigate('__RANDOM__')}>Next Word</button>
      </div>

      {tooltip && (
          <WordTooltip 
              word={tooltip.word} text={tooltip.text} pos={tooltip.pos}
              x={tooltip.x} y={tooltip.y} 
              onOpen={() => { onNavigate(tooltip.word); setTooltip(null); }}
              onClose={() => setTooltip(null)}
          />
      )}
    </div>
  );
};

export default FlashcardView;