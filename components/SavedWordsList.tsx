
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
  
  // Undo State
  const [undoItem, setUndoItem] = useState<{ word: string, srsItem: SRSItem } | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  // Long Press Refs
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
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

  // --- Long Press Edit Logic (Only for Saved Mode) ---
  const startPress = (word: string) => {
    if (mode === 'history') return; // Disable edit in history
    pressTimer.current = window.setTimeout(() => {
      setEditingWord(word);
      setEditValue(word);
    }, 600); 
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const submitEdit = () => {
    if (editingWord && editValue.trim()) {
        onEdit(editingWord, editValue.trim());
    }
    setEditingWord(null);
  };

  const sortedWords = useMemo(() => {
    // If History mode, typically we just want recent first (which is how `words` comes in).
    // But user might want to sort history alphabetically too.
    
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
                     <button 
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => handleRemoveClick(e, word)} 
                        className="delete-btn-edit-mode"
                     >
                        Delete
                     </button>
                   </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                     <div 
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}
                        onMouseDown={() => startPress(word)}
                        onMouseUp={cancelPress}
                        onMouseLeave={cancelPress}
                        onTouchStart={() => startPress(word)}
                        onTouchEnd={cancelPress}
                     >
                        <button 
                            onClick={() => { onClose(); onSelect(word); }} 
                            className="word-button"
                            style={{ userSelect: 'none' }}
                        >
                            {word}
                        </button>
                        {mode === 'saved' && renderMasteryDots(word)}
                     </div>
                     
                     {/* History Mode: Show Star and Delete Button */}
                     {mode === 'history' && (
                        <div style={{display: 'flex', alignItems: 'center'}}>
                            <button 
                                className={`star-btn-list ${isSaved(word) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); onToggleSave(word); }}
                                title={isSaved(word) ? 'Remove from Saved' : 'Save Word'}
                            >
                                {isSaved(word) ? '★' : '☆'}
                            </button>
                            <button
                                className="delete-history-btn"
                                onClick={(e) => handleRemoveClick(e, word)}
                                title="Remove from history"
                            >
                                ✕
                            </button>
                        </div>
                     )}
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
