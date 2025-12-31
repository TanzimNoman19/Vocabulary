
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { CardData } from '../services/dictionaryService';

interface TrashModalProps {
  trashedWords: string[];
  cardCache: Record<string, CardData>;
  onClose: () => void;
  onRestore: (words: string[]) => void;
  onPermanentDelete: (words: string[]) => void;
}

const TrashModal: React.FC<TrashModalProps> = ({ trashedWords, cardCache, onClose, onRestore, onPermanentDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmptyTrash = () => {
    if (window.confirm("Are you sure you want to empty the trash? This action cannot be undone and all words will be permanently deleted.")) {
      onPermanentDelete(trashedWords);
    }
  };

  const handleRestoreAll = () => {
    onRestore(trashedWords);
    onClose();
  };

  const filteredTrash = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return trashedWords;
    return trashedWords.filter(w => w.toLowerCase().includes(query));
  }, [trashedWords, searchQuery]);

  return (
    <div className="auth-overlay" style={{ padding: 0 }} onClick={onClose}>
        <div className="trash-modal-container" onClick={e => e.stopPropagation()}>
            <header className="trash-header">
                <button onClick={onClose} className="back-btn" aria-label="Go back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div className="header-info">
                  <h2>Trash Bin</h2>
                  <span>{trashedWords.length} items</span>
                </div>
                {trashedWords.length > 0 && (
                    <button className="empty-trash-btn" onClick={handleEmptyTrash}>
                        Empty Bin
                    </button>
                )}
            </header>

            <div className="trash-controls">
                <div className="trash-search-wrapper">
                  <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input 
                    type="text" 
                    placeholder="Search trash..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {trashedWords.length > 1 && !searchQuery && (
                    <button className="restore-all-pill" onClick={handleRestoreAll}>
                        Restore All
                    </button>
                )}
            </div>

            <div className="trash-body">
                {filteredTrash.length === 0 ? (
                    <div className="trash-empty-state">
                        <div className="empty-icon">
                          {searchQuery ? '🔍' : '✨'}
                        </div>
                        <p>{searchQuery ? 'No matching words found in trash.' : 'Your bin is sparkling clean!'}</p>
                        {!searchQuery && <span>Words you delete will appear here.</span>}
                    </div>
                ) : (
                    <div className="trash-list">
                        {filteredTrash.map(word => {
                            const cache = cardCache[word];
                            return (
                                <div key={word} className="trash-item-card">
                                    <div className="item-content">
                                        <div className="item-header">
                                          <span className="item-word">{word}</span>
                                          <span className="item-pos">{cache?.pos || 'word'}</span>
                                        </div>
                                        <p className="item-snippet">
                                            {cache?.definition || 'No definition available for this item.'}
                                        </p>
                                    </div>
                                    <div className="item-actions">
                                        <button className="action-restore" onClick={() => onRestore([word])} title="Restore word">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        </button>
                                        <button className="action-delete" onClick={() => {
                                          if(window.confirm(`Permanently delete "${word}"?`)) onPermanentDelete([word]);
                                        }} title="Delete forever">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
        <style>{`
            .trash-modal-container { 
              height: 100%; 
              width: 100%; 
              display: flex; 
              flex-direction: column; 
              background: var(--bg-color);
              animation: slideInTrash 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            @keyframes slideInTrash {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            .trash-header {
              padding: 1rem 1.25rem;
              display: flex;
              align-items: center;
              gap: 1rem;
              background: var(--card-bg);
              border-bottom: 1px solid var(--border-color);
            }
            .trash-header h2 { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); }
            .header-info { flex: 1; }
            .header-info span { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
            .back-btn { color: var(--text-primary); padding: 4px; }
            .empty-trash-btn {
              font-size: 0.75rem;
              font-weight: 800;
              color: var(--danger-color);
              padding: 8px 16px;
              border-radius: 12px;
              background: rgba(255, 59, 48, 0.08);
            }

            .trash-controls {
              padding: 1rem 1.25rem;
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
            .trash-search-wrapper {
              position: relative;
              width: 100%;
            }
            .trash-search-wrapper .search-icon {
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              color: var(--text-muted);
            }
            .trash-search-wrapper input {
              width: 100%;
              padding: 12px 12px 12px 40px;
              border-radius: 14px;
              border: 1.5px solid var(--border-color);
              background: var(--card-bg);
              color: var(--text-primary);
              font-size: 0.95rem;
              outline: none;
            }
            .trash-search-wrapper input:focus { border-color: var(--accent-primary); }

            .restore-all-pill {
              align-self: flex-start;
              font-size: 0.75rem;
              font-weight: 800;
              color: var(--accent-primary);
              background: var(--accent-secondary);
              padding: 8px 16px;
              border-radius: 20px;
            }

            .trash-body {
              flex: 1;
              overflow-y: auto;
              padding: 0 1.25rem 2rem 1.25rem;
            }
            .trash-empty-state {
              padding: 4rem 2rem;
              text-align: center;
              color: var(--text-muted);
            }
            .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
            .trash-empty-state p { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text-secondary); }
            .trash-empty-state span { font-size: 0.85rem; }

            .trash-list { display: flex; flex-direction: column; gap: 0.75rem; }
            .trash-item-card {
              display: flex;
              align-items: center;
              padding: 1rem;
              background: var(--card-bg);
              border-radius: 20px;
              border: 1px solid var(--border-color);
              gap: 1rem;
              animation: fadeInTrashItem 0.4s ease-out;
            }
            @keyframes fadeInTrashItem { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            
            .item-content { flex: 1; min-width: 0; opacity: 0.7; }
            .item-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
            .item-word { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); }
            .item-pos { font-size: 0.65rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase; }
            .item-snippet { 
              font-size: 0.8rem; 
              color: var(--text-secondary); 
              margin: 0; 
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis; 
            }

            .item-actions { display: flex; gap: 8px; }
            .item-actions button {
              width: 40px;
              height: 40px;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
            }
            .action-restore { background: var(--accent-secondary); color: var(--accent-primary); }
            .action-delete { background: rgba(255, 59, 48, 0.05); color: var(--danger-color); }
            
            .item-actions button:active { transform: scale(0.9); }
        `}</style>
    </div>
  );
};

export default TrashModal;
