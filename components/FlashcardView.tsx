
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { fetchWordData, CardData, getShortDefinition } from '../services/dictionaryService';
import { Grade, SRSItem } from '../services/srsService';
import InteractiveText from './InteractiveText';
import WordTooltip from './WordTooltip';
import type { VisibilitySettings } from '../App';

interface FlashcardViewProps {
  topic: string;
  savedWords: string[];
  favoriteWords: string[];
  srsData: Record<string, SRSItem>;
  cardCache: Record<string, CardData>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onToggleFavorite: (word: string) => void;
  onNavigate: (word: string) => void;
  onCacheUpdate: (word: string, data: CardData) => void;
  onOpenImport: () => void;
  isOnline: boolean;
  visibilitySettings: VisibilitySettings;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
    topic, savedWords, favoriteWords, srsData, cardCache, onUpdateSRS, onToggleSave, onToggleFavorite, onNavigate, onCacheUpdate, onOpenImport, isOnline, visibilitySettings
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [data, setData] = useState<CardData>({
    pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const activeTopic = useRef(topic);
  const [tooltip, setTooltip] = useState<{ word: string, text: string, pos?: string, x: number, y: number } | null>(null);

  useEffect(() => {
    if (topic && topic !== "__EMPTY_FALLBACK__") {
        loadTopic(topic);
    }
    setTooltip(null);
  }, [topic, isOnline]);

  const loadTopic = async (word: string) => {
    activeTopic.current = word;
    setIsFlipped(false);
    setErrorMsg(null);

    if (cardCache[word]) {
        setData(cardCache[word]);
        setIsLoading(false);
        return;
    }

    if (!isOnline) {
      setErrorMsg("Offline: Word not cached. Connect to internet to download details.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setData({ pos: '...', ipa: '', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: '' });
    
    try {
      const result = await fetchWordData(word);
      if (activeTopic.current === word) {
        setData(result);
        setIsLoading(false);
        onCacheUpdate(word, result);
      }
    } catch (e) {
      if (activeTopic.current === word) {
        setIsLoading(false);
        setErrorMsg("Failed to fetch word details. Check your connection.");
      }
    }
  };

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!isOnline && !cardCache[word]) {
        setTooltip({ word, text: 'No offline data for this word.', x: clientX, y: clientY });
        return;
    }

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

  const renderUsageNotes = (notes: any) => {
    if (!notes) return null;
    
    // Safety check to ensure we are working with a string to avoid TypeError: str.split is not a function
    const notesStr = typeof notes === 'string' ? notes : String(notes);
    
    // Split by bracketed tags: [TRAP], [MNEMONIC], etc.
    const parts = notesStr.split(/(\[[A-Z-]+\]:?)/g).filter(Boolean);
    
    return (
      <div className="usage-box-container">
        {parts.map((part, idx) => {
          const isTag = /^\[[A-Z-]+\]:?$/.test(part);
          if (isTag) {
            const label = part.replace(/[\[\]:]/g, '');
            return <span key={idx} className={`usage-tag tag-${label.toLowerCase()}`}>{label}</span>;
          }
          return <p key={idx} className="usage-text-segment">{part.trim()}</p>;
        })}
      </div>
    );
  };

  if (topic === "__EMPTY_FALLBACK__") {
      return (
          <div className="flashcard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <div className="card-face card-front" style={{ position: 'relative', height: 'auto', minHeight: '350px', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📚</div>
                  <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Library is Empty</h2>
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '0 1rem', lineHeight: '1.5', fontSize: '0.95rem' }}>
                      Start building your personalized library to begin your learning journey.
                  </p>
                  <button className="auth-btn primary" style={{ marginTop: '2rem' }} onClick={onOpenImport}>
                      Import Words
                  </button>
              </div>
          </div>
      );
  }

  const isFavorite = favoriteWords.includes(topic);
  const srsItem = srsData[topic];
  
  const getStatusLabel = () => {
    if (!srsItem || srsItem.reviewCount === 0) return 'NEW WORD';
    if (srsItem.masteryLevel >= 5) return 'MASTERED';
    if (srsItem.masteryLevel === 0 && srsItem.reviewCount > 0) return 'RE-LEARNING';
    return 'LEARNING';
  };

  const statusLabel = getStatusLabel();
  
  const parseList = (val: any) => {
    if (!val || val === 'N/A') return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val !== 'string') return [String(val)];
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  const synonymsList = parseList(data.synonyms);
  const antonymsList = parseList(data.antonyms);
  const familyList = parseList(data.family);

  return (
    <div className="flashcard-container" onClick={() => setTooltip(null)}>
      <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={(e) => {
          if ((e.target as HTMLElement).closest('.interactive-word-span')) return;
          if (errorMsg) return;
          if (!isFlipped) setIsFlipped(true);
      }}>
        <div className="card-face card-front">
           <div className="card-actions-top">
               <button className={`fav-btn ${isFavorite ? 'faved' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleFavorite(topic); }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
               </button>
           </div>
           <div className="word-display">{topic}</div>
           <div className="pos-tag">{errorMsg ? '⚠️ ERROR' : (data.pos || '...')}</div>
           
           {errorMsg ? (
               <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem', fontSize: '0.9rem' }}>{errorMsg}</p>
           ) : (
               <>
                <div className={`status-badge ${statusLabel.replace(' ', '-').toLowerCase()}`}>{statusLabel}</div>
                <div className="tap-hint">{isLoading ? 'Fetching details...' : 'Tap to reveal details'}</div>
               </>
           )}
        </div>

        <div className="card-face card-back">
           <div className="card-back-header">
             <div style={{ display: 'flex', flexDirection: 'column' }}>
               <h2 className="word-small" style={{ fontSize: '1.4rem' }}>{topic}</h2>
               {(visibilitySettings.ipa && data.ipa) && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{data.ipa}</span>}
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
                <button className={`fav-btn ${isFavorite ? 'faved' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleFavorite(topic); }} style={{ position: 'relative', top: 0, right: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
             </div>
           </div>
           
           <div className="card-back-scrollable">
                {visibilitySettings.definition && (
                    <>
                    <div className="section-label">DEFINITION</div>
                    <div className="def-text">
                        <InteractiveText text={String(data.definition || 'Waiting for details...')} onWordClick={handleWordClick} />
                    </div>
                    </>
                )}

                {visibilitySettings.bengali && data.bengali && (
                    <>
                    <div className="section-label">BENGALI</div>
                    <div className="bengali-text">{String(data.bengali)}</div>
                    </>
                )}

                {visibilitySettings.context && (
                    <>
                    <div className="section-label">IN CONTEXT</div>
                    <div className="context-box">
                      <InteractiveText text={String(data.context || 'Generating example sentence...')} onWordClick={handleWordClick} />
                    </div>
                    </>
                )}

                {visibilitySettings.family && familyList.length > 0 && (
                  <>
                    <div className="section-label">WORD FAMILY</div>
                    <div className="chip-container">
                        {familyList.map(f => {
                            const clean = f.replace(/\s*\([^)]*\)/g, '').trim();
                            return (
                                <span 
                                    className="chip" 
                                    key={f} 
                                    onClick={(e) => { e.stopPropagation(); onNavigate(clean); }}
                                >
                                    {f}
                                </span>
                            );
                        })}
                    </div>
                  </>
                )}

                {visibilitySettings.etymology && data.etymology && (
                    <>
                    <div className="section-label">ORIGIN / ETYMOLOGY</div>
                    <div className="etymology-text">{String(data.etymology)}</div>
                    </>
                )}

                <div className="synonyms-antonyms-container">
                    {(visibilitySettings.synonyms && synonymsList.length > 0) && (
                      <div className="sa-column">
                        <div className="section-label">SYNONYMS</div>
                        <div className="chip-container">
                          {synonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s); }}>{s}</span>)}
                        </div>
                      </div>
                    )}
                    {(visibilitySettings.antonyms && antonymsList.length > 0) && (
                      <div className="sa-column">
                        <div className="section-label">ANTONYMS</div>
                        <div className="chip-container">
                          {antonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s); }}>{s}</span>)}
                        </div>
                      </div>
                    )}
                </div>

                {visibilitySettings.usageNotes && data.usage_notes && (
                    <>
                    <div className="section-label">CREATIVE USAGE NOTES</div>
                    <div className="usage-box">
                        {renderUsageNotes(data.usage_notes)}
                    </div>
                    </>
                )}
           </div>

           <div className="card-back-footer">
               <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                 Source: {data.source || 'Local Cache'}
               </span>
               <button className="action-btn" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'dont_know'); }}>
                  Review Again
               </button>
           </div>
        </div>
      </div>
      
      <div className="external-actions">
          <button className="skip-action-btn know-btn" onClick={() => onUpdateSRS(topic, 'know')}>
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             Got It
          </button>
          <button className="skip-action-btn next-btn" onClick={() => onNavigate('__RANDOM__')}>
             Next Word
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
      </div>

      {tooltip && (
          <WordTooltip 
              word={tooltip.word} text={tooltip.text} pos={tooltip.pos}
              x={tooltip.x} y={tooltip.y} 
              onOpen={() => { onNavigate(tooltip.word); setTooltip(null); }}
              onClose={() => setTooltip(null)}
          />
      )}

      <style>{`
          .usage-box-container {
              display: flex;
              flex-direction: column;
              gap: 8px;
          }
          .usage-tag {
              display: inline-block;
              font-size: 0.65rem;
              font-weight: 900;
              padding: 2px 8px;
              border-radius: 4px;
              width: fit-content;
              letter-spacing: 0.5px;
          }
          .tag-trap { background: #fee2e2; color: #991b1b; }
          .tag-mnemonic { background: #fef9c3; color: #854d0e; }
          .tag-vibe { background: #e0e7ff; color: #3730a3; }
          .tag-context { background: #dcfce7; color: #166534; }
          .tag-tip { background: #ffedd5; color: #9a3412; }
          
          .usage-text-segment {
              margin: 0;
              line-height: 1.5;
              font-size: 0.95rem;
          }

          .card-actions-top {
            position: absolute;
            top: 1.5rem;
            right: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 10;
          }
          .fav-btn { 
            color: var(--text-muted); 
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          }
          .fav-btn.faved { 
            color: #ff2d55; 
            fill: #ff2d55;
            transform: scale(1.1);
          }
          .fav-btn:active {
            transform: scale(0.9);
          }
          .status-badge.re-learning {
              background: rgba(239, 68, 68, 0.1);
              color: var(--danger-color);
              border: 1px solid rgba(239, 68, 68, 0.2);
          }
          .synonyms-antonyms-container {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
      `}</style>
    </div>
  );
};

export default FlashcardView;
