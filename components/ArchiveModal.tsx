
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { CardData } from '../services/dictionaryService';

interface ArchiveModalProps {
  archivedWords: string[];
  cardCache: Record<string, CardData>;
  onClose: () => void;
  onRestore: (words: string[]) => void;
  onDelete: (words: string[]) => void;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ archivedWords, cardCache, onClose, onRestore, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleRestoreAll = () => {
    onRestore(archivedWords);
    onClose();
  };

  const filteredArchive = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return archivedWords;
    return archivedWords.filter(w => w.toLowerCase().includes(query));
  }, [archivedWords, searchQuery]);

  return (
    <div className="auth-overlay" style={{ padding: 0 }} onClick={onClose}>
        <div className="archive-modal-container" onClick={e => e.stopPropagation()}>
            <header className="archive-header">
                <button onClick={onClose} className="back-btn" aria-label="Go back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div className="header-info">
                  <h2>Archive</h2>
                  <span>{archivedWords.length} items</span>
                </div>
            </header>

            <div className="archive-controls">
                <div className="archive-search-wrapper">
                  <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input 
                    type="text" 
                    placeholder="Search archive..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {archivedWords.length > 1 && !searchQuery && (
                    <button className="restore-all-pill" onClick={handleRestoreAll}>
                        Restore All to Library
                    </button>
                )}
            </div>

            <div className="archive-body">
                {filteredArchive.length === 0 ? (
                    <div className="archive-empty-state">
                        <div className="empty-icon">
                          {searchQuery ? '🔍' : '📦'}
                        </div>
                        <p>{searchQuery ? 'No matching words found in archive.' : 'Your archive is empty.'}</p>
                        {!searchQuery && <span>Words you archive will appear here.</span>}
                    </div>
                ) : (
                    <div className="archive-list">
                        {filteredArchive.map(word => {
                            const cache = cardCache[word];
                            return (
                                <div key={word} className="archive-item-card">
                                    <div className="item-content">
                                        <div className="item-header">
                                          <span className="item-word">{word}</span>
                                          <span className="item-pos">{cache?.pos || 'word'}</span>
                                        </div>
                                        <p className="item-snippet">
                                            {cache?.definition || 'No definition available.'}
                                        </p>
                                    </div>
                                    <div className="item-actions">
                                        <button className="action-restore" onClick={() => onRestore([word])} title="Restore to library">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        </button>
                                        <button className="action-delete" onClick={() => {
                                          if(window.confirm(`Move "${word}" to trash?`)) onDelete([word]);
                                        }} title="Move to trash">
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
            .archive-modal-container { 
              height: 100%; 
              width: 100%; 
              display: flex; 
              flex-direction: column; 
              background: var(--bg-color);
              animation: slideInArchive 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            @keyframes slideInArchive {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            .archive-header {
              padding: 1rem 1.25rem;
              display: flex;
              align-items: center;
              gap: 1rem;
              background: var(--card-bg);
              border-bottom: 1px solid var(--border-color);
            }
            .archive-header h2 { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); }
            .header-info { flex: 1; }
            .header-info span { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
            .back-btn { color: var(--text-primary); padding: 4px; }

            .archive-controls {
              padding: 1rem 1.25rem;
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
            .archive-search-wrapper {
              position: relative;
              width: 100%;
            }
            .archive-search-wrapper .search-icon {
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              color: var(--text-muted);
            }
            .archive-search-wrapper input {
              width: 100%;
              padding: 12px 12px 12px 40px;
              border-radius: 14px;
              border: 1.5px solid var(--border-color);
              background: var(--card-bg);
              color: var(--text-primary);
              font-size: 0.95rem;
              outline: none;
            }
            .archive-search-wrapper input:focus { border-color: var(--accent-primary); }

            .restore-all-pill {
              align-self: flex-start;
              font-size: 0.75rem;
              font-weight: 800;
              color: var(--accent-primary);
              background: var(--accent-secondary);
              padding: 8px 16px;
              border-radius: 20px;
            }

            .archive-body {
              flex: 1;
              overflow-y: auto;
              padding: 0 1.25rem 2rem 1.25rem;
            }
            .archive-empty-state {
              padding: 4rem 2rem;
              text-align: center;
              color: var(--text-muted);
            }
            .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
            .archive-empty-state p { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text-secondary); }
            .archive-empty-state span { font-size: 0.85rem; }

            .archive-list { display: flex; flex-direction: column; gap: 0.75rem; }
            .archive-item-card {
              display: flex;
              align-items: center;
              padding: 1rem;
              background: var(--card-bg);
              border-radius: 20px;
              border: 1px solid var(--border-color);
              gap: 1rem;
            }
            
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

export default ArchiveModal;
