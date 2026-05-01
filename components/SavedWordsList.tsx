
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SRSItem } from '../services/srsService';
import { CardData, capitalize } from '../services/dictionaryService';
import { Label } from '../App';

interface SavedWordsListProps {
  savedWords: string[];
  favoriteWords: string[];
  archivedWords: string[];
  trashedWords: string[];
  srsData: Record<string, SRSItem>;
  cardCache: Record<string, CardData>;
  onNavigate: (word: string, initialFlipped?: boolean) => void;
  onDeleteMultiple: (words: string[]) => void;
  onArchiveMultiple: (words: string[]) => void;
  onRestoreFromArchive: (words: string[]) => void;
  onRestoreFromTrash: (words: string[]) => void;
  onPermanentDelete: (words: string[]) => void;
  onOpenImport: () => void;
  onUpdateWordData: (oldWord: string, newWord: string, newData: CardData) => void;
  onEditWords: (words: string[]) => void;
  isOnline: boolean;
  labels: Label[];
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  wordLabels: Record<string, string[]>;
  setWordLabels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  activeLabelFilters: string[];
  setActiveLabelFilters: React.Dispatch<React.SetStateAction<string[]>>;
  labelFilterLogic: 'AND' | 'OR';
  setLabelFilterLogic: React.Dispatch<React.SetStateAction<'AND' | 'OR'>>;
  isLabelManagerOpen: boolean;
  setIsLabelManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

type SortType = 'alpha' | 'time' | 'smart';
type SortOrder = 'asc' | 'desc';
type MasteryFilter = 'all' | 'new' | 'learning' | 'mastered';

const SavedWordsList: React.FC<SavedWordsListProps> = ({ 
    savedWords, favoriteWords, archivedWords, trashedWords, srsData, cardCache, onNavigate, onDeleteMultiple, onArchiveMultiple, onRestoreFromArchive, onRestoreFromTrash, onPermanentDelete, onOpenImport, onUpdateWordData, onEditWords,
    isOnline,
    labels, setLabels, wordLabels, setWordLabels, activeLabelFilters, setActiveLabelFilters, labelFilterLogic, setLabelFilterLogic,
    isLabelManagerOpen, setIsLabelManagerOpen
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<SortType>(() => localStorage.getItem('lexiflow_sortBy') as SortType || 'time');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => localStorage.getItem('lexiflow_sortOrder') as SortOrder || 'desc');

  useEffect(() => {
    localStorage.setItem('lexiflow_sortBy', sortBy);
    localStorage.setItem('lexiflow_sortOrder', sortOrder);
  }, [sortBy, sortOrder]);
  const [filter, setFilter] = useState<MasteryFilter>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<number | null>(null);

  const [isBulkLabelingOpen, setIsBulkLabelingOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#5856D6');

  const [isLabelFilterVisible, setIsLabelFilterVisible] = useState(false);

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;
    const newLabel: Label = { id: Date.now().toString(), name: newLabelName.trim(), color: newLabelColor };
    setLabels(prev => [...prev, newLabel]);
    setNewLabelName('');
  };

  const handleToggleLabelFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveLabelFilters(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkLabel = (labelId: string, action: 'add' | 'remove') => {
    setWordLabels(prev => {
        const next = { ...prev };
        selectedWords.forEach(word => {
            const current = next[word] || [];
            if (action === 'add' && !current.includes(labelId)) {
                next[word] = [...current, labelId];
            } else if (action === 'remove') {
                next[word] = current.filter(id => id !== labelId);
            }
        });
        return next;
    });
  };

  const baseList = activeTab === 'all' ? savedWords : favoriteWords;

  const parseSafeList = (val: any): string[] => {
    if (!val || val === 'N/A' || val === 'None') return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val !== 'string') return [String(val).trim()];
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  const filteredAndSortedList = useMemo(() => {
    let list = [...baseList];
    
    // Label filter
    if (activeLabelFilters.length > 0) {
        list = list.filter(word => {
            const currentLabels = wordLabels[word] || [];
            if (labelFilterLogic === 'OR') {
                return activeLabelFilters.some(id => currentLabels.includes(id));
            } else {
                return activeLabelFilters.every(id => currentLabels.includes(id));
            }
        });
    }

    if (filter !== 'all') {
        list = list.filter(word => {
            const item = srsData[word];
            const mastery = item?.masteryLevel || 0;
            const revCount = item?.reviewCount || 0;
            if (filter === 'new') return revCount === 0;
            if (filter === 'learning') return revCount > 0 && mastery < 5;
            if (filter === 'mastered') return mastery >= 5;
            return true;
        });
    }
    list.sort((a, b) => {
        if (sortBy === 'alpha') {
            const res = a.localeCompare(b);
            return sortOrder === 'asc' ? res : -res;
        } else if (sortBy === 'time') {
            // Newest at index 0 (prepended in App.tsx)
            // 'asc' -> Oldest First (Highest index first)
            // 'desc' -> Newest First (Lowest index first)
            const idxA = savedWords.indexOf(a);
            const idxB = savedWords.indexOf(b);
            return sortOrder === 'asc' ? idxB - idxA : idxA - idxB;
        } else {
            // Smart Sort: Prioritize recently added/interacted, then due words, then mastery level
            const itemA = srsData[a];
            const itemB = srsData[b];
            
            const timeA = itemA?.lastInteractedAt || (Date.now() - (savedWords.indexOf(a) * 1000));
            const timeB = itemB?.lastInteractedAt || (Date.now() - (savedWords.indexOf(b) * 1000));
            
            // Primary priority: Recency (if timestamps differ significantly, or by default)
            if (Math.abs(timeA - timeB) > 100) { // More than 100ms difference
                const timeRes = timeB - timeA;
                return sortOrder === 'asc' ? -timeRes : timeRes;
            }

            const now = Date.now();
            const isDueA = !itemA || itemA.nextReview <= now ? 1 : 0;
            const isDueB = !itemB || itemB.nextReview <= now ? 1 : 0;
            
            if (isDueA !== isDueB) return isDueB - isDueA;
            
            // Lower mastery first (needs more practice)
            const masteryA = itemA?.masteryLevel || 0;
            const masteryB = itemB?.masteryLevel || 0;
            return masteryA - masteryB;
        }
    });
    return list;
  }, [baseList, sortBy, sortOrder, filter, srsData, savedWords, activeLabelFilters, wordLabels, labelFilterLogic]);



  const getMasteryColor = (word: string) => {
      const item = srsData[word];
      if (item?.masteryLevel >= 5) return 'var(--success-color)';
      if (item?.reviewCount > 0) return 'var(--gold-color)';
      return 'var(--accent-primary)';
  };

  const getMasteryLabel = (word: string) => {
      const item = srsData[word];
      if (item?.masteryLevel >= 5) return { text: 'MASTERED', class: 'mastered' };
      if (item?.reviewCount > 0) return { text: 'LEARNING', class: 'learning' };
      return { text: 'NEW', class: 'new' };
  };

  const toggleSelection = (word: string) => {
    const next = new Set(selectedWords);
    if (next.has(word)) next.delete(word); else next.add(word);
    setSelectedWords(next);
    if (next.size === 0) setSelectionMode(false);
  };

  const handleItemClick = (word: string) => {
    if (selectionMode) { toggleSelection(word); } else { onNavigate(word, true); }
  };

  const toggleExpand = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWords(prev => (prev.has(word) ? new Set() : new Set([word])));
  };

  const startLongPress = (word: string, e: React.PointerEvent) => {
    if (selectionMode) return;
    longPressTimer.current = window.setTimeout(() => {
        setSelectionMode(true);
        toggleSelection(word);
        if ('vibrate' in navigator) navigator.vibrate(50);
    }, 1000); // Trigger after 1s to prevent scroll accidents
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  return (
    <div className="saved-list-view">
      {selectionMode && (
          <div className="selection-bar">
              <button className="icon-btn-selection" onClick={() => { setSelectionMode(false); setSelectedWords(new Set()); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <div className="selection-count">{selectedWords.size} Selected</div>
              <div className="selection-actions-group">
                <button className="text-action" onClick={() => {
                    if (selectedWords.size === filteredAndSortedList.length) setSelectedWords(new Set());
                    else setSelectedWords(new Set(filteredAndSortedList));
                }}>
                    {selectedWords.size === filteredAndSortedList.length ? 'NONE' : 'ALL'}
                </button>
                <button 
                  className="icon-btn-selection tag-circle" 
                  onClick={() => setIsBulkLabelingOpen(true)}
                  title="Assign Labels"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </button>
                <button 
                  className="icon-btn-selection edit-circle" 
                  onClick={() => { 
                    onEditWords(Array.from(selectedWords));
                    setSelectionMode(false); 
                    setSelectedWords(new Set()); 
                  }}
                  title="Edit Selected"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="icon-btn-selection trash-circle" onClick={() => { if(confirm(`Delete ${selectedWords.size} words?`)) { onDeleteMultiple(Array.from(selectedWords)); setSelectionMode(false); setSelectedWords(new Set()); } }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <button 
                  className="icon-btn-selection archive-circle" 
                  onClick={() => { 
                    onArchiveMultiple(Array.from(selectedWords));
                    setSelectionMode(false); 
                    setSelectedWords(new Set()); 
                  }}
                  title="Archive"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
              </div>
          </div>
      )}

      <div className="list-tabs-container">
          <div className="list-tabs">
              <button onClick={() => setActiveTab('all')} className={activeTab === 'all' ? 'active' : ''}>
                  LIBRARY ({savedWords.length})
              </button>
              <button onClick={() => setActiveTab('favorites')} className={activeTab === 'favorites' ? 'active fav' : ''}>
                  FAVOURITE ({favoriteWords.length})
              </button>
          </div>
      </div>

      <div className="filter-sort-bar">
          <div className="sort-filter-main-row">
            <div className="sort-toggles">
                <button className={sortBy === 'smart' ? 'active' : ''} onClick={() => { if (sortBy === 'smart') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('smart'); setSortOrder('desc'); } }}>
                    SMART {sortBy === 'smart' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button className={sortBy === 'time' ? 'active' : ''} onClick={() => { if (sortBy === 'time') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('time'); setSortOrder('desc'); } }}>
                    RECENT {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button className={sortBy === 'alpha' ? 'active' : ''} onClick={() => { if (sortBy === 'alpha') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('alpha'); setSortOrder('asc'); } }}>
                    A-Z {sortBy === 'alpha' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
            </div>
            <button 
                className={`icon-btn filter-toggle-btn ${isLabelFilterVisible ? 'active' : ''} ${activeLabelFilters.length > 0 ? 'filtering' : ''}`} 
                onClick={() => setIsLabelFilterVisible(!isLabelFilterVisible)} 
                title="Toggle Label Filters"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </button>
          </div>

          {labels.length > 0 && isLabelFilterVisible && (
            <div className="labels-filter-container slide-down">
              <div className="labels-header-row">
                <span className="section-label">FILTER BY LABELS</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                        className="icon-btn-minimal" 
                        onClick={() => setIsLabelManagerOpen(true)} 
                        title="Manage Categories"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    </button>
                    <button 
                        className={`logic-toggle ${labelFilterLogic === 'AND' ? 'and' : 'or'}`}
                        onClick={() => setLabelFilterLogic(prev => prev === 'AND' ? 'OR' : 'AND')}
                    >
                        {labelFilterLogic}
                    </button>
                </div>
              </div>
              <div className="labels-horizontal-scroll">
                  {labels.map(label => {
                      const isActive = activeLabelFilters.includes(label.id);
                      return (
                          <button 
                            key={label.id} 
                            className={`label-filter-chip ${isActive ? 'active' : ''}`}
                            onClick={(e) => handleToggleLabelFilter(label.id, e)}
                            style={{ '--label-color': label.color } as any}
                          >
                              <span className="dot" style={{ backgroundColor: label.color }}></span>
                              {label.name}
                          </button>
                      );
                  })}
                  {activeLabelFilters.length > 0 && (
                      <button className="clear-labels-btn" onClick={() => setActiveLabelFilters([])}>CLEAR ALL</button>
                  )}
              </div>
            </div>
          )}
          
          <div className="filter-chips">
              {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(f => (
                  <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
              ))}
          </div>
      </div>

      


      <div className="words-scroll-list">
        {filteredAndSortedList.length === 0 ? (
              <div className="empty-state"><div className="icon">📚</div><p>Your library is empty.</p></div>
          ) : (
              filteredAndSortedList.map(word => {
                  const mastery = getMasteryLabel(word);
                  const masteryLevel = srsData[word]?.masteryLevel || 0;
                  const isExpanded = expandedWords.has(word);
                  return (
                    <div 
                        key={word} 
                        className={`modern-word-card ${selectedWords.has(word) ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`} 
                        onClick={() => handleItemClick(word)} 
                        onPointerDown={(e) => startLongPress(word, e)}
                        onPointerUp={cancelLongPress}
                        onPointerMove={cancelLongPress}
                    >
                        <div className="card-info">
                            <div className="card-top-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                    <span className="word-title">{capitalize(word)}</span>
                                    <div className="card-labels-dots-inline">
                                        {(wordLabels[word] || []).map(labelId => {
                                            const label = labels.find(l => l.id === labelId);
                                            if (!label) return null;
                                            return <div key={labelId} className="label-dot-small" style={{ backgroundColor: label.color }} title={label.name} />;
                                        })}
                                    </div>
                                </div>
                                <div className="card-indicators">
                                    {favoriteWords.includes(word) && <span className="fav-indicator">❤️</span>}
                                    <span className={`mastery-pill ${mastery.class}`}>{mastery.text}</span>
                                </div>
                            </div>
                            <p className="word-snippet">{cardCache[word]?.definition || 'No definition cached...'}</p>
                            
                            {isExpanded && (wordLabels[word] || []).length > 0 && (
                                <div className="expanded-labels-list">
                                    {(wordLabels[word] || []).map(labelId => {
                                        const label = labels.find(l => l.id === labelId);
                                        if (!label) return null;
                                        return (
                                            <span key={labelId} className="expanded-label-pill" style={{ '--label-color': label.color } as any}>
                                                {label.name}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mastery-progress-dashes">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`dash ${i < masteryLevel ? 'filled' : ''}`} />
                                ))}
                            </div>
                        </div>
                        <button className={`expand-action-btn ${isExpanded ? 'active' : ''}`} onClick={(e) => toggleExpand(word, e)}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    </div>
                  );
              })
          )}
      </div>

      {/* Label Manager Modal */}
      {isLabelManagerOpen && (
        <div className="auth-overlay" onClick={() => setIsLabelManagerOpen(false)}>
            <div className="auth-container label-manager-modal" onClick={e => e.stopPropagation()}>
                <div className="auth-header">
                    <div className="header-info-group">
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 900 }}>Manage Labels</h3>
                        <span className="subtitle">Create and organize your custom categories</span>
                    </div>
                    <button onClick={() => setIsLabelManagerOpen(false)} className="close-button-cross"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                <div className="label-manager-content">
                    <div className="add-label-row">
                        <input 
                            type="text" 
                            className="label-input" 
                            placeholder="New Label Name..." 
                            value={newLabelName}
                            onChange={e => setNewLabelName(e.target.value)}
                        />
                        <input 
                            type="color" 
                            className="label-color-picker" 
                            value={newLabelColor}
                            onChange={e => setNewLabelColor(e.target.value)}
                        />
                        <button className="add-label-btn" onClick={handleAddLabel}>ADD</button>
                    </div>

                    <div className="labels-list-admin">
                        {labels.length === 0 ? (
                            <p className="empty-labels-hint">No labels created yet. Add one above to start organizing!</p>
                        ) : (
                            labels.map(label => (
                                <div key={label.id} className="label-admin-item">
                                    <div className="label-admin-info">
                                        <input 
                                            type="color" 
                                            className="label-inline-picker" 
                                            value={label.color}
                                            onChange={e => {
                                                const newColor = e.target.value;
                                                setLabels(prev => prev.map(l => l.id === label.id ? { ...l, color: newColor } : l));
                                            }}
                                        />
                                        <span className="label-admin-name">{label.name}</span>
                                    </div>
                                    <button className="delete-label-btn" onClick={() => {
                                        if(confirm(`Delete label "${label.name}"? It will be removed from all words.`)) {
                                            setLabels(prev => prev.filter(l => l.id !== label.id));
                                            setActiveLabelFilters(prev => prev.filter(id => id !== label.id));
                                            setWordLabels(prev => {
                                                const next = { ...prev };
                                                Object.keys(next).forEach(w => {
                                                    next[w] = next[w].filter(id => id !== label.id);
                                                });
                                                return next;
                                            });
                                        }
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Bulk Labeling Modal */}
      {isBulkLabelingOpen && (
                <div className="auth-overlay" onClick={() => setIsBulkLabelingOpen(false)}>
                <div className="auth-container label-manager-modal" onClick={e => e.stopPropagation()}>
                    <div className="auth-header">
                        <div className="header-info-group">
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 900 }}>Bulk Labeling</h3>
                            <span className="subtitle">Assign labels to {selectedWords.size} words</span>
                        </div>
                        <button onClick={() => setIsBulkLabelingOpen(false)} className="close-button-cross"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                    <div className="label-manager-content">
                        <div className="bulk-labels-grid">
                            {labels.map(label => {
                                const selectedArray = Array.from(selectedWords);
                                const count = selectedArray.filter((w: string) => wordLabels[w]?.includes(label.id)).length;
                                const isAll = count === selectedWords.size;
                                const isSome = count > 0 && count < selectedWords.size;

                                return (
                                    <div key={label.id} className={`bulk-label-item ${isAll ? 'complete' : isSome ? 'partial' : ''}`} onClick={() => handleBulkLabel(label.id, isAll ? 'remove' : 'add')}>
                                        <div className="swatch-check">
                                            <div className="label-swatch" style={{ backgroundColor: label.color }}>
                                                {isAll && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                {isSome && <div className="partial-dot" />}
                                            </div>
                                        </div>
                                        <div className="bulk-label-info">
                                            <span className="bulk-label-name">{label.name}</span>
                                            <span className="bulk-label-count">{count}/{selectedWords.size} tagged</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="finish-bulk-btn" onClick={() => { setIsBulkLabelingOpen(false); setSelectionMode(false); setSelectedWords(new Set()); }}>FINISH</button>
                    </div>
                </div>
            </div>
      )}



      {/* Edit modal is now handled by App.tsx level */}

      <style>{`
        /* SELECTION BAR STYLES */
        .selection-bar {
            position: sticky;
            top: 0.5rem;
            left: 0.5rem;
            right: 0.5rem;
            z-index: 500;
            background: var(--accent-primary);
            color: white;
            padding: 6px 10px;
            display: flex;
            align-items: center;
            gap: 6px;
            border-radius: 18px;
            box-shadow: 0 10px 30px rgba(88, 86, 214, 0.4);
            animation: selectionSlideDown 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            margin-bottom: 0.5rem;
        }

        @keyframes selectionSlideDown {
            from { transform: translateY(-30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .selection-count {
            flex: 1;
            font-weight: 900;
            font-size: 0.7rem;
            letter-spacing: -0.1px;
            white-space: nowrap;
        }

        .icon-btn-selection {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .icon-btn-selection:active { transform: scale(0.9); }

        .trash-circle {
            background: white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
        }

        .edit-circle {
            background: rgba(255, 255, 255, 0.35);
            border-radius: 8px;
            width: 28px;
            height: 28px;
            color: white;
        }

        .archive-circle {
            background: rgba(255, 255, 255, 0.35);
            border-radius: 8px;
            width: 28px;
            height: 28px;
            color: white;
        }

        .tag-circle {
            background: rgba(255, 255, 255, 0.5);
            border-radius: 8px;
            width: 28px;
            height: 28px;
            color: white;
        }

        .selection-actions-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .text-action {
            color: white;
            font-weight: 900;
            font-size: 0.55rem;
            letter-spacing: 0.4px;
            padding: 5px 10px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            text-transform: uppercase;
        }

        .saved-list-view { position: relative; }

        .list-tabs-container { display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; padding: 0 4px; }
        .list-tabs { flex: 1; display: flex; gap: 6px; background: var(--accent-secondary); padding: 5px; border-radius: 16px; }
        .list-tabs button { flex: 1; padding: 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); }
        .list-tabs button.active { background: var(--card-bg); color: var(--accent-primary); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.1); }
        
        .sort-filter-main-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 0.75rem;
        }

        .sort-toggles {
            display: flex;
            background: var(--accent-secondary);
            padding: 4px;
            border-radius: 12px;
            flex: 1;
        }
        .sort-toggles button {
            flex: 1;
            padding: 8px 4px;
            border-radius: 8px;
            font-size: 0.65rem;
            font-weight: 800;
            color: var(--text-muted);
            transition: all 0.2s;
            white-space: nowrap;
        }
        .sort-toggles button.active {
            background: var(--card-bg);
            color: var(--accent-primary);
            box-shadow: 0 4px 10px rgba(88, 86, 214, 0.15);
        }

        .filter-toggle-btn {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: var(--accent-secondary);
            color: var(--text-muted);
            border: 1.5px solid var(--border-color);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .filter-toggle-btn.active {
            background: var(--accent-primary);
            color: white;
            border-color: var(--accent-primary);
            box-shadow: 0 8px 20px rgba(88, 86, 214, 0.3);
        }
        .filter-toggle-btn.filtering {
            border-color: var(--accent-primary);
            color: var(--accent-primary);
        }
        .filter-toggle-btn.filtering.active { color: white; }

        .filter-chips {
            display: flex;
            gap: 8px;
            margin-bottom: 1rem;
            overflow-x: auto;
            scrollbar-width: none;
            padding: 2px;
        }
        .filter-chips::-webkit-scrollbar { display: none; }
        .filter-chips .chip {
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 0.65rem;
            font-weight: 900;
            background: var(--card-bg);
            color: var(--text-muted);
            border: 1.5px solid var(--border-color);
            white-space: nowrap;
            transition: all 0.2s;
        }
        .filter-chips .chip.active {
            background: var(--accent-primary);
            color: white;
            border-color: var(--accent-primary);
            box-shadow: 0 4px 12px rgba(88, 86, 214, 0.2);
        }

        .icon-btn-minimal {
            background: var(--accent-secondary);
            color: var(--accent-primary);
            width: 24px;
            height: 24px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
        }
        .icon-btn-minimal:hover { opacity: 1; transform: scale(1.05); }

        .labels-manager-btn {
            background: var(--accent-secondary);
            color: var(--text-secondary);
            border: 1px solid var(--border-color);
        }

        .slide-down {
            animation: slideDown 0.25s ease-out;
        }
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .labels-filter-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 0.5rem;
        }
        .labels-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-label {
            font-size: 0.6rem;
            font-weight: 900;
            color: var(--text-muted);
            letter-spacing: 0.8px;
        }
        .logic-toggle {
            font-size: 0.6rem;
            font-weight: 900;
            padding: 2px 8px;
            border-radius: 6px;
            border: 1.5px solid var(--border-color);
            transition: all 0.2s;
        }
        .logic-toggle.and { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
        .logic-toggle.or { background: var(--accent-secondary); color: var(--accent-primary); border-color: var(--accent-primary); }

        .labels-horizontal-scroll {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 4px 2px 8px 2px;
            scrollbar-width: none;
        }
        .labels-horizontal-scroll::-webkit-scrollbar { display: none; }

        .label-filter-chip {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--card-bg);
            border: 1.5px solid var(--border-color);
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 800;
            white-space: nowrap;
            color: var(--text-secondary);
            transition: all 0.2s;
        }
        .label-filter-chip.active {
            background: var(--accent-secondary);
            border-color: var(--accent-primary);
            color: var(--accent-primary);
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .label-filter-chip .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .clear-labels-btn {
            font-size: 0.6rem;
            font-weight: 900;
            color: var(--danger-color);
            padding: 0 10px;
            white-space: nowrap;
        }

        .words-scroll-list { display: flex; flex-direction: column; gap: 0.65rem; padding: 0 4px; }
        .modern-word-card { 
            background: var(--card-bg); 
            border-radius: 20px; 
            padding: 0.85rem 1.15rem; 
            display: flex; 
            align-items: flex-start; 
            gap: 1rem; 
            border: 1px solid var(--border-color); 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            cursor: pointer;
            box-shadow: 0 1px 4px rgba(0,0,0,0.01);
            position: relative;
            overflow: hidden;
        }
        .modern-word-card.expanded {
            padding-bottom: 1.25rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            background: #fff;
        }
        .modern-word-card.selected { background: var(--accent-secondary); border-color: var(--accent-primary); }
        .word-title { font-size: 1.15rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; text-transform: none; }
        .card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-top: 2px; }
        .card-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .card-labels-dots-inline {
            display: flex;
            gap: 3px;
            flex-wrap: wrap;
            align-items: center;
        }
        .label-dot-small {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .expanded-labels-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 12px;
            margin-top: 4px;
        }
        .expanded-label-pill {
            font-size: 0.6rem;
            font-weight: 800;
            padding: 4px 10px;
            background: var(--accent-secondary);
            color: var(--accent-primary);
            border-radius: 8px;
            border-left: 3px solid var(--label-color);
        }
        .card-indicators { display: flex; align-items: center; gap: 6px; }
        .word-snippet { 
            font-size: 0.85rem; 
            color: var(--text-secondary);
            margin: 0 0 8px 0; 
            line-height: 1.4; 
            display: -webkit-box; 
            -webkit-line-clamp: 1; 
            -webkit-box-orient: vertical; 
            overflow: hidden; 
            font-weight: 500;
            transition: all 0.3s ease;
        }
        .modern-word-card.expanded .word-snippet {
            -webkit-line-clamp: unset;
            display: block;
            color: var(--text-primary);
            font-weight: 600;
        }

        .mastery-progress-dashes { display: flex; gap: 4px; margin-top: 4px; }
        .mastery-progress-dashes .dash { width: 14px; height: 2.5px; border-radius: 4px; background: var(--border-color); }
        .mastery-progress-dashes .dash.filled { background: var(--accent-primary); opacity: 0.3; }
        .mastery-pill.new .dash.filled { background: var(--accent-primary); }
        .mastery-pill.learning .dash.filled { background: #f57f17; }
        .mastery-pill.mastered .dash.filled { background: #2e7d32; opacity: 1; }

        .mastery-pill { font-size: 0.6rem; padding: 2px 8px; border-radius: 6px; font-weight: 800; text-transform: uppercase; }
        .mastery-pill.new { background: var(--accent-secondary); color: var(--accent-primary); }
        .mastery-pill.learning { background: rgba(255, 193, 7, 0.1); color: #f57f17; }
        .mastery-pill.mastered { background: rgba(0, 200, 83, 0.1); color: #2e7d32; }



        .expand-action-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            background: var(--accent-secondary);
            border: none;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            flex-shrink: 0;
            margin-top: 4px;
        }
        .expand-action-btn:hover {
            background: var(--border-color);
            color: var(--accent-primary);
        }
        .expand-action-btn.active {
            transform: rotate(90deg);
            background: var(--accent-primary);
            color: white;
        }
        .expand-action-btn svg {
            transition: transform 0.3s ease;
        }



        /* LABEL MANAGER STYLES */
        .label-manager-modal {
            max-width: 400px;
        }
        .label-manager-content {
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .add-label-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .label-input {
            flex: 1;
            padding: 12px;
            border-radius: 12px;
            border: 1.5px solid var(--border-color);
            background: var(--bg-color);
            color: var(--text-primary);
            font-size: 0.85rem;
            font-weight: 700;
        }
        .label-input:focus { border-color: var(--accent-primary); outline: none; }
        .label-color-picker {
            width: 44px;
            height: 44px;
            padding: 0;
            border-radius: 10px;
            border: 1.5px solid var(--border-color);
            background: none;
            cursor: pointer;
        }
        .add-label-btn {
            background: var(--accent-primary);
            color: white;
            font-weight: 900;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 0.75rem;
        }
        .labels-list-admin {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .label-admin-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            background: var(--accent-secondary);
            border-radius: 14px;
            border: 1px solid var(--border-color);
        }
        .label-admin-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .label-inline-picker {
            width: 20px;
            height: 20px;
            padding: 0;
            border: none;
            background: none;
            cursor: pointer;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
        }
        .label-inline-picker::-webkit-color-swatch-wrapper { padding: 0; }
        .label-inline-picker::-webkit-color-swatch { border: none; border-radius: 50%; }
        
        .label-swatch {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .label-admin-name {
            font-weight: 800;
            font-size: 0.9rem;
            color: var(--text-primary);
        }
        .delete-label-btn {
            color: var(--danger-color);
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        .delete-label-btn:hover { opacity: 1; }
        
        .empty-labels-hint {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.8rem;
            font-weight: 600;
            line-height: 1.5;
            padding: 2rem 0;
        }

        .bulk-labels-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
        }
        .bulk-label-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--card-bg);
            border-radius: 16px;
            border: 1.5px solid var(--border-color);
            cursor: pointer;
            transition: all 0.2s;
        }
        .bulk-label-item.complete {
            border-color: var(--accent-primary);
            background: var(--accent-secondary);
        }
        .bulk-label-item.partial {
            border-color: var(--border-color);
            background: var(--accent-secondary);
            border-style: dashed;
        }
        .partial-dot {
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
        }
        .bulk-label-info {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .bulk-label-name {
            font-weight: 800;
            font-size: 0.9rem;
            color: var(--text-primary);
        }
        .bulk-label-count {
            font-size: 0.65rem;
            font-weight: 700;
            color: var(--text-muted);
        }
        .finish-bulk-btn {
            width: 100%;
            padding: 16px;
            background: var(--accent-primary);
            color: white;
            font-weight: 900;
            border-radius: 16px;
            margin-top: 10px;
        }
      `}</style>
    </div>
  );
};

export default SavedWordsList;
