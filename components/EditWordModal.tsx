
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
            <h3>{viewMode === 'form' ? 'Edit Dictionary Entry' : 'JSON Raw Editor'}</h3>
            <span className="subtitle">{tempWord}</span>
          </div>
          <div className="header-actions-group">
            {viewMode === 'form' && (
              <button 
                className={`ai-refresh-btn ${isAiLoading ? 'loading' : ''}`} 
                onClick={handleAiGlobalRefresh}
                title="Regenerate all fields using Gemini AI"
                disabled={isAiLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  <path d="M5 3v4"/><path d="M3 5h4"/><path d="M21 17v4"/><path d="M19 19h4"/>
                </svg>
                {isAiLoading ? 'Regenerating...' : 'AI Refresh'}
              </button>
            )}
            <button className="mode-toggle-btn" onClick={handleToggleMode}>
                {viewMode === 'form' ? '{ } Edit JSON' : '📝 Back to Form'}
            </button>
            <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
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

              <div className="form-grid">
                <div className="form-group">
                    <label>Part of Speech</label>
                    <input name="pos" value={formData.pos} onChange={handleChange} placeholder="e.g. noun" />
                </div>
                <div className="form-group">
                    <label>IPA Pronunciation</label>
                    <input name="ipa" value={formData.ipa} onChange={handleChange} placeholder="e.g. /haʊs/" />
                </div>
              </div>

              <div className="form-group">
                <label>Definition</label>
                <textarea name="definition" value={formData.definition} onChange={handleChange} placeholder="English definition..." rows={3} />
              </div>

              <div className="form-group">
                <label>Bengali Meaning</label>
                <input name="bengali" value={formData.bengali} onChange={handleChange} placeholder="Bangla definition..." />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Context / Example</label>
                    <button 
                        type="button" 
                        className={`mini-ai-btn ${isSentenceLoading ? 'loading' : ''}`}
                        onClick={handleAiSentenceRefresh}
                        title="Generate new example sentence"
                        disabled={isSentenceLoading}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                        </svg>
                        <span>AI Sentence</span>
                    </button>
                </div>
                <textarea 
                    name="context" 
                    value={formData.context} 
                    onChange={handleChange} 
                    placeholder="Example sentence..." 
                    rows={2} 
                    style={{ opacity: isSentenceLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                    <label>Word Family</label>
                    <input name="family" value={formData.family} onChange={handleChange} placeholder="Related forms..." />
                </div>
                <div className="form-group">
                    <label>Difficulty</label>
                    <input name="difficulty" value={formData.difficulty} onChange={handleChange} placeholder="Basic, SAT, etc." />
                </div>
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

              <div className="form-group">
                <label>Etymology (Origin)</label>
                <textarea name="etymology" value={formData.etymology || ''} onChange={handleChange} placeholder="Word origin..." rows={2} />
              </div>

              <div className="form-group">
                <label>Usage Notes</label>
                <textarea name="usage_notes" value={formData.usage_notes || ''} onChange={handleChange} placeholder="Special usage rules..." rows={2} />
              </div>
            </div>
          ) : (
            <div className="json-editor-area">
                <div className="json-controls">
                    <p className="json-hint">Edit the raw JSON structure below. All fields must be correctly escaped.</p>
                </div>
                <textarea 
                    className={`json-textarea ${jsonError ? 'error' : ''}`}
                    value={jsonText}
                    onChange={handleJsonChange}
                    spellCheck={false}
                    autoFocus
                />
                {jsonError && <div className="json-error-msg">⚠️ Invalid JSON: {jsonError}</div>}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="auth-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="auth-btn primary" disabled={!!jsonError || isAiLoading}>Save Changes</button>
          </div>
        </form>
      </div>

      <style>{`
        .edit-word-container {
            max-width: 500px;
            width: 95%;
            height: 85vh;
            max-height: 800px;
            overflow-y: hidden;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
        }
        
        /* Larger container when editing JSON */
        .edit-word-container.json-mode-active {
            max-width: 600px;
            height: 90vh;
        }

        .header-info-group { display: flex; flex-direction: column; }
        .header-info-group h3 { margin: 0; font-size: 1.1rem; }
        .header-info-group .subtitle { font-size: 0.75rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; margin-top: 2px; }
        
        .header-actions-group { display: flex; align-items: center; gap: 8px; }
        
        .ai-refresh-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.7rem;
            font-weight: 800;
            padding: 6px 10px;
            border-radius: 8px;
            background: linear-gradient(135deg, #5856d6 0%, #ff2d55 100%);
            color: white;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        .ai-refresh-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(88, 86, 214, 0.3); }
        .ai-refresh-btn:active { transform: translateY(0); }
        .ai-refresh-btn.loading svg { animation: spin 1s linear infinite; }
        
        .mini-ai-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.65rem;
            font-weight: 800;
            padding: 4px 8px;
            border-radius: 6px;
            background: var(--accent-secondary);
            color: var(--accent-primary);
            border: 1px solid var(--border-color);
            cursor: pointer;
        }
        .mini-ai-btn:hover { background: var(--border-color); }
        .mini-ai-btn.loading svg { animation: spin 1s linear infinite; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .mode-toggle-btn {
            font-size: 0.7rem;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            background: var(--accent-secondary);
            color: var(--accent-primary);
            border: 1px solid var(--border-color);
        }
        .mode-toggle-btn:hover { background: var(--border-color); }

        .edit-word-form {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
            margin-top: 1rem;
            min-height: 0;
        }
        .form-content-area {
            flex: 1;
            overflow-y: auto;
            padding-right: 4px;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .word-primary-group {
            background: var(--accent-secondary);
            padding: 1rem;
            border-radius: 16px;
            border: 1px solid var(--border-color);
        }
        .word-edit-input {
            font-size: 1.2rem !important;
            font-weight: 800 !important;
            color: var(--accent-primary) !important;
        }
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-group label {
            font-size: 0.75rem;
            font-weight: 800;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 10px 14px;
            border-radius: 12px;
            border: 1.5px solid var(--border-color);
            background: var(--bg-color);
            color: var(--text-primary);
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus {
            border-color: var(--accent-primary);
        }
        
        .json-editor-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 0;
        }
        .json-controls { flex: 0 0 auto; }
        .json-hint { font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4; }
        .json-textarea {
            flex: 1;
            width: 100%;
            min-height: 300px;
            background: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Fira Code', 'Courier New', monospace;
            font-size: 0.85rem;
            padding: 1.25rem;
            border-radius: 16px;
            border: 1.5px solid var(--border-color);
            resize: none;
            outline: none;
            line-height: 1.5;
        }
        .json-textarea.error { border-color: var(--danger-color); box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.2); }
        .json-error-msg { font-size: 0.75rem; color: var(--danger-color); font-weight: 600; padding: 4px 8px; }

        .form-actions {
            display: flex;
            gap: 12px;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border-color);
            flex: 0 0 auto;
        }
        .form-actions button {
            flex: 1;
        }
      `}</style>
    </div>
  );
};

export default EditWordModal;
