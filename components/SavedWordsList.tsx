
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef } from 'react';
import { SRSItem } from '../services/srsService';
import { CardData, capitalize, generateSemanticClusters } from '../services/dictionaryService';
import { SemanticCluster } from '../App';
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
  semanticClusters: SemanticCluster[];
  setSemanticClusters: (clusters: SemanticCluster[]) => void;
  clusterSimilarity: number;
  setClusterSimilarity: (val: number) => void;
  isOnline: boolean;
}

type SortType = 'alpha' | 'time';
type SortOrder = 'asc' | 'desc';
type MasteryFilter = 'all' | 'new' | 'learning' | 'mastered';
type ViewType = 'list' | 'family' | 'synonym';

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
    savedWords, favoriteWords, trashedWords, srsData, cardCache, onNavigate, onDeleteMultiple, onRestoreFromTrash, onPermanentDelete, onOpenImport, onUpdateWordData,
    semanticClusters, setSemanticClusters, clusterSimilarity, setClusterSimilarity, isOnline
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<SortType>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<MasteryFilter>('all');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<FamilyGroup | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<SemanticCluster | null>(null);
  const [isRefreshingClusters, setIsRefreshingClusters] = useState(false);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<number | null>(null);
  const [editingWord, setEditingWord] = useState<string | null>(null);

  const baseList = activeTab === 'all' ? savedWords : favoriteWords;

  const parseSafeList = (val: any): string[] => {
    if (!val || val === 'N/A' || val === 'None') return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val !== 'string') return [String(val).trim()];
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  const filteredAndSortedList = useMemo(() => {
    let list = [...baseList];
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
        } else {
            const idxA = savedWords.indexOf(a);
            const idxB = savedWords.indexOf(b);
            return sortOrder === 'asc' ? idxB - idxA : idxA - idxB;
        }
    });
    return list;
  }, [baseList, sortBy, sortOrder, filter, srsData, savedWords]);

  const displayClusters = useMemo(() => {
    if (viewType !== 'synonym') return [];
    const levelFilteredClusters = semanticClusters.filter(c => (c as any).level === clusterSimilarity);
    if (levelFilteredClusters.length > 0) {
        const savedSet = new Set(filteredAndSortedList);
        const result: SemanticCluster[] = [];
        const assigned = new Set<string>();
        levelFilteredClusters.forEach(cluster => {
            const present = (cluster.members || []).filter(m => savedSet.has(m));
            if (present.length > 0) {
                result.push({ ...cluster, members: present });
                present.forEach(m => assigned.add(m));
            }
        });
        filteredAndSortedList.forEach(w => {
            if (!assigned.has(w)) {
                result.push({ id: `new-${w}`, title: `${w}`, members: [w], explanation: 'Recently added to library.', isAiGenerated: false });
            }
        });
        return result;
    }
    const getSynSet = (word: string) => {
        const cache = cardCache[word];
        const list = parseSafeList(cache?.synonyms);
        return new Set(list.map(s => capitalize(s)));
    };
    let groups: Set<string>[] = filteredAndSortedList.map(w => new Set([w]));
    for (let i = 0; i < filteredAndSortedList.length; i++) {
        const wordA = filteredAndSortedList[i];
        const synsA = getSynSet(wordA);
        for (let j = i + 1; j < filteredAndSortedList.length; j++) {
            const wordB = filteredAndSortedList[j];
            const synsB = getSynSet(wordB);
            let shouldMerge = false;
            if (clusterSimilarity === 0) {
                shouldMerge = synsA.has(wordB) || synsB.has(wordA);
            } else if (clusterSimilarity === 1) {
                shouldMerge = synsA.has(wordB) || synsB.has(wordA) || Array.from(synsA).some(s => synsB.has(s));
            }
            if (shouldMerge) {
                const groupIdxA = groups.findIndex(g => g.has(wordA));
                const groupIdxB = groups.findIndex(g => g.has(wordB));
                if (groupIdxA !== groupIdxB && groupIdxA !== -1 && groupIdxB !== -1) {
                    const merged = new Set([...groups[groupIdxA], ...groups[groupIdxB]]);
                    groups.splice(Math.max(groupIdxA, groupIdxB), 1);
                    groups.splice(Math.min(groupIdxA, groupIdxB), 1);
                    groups.push(merged);
                }
            }
        }
    }
    return groups.map((g, idx) => {
        const members = Array.from(g);
        let explanation = clusterSimilarity === 0 ? 'Direct dictionary synonyms found in your library.' : 'Words related through common synonyms or shared meaning.';
        if (clusterSimilarity === 0 && members.length > 1) {
            const leadDef = cardCache[members[0]]?.definition;
            if (leadDef) explanation = leadDef;
        }
        return {
            id: `local-${idx}`,
            title: members.slice(0, 2).join(', ') + (members.length > 2 ? '...' : ''),
            members: members,
            explanation: explanation,
            isAiGenerated: false
        } as SemanticCluster;
    });
  }, [viewType, filteredAndSortedList, cardCache, clusterSimilarity, semanticClusters]);

  const handleRefineClusters = async () => {
      if (!isOnline || isRefreshingClusters) return;
      setIsRefreshingClusters(true);
      try {
          const result = await generateSemanticClusters(savedWords, clusterSimilarity);
          if (result.length > 0) {
              const otherLevels = semanticClusters.filter(c => (c as any).level !== clusterSimilarity);
              setSemanticClusters([...otherLevels, ...result]);
          }
      } catch (e) {
          alert("Could not update clusters. Try again later.");
      } finally {
          setIsRefreshingClusters(false);
      }
  };

  const familyGroups = useMemo(() => {
    if (viewType !== 'family') return [];
    const parseMembers = (val: any): FamilyMember[] => {
      const list = parseSafeList(val);
      return list.map(m => {
        const match = m.match(/(.*?)\s*\((.*?)\)/);
        return { word: (match ? match[1].trim() : m.trim()).toLowerCase(), pos: match ? match[2].trim() : '' };
      }).filter(m => m.word.length > 0 && m.word !== 'none');
    };
    let clusters: { all: FamilyMember[], saved: Set<string> }[] = [];
    filteredAndSortedList.forEach(word => {
      const cache = cardCache[word];
      const members = parseMembers(cache?.family);
      if (!members.find(m => m.word === word.toLowerCase())) members.push({ word: word.toLowerCase(), pos: cache?.pos || '' });
      clusters.push({ all: members, saved: new Set([word]) });
    });
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const hasCommon = clusters[i].all.some(m1 => clusters[j].all.some(m2 => m1.word === m2.word));
          if (hasCommon) {
            const mergedAll = [...clusters[i].all];
            clusters[j].all.forEach(m => { if (!mergedAll.find(existing => existing.word === m.word)) mergedAll.push(m); });
            clusters[i] = { all: mergedAll, saved: new Set([...clusters[i].saved, ...clusters[j].saved]) };
            clusters.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return clusters.map((c, idx) => ({ id: `family-${idx}`, savedMembers: Array.from(c.saved).sort(), allMembers: c.all.sort() })).sort((a, b) => a.savedMembers[0].localeCompare(b.savedMembers[0]));
  }, [filteredAndSortedList, cardCache, viewType]);

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

  const startLongPress = (word: string, e: React.PointerEvent) => {
    if (selectionMode || viewType !== 'list') return;
    longPressTimer.current = window.setTimeout(() => {
        setSelectionMode(true);
        toggleSelection(word);
        if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
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
              <button className="icon-btn-selection danger-fill" onClick={() => { onDeleteMultiple(Array.from(selectedWords)); setSelectionMode(false); }}>
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
              <button className={sortBy === 'time' ? 'active' : ''} onClick={() => { if (sortBy === 'time') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('time'); }}>
                  RECENT {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button className={sortBy === 'alpha' ? 'active' : ''} onClick={() => { if (sortBy === 'alpha') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else setSortBy('alpha'); }}>
                  A-Z {sortBy === 'alpha' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              
              <div className="view-toggle-group">
                <button className={`view-toggle-btn ${viewType === 'family' ? 'active' : ''}`} onClick={() => setViewType(prev => prev === 'family' ? 'list' : 'family')} title="Family View">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </button>
                <button className={`view-toggle-btn ${viewType === 'synonym' ? 'active' : ''}`} onClick={() => setViewType(prev => prev === 'synonym' ? 'list' : 'synonym')} title="Synonym Clusters">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </button>
              </div>
          </div>
          <div className="filter-chips">
              {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(f => (
                  <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
              ))}
          </div>
      </div>
      
      {viewType === 'synonym' && (
          <div className="synonym-controls-box">
              <div className="similarity-row">
                  <div className="similarity-nav">
                    <button className={clusterSimilarity === 0 ? 'active' : ''} onClick={() => setClusterSimilarity(0)}>STRICT</button>
                    <button className={clusterSimilarity === 1 ? 'active' : ''} onClick={() => setClusterSimilarity(1)}>RELATED</button>
                    <button className={clusterSimilarity === 2 ? 'active' : ''} onClick={() => setClusterSimilarity(2)}>THEMATIC</button>
                  </div>
                  <button className={`ai-refine-btn ${isRefreshingClusters ? 'loading' : ''}`} onClick={handleRefineClusters} disabled={!isOnline}>
                    {isRefreshingClusters ? 'Updating...' : '✨ Update'}
                  </button>
              </div>
              <p className="similarity-hint">
                {clusterSimilarity === 0 ? "Only exact synonyms." : clusterSimilarity === 1 ? "Connected words with shared meanings." : "Deep conceptual grouping."}
              </p>
          </div>
      )}

      <div className="words-scroll-list">
        {viewType === 'list' ? (
          filteredAndSortedList.length === 0 ? (
              <div className="empty-state"><div className="icon">📚</div><p>Your library is empty.</p></div>
          ) : (
              filteredAndSortedList.map(word => {
                  const mastery = getMasteryLabel(word);
                  const masteryLevel = srsData[word]?.masteryLevel || 0;
                  return (
                    <div key={word} className={`modern-word-card ${selectedWords.has(word) ? 'selected' : ''}`} onClick={() => handleItemClick(word)} onPointerDown={(e) => startLongPress(word, e)}>
                        <div className="card-info">
                            <div className="card-top-row">
                                <span className="word-title">{word}</span>
                                <div className="card-indicators">
                                    {favoriteWords.includes(word) && <span className="fav-indicator">❤️</span>}
                                    <span className={`mastery-pill ${mastery.class}`}>{mastery.text}</span>
                                    <button className="edit-mini-btn" onClick={(e) => { e.stopPropagation(); setEditingWord(word); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                </div>
                            </div>
                            <p className="word-snippet">{cardCache[word]?.definition || 'No definition cached...'}</p>
                            <div className="mastery-progress-dashes">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`dash ${i < masteryLevel ? 'filled' : ''}`} />
                                ))}
                            </div>
                        </div>
                        <div className="arrow-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  );
              })
          )
        ) : viewType === 'family' ? (
            familyGroups.map(group => (
                <div key={group.id} className="family-entry" onClick={() => setSelectedFamilyGroup(group)}>
                  <div className="family-header">
                    <div className="family-title-group">
                      <span className="family-icon">🌿</span>
                      <div className="cluster-title-stack">
                        <span className="family-name">{group.savedMembers.join(', ')}</span>
                        <span className="cluster-meta">{group.savedMembers.length} MEMBERS</span>
                      </div>
                    </div>
                    <svg className="chevron-right" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                </div>
            ))
        ) : (
            displayClusters.map(cluster => (
                <div key={cluster.id} className="family-entry" onClick={() => setSelectedCluster(cluster)}>
                  <div className="family-header">
                    <div className="family-title-group">
                      <span className="family-icon">{cluster.isAiGenerated ? '✨' : '🔗'}</span>
                      <div className="cluster-title-stack">
                        <span className="family-name">{cluster.title}</span>
                        <span className="cluster-meta">{cluster.members.length} WORDS</span>
                      </div>
                    </div>
                    <svg className="chevron-right" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                </div>
            ))
        )}
      </div>

      {/* Cluster Detail Modal */}
      {selectedCluster && (
        <div className="auth-overlay" onClick={() => setSelectedCluster(null)}>
          <div className="auth-container family-modal cluster-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="auth-header">
              <div className="header-info-group">
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.3px' }}>{selectedCluster.title}</h3>
                <span className="subtitle">{clusterSimilarity === 2 ? 'Thematic Domain' : 'Semantic Cluster'}</span>
              </div>
              <button onClick={() => setSelectedCluster(null)} className="close-button-cross"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div className="family-modal-content">
              <div className="common-thread-box">
                <span className="thread-label">{clusterSimilarity === 0 ? 'COMMON DEFINITION' : clusterSimilarity === 1 ? 'COMMON THREAD' : 'THEME SUMMARY'}</span>
                <p className="modal-hint">{selectedCluster.explanation}</p>
              </div>
              <div className="family-members-grid">
                {(selectedCluster.members || []).map(word => {
                  const cache = cardCache[word];
                  return (
                    <div key={word} className="family-member-card saved" onClick={() => onNavigate(word, true)} style={{ borderLeft: `5px solid ${getMasteryColor(word)}` }}>
                      <div className="member-main-info">
                        <span className="member-word">{word}</span>
                      </div>
                      <p className="member-snippet-oneline">{cache?.definition || 'Loading details...'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedFamilyGroup && (
        <div className="auth-overlay" onClick={() => setSelectedFamilyGroup(null)}>
          <div className="auth-container family-modal" onClick={e => e.stopPropagation()}>
            <div className="auth-header">
              <div className="header-info-group">
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Word Family</h3>
              </div>
              <button onClick={() => setSelectedFamilyGroup(null)} className="close-button-cross" style={{ background: 'transparent' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="family-modal-content">
              <div className="family-members-grid" style={{ gap: '1rem' }}>
                {selectedFamilyGroup.allMembers.map(m => {
                  const capW = capitalize(m.word);
                  const isSaved = savedWords.includes(capW);
                  const cache = cardCache[capW];
                  return (
                    <div key={m.word} className={`family-member-card ${isSaved ? 'saved' : ''}`} onClick={() => isSaved && onNavigate(capW, true)}>
                      <div className="member-main-info" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span className="member-word">{capW}</span>
                          {m.pos && <span className="member-pos" style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>({m.pos.toLowerCase()})</span>}
                        </div>
                        {isSaved && <span className="saved-badge">LIBRARY</span>}
                      </div>
                      <p className="member-snippet-oneline" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {isSaved ? (cache?.definition || 'Saved to library.') : `A related ${m.pos || 'form'} of the word.`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingWord && <EditWordModal word={editingWord} initialData={cardCache[editingWord]} onClose={() => setEditingWord(null)} onSave={onUpdateWordData} />}

      <style>{`
        .list-tabs-container { display: flex; align-items: center; gap: 12px; margin-bottom: 1.2rem; padding: 0 4px; }
        .list-tabs { flex: 1; display: flex; gap: 6px; background: var(--accent-secondary); padding: 5px; border-radius: 16px; }
        .list-tabs button { flex: 1; padding: 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); }
        .list-tabs button.active { background: var(--card-bg); color: var(--accent-primary); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.1); }
        
        .view-toggle-group { display: flex; gap: 8px; }
        .view-toggle-btn { width: 40px; height: 40px; border-radius: 12px; background: var(--accent-secondary); color: var(--accent-primary); border: 1.5px solid var(--border-color); display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        .view-toggle-btn.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

        .filter-sort-bar { margin: 0 4px 1.5rem 4px; display: flex; flex-direction: column; gap: 14px; }
        .sort-toggles { display: flex; gap: 10px; align-items: center; }
        .sort-toggles button:not(.view-toggle-btn) { font-size: 0.65rem; font-weight: 800; padding: 10px 16px; border-radius: 12px; background: var(--card-bg); color: var(--text-secondary); border: 1px solid var(--border-color); letter-spacing: 0.5px; height: 40px; }
        .sort-toggles button.active:not(.view-toggle-btn) { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
        
        .filter-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .chip { white-space: nowrap; font-size: 0.65rem; font-weight: 800; padding: 8px 18px; border-radius: 20px; border: 1.5px solid var(--border-color); color: var(--text-muted); background: transparent; }
        .chip.active { background: var(--text-primary); color: var(--bg-color); border-color: var(--text-primary); }

        .synonym-controls-box { margin: 0 4px 1.2rem 4px; padding: 1rem; background: var(--accent-secondary); border-radius: 18px; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border-color); }
        .similarity-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .similarity-nav { display: flex; background: var(--border-color); padding: 3px; border-radius: 10px; flex: 1; overflow: hidden; }
        .similarity-nav button { flex: 1; font-size: 0.6rem; font-weight: 900; padding: 10px 4px; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; }
        .similarity-nav button.active { background: var(--card-bg); color: var(--accent-primary); box-shadow: var(--shadow-sm); border-radius: 8px; }
        .similarity-hint { font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin: 0; padding-left: 4px; }
        
        .ai-refine-btn { padding: 10px 16px; font-size: 0.7rem; font-weight: 900; background: var(--card-bg); color: var(--accent-primary); border-radius: 10px; border: 1px solid var(--border-color); transition: all 0.2s; white-space: nowrap; }
        .ai-refine-btn:active { transform: scale(0.95); }

        .words-scroll-list { display: flex; flex-direction: column; gap: 1rem; padding: 0 4px; }
        .modern-word-card { 
            background: var(--card-bg); 
            border-radius: 24px; 
            padding: 1.5rem; 
            display: flex; 
            align-items: center; 
            gap: 1rem; 
            border: 1px solid var(--border-color); 
            transition: all 0.2s; 
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .modern-word-card.selected { background: var(--accent-secondary); border-color: var(--accent-primary); }
        .word-title { font-size: 1.35rem; font-weight: 800; color: var(--text-primary); }
        .card-info { flex: 1; min-width: 0; }
        .card-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .card-indicators { display: flex; align-items: center; gap: 8px; }
        .edit-mini-btn { padding: 4px; border-radius: 6px; color: var(--accent-primary); background: var(--accent-secondary); transition: 0.1s; }
        .edit-mini-btn:active { transform: scale(0.9); }
        .word-snippet { font-size: 0.95rem; color: var(--text-secondary); margin: 0 0 1rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .mastery-progress-dashes { display: flex; gap: 6px; }
        .mastery-progress-dashes .dash { width: 18px; height: 3px; border-radius: 4px; background: var(--border-color); }
        .mastery-progress-dashes .dash.filled { background: var(--accent-primary); opacity: 0.3; }
        .mastery-pill.new .dash.filled { background: var(--accent-primary); }
        .mastery-pill.learning .dash.filled { background: #f57f17; }
        .mastery-pill.mastered .dash.filled { background: #2e7d32; opacity: 1; }

        .family-entry { background: var(--card-bg); border-radius: 20px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s; width: 100%; display: block; }
        .family-entry:active { transform: scale(0.98); }
        .family-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .family-title-group { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; }
        .family-icon { font-size: 1.4rem; flex-shrink: 0; }
        .cluster-title-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
        .family-name { font-weight: 800; font-size: 1.1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
        .cluster-meta { font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; }

        .mastery-pill { font-size: 0.65rem; padding: 4px 10px; border-radius: 8px; font-weight: 800; text-transform: uppercase; }
        .mastery-pill.new { background: var(--accent-secondary); color: var(--accent-primary); }
        .mastery-pill.learning { background: rgba(255, 193, 7, 0.1); color: #f57f17; }
        .mastery-pill.mastered { background: rgba(0, 200, 83, 0.1); color: #2e7d32; }

        .common-thread-box { background: var(--accent-secondary); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid var(--border-color); }
        .thread-label { font-size: 0.6rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 1px; display: block; margin-bottom: 8px; }
        .modal-hint { font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; font-weight: 600; margin: 0; }

        .family-member-card { padding: 1.15rem; background: var(--bg-color); border-radius: 20px; display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--border-color); transition: all 0.2s; }
        .family-member-card.saved { background: white; border: 1px solid var(--accent-primary); cursor: pointer; }
        .family-member-card.saved:active { transform: scale(0.98); }
        .member-word { font-weight: 800; color: var(--text-primary); font-size: 1.15rem; }
        .saved-badge { font-size: 0.65rem; background: var(--accent-primary); color: white; padding: 3px 8px; border-radius: 6px; font-weight: 900; letter-spacing: 0.5px; }
        .member-snippet-oneline { font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }

        .arrow-icon { color: var(--text-muted); padding-left: 8px; }

        /* MODAL FIX: Fixed header and scrollable content */
        .family-modal {
          width: 95%;
          max-width: 440px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          padding: 0 !important;
          overflow: hidden;
          border-radius: 32px !important;
        }
        .family-modal .auth-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 0 !important;
          flex-shrink: 0;
          background: var(--card-bg);
          z-index: 10;
        }
        .family-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  );
};

export default SavedWordsList;
