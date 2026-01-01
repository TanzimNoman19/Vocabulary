
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { CardData, fetchWordData, fetchContextSentence } from '../services/dictionaryService';

interface EditWordModalProps {
  word: string;
  initialData: CardData;
  onClose: () => void;
  onSave: (oldWord: string, newWord: string, newData: CardData) => void;
}

const EditWordModal: React.FC<EditWordModalProps> = ({ word, initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<CardData>({ ...initialData });
  const [tempWord, setTempWord] = useState(word);
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSentenceLoading, setIsSentenceLoading] = useState(false);

  // Initialize JSON text when opening or switching to JSON mode
  useEffect(() => {
    if (viewMode === 'json') {
      const fullObject = { word: tempWord, ...formData };
      setJsonText(JSON.stringify(fullObject, null, 2));
    }
  }, [viewMode, formData, tempWord]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value);
    setJsonError(null);
  };

  const validateAndSyncJson = (): boolean => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.word) throw new Error("Missing 'word' field in JSON.");
      
      const { word: newW, ...rest } = parsed;
      setTempWord(newW);
      setFormData(rest as CardData);
      setJsonError(null);
      return true;
    } catch (e: any) {
      setJsonError(e.message);
      return false;
    }
  };

  const handleToggleMode = () => {
    if (viewMode === 'json') {
      // Sync back to form
      if (validateAndSyncJson()) {
        setViewMode('form');
      }
    } else {
      setViewMode('json');
    }
  };

  const handleAiGlobalRefresh = async () => {
    if (!tempWord.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const newData = await fetchWordData(tempWord.trim());
      setFormData(newData);
    } catch (e) {
      console.error("AI Refresh failed", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiSentenceRefresh = async () => {
    if (!tempWord.trim() || isSentenceLoading) return;
    setIsSentenceLoading(true);
    try {
      const newSentence = await fetchContextSentence(tempWord.trim());
      setFormData(prev => ({ ...prev, context: newSentence }));
    } catch (e) {
      console.error("Sentence Refresh failed", e);
    } finally {
      setIsSentenceLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (viewMode === 'json') {
      if (!validateAndSyncJson()) return;
    }

    if (!tempWord.trim()) return;
    onSave(word, tempWord.trim(), formData);
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className={`auth-container edit-word-container ${viewMode === 'json' ? 'json-mode-active' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <div className="header-info-group">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{viewMode === 'form' ? 'Edit Word' : 'Raw Editor'}</h3>
            <span className="subtitle">{tempWord}</span>
          </div>
          <div className="header-actions-group">
            {viewMode === 'form' && (
              <button 
                className={`ai-refresh-btn ${isAiLoading ? 'loading' : ''}`} 
                onClick={handleAiGlobalRefresh}
                title="AI Refresh"
                disabled={isAiLoading}
              >
                <svg className="sparkle-icon-colorful" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </button>
            )}
            <button className="mode-toggle-btn" onClick={handleToggleMode}>
                {viewMode === 'form' ? '{ }' : '📝'}
            </button>
            <button onClick={onClose} className="close-button-cross" aria-label="Close editor">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="edit-word-form">
          {viewMode === 'form' ? (
            <div className="form-content-area">
              <div className="form-group word-primary-group">
                <label>The Word</label>
                <input 
                    name="word" 
                    value={tempWord} 
                    onChange={(e) => setTempWord(e.target.value)} 
                    placeholder="Word name..." 
                    className="word-edit-input"
                />
              </div>

              <div className="form-group">
                <label>POS (Part of Speech)</label>
                <input name="pos" value={formData.pos} onChange={handleChange} placeholder="noun" />
              </div>

              <div className="form-group">
                <label>Definition</label>
                <textarea name="definition" value={formData.definition} onChange={handleChange} placeholder="Definition..." rows={2} />
              </div>

              <div className="form-group">
                <label>Bengali</label>
                <input name="bengali" value={formData.bengali} onChange={handleChange} placeholder="Bangla meaning..." />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Context</label>
                    <button 
                        type="button" 
                        className={`mini-ai-btn ${isSentenceLoading ? 'loading' : ''}`}
                        onClick={handleAiSentenceRefresh}
                        disabled={isSentenceLoading}
                    >
                        <span>✨ AI</span>
                    </button>
                </div>
                <textarea 
                    name="context" 
                    value={formData.context} 
                    onChange={handleChange} 
                    placeholder="Example..." 
                    rows={2} 
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                    <label>Synonyms</label>
                    <input name="synonyms" value={formData.synonyms} onChange={handleChange} placeholder="Comma separated..." />
                </div>
                <div className="form-group">
                    <label>Antonyms</label>
                    <input name="antonyms" value={formData.antonyms} onChange={handleChange} placeholder="Comma separated..." />
                </div>
              </div>
            </div>
          ) : (
            <div className="json-editor-area">
                <textarea 
                    className={`json-textarea ${jsonError ? 'error' : ''}`}
                    value={jsonText}
                    onChange={handleJsonChange}
                    spellCheck={false}
                    autoFocus
                />
                {jsonError && <div className="json-error-msg">⚠️ Invalid JSON</div>}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="auth-btn" onClick={onClose} style={{ background: 'var(--accent-secondary)' }}>Cancel</button>
            <button type="submit" className="auth-btn primary" disabled={!!jsonError || isAiLoading}>Save</button>
          </div>
        </form>
      </div>

      <style>{`
        .edit-word-container {
            max-width: 480px;
            width: 95%;
            height: 85vh;
            max-height: 800px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
        }

        .header-info-group { display: flex; flex-direction: column; }
        .header-info-group .subtitle { font-size: 0.75rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; }
        
        .header-actions-group { display: flex; align-items: center; gap: 8px; }
        
        .ai-refresh-btn, .mode-toggle-btn {
            width: 38px; height: 38px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 10px; background: var(--accent-secondary); color: var(--accent-primary);
            transition: all 0.2s;
        }
        .ai-refresh-btn:hover, .mode-toggle-btn:hover { background: var(--border-color); }
        .ai-refresh-btn.loading svg { animation: spin 0.8s linear infinite; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .edit-word-form { display: flex; flex-direction: column; flex: 1; overflow: hidden; margin-top: 1rem; }
        .form-content-area { flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 1rem; }
        
        .word-primary-group { background: var(--accent-secondary); padding: 1rem; border-radius: 16px; border: 1px solid var(--border-color); }
        .word-edit-input { font-size: 1.2rem !important; font-weight: 800 !important; color: var(--accent-primary) !important; background: transparent !important; border: none !important; padding: 0 !important; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group textarea {
            width: 100%; padding: 10px 12px; border-radius: 12px; border: 1.5px solid var(--border-color);
            background: var(--bg-color); color: var(--text-primary); font-size: 0.9rem; outline: none; transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus { border-color: var(--accent-primary); }
        
        .json-editor-area { flex: 1; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
        .json-textarea { flex: 1; width: 100%; background: var(--bg-color); color: var(--text-primary); font-family: monospace; font-size: 0.85rem; padding: 1rem; border-radius: 16px; border: 1.5px solid var(--border-color); resize: none; outline: none; }
        .json-textarea.error { border-color: var(--danger-color); }

        .form-actions { display: flex; gap: 12px; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); flex-shrink: 0; }
        .form-actions button { flex: 1; }
      `}</style>
    </div>
  );
};

export default EditWordModal;
