
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

interface FamilyMember {
    word: string;
    pos: string;
}

interface FamilyGroup {
  id: string; // The root representative from Union-Find
  displayTitle: string; // "Word1 (pos), Word2 (pos)..."
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
  const [isFamilyView, setIsFamilyView] = useState(false);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<number | null>(null);

  const [editingWord, setEditingWord] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<FamilyGroup | null>(null);

  const [lastTrashed, setLastTrashed] = useState<string[] | null>(null);
  const undoTimeout = useRef<number | null>(null);

  const baseList = activeTab === 'all' ? savedWords : favoriteWords;

  const parseFamilyMember = (memberStr: string): FamilyMember => {
      const match = memberStr.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) return { word: capitalize(match[1].trim()), pos: match[2].trim() };
      return { word: capitalize(memberStr.trim()), pos: '' };
  };

  const groupedFamilies = useMemo(() => {
    if (!isFamilyView) return [];

    // Union-Find / Disjoint Set Union (DSU) to group words effectively
    const parent: Record<string, string> = {};
    const find = (i: string): string => {
        if (!parent[i]) parent[i] = i;
        if (parent[i] === i) return i;
        return parent[i] = find(parent[i]);
    };
    const union = (i: string, j: string) => {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    // Word metadata aggregation
    const allKnownMembers = new Map<string, FamilyMember>();
    const savedByRoot = new Map<string, Set<string>>();

    // Pass 1: Union everything based on family strings
    baseList.forEach(savedWord => {
        const cache = cardCache[savedWord];
        const lowerSaved = savedWord.toLowerCase();
        
        // Ensure the word itself is in the system
        allKnownMembers.set(lowerSaved, { word: savedWord, pos: cache?.pos || '' });

        const familyStr = cache?.family;
        if (familyStr && familyStr !== 'N/A') {
            const memberObjs = familyStr.split(',').map(s => parseFamilyMember(s));
            memberObjs.forEach(m => {
                const lowerM = m.word.toLowerCase();
                // Store metadata for display
                if (!allKnownMembers.has(lowerM) || (m.pos && !allKnownMembers.get(lowerM)!.pos)) {
                    allKnownMembers.set(lowerM, m);
                }
                // Link them
                union(lowerSaved, lowerM);
            });
        }
    });

    // Pass 2: Collect members into groups
    const groupsMap = new Map<string, FamilyGroup>();

    baseList.forEach(savedWord => {
        const root = find(savedWord.toLowerCase());
        if (!groupsMap.has(root)) {
            groupsMap.set(root, {
                id: root,
                displayTitle: '',
                savedMembers: [],
                allMembers: []
            });
        }
        groupsMap.get(root)!.savedMembers.push(savedWord);
    });

    // Pass 3: Resolve all members for each group (including unsaved ones mentioned in family strings)
    // We iterate through allKnownMembers and attach them to their root
    allKnownMembers.forEach((meta, lowerWord) => {
        const root = find(lowerWord);
        const group = groupsMap.get(root);
        if (group) {
            // Check if this member is already in allMembers to avoid duplicates
            if (!group.allMembers.some(m => m.word.toLowerCase() === lowerWord)) {
                group.allMembers.push(meta);
            }
        }
    });

    const result = Array.from(groupsMap.values());

    // Step 4: Finalize Display Title and Sorting
    result.forEach(group => {
        const savedSet = new Set(group.savedMembers);
        
        // Sort all members: Saved ones first, then alphabetical
        group.allMembers.sort((a, b) => {
            const aIsSaved = savedSet.has(a.word);
            const bIsSaved = savedSet.has(b.word);
            if (aIsSaved && !bIsSaved) return -1;
            if (!aIsSaved && bIsSaved) return 1;
            return a.word.localeCompare(b.word);
        });

        group.displayTitle = group.allMembers
            .map(m => `${m.word}${m.pos ? ` (${m.pos})` : ''}`)
            .join(', ');
    });

    // Step 5: Sort the list of family entries
    result.sort((a, b) => {
        if (sortBy === 'alpha') {
            return sortOrder === 'asc' 
                ? a.displayTitle.localeCompare(b.displayTitle) 
                : b.displayTitle.localeCompare(a.displayTitle);
        } else {
            const timeA = Math.max(...a.savedMembers.map(w => savedWords.indexOf(w)));
            const timeB = Math.max(...b.savedMembers.map(w => savedWords.indexOf(w)));
            return sortOrder === 'asc' ? timeB - timeA : timeA - timeB;
        }
    });

    return result;
  }, [baseList, isFamilyView, cardCache, sortBy, sortOrder, savedWords]);

  const filteredAndSortedList = useMemo(() => {
    if (isFamilyView) return [];
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
  }, [baseList, sortBy, sortOrder, filter, srsData, savedWords, isFamilyView]);

  const toggleSelection = (word: string) => {
    if (isFamilyView) return;
    const next = new Set(selectedWords);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setSelectedWords(next);
    if (next.size === 0) setSelectionMode(false);
  };

  const startLongPress = (word: string, e: React.PointerEvent) => {
    if (selectionMode || isFamilyView) return;
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
    if (selectionMode) toggleSelection(word);
    else onNavigate(word, true);
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
              
              <button 
                className={`family-view-toggle ${isFamilyView ? 'active' : ''}`}
                onClick={() => {
                    setIsFamilyView(!isFamilyView);
                    setSelectionMode(false);
                    setSelectedWords(new Set());
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 2-2 4 4 3-5"></path><path d="M11 20h10"></path><path d="m3 6 2-2 4 4 3-5"></path><path d="M11 10h10"></path></svg>
                {isFamilyView ? 'ROOTS ON' : 'ROOTS'}
              </button>
          </div>
          {!isFamilyView && (
              <div className="filter-chips">
                  {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(f => (
                      <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
                  ))}
              </div>
          )}
      </div>
      
      <div className="words-scroll-list">
        {isFamilyView ? (
            groupedFamilies.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">🌱</div>
                    <p>No word families detected yet.</p>
                </div>
            ) : (
                groupedFamilies.map(group => (
                    <div 
                      key={group.id} 
                      className="modern-word-card family-card"
                      onClick={() => setSelectedFamily(group)}
                    >
                        <div className="card-info">
                            <div className="card-top-row">
                                <span className="word-title family-main-title">{group.displayTitle}</span>
                                <div className="card-indicators">
                                    <span className="mastery-pill family-count">{group.savedMembers.length} SAVED</span>
                                </div>
                            </div>
                        </div>
                        <div className="arrow-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                    </div>
                ))
            )
        ) : (
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
        )}
      </div>

      {selectedFamily && (
          <div className="auth-overlay" onClick={() => setSelectedFamily(null)}>
              <div className="family-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <div className="header-text">
                        <span className="header-emoji">🌳</span>
                        <span>Family Details</span>
                      </div>
                      <button className="close-x-btn" onClick={() => setSelectedFamily(null)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                  <div className="modal-scroll-area">
                      <p className="modal-hint">All related forms for this word family.</p>
                      <div className="family-member-list">
                          {selectedFamily.allMembers.map(m => {
                              const capitalizedWord = capitalize(m.word);
                              const isSaved = savedWords.includes(capitalizedWord);
                              const item = srsData[capitalizedWord];
                              const cache = cardCache[capitalizedWord];
                              const mastery = item?.masteryLevel || 0;

                              return (
                                  <div 
                                    key={`${m.word}-${m.pos}`} 
                                    className={`member-row ${isSaved ? 'is-saved' : ''}`}
                                    onClick={() => onNavigate(capitalizedWord, true)}
                                  >
                                      <div className="member-main">
                                          <div className="member-name-row">
                                              <span className="member-name">{capitalizedWord}</span>
                                              {m.pos && <span className="member-pos">({m.pos})</span>}
                                              {isSaved && <span className="member-saved-badge">LIBRARY</span>}
                                          </div>
                                          {isSaved && (
                                              <p className="member-def">{cache?.definition || 'View details...'}</p>
                                          )}
                                      </div>
                                      {isSaved && (
                                          <div className="member-mastery">
                                              <div className={`mastery-dot ${mastery >= 5 ? 'mastered' : (mastery > 0 ? 'learning' : 'new')}`} />
                                          </div>
                                      )}
                                      <div className="member-arrow">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                      </div>
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
        
        .filter-sort-bar { margin: 0 4px 1.5rem 4px; display: flex; flex-direction: column; gap: 14px; }
        .sort-toggles { display: flex; gap: 10px; flex-wrap: wrap; }
        .sort-toggles button { font-size: 0.65rem; font-weight: 800; padding: 10px 16px; border-radius: 12px; background: var(--card-bg); color: var(--text-secondary); border: 1px solid var(--border-color); letter-spacing: 0.5px; }
        .sort-toggles button.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.2); }
        
        .family-view-toggle {
            display: flex; align-items: center; gap: 6px;
            background: var(--accent-secondary) !important;
            color: var(--accent-primary) !important;
            border-color: var(--accent-primary) !important;
        }
        .family-view-toggle.active {
            background: var(--accent-primary) !important;
            color: white !important;
        }

        .filter-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .filter-chips::-webkit-scrollbar { display: none; }
        .chip { white-space: nowrap; font-size: 0.65rem; font-weight: 800; padding: 8px 18px; border-radius: 20px; border: 1.5px solid var(--border-color); color: var(--text-muted); background: transparent; transition: all 0.2s; }
        .chip.active { background: var(--text-primary); color: var(--bg-color); border-color: var(--text-primary); }

        .words-scroll-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 0 4px; }
        
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
        .modern-word-card.family-card { border-left: 4px solid var(--accent-primary); }

        .card-info { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .card-top-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .word-title { font-size: 1.15rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; }
        .family-main-title {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 1rem;
            line-height: 1.3;
        }
        
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
        .mastery-pill.family-count { background: var(--accent-primary); color: white; white-space: nowrap; }
        
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

        .family-modal {
            width: 95%; max-width: 420px;
            background: var(--card-bg); border-radius: 28px;
            display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            animation: familyModalUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes familyModalUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .family-modal .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .family-modal .modal-scroll-area { padding: 1.25rem; flex: 1; overflow-y: auto; max-height: 60vh; }
        .modal-hint { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.25rem; font-weight: 600; }
        
        .family-member-list { display: flex; flex-direction: column; gap: 10px; }
        .member-row {
            padding: 1rem; border-radius: 16px; background: var(--bg-color); border: 1px solid var(--border-color);
            display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s;
        }
        .member-row:active { transform: scale(0.98); background: var(--accent-secondary); }
        .member-row.is-saved { background: var(--card-bg); border-color: var(--accent-primary); }
        
        .member-main { flex: 1; min-width: 0; }
        .member-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .member-name { font-weight: 800; font-size: 1rem; color: var(--text-primary); }
        .member-pos { font-size: 0.7rem; color: var(--accent-primary); font-weight: 700; opacity: 0.7; }
        .member-saved-badge { font-size: 0.6rem; font-weight: 900; color: white; background: var(--accent-primary); padding: 2px 6px; border-radius: 4px; }
        .member-def { font-size: 0.75rem; color: var(--text-secondary); margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .member-mastery { width: 10px; height: 10px; }
        .mastery-dot { width: 8px; height: 8px; border-radius: 50%; }
        .mastery-dot.new { background: var(--accent-secondary); }
        .mastery-dot.learning { background: #ffc107; }
        .mastery-dot.mastered { background: var(--success-color); }
        
        .member-arrow { color: var(--text-muted); opacity: 0.4; }

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
