
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SRSItem, getMasteryColor, initializeSRSItem } from '../services/srsService';

interface SavedWordsListProps {
  words: string[];
  savedWordsList?: string[]; // Used in History mode to check if word is saved
  srsData: Record<string, SRSItem>;
  onSelect: (word: string) => void;
  onRemove: (word: string) => void;
  onEdit: (oldWord: string, newWord: string) => void;
  onRestore: (word: string, srsItem: SRSItem) => void;
  onToggleSave: (word: string) => void;
  onClose: () => void;
  onImport: (data: { savedWords: string[], srsData: Record<string, SRSItem> }) => void;
  mode: 'saved' | 'history';
}

type SortKey = 'time' | 'alpha' | 'mastery';
type SortOrder = 'asc' | 'desc';

const SavedWordsList: React.FC<SavedWordsListProps> = ({ 
  words, savedWordsList, srsData, onSelect, onRemove, onEdit, onRestore, onToggleSave, onClose, onImport, mode 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // Default most recent

  // Edit State
  const [editingWord, setEditingWord] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Active Item State (for Saved Mode)
  const [activeWord, setActiveWord] = useState<string | null>(null);

  // Undo State
  const [undoItem, setUndoItem] = useState<{ word: string, srsItem: SRSItem } | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const handleExport = () => {
    const backup = {
      savedWords: words,
      srsData: srsData,
      version: 1,
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabulary_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        let importData = { savedWords: [] as string[], srsData: {} as Record<string, SRSItem> };

        if (Array.isArray(parsed)) {
            importData.savedWords = parsed;
        } else if (parsed.savedWords && Array.isArray(parsed.savedWords)) {
            importData.savedWords = parsed.savedWords;
            importData.srsData = parsed.srsData || {};
        } else {
            alert('Invalid file format.');
            return;
        }

        onImport(importData);
        alert(`Successfully imported ${importData.savedWords.length} words.`);
      } catch (error) {
        console.error(error);
        alert('Failed to parse file.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      if (key === 'alpha') setSortOrder('asc');
      else setSortOrder('desc'); 
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Even in history mode, we create a dummy SRS item for consistency in the state type
    const item = srsData[word] || initializeSRSItem(word);
    setUndoItem({ word, srsItem: item });
    
    onRemove(word);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = window.setTimeout(() => {
        setUndoItem(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (undoItem) {
        onRestore(undoItem.word, undoItem.srsItem);
        setUndoItem(null);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    }
  };

  const submitEdit = () => {
    if (editingWord && editValue.trim()) {
        onEdit(editingWord, editValue.trim());
    }
    setEditingWord(null);
    setActiveWord(null);
  };

  const handleEditClick = (word: string) => {
      setEditingWord(word);
      setEditValue(word);
  };

  const sortedWords = useMemo(() => {
    const items = words.map((word, index) => ({
      word,
      timeScore: words.length - index, // Assumes input array is ordered by time (newest or oldest)
      mastery: srsData[word]?.masteryLevel || 0
    }));

    return items.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'alpha':
          comparison = a.word.localeCompare(b.word);
          break;
        case 'mastery':
          comparison = a.mastery - b.mastery;
          break;
        case 'time':
          comparison = a.timeScore - b.timeScore;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }).map(item => item.word);
  }, [words, srsData, sortKey, sortOrder]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>;
  };

  const renderMasteryDots = (word: string) => {
    const item = srsData[word] || initializeSRSItem(word);
    const level = item.masteryLevel;
    
    return (
      <div className="mastery-indicator" title={`Mastery Level: ${level}/5`}>
        {[...Array(5)].map((_, i) => (
          <span 
            key={i} 
            className={`mastery-dot ${i < level ? 'filled' : ''}`}
            style={{ backgroundColor: i < level ? getMasteryColor(level) : '#eee' }}
          />
        ))}
      </div>
    );
  };
  
  const isSaved = (word: string) => {
    if (mode === 'saved') return true;
    return savedWordsList ? savedWordsList.some(w => w.toLowerCase() === word.toLowerCase()) : false;
  };

  return (
    <div className="saved-list-overlay">
      <div className="saved-list-container">
        <div className="saved-list-header">
          <h3>{mode === 'saved' ? 'Your Collection' : 'History'}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {undoItem && (
               <button onClick={handleUndo} className="header-undo-btn">
                 Undo Delete
               </button>
            )}
            <button onClick={onClose} className="close-button">Close</button>
          </div>
        </div>

        {mode === 'saved' && (
            <div className="backup-controls">
            <button onClick={handleExport} className="backup-btn" disabled={words.length === 0}>
                Download Backup
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="backup-btn">
                Import Backup
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                accept=".json"
            />
            </div>
        )}

        <div className="sort-controls">
          <span className="sort-label">Sort by:</span>
          <button 
            className={`sort-btn ${sortKey === 'alpha' ? 'active' : ''}`} 
            onClick={() => toggleSort('alpha')}
          >
            A-Z {renderSortIndicator('alpha')}
          </button>
          <button 
            className={`sort-btn ${sortKey === 'time' ? 'active' : ''}`} 
            onClick={() => toggleSort('time')}
          >
            {mode === 'saved' ? 'Time Added' : 'Recent'} {renderSortIndicator('time')}
          </button>
          {mode === 'saved' && (
            <button 
                className={`sort-btn ${sortKey === 'mastery' ? 'active' : ''}`} 
                onClick={() => toggleSort('mastery')}
            >
                Mastery {renderSortIndicator('mastery')}
            </button>
          )}
        </div>

        {sortedWords.length === 0 ? (
          <p className="empty-state">
            {mode === 'saved' ? 'No words saved yet.' : 'No history yet.'}
          </p>
        ) : (
          <ul className="saved-words-ul">
            {sortedWords.map((word) => (
              <li key={word} className="saved-word-item">
                {editingWord === word && mode === 'saved' ? (
                   <div className="edit-mode-container">
                     <input 
                       autoFocus
                       className="edit-word-input"
                       value={editValue}
                       onChange={(e) => setEditValue(e.target.value)}
                       onBlur={submitEdit}
                       onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
                     />
                   </div>
                ) : (
                  <div 
                    className={`saved-item-row ${mode === 'saved' ? 'clickable-row' : ''}`}
                    onClick={() => mode === 'saved' && setActiveWord(activeWord === word ? null : word)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                     {/* Word Info Section */}
                     <div className="saved-word-info">
                        {mode === 'saved' ? (
                            // Saved Mode: Static Text + Mastery
                            <>
                                <span className="saved-word-text">{word}</span>
                                {renderMasteryDots(word)}
                            </>
                        ) : (
                            // History Mode: Clickable Button
                            <button 
                                onClick={(e) => { e.stopPropagation(); onClose(); onSelect(word); }} 
                                className="word-button"
                            >
                                {word}
                            </button>
                        )}
                     </div>
                     
                     {/* Actions Section */}
                     <div className="saved-item-actions">
                        {mode === 'saved' ? (
                            // Show icons ONLY if active
                            activeWord === word && (
                                <>
                                    <button 
                                        className="action-btn" 
                                        onClick={(e) => { e.stopPropagation(); onClose(); onSelect(word); }}
                                        title="Open Wiki"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                    </button>
                                    <button 
                                        className="action-btn" 
                                        onClick={(e) => { e.stopPropagation(); handleEditClick(word); }}
                                        title="Edit"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button 
                                        className="action-btn delete" 
                                        onClick={(e) => handleRemoveClick(e, word)}
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </>
                            )
                        ) : (
                            // History Mode Actions: Always Visible
                             <>
                                <button 
                                    className={`action-btn ${isSaved(word) ? 'active-star' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); onToggleSave(word); }}
                                    title={isSaved(word) ? 'Remove from Saved' : 'Save Word'}
                                >
                                    {isSaved(word) ? '★' : '☆'}
                                </button>
                                <button
                                    className="action-btn delete"
                                    onClick={(e) => handleRemoveClick(e, word)}
                                    title="Remove from history"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </>
                        )}
                     </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        
        {/* Undo Toast */}
        {undoItem && (
            <div className="undo-toast">
                <span>Deleted "{undoItem.word}"</span>
                <button onClick={handleUndo} className="undo-btn">UNDO</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default SavedWordsList;