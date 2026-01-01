
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { UserHistoryItem } from '../services/supabaseClient';
import { CardData } from '../services/geminiService';

interface HistoryViewProps {
  history: UserHistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<UserHistoryItem[]>>;
  savedWords: string[];
  onToggleSave: (word: string) => void;
  onNavigate: (word: string) => void;
  onClose: () => void;
  cardCache: Record<string, CardData>;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, setHistory, savedWords, onToggleSave, onNavigate, onClose, cardCache }) => {
  const [sortMode, setSortMode] = useState<'recent' | 'a2z'>('recent');
  const [undoItem, setUndoItem] = useState<{ item: UserHistoryItem, index: number } | null>(null);

  const sortedHistory = useMemo(() => {
    const list = [...history];
    if (sortMode === 'recent') {
      return list.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      return list.sort((a, b) => a.word.localeCompare(b.word));
    }
  }, [history, sortMode]);

  const handleDelete = (word: string) => {
    const idx = history.findIndex(h => h.word === word);
    if (idx !== -1) {
      const item = history[idx];
      setUndoItem({ item, index: idx });
      setHistory(prev => prev.filter(h => h.word !== word));
      
      setTimeout(() => setUndoItem(null), 5000);
    }
  };

  const handleUndo = () => {
    if (undoItem) {
      setHistory(prev => {
        const newList = [...prev];
        newList.splice(undoItem.index, 0, undoItem.item);
        return newList;
      });
      setUndoItem(null);
    }
  };

  return (
    <div className="auth-overlay" style={{ padding: 0 }} onClick={onClose}>
        <div className="chat-page" style={{ background: 'var(--bg-color)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div className="chat-page-header" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <button onClick={onClose} style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <span style={{ fontWeight: 800, flex: 1 }}>History</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setSortMode('recent')} 
                      style={{ 
                        fontSize: '0.7rem', 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        background: sortMode === 'recent' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        color: sortMode === 'recent' ? 'white' : 'var(--accent-primary)',
                        fontWeight: '700'
                      }}
                    >TIME</button>
                    <button 
                      onClick={() => setSortMode('a2z')} 
                      style={{ 
                        fontSize: '0.7rem', 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        background: sortMode === 'a2z' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        color: sortMode === 'a2z' ? 'white' : 'var(--accent-primary)',
                        fontWeight: '700'
                      }}
                    >A-Z</button>
                </div>
            </div>

            <div className="chat-body" style={{ padding: '0.75rem', background: 'var(--bg-color)' }}>
                {sortedHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
                        Your history is empty.
                    </div>
                ) : (
                    sortedHistory.map((item) => {
                        const isSaved = savedWords.some(w => w.toLowerCase() === item.word.toLowerCase());
                        const cache = cardCache[item.word];
                        
                        return (
                            <div key={item.word} className="word-card-row" style={{ margin: '0 0 6px 0' }} onClick={() => onNavigate(item.word)}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{item.word}</span>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                        {cache?.definition || 'View details...'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    <button onClick={() => onToggleSave(item.word)} style={{ color: isSaved ? '#ff2d55' : 'var(--text-muted)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                    </button>
                                    <button onClick={() => handleDelete(item.word)} style={{ color: 'var(--text-muted)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {undoItem && (
                <div 
                  style={{ 
                    position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
                    background: '#1c1c1e', color: 'white', padding: '12px 20px', borderRadius: '30px',
                    display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    zIndex: 3000, minWidth: '240px'
                  }}
                >
                    <span style={{ fontSize: '0.85rem' }}>Deleted <b>{undoItem.item.word}</b></span>
                    <button onClick={handleUndo} style={{ color: 'var(--accent-primary)', fontWeight: '700', fontSize: '0.85rem' }}>UNDO</button>
                </div>
            )}
        </div>
    </div>
  );
};

export default HistoryView;
