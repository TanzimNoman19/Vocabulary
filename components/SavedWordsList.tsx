
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef } from 'react';
import { SRSItem } from '../services/srsService';
import { CardData, capitalize } from '../services/dictionaryService';
import EditWordModal from './EditWordModal';

interface SavedWordsListProps {
  savedWords: string[];
  favoriteWords: string[];
  trashedWords: string[];
  srsData: Record<string, SRSItem>;
  cardCache: Record<string, CardData>;
  onNavigate: (word: string, initialFlipped?: boolean) => void;
  onDeleteMultiple: (words: string[]) => void;
  onRestoreFromTrash: (words: string[]) => void;
  onPermanentDelete: (words: string[]) => void;
  onOpenImport: () => void;
  onUpdateWordData: (oldWord: string, newWord: string, newData: CardData) => void;
}

type SortType = 'alpha' | 'time';
type SortOrder = 'asc' | 'desc';
type MasteryFilter = 'all' | 'new' | 'learning' | 'mastered';
type ViewType = 'list' | 'family';

interface FamilyMember {
  word: string;
  pos: string;
}

interface FamilyGroup {
  id: string;
  savedMembers: string[];
  allMembers: FamilyMember[];
}

const SavedWordsList: React.FC<SavedWordsListProps> = ({ 
    savedWords, favoriteWords, trashedWords, srsData, cardCache, onNavigate, onDeleteMultiple, onRestoreFromTrash, onPermanentDelete, onOpenImport, onUpdateWordData
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<SortType>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<MasteryFilter>('all');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<FamilyGroup | null>(null);
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<number | null>(null);

  // Edit Mode State
  const [editingWord, setEditingWord] = useState<string | null>(null);

  // Undo Snackbar State
  const [lastTrashed, setLastTrashed] = useState<string[] | null>(null);
  const undoTimeout = useRef<number | null>(null);

  const baseList = activeTab === 'all' ? savedWords : favoriteWords;

  const filteredAndSortedList = useMemo(() => {
    let list = [...baseList];
    if (filter !== 'all') {
        list = list.filter(word => {
            const item = srsData[word];
            const mastery = item?.masteryLevel || 0;
            const revCount = item?.reviewCount || 0;
            if (filter === 'new') return revCount === 0;
            if (filter === 'learning') return (mastery > 0 && mastery < 5) || (mastery === 0 && revCount > 0);
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

  /**
   * Logical Set Union Grouping:
   * Fixed: Added a block to ignore generic placeholder text like "None" or "N/A"
   * to prevent unrelated words from being merged together.
   */
  const familyGroups = useMemo(() => {
    if (viewType !== 'family') return [];

    const parseMembers = (str: string): FamilyMember[] => {
      if (!str) return [];
      const trimmed = str.trim();
      const lower = trimmed.toLowerCase();
      // Exclude generic placeholder text from being used as a grouping key
      if (lower === 'none' || lower === 'n/a' || lower === 'pending' || lower === 'waiting') return [];

      return trimmed.split(',').map(m => {
        const match = m.match(/(.*?)\s*\((.*?)\)/);
        return {
          word: (match ? match[1].trim() : m.trim()).toLowerCase(),
          pos: match ? match[2].trim() : ''
        };
      }).filter(m => {
          const w = m.word;
          return w.length > 0 && w !== 'none' && w !== 'n/a';
      });
    };

    let clusters: { all: FamilyMember[], saved: Set<string> }[] = [];

    filteredAndSortedList.forEach(word => {
      const cache = cardCache[word];
      const members = parseMembers(cache?.family || '');
      
      // Ensure the saved word itself is always in its own family set
      if (!members.find(m => m.word === word.toLowerCase())) {
        members.push({ word: word.toLowerCase(), pos: cache?.pos || '' });
      }
      
      clusters.push({ 
        all: members, 
        saved: new Set([word]) 
      });
    });

    // Merge logic (Connected Components / Disjoint Set Union)
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const hasCommon = clusters[i].all.some(m1 => 
            clusters[j].all.some(m2 => m1.word === m2.word)
          );

          if (hasCommon) {
            // Merge j into i
            const mergedAll = [...clusters[i].all];
            clusters[j].all.forEach(m => {
              if (!mergedAll.find(existing => existing.word === m.word)) {
                mergedAll.push(m);
              }
            });
            const mergedSaved = new Set([...clusters[i].saved, ...clusters[j].saved]);
            
            clusters[i] = { all: mergedAll, saved: mergedSaved };
            clusters.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    return clusters.map((c, idx) => {
      const sortedSaved = Array.from(c.saved).sort((a, b) => a.localeCompare(b));
      const sortedAll = c.all.sort((a, b) => {
        const aSaved = c.saved.has(capitalize(a.word));
        const bSaved = c.saved.has(capitalize(b.word));
        if (aSaved && !bSaved) return -1;
        if (!aSaved && bSaved) return 1;
        return a.word.localeCompare(b.word);
      });

      return {
        id: `family-${idx}`,
        savedMembers: sortedSaved,
        allMembers: sortedAll
      } as FamilyGroup;
    }).sort((a, b) => a.savedMembers[0].localeCompare(b.savedMembers[0]));

  }, [filteredAndSortedList, cardCache, viewType, savedWords]);

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
    if (selectionMode || viewType === 'family') return;
    longPressTimer.current = window.setTimeout(() => {
        setSelectionMode(true);
        toggleSelection(word);
        if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
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
    } else {
        onNavigate(word, true);
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

  const handleOpenEdit = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    setEditingWord(word);
  };

  return (
    <div className="saved-list-view">
      {selectionMode && (
          <div className="selection-bar">
              <button className="icon-btn-selection" onClick={() => { setSelectionMode(false); setSelectedWords(new Set()); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <div style={{ flex: 1, fontWeight: 800 }}>{selectedWords.size} Selected</div>
              <button className="text-action" onClick={() => {
                  if (selectedWords.size === filteredAndSortedList.length) setSelectedWords(new Set());
                  else setSelectedWords(new Set(filteredAndSortedList));
              }}>
                  {selectedWords.size === filteredAndSortedList.length ? 'NONE' : 'ALL'}
              </button>
              <button className="icon-btn-selection danger-fill" onClick={handleBatchMoveToTrash}>
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
          <button className={`view-toggle-btn ${viewType === 'family' ? 'active' : ''}`} onClick={() => setViewType(prev => prev === 'list' ? 'family' : 'list')} title="Toggle Family View">
            {viewType === 'list' ? (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            )}
          </button>
      </div>

      <div className="filter-sort-bar">
          <div className="sort-toggles">
              <button 
                className={sortBy === 'time' ? 'active' : ''} 
                onClick={() => { if (sortBy === 'time') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('time'); }}
              >
                  RECENT {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={sortBy === 'alpha' ? 'active' : ''} 
                onClick={() => { if (sortBy === 'alpha') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('alpha'); }}
              >
                  ALPHABET {sortBy === 'alpha' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
          </div>
          <div className="filter-chips">
              {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(f => (
                  <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
              ))}
          </div>
      </div>
      
      <div className="words-scroll-list">
        {viewType === 'list' ? (
          filteredAndSortedList.length === 0 ? (
              <div className="empty-state">
                  <div className="icon">{activeTab === 'all' ? '📚' : '❤️'}</div>
                  <p>{filter === 'all' ? 'Your library is empty.' : 'No matches found.'}</p>
                  {filter === 'all' && activeTab === 'all' && (
                    <button className="auth-btn primary" style={{ marginTop: '1rem' }} onClick={onOpenImport}>
                      Import Words
                    </button>
                  )}
              </div>
          ) : (
              filteredAndSortedList.map(word => {
                  const item = srsData[word];
                  const cache = cardCache[word];
                  const mastery = item?.masteryLevel || 0;
                  const revCount = item?.reviewCount || 0;
                  const isFaved = favoriteWords.includes(word);
                  const isSelected = selectedWords.has(word);
                  
                  let badgeClass = 'new';
                  let badgeText = 'NEW';
                  if (mastery >= 5) { 
                      badgeClass = 'mastered'; 
                      badgeText = 'MASTERED'; 
                  }
                  else if (mastery > 0 || (mastery === 0 && revCount > 0)) { 
                      badgeClass = 'learning'; 
                      badgeText = 'LEARNING'; 
                  }

                  return (
                      <div 
                        key={word} 
                        className={`modern-word-card ${isSelected ? 'selected' : ''} ${selectionMode ? 'selection-active' : ''}`}
                        onClick={() => handleItemClick(word)}
                        onPointerDown={(e) => startLongPress(word, e)}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                          {selectionMode && (
                              <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                                  {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                          )}
                          
                          <div className="card-info">
                              <div className="card-top-row">
                                  <span className="word-title">{word}</span>
                                  <div className="card-indicators">
                                      {isFaved && <span className="fav-indicator">❤️</span>}
                                      <span className={`mastery-pill ${badgeClass}`}>{badgeText}</span>
                                      {!selectionMode && (
                                          <button 
                                              className="row-edit-btn" 
                                              onClick={(e) => handleOpenEdit(e, word)}
                                              title="Edit Word Data"
                                          >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                          </button>
                                      )}
                                  </div>
                              </div>
                              <p className="word-snippet">{cache ? cache.definition : 'AI details loading...'}</p>
                              
                              <div className="mastery-progress-bar">
                                  {[1, 2, 3, 4, 5].map(step => (
                                      <div 
                                          key={step} 
                                          className={`progress-dot ${mastery >= step ? 'filled' : ''} ${mastery >= 5 ? 'mastered' : ''}`}
                                      />
                                  ))}
                              </div>
                          </div>

                          {!selectionMode && (
                              <div className="arrow-icon">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                              </div>
                          )}
                      </div>
                  );
              })
          )
        ) : (
          /* Grouped Family View Render */
          familyGroups.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🧭</div>
              <p>No families found. Details are loaded once words are cached via AI.</p>
            </div>
          ) : (
            familyGroups.map(group => {
              const headerText = group.savedMembers.join(', ');
              return (
                <div key={group.id} className="family-entry compact" onClick={() => setSelectedFamilyGroup(group)}>
                  <div className="family-header">
                    <div className="family-title-group">
                      <span className="family-icon">🌿</span>
                      <span className="family-name">{headerText}</span>
                    </div>
                    <svg className="chevron-right" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Family Detail Modal */}
      {selectedFamilyGroup && (
        <div className="auth-overlay" onClick={() => setSelectedFamilyGroup(null)}>
          <div className="auth-container family-modal" onClick={e => e.stopPropagation()}>
            <div className="auth-header">
              <div className="header-info-group">
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Word Family</h3>
              </div>
              <button onClick={() => setSelectedFamilyGroup(null)} className="close-button-cross">
                 <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="family-modal-content">
              <div className="family-members-grid">
                {selectedFamilyGroup.allMembers.map(m => {
                  const capitalizedWord = capitalize(m.word);
                  const isSaved = savedWords.includes(capitalizedWord);
                  const cache = cardCache[capitalizedWord];
                  return (
                    <div 
                      key={m.word} 
                      className={`family-member-card ${isSaved ? 'saved' : ''}`}
                      onClick={() => isSaved && onNavigate(capitalizedWord, true)}
                    >
                      <div className="member-main-info">
                        <span className="member-word">{capitalizedWord}</span>
                        {m.pos && <span className="member-pos">({m.pos})</span>}
                        {isSaved && <span className="saved-badge">LIBRARY</span>}
                      </div>
                      {isSaved && cache?.definition && (
                        <p className="member-snippet-oneline">
                          {cache.definition}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingWord && (
          <EditWordModal 
            word={editingWord}
            initialData={cardCache[editingWord] || {} as CardData}
            onClose={() => setEditingWord(null)}
            onSave={(oldWord, newWord, newData) => {
                onUpdateWordData(oldWord, newWord, newData);
                setEditingWord(null);
            }}
          />
      )}

      {lastTrashed && (
          <div className="modern-snackbar">
              <span className="snackbar-msg">Deleted {lastTrashed.length} {lastTrashed.length === 1 ? 'word' : 'words'}</span>
              <button className="snackbar-undo" onClick={handleUndoTrash}>UNDO</button>
          </div>
      )}

      <style>{`
        .list-tabs-container { display: flex; align-items: center; gap: 12px; margin-bottom: 1.2rem; padding: 0 4px; }
        .list-tabs { flex: 1; display: flex; gap: 6px; background: var(--accent-secondary); padding: 5px; border-radius: 16px; }
        .list-tabs button { flex: 1; padding: 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .list-tabs button.active { background: var(--card-bg); color: var(--accent-primary); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.1); }
        .list-tabs button.active.fav { color: #ff2d55; }
        
        .view-toggle-btn { width: 44px; height: 44px; border-radius: 14px; background: var(--accent-secondary); color: var(--accent-primary); border: 1.5px solid var(--border-color); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .view-toggle-btn.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

        .filter-sort-bar { margin: 0 4px 1.5rem 4px; display: flex; flex-direction: column; gap: 14px; }
        .sort-toggles { display: flex; gap: 10px; }
        .sort-toggles button { font-size: 0.65rem; font-weight: 800; padding: 10px 16px; border-radius: 12px; background: var(--card-bg); color: var(--text-secondary); border: 1px solid var(--border-color); letter-spacing: 0.5px; }
        .sort-toggles button.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.2); }
        
        .filter-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .filter-chips::-webkit-scrollbar { display: none; }
        .chip { white-space: nowrap; font-size: 0.65rem; font-weight: 800; padding: 8px 18px; border-radius: 20px; border: 1.5px solid var(--border-color); color: var(--text-muted); background: transparent; transition: all 0.2s; }
        .chip.active { background: var(--text-primary); color: var(--bg-color); border-color: var(--text-primary); }

        .words-scroll-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 0 4px; }
        
        .family-entry { 
          background: var(--card-bg); 
          border-radius: 20px; 
          border: 1px solid var(--border-color); 
          cursor: pointer; 
          transition: all 0.2s;
        }
        .family-entry:active { transform: scale(0.98); background: var(--accent-secondary); }
        .family-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; }
        .family-title-group { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .family-icon { font-size: 1.2rem; flex-shrink: 0; }
        .family-name { 
          font-weight: 800; 
          font-size: 1rem; 
          color: var(--text-primary); 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          letter-spacing: -0.2px;
        }
        .chevron-right { color: var(--text-muted); opacity: 0.5; }

        .family-modal { max-width: 440px; width: 92%; padding: 1.5rem; max-height: 85vh; display: flex; flex-direction: column; }
        .family-modal-content { overflow-y: auto; padding-top: 0.5rem; }
        .family-members-grid { display: flex; flex-direction: column; gap: 12px; }
        .family-member-card { 
          padding: 1.15rem; 
          background: var(--bg-color); 
          border-radius: 20px; 
          display: flex; 
          flex-direction: column;
          gap: 6px;
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }
        .family-member-card.saved { 
          background: var(--card-bg);
          border-color: var(--accent-primary); 
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(88, 86, 214, 0.05);
        }
        .family-member-card.saved:active { transform: scale(0.98); background: var(--accent-secondary); }
        
        .member-main-info { display: flex; align-items: center; gap: 8px; }
        .member-word { font-weight: 800; color: var(--text-primary); font-size: 1.1rem; }
        .member-pos { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }
        .saved-badge { 
          margin-left: auto; 
          font-size: 0.6rem; 
          font-weight: 900; 
          background: var(--accent-primary); 
          color: white; 
          padding: 3px 8px; 
          border-radius: 6px;
          letter-spacing: 0.5px;
        }
        
        .member-snippet-oneline {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
            opacity: 0.9;
        }

        .modern-word-card { 
            background: var(--card-bg); 
            border-radius: 20px; 
            padding: 1.25rem; 
            display: flex; 
            align-items: center; 
            gap: 1rem;
            border: 1px solid var(--border-color);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            cursor: pointer;
        }
        .modern-word-card:active { transform: scale(0.98); background: var(--bg-color); }
        .modern-word-card.selected { background: var(--accent-secondary); border-color: var(--accent-primary); }
        
        .card-info { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .card-top-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .word-title { font-size: 1.15rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; }
        
        .card-indicators { display: flex; align-items: center; gap: 6px; }
        .fav-indicator { font-size: 0.8rem; }
        
        .row-edit-btn {
            background: var(--accent-secondary);
            color: var(--accent-primary);
            padding: 4px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
            transition: all 0.2s;
        }
        .row-edit-btn:hover { opacity: 1; transform: translateY(-1px); }

        .mastery-pill { 
            font-size: 0.6rem; 
            padding: 3px 8px; 
            border-radius: 6px; 
            font-weight: 800; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .mastery-pill.new { background: var(--accent-secondary); color: var(--accent-primary); }
        .mastery-pill.learning { background: rgba(255, 193, 7, 0.1); color: #f57f17; }
        .mastery-pill.mastered { background: rgba(0, 200, 83, 0.1); color: #2e7d32; }
        
        .word-snippet { 
            font-size: 0.8rem; 
            color: var(--text-secondary); 
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin: 2px 0 6px 0;
        }
        
        .mastery-progress-bar { display: flex; gap: 4px; margin-top: 4px; }
        .progress-dot { width: 14px; height: 4px; border-radius: 2px; background: var(--border-color); transition: all 0.3s; }
        .progress-dot.filled { background: var(--accent-primary); }
        .progress-dot.mastered { background: var(--success-color); }
        
        .arrow-icon { color: var(--text-muted); opacity: 0.5; }

        .selection-bar { position: fixed; top: 0; left: 0; width: 100%; height: 70px; background: var(--accent-primary); color: white; z-index: 1000; display: flex; align-items: center; padding: 0 1.2rem; gap: 1rem; box-shadow: 0 8px 30px rgba(88, 86, 214, 0.3); animation: slideDown 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        
        .icon-btn-selection { color: white; background: rgba(255,255,255,0.2); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .icon-btn-selection.danger-fill { background: #ff3b30; }
        .selection-bar .text-action { font-size: 0.7rem; font-weight: 800; color: white; letter-spacing: 1px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.1); }

        .checkbox { width: 24px; height: 24px; border-radius: 8px; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .checkbox.checked { background: var(--accent-primary); border-color: var(--accent-primary); color: white; }

        .modern-snackbar { position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%); background: #1c1c1e; color: white; padding: 16px 24px; border-radius: 20px; display: flex; align-items: center; gap: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 2000; min-width: 300px; animation: snackUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); border: 1px solid rgba(255,255,255,0.1); }
        .snackbar-msg { font-size: 0.85rem; font-weight: 600; flex: 1; }
        .snackbar-undo { color: var(--accent-primary); font-weight: 800; font-size: 0.8rem; letter-spacing: 1px; padding: 4px 8px; }
        @keyframes snackUp { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

        .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
        .empty-state .icon { font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.5; }
        .empty-state p { font-size: 1rem; font-weight: 500; }
      `}</style>
    </div>
  );
};

export default SavedWordsList;
