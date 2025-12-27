
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { CardData } from '../services/dictionaryService';

interface TrashModalProps {
  trashedWords: string[];
  cardCache: Record<string, CardData>;
  onClose: () => void;
  onRestore: (words: string[]) => void;
  onPermanentDelete: (words: string[]) => void;
}

const TrashModal: React.FC<TrashModalProps> = ({ trashedWords, cardCache, onClose, onRestore, onPermanentDelete }) => {
  const handleEmptyTrash = () => {
    if (window.confirm("Empty trash? All words in trash will be permanently lost.")) {
      onPermanentDelete(trashedWords);
    }
  };

  const handleRestoreAll = () => {
    onRestore(trashedWords);
    onClose();
  };

  return (
    <div className="auth-overlay" style={{ padding: 0 }} onClick={onClose}>
        <div className="chat-page" style={{ background: 'var(--bg-color)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div className="chat-page-header" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <button onClick={onClose} style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 300, padding: '0 12px' }}>&lt;</button>
                <span style={{ fontWeight: 800, flex: 1 }}>Trash Bin</span>
                {trashedWords.length > 0 && (
                    <button className="icon-btn danger" onClick={handleEmptyTrash} title="Empty Trash">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                )}
            </div>

            <div className="chat-body" style={{ padding: '0.75rem' }}>
                {trashedWords.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗑️</div>
                        <p>Trash is empty.</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                            <button className="auth-btn" style={{ flex: 1, padding: '10px', fontSize: '0.8rem', background: 'var(--accent-secondary)', color: 'var(--accent-primary)' }} onClick={handleRestoreAll}>
                                RESTORE ALL ({trashedWords.length})
                            </button>
                        </div>
                        {trashedWords.map(word => {
                            const cache = cardCache[word];
                            return (
                                <div key={word} className="word-card-row" style={{ margin: '0 0 8px 0', opacity: 0.7 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{word}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                            {cache?.definition || 'Definition details in trash...'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="icon-btn" onClick={() => onRestore([word])} title="Restore" style={{ color: 'var(--accent-primary)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        </button>
                                        <button className="icon-btn" onClick={() => onPermanentDelete([word])} title="Delete Forever" style={{ color: 'var(--danger-color)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
        <style>{`
            .chat-page { height: 100%; display: flex; flexDirection: column; width: 100%; }
            .chat-page-header { flex: 0 0 auto; padding: 1rem; display: flex; align-items: center; gap: 1rem; }
            .chat-body { flex: 1; overflow-y: auto; }
        `}</style>
    </div>
  );
};

export default TrashModal;
