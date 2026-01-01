
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
  initialFlipped?: boolean;
  savedWords: string[];
  favoriteWords: string[];
  srsData: Record<string, SRSItem>;
  cardCache: Record<string, CardData>;
  onUpdateSRS: (word: string, grade: Grade) => void;
  onToggleSave: (word: string) => void;
  onToggleFavorite: (word: string) => void;
  onNavigate: (word: string, initialFlipped?: boolean) => void;
  onNavigateSilent?: (word: string) => void;
  onCacheUpdate: (word: string, data: CardData) => void;
  onOpenImport: () => void;
  isOnline: boolean;
  visibilitySettings: VisibilitySettings;
  isExploreMode?: boolean;
  exploreProgress?: { current: number, total: number };
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
    topic, initialFlipped = false, savedWords, favoriteWords, srsData, cardCache, onUpdateSRS, onToggleSave, onToggleFavorite, onNavigate, onCacheUpdate, onOpenImport, isOnline, visibilitySettings,
    isExploreMode = false, exploreProgress
}) => {
  const [isFlipped, setIsFlipped] = useState(initialFlipped);
  const [data, setData] = useState<CardData>({
    pos: '...', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const activeTopic = useRef(topic);
  const [tooltip, setTooltip] = useState<{ word: string, text: string, pos?: string, x: number, y: number } | null>(null);

  useEffect(() => {
    if (topic && topic !== "__EMPTY_FALLBACK__") {
        loadTopic(topic);
        setIsFlipped(initialFlipped);
    }
    setTooltip(null);
  }, [topic, initialFlipped, isOnline]);

  const loadTopic = async (word: string) => {
    activeTopic.current = word;
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
    setData({ pos: '...', definition: '', bengali: '', family: '', context: '', synonyms: '', antonyms: '', difficulty: '' });
    
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

    if (cardCache[word]) {
        const cached = cardCache[word];
        setTooltip({ 
          word, 
          text: `${cached.definition}\n${cached.bengali}`, 
          pos: cached.pos ? `(${cached.pos})` : undefined,
          x: clientX, 
          y: clientY 
        });
        return;
    }

    if (!isOnline) {
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
    const notesStr = typeof notes === 'string' ? notes : String(notes);
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
                      Start building your personalized library or try Explore mode.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '2rem' }}>
                    <button className="auth-btn primary" onClick={onOpenImport}>Import Words</button>
                  </div>
              </div>
          </div>
      );
  }

  const isFavorite = favoriteWords.includes(topic);
  const srsItem = srsData[topic];
  
  const getStatusLabel = () => {
    if (isExploreMode) return `DISCOVERING ${exploreProgress?.current}/${exploreProgress?.total}`;
    if (!srsItem || srsItem.reviewCount === 0) return 'NEW WORD';
    if (srsItem.masteryLevel >= 5) return 'MASTERED';
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
                <div className={`status-badge ${isExploreMode ? 'explore-badge' : statusLabel.replace(' ', '-').toLowerCase()}`}>{statusLabel}</div>
                <div className="tap-hint">{isLoading ? 'Fetching details...' : 'Tap to reveal details'}</div>
               </>
           )}
        </div>

        <div className="card-face card-back">
           <div className="card-back-header">
             <div style={{ display: 'flex', flexDirection: 'column' }}>
               <h2 className="word-small" style={{ fontSize: '1.4rem' }}>{topic}</h2>
               {data.pos && <div className="header-pos-sub">{data.pos}</div>}
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
                            // Extract word only for navigation (strips brackets like (v), (n))
                            const clean = f.replace(/\s*\([^)]*\)/g, '').trim();
                            return (
                                <span 
                                    className="chip" 
                                    key={f} 
                                    onClick={(e) => { e.stopPropagation(); onNavigate(clean, true); }}
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
                          {synonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s, true); }}>{s}</span>)}
                        </div>
                      </div>
                    )}
                    {(visibilitySettings.antonyms && antonymsList.length > 0) && (
                      <div className="sa-column">
                        <div className="section-label">ANTONYMS</div>
                        <div className="chip-container">
                          {antonymsList.map(s => <span className="chip" key={s} onClick={(e) => { e.stopPropagation(); onNavigate(s, true); }}>{s}</span>)}
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
               <button className="action-btn-back" onClick={(e) => { e.stopPropagation(); onUpdateSRS(topic, 'dont_know'); }}>
                  Review Again
               </button>
           </div>
        </div>
      </div>
      
      <div className="external-actions">
        {!isExploreMode ? (
            /* Classic review layout */
            <>
                <button className="skip-action-btn know-btn" onClick={() => onUpdateSRS(topic, 'know')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Got It
                </button>
                <button className="skip-action-btn next-btn" onClick={() => onNavigate('__RANDOM__', false)}>
                    Next Word
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </>
        ) : (
            /* New 3-button Explore layout */
            <>
                <button 
                    className="nav-icon-btn" 
                    onClick={() => onNavigate('__PREV__')} 
                    disabled={exploreProgress?.current === 1}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                
                <button className="skip-action-btn know-btn middle" onClick={() => onUpdateSRS(topic, 'know')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Already Knew
                </button>

                {exploreProgress?.current === exploreProgress?.total ? (
                    <button className="nav-icon-btn primary-gen" onClick={() => onNavigate('__GENERATE__')}>
                        <svg className="sparkle-icon-filled" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M3 5h4M21 17v4M19 19h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                ) : (
                    <button className="nav-icon-btn" onClick={() => onNavigate('__RANDOM__')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                )}
            </>
        )}
      </div>

      {tooltip && (
          <WordTooltip 
              word={tooltip.word} text={tooltip.text} pos={tooltip.pos}
              x={tooltip.x} y={tooltip.y} 
              onOpen={() => { onNavigate(tooltip.word, true); setTooltip(null); }}
              onClose={() => setTooltip(null)}
          />
      )}

      <style>{`
          .header-pos-sub {
              font-size: 0.75rem;
              font-style: italic;
              color: var(--accent-primary);
              margin-top: 2px;
              opacity: 0.85;
              font-weight: 600;
              letter-spacing: 0.2px;
          }
          .card-back-footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 1rem 1.5rem;
              border-top: 1px solid var(--border-color);
              background: var(--card-bg);
          }
          .action-btn-back {
              padding: 8px 14px;
              border-radius: 10px;
              font-weight: 700;
              font-size: 0.75rem;
              background: var(--accent-secondary);
              color: var(--accent-primary);
              border: 1px solid var(--border-color);
          }
          .action-btn-back:active { transform: scale(0.95); }

          .nav-icon-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-sm);
            transition: all 0.2s;
            flex-shrink: 0;
          }
          .nav-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
          .nav-icon-btn:active:not(:disabled) { transform: scale(0.9); background: var(--accent-secondary); }
          
          .sparkle-icon-filled {
              color: #FFD700;
              filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.5));
          }
          
          .nav-icon-btn.primary-gen { 
            background: var(--accent-primary); 
            color: white; 
            border-color: var(--accent-primary);
            animation: pulse-gen 2s infinite;
          }
          @keyframes pulse-gen {
              0% { box-shadow: 0 0 0 0 rgba(88, 86, 214, 0.4); }
              70% { box-shadow: 0 0 0 10px rgba(88, 86, 214, 0); }
              100% { box-shadow: 0 0 0 0 rgba(88, 86, 214, 0); }
          }

          .status-badge.explore-badge {
            background: linear-gradient(135deg, #5856d6 0%, #ff2d55 100%);
            color: white;
            border: none;
          }
          
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
