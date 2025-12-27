
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SRSItem } from '../services/srsService';
import { CardData } from '../services/dictionaryService';
import TrashModal from './TrashModal';

interface SavedWordsListProps {
  savedWords: string[];
  favoriteWords: string[];
  trashedWords: string[];
  srsData: Record<string, SRSItem>;
  cardCache: Record<string, CardData>;
  onNavigate: (word: string) => void;
  onDeleteMultiple: (words: string[]) => void;
  onRestoreFromTrash: (words: string[]) => void;
  onPermanentDelete: (words: string[]) => void;
}

type SortType = 'alpha' | 'time';
type SortOrder = 'asc' | 'desc';
type MasteryFilter = 'all' | 'new' | 'learning' | 'mastered';

const SavedWordsList: React.FC<SavedWordsListProps> = ({ 
    savedWords, favoriteWords, trashedWords, srsData, cardCache, onNavigate, onDeleteMultiple, onRestoreFromTrash, onPermanentDelete
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<SortType>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<MasteryFilter>('all');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<number | null>(null);

  // Swipe State
  const [swipingWord, setSwipingWord] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStart = useRef({ x: 0, y: 0 });

  // Undo Snackbar State (Now specifically for "Moved to Trash")
  const [lastTrashed, setLastTrashed] = useState<string[] | null>(null);
  const undoTimeout = useRef<number | null>(null);

  const baseList = activeTab === 'all' ? savedWords : favoriteWords;

  const filteredAndSortedList = useMemo(() => {
    let list = [...baseList];
    if (filter !== 'all') {
        list = list.filter(word => {
            const item = srsData[word];
            const mastery = item?.masteryLevel || 0;
            if (filter === 'new') return mastery === 0;
            if (filter === 'learning') return mastery > 0 && mastery < 5;
            if (filter === 'mastered') return mastery >= 5;
            return true;
        });
    }
    list.sort((a, b) => {
        if (sortBy === 'alpha') {
            const res = a.localeCompare(b);
            return sortOrder === 'asc' ? res : -res;
        } else {
            const idxA = savedWords.indexOf(a);
            const idxB = savedWords.indexOf(b);
            return sortOrder === 'asc' ? idxB - idxA : idxA - idxB;
        }
    });
    return list;
  }, [baseList, sortBy, sortOrder, filter, srsData, savedWords]);

  const toggleSelection = (word: string) => {
    const next = new Set(selectedWords);
    if (next.has(word)) {
        next.delete(word);
    } else {
        next.add(word);
    }
    setSelectedWords(next);
    if (next.size === 0) setSelectionMode(false);
  };

  const startLongPress = (word: string, e: React.PointerEvent) => {
    if (swipingWord || selectionMode) return;
    touchStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
        setSelectionMode(true);
        toggleSelection(word);
        if ('vibrate' in navigator) navigator.vibrate(50);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const handleItemClick = (word: string) => {
    if (selectionMode) {
        toggleSelection(word);
    } else if (!swipingWord) {
        onNavigate(word);
    }
  };

  const handleBatchMoveToTrash = () => {
    const wordsToTrash = Array.from(selectedWords);
    setLastTrashed(wordsToTrash);
    onDeleteMultiple(wordsToTrash);
    setSelectionMode(false);
    setSelectedWords(new Set());

    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    undoTimeout.current = window.setTimeout(() => setLastTrashed(null), 5000);
  };

  const handleUndoTrash = () => {
    if (lastTrashed) {
        onRestoreFromTrash(lastTrashed);
        setLastTrashed(null);
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
    }
  };

  // Swipe logic
  const onTouchStart = (word: string, e: React.TouchEvent | React.MouseEvent) => {
    if (selectionMode) return;
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
    touchStart.current = { x: clientX, y: 0 };
    setSwipingWord(word);
  };

  const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!swipingWord || selectionMode) return;
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
    const diffX = clientX - touchStart.current.x;
    if (diffX < 0) setSwipeOffset(Math.max(-100, diffX));
    else setSwipeOffset(0);
  };

  const onTouchEnd = () => {
    if (!swipingWord) return;
    if (swipeOffset < -70) {
        const word = swipingWord;
        setLastTrashed([word]);
        onDeleteMultiple([word]);
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        undoTimeout.current = window.setTimeout(() => setLastTrashed(null), 5000);
    }
    setSwipingWord(null);
    setSwipeOffset(0);
  };

  return (
    <div className="saved-list-view" onMouseUp={onTouchEnd} onTouchEnd={onTouchEnd}>
      {isTrashOpen && (
          <TrashModal 
            trashedWords={trashedWords} 
            cardCache={cardCache}
            onClose={() => setIsTrashOpen(false)} 
            onRestore={onRestoreFromTrash} 
            onPermanentDelete={onPermanentDelete}
          />
      )}

      {/* Selection Overlay */}
      {selectionMode && (
          <div className="selection-bar">
              <button className="icon-btn" onClick={() => { setSelectionMode(false); setSelectedWords(new Set()); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <div style={{ flex: 1, fontWeight: 800 }}>{selectedWords.size} Selected</div>
              <button className="text-action" onClick={() => {
                  if (selectedWords.size === filteredAndSortedList.length) setSelectedWords(new Set());
                  else setSelectedWords(new Set(filteredAndSortedList));
              }}>
                  {selectedWords.size === filteredAndSortedList.length ? 'NONE' : 'ALL'}
              </button>
              <button className="icon-btn danger-fill" onClick={handleBatchMoveToTrash}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
          </div>
      )}

      <div className="list-tabs-container">
          <div className="list-tabs">
              <button onClick={() => setActiveTab('all')} className={activeTab === 'all' ? 'active' : ''}>
                  LIBRARY ({savedWords.length})
              </button>
              <button onClick={() => setActiveTab('favorites')} className={activeTab === 'favorites' ? 'active fav' : ''}>
                  FAVORITES ({favoriteWords.length})
              </button>
          </div>
          <button className={`icon-btn trash-btn ${trashedWords.length > 0 ? 'not-empty' : ''}`} onClick={() => setIsTrashOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
      </div>

      <div className="filter-sort-bar">
          <div className="sort-toggles">
              <button 
                className={sortBy === 'time' ? 'active' : ''} 
                onClick={() => { if (sortBy === 'time') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('time'); }}
              >
                  TIME {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={sortBy === 'alpha' ? 'active' : ''} 
                onClick={() => { if (sortBy === 'alpha') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('alpha'); }}
              >
                  A-Z {sortBy === 'alpha' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
          </div>
          <div className="filter-chips">
              {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(f => (
                  <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
              ))}
          </div>
      </div>
      
      <div className="words-scroll-list">
        {filteredAndSortedList.length === 0 ? (
            <div className="empty-state">
                <div className="icon">{activeTab === 'all' ? '📚' : '❤️'}</div>
                <p>{filter === 'all' ? 'Your library is empty.' : 'No matches.'}</p>
            </div>
        ) : (
            filteredAndSortedList.map(word => {
                const item = srsData[word];
                const cache = cardCache[word];
                const mastery = item?.masteryLevel || 0;
                const isFaved = favoriteWords.includes(word);
                const isSelected = selectedWords.has(word);
                const isSwiping = swipingWord === word;
                
                let badgeClass = 'new';
                let badgeText = 'NEW';
                if (mastery >= 5) { badgeClass = 'mastered'; badgeText = 'MASTERED'; }
                else if (mastery > 0) { badgeClass = 'learning'; badgeText = 'LEARNING'; }

                return (
                    <div key={word} className="swipe-container">
                        <div className="swipe-bg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </div>

                        <div 
                          className={`word-card-row ${isSelected ? 'selected' : ''} ${selectionMode ? 'selection-active' : ''}`}
                          style={{ transform: isSwiping ? `translateX(${swipeOffset}px)` : 'none' }}
                          onClick={() => handleItemClick(word)}
                          onPointerDown={(e) => startLongPress(word, e)}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onMouseDown={(e) => onTouchStart(word, e)}
                          onTouchStart={(e) => onTouchStart(word, e)}
                          onMouseMove={(e) => isSwiping && onTouchMove(e)}
                          onTouchMove={(e) => isSwiping && onTouchMove(e)}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                            {selectionMode && (
                                <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                </div>
                            )}
                            
                            <div className="row-content">
                                <h3>
                                    {word}
                                    {!selectionMode && <span className={`mini-badge ${badgeClass}`}>{badgeText}</span>}
                                    {isFaved && !selectionMode && <span className="row-fav-icon">❤️</span>}
                                </h3>
                                <p className="row-def">{cache ? cache.definition : 'Loading...'}</p>
                            </div>
                            {!selectionMode && (
                                <div className="row-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {/* Undo Snackbar */}
      {lastTrashed && (
          <div className="modern-snackbar">
              <span className="snackbar-msg">Moved {lastTrashed.length} {lastTrashed.length === 1 ? 'word' : 'words'} to Trash</span>
              <button className="snackbar-undo" onClick={handleUndoTrash}>UNDO</button>
          </div>
      )}

      <style>{`
        .list-tabs-container { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; }
        .list-tabs { flex: 1; display: flex; gap: 4px; background: var(--accent-secondary); padding: 4px; border-radius: 12px; }
        .list-tabs button { flex: 1; padding: 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; }
        .list-tabs button.active { background: var(--card-bg); color: var(--accent-primary); box-shadow: var(--shadow-sm); }
        .list-tabs button.active.fav { color: #ff2d55; }
        
        .trash-btn { width: 44px; height: 44px; background: var(--accent-secondary); color: var(--text-secondary); position: relative; }
        .trash-btn.not-empty { color: var(--accent-primary); }
        .trash-btn.not-empty::after { content: ''; position: absolute; top: 12px; right: 12px; width: 6px; height: 6px; background: var(--danger-color); border-radius: 50%; }

        .filter-sort-bar { margin-bottom: 1.2rem; display: flex; flex-direction: column; gap: 12px; }
        .sort-toggles { display: flex; gap: 8px; }
        .sort-toggles button { font-size: 0.7rem; font-weight: 700; padding: 8px 14px; border-radius: 10px; background: var(--accent-secondary); color: var(--accent-primary); }
        .sort-toggles button.active { background: var(--accent-primary); color: white; }
        .filter-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .chip { white-space: nowrap; font-size: 0.65rem; font-weight: 800; padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--border-color); color: var(--text-secondary); }
        .chip.active { background: var(--text-primary); color: var(--bg-color); border-color: var(--text-primary); }

        .words-scroll-list { display: flex; flex-direction: column; gap: 0.8rem; }
        .swipe-container { position: relative; overflow: hidden; border-radius: 16px; }
        .swipe-bg { position: absolute; right: 0; top: 0; height: 100%; width: 100px; background: var(--danger-color); color: white; display: flex; align-items: center; justify-content: flex-end; padding-right: 25px; border-radius: 16px; z-index: 1; }
        .word-card-row { position: relative; z-index: 2; background: var(--card-bg); transition: transform 0.15s ease-out, background 0.2s; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); }
        .word-card-row.selected { background: var(--accent-secondary); border-color: var(--accent-primary); transform: scale(0.97); }
        .row-fav-icon { margin-left: 6px; font-size: 0.8rem; }

        .selection-bar { position: fixed; top: 0; left: 0; width: 100%; height: 70px; background: rgba(88, 86, 214, 0.95); backdrop-filter: blur(10px); color: white; z-index: 1000; display: flex; align-items: center; padding: 0 1.2rem; gap: 1rem; }
        .selection-bar .icon-btn { color: white; background: rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 10px; }
        .selection-bar .icon-btn.danger-fill { background: #ff3b30; }
        .selection-bar .text-action { font-size: 0.75rem; font-weight: 800; color: white; letter-spacing: 0.5px; }

        .checkbox { width: 24px; height: 24px; border-radius: 8px; border: 2px solid var(--text-muted); margin-right: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .checkbox.checked { background: var(--accent-primary); border-color: var(--accent-primary); color: white; }

        .modern-snackbar { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: #1c1c1e; color: white; padding: 14px 24px; border-radius: 16px; display: flex; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 2000; min-width: 280px; animation: slideUpFade 0.3s ease-out; }
        .snackbar-msg { font-size: 0.9rem; font-weight: 500; }
        .snackbar-undo { color: var(--accent-primary); font-weight: 800; font-size: 0.85rem; letter-spacing: 1px; }
        @keyframes slideUpFade { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default SavedWordsList;
