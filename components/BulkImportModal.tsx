
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { CardData, generateBulkWordData, searchVocabulary } from '../services/dictionaryService';

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (words: Record<string, CardData>) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'json'>('ai');
  const [jsonInput, setJsonInput] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'Copy Sample JSON' | 'Copied!'>('Copy Sample JSON');
  const [summary, setSummary] = useState<{ total: number, unique: number } | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeTab === 'json' && jsonInput.trim()) {
        try {
            const parsed = JSON.parse(jsonInput);
            if (Array.isArray(parsed)) {
                const uniqueWords = new Set(parsed.map((i: any) => i.word?.toLowerCase()).filter(Boolean));
                setSummary({ total: parsed.length, unique: uniqueWords.size });
                setError(null);
            } else {
                setSummary(null);
            }
        } catch (e) {
            setSummary(null);
        }
    } else {
        setSummary(null);
    }
  }, [jsonInput, activeTab]);

  // Handle AI Suggestions
  useEffect(() => {
    if (activeTab !== 'ai' || !aiInput.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      // Find the segment the user is currently typing
      const words = aiInput.split(/[,|\n]/);
      const currentSegment = words[words.length - 1].trim();

      if (currentSegment.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchVocabulary(currentSegment);
          // Filter out words already in the list
          const existingWords = new Set(words.map(w => w.trim().toLowerCase()));
          const filtered = results.filter(r => !existingWords.has(r.toLowerCase()));
          setSuggestions(filtered);
        } catch (e) {
          console.error("Suggestion fetch failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [aiInput, activeTab]);

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array.");
      
      const newCache: Record<string, CardData> = {};
      parsed.forEach((item: any) => {
        if (!item.word) return;
        const wordKey = item.word;
        // Fix: Removed 'etymology' property as it is no longer defined in CardData interface.
        newCache[wordKey] = {
          pos: item.pos || '',
          ipa: item.ipa || '',
          definition: item.definition || '',
          bengali: item.bengali || '',
          family: item.family || '',
          context: item.context || '',
          synonyms: item.synonyms || '',
          antonyms: item.antonyms || '',
          difficulty: item.difficulty || '',
          usage_notes: item.usage_notes || ''
        };
      });

      onImport(newCache);
      onClose();
    } catch (e: any) {
      setError(e.message || "Invalid JSON format.");
    }
  };

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    const words = aiInput.split(/[,|\n]/).map(w => w.trim()).filter(w => w.length > 1);
    
    if (words.length === 0) {
        setError("Please enter at least one word.");
        return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
        const result = await generateBulkWordData(words);
        onImport(result);
        onClose();
    } catch (e: any) {
        setError("AI generation failed. Please try a smaller batch or check your connection.");
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSelectSuggestion = (word: string) => {
    const words = aiInput.split(/[,|\n]/);
    words[words.length - 1] = word;
    const newValue = words.join(', ') + ', ';
    setAiInput(newValue);
    setSuggestions([]);
    
    // Focus back and scroll to end
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCopy = async () => {
    const sampleJson = `[
  {
    "word": "Ephemeral",
    "pos": "adjective",
    "ipa": "/əˈfem(ə)rəl/",
    "definition": "Lasting for a very short time.",
    "bengali": "ক্ষণস্থায়ী বা অল্পস্থায়ী",
    "family": "ephemerally (adv), ephemerality (n)",
    "context": "The beauty of a sunset is ephemeral, fading into darkness in minutes.",
    "synonyms": "transient, fleeting, momentary",
    "antonyms": "permanent, eternal, lasting",
    "difficulty": "Advanced",
    "usage_notes": "[TRAP]: Don't confuse with 'ethereal' (delicate/heavenly). [MNEMONIC]: Think of an 'e-mail' that self-destructs after reading. [VIBE]: Literary and poetic."
  },
  {
    "word": "Mellifluous",
    "pos": "adjective",
    "ipa": "/meˈlifluəs/",
    "definition": "A voice or words that are sweet or musical; pleasant to hear.",
    "bengali": "মধুর বা শ্রুতিমধুর",
    "family": "mellifluously (adv)",
    "context": "The singer's mellifluous voice filled the hall and captivated the audience.",
    "synonyms": "sweet-sounding, dulcet, euphonious",
    "antonyms": "cacophonous, harsh, grating",
    "difficulty": "GRE",
    "usage_notes": "[VIBE]: Very sophisticated. [CONTEXT]: Perfect for describing music, voices, or flowing water. [MNEMONIC]: 'Melli' sounds like 'Melody' + 'Fluous' sounds like 'Flowing'."
  }
]`;
    setError(null);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(sampleJson);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = sampleJson;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy Sample JSON'), 2000);
    } catch (err) {
      setJsonInput(sampleJson);
      setCopyStatus('Copy Sample JSON');
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-container bulk-import-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Import Words</h3>
          <button onClick={onClose} className="close-button-cross" aria-label="Close import">
             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="import-tabs">
            <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
                ✨ AI Word List
            </button>
            <button className={activeTab === 'json' ? 'active' : ''} onClick={() => setActiveTab('json')}>
                Manual JSON
            </button>
        </div>
        
        <div className="tab-content">
            {activeTab === 'ai' ? (
                <div className="ai-mode">
                    <p className="tab-hint">Enter words separated by commas or new lines. Gemini will generate full flashcards including definitions, word families, and usage tips.</p>
                    
                    <div className="ai-input-wrapper">
                        <textarea 
                            ref={textareaRef}
                            className="import-textarea ai-list"
                            placeholder="Enter words here... (e.g. ephemeral, petrichor, mellifluous)"
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            disabled={isGenerating}
                        />
                        
                        {suggestions.length > 0 && (
                          <div className="import-suggestions">
                            {suggestions.map((word, i) => (
                              <button key={i} className="import-suggestion-chip" onClick={() => handleSelectSuggestion(word)}>
                                {word}
                              </button>
                            ))}
                          </div>
                        )}

                        {isSearching && (
                          <div className="import-search-status">
                            Searching words...
                          </div>
                        )}
                    </div>

                    <div className="import-footer-actions">
                        <button 
                            className={`auth-btn primary ai-gen-btn ${isGenerating ? 'loading' : ''}`} 
                            onClick={handleAiGenerate}
                            disabled={!aiInput.trim() || isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <div className="spinner-mini"></div>
                                    <span>AI Generating...</span>
                                </>
                            ) : (
                                '✨ Generate & Import'
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="json-mode">
                    <p className="tab-hint">Paste an array of objects. Perfect for migrating between devices or manually curating lists.</p>
                    
                    {summary && (
                        <div className="import-summary-pill">
                            <span>Detected {summary.total} entries ({summary.unique} unique)</span>
                        </div>
                    )}

                    <textarea 
                        className="import-textarea"
                        placeholder="[{ 'word': 'apple', ... }]"
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                    />

                    <div className="import-footer-actions">
                        <button className="auth-btn sample-copy-btn" onClick={handleCopy}>
                            {copyStatus === 'Copied!' ? '✅ Copied!' : '📋 Copy Sample'}
                        </button>
                        <button className="auth-btn primary" onClick={handleJsonImport} disabled={!jsonInput.trim()}>
                            Import Words
                        </button>
                    </div>
                </div>
            )}
        </div>

        {error && (
            <div className="import-error-msg">
                ⚠️ {error}
            </div>
        )}
      </div>

      <style>{`
        .bulk-import-container {
            max-width: 440px;
            width: 95%;
            padding: 1.5rem;
        }

        .import-tabs {
            display: flex;
            background: var(--accent-secondary);
            padding: 4px;
            border-radius: 14px;
            margin-bottom: 1.5rem;
        }
        .import-tabs button {
            flex: 1;
            padding: 10px;
            font-size: 0.8rem;
            font-weight: 800;
            border-radius: 11px;
            color: var(--text-secondary);
            transition: all 0.2s;
        }
        .import-tabs button.active {
            background: var(--card-bg);
            color: var(--accent-primary);
            box-shadow: var(--shadow-sm);
        }

        .tab-hint {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin: 0 0 1rem 0;
            line-height: 1.5;
        }

        .import-summary-pill {
            background: var(--accent-secondary);
            color: var(--accent-primary);
            font-size: 0.7rem;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            margin-bottom: 10px;
            display: inline-block;
        }

        .ai-input-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .import-textarea {
            width: 100%;
            height: 180px;
            background: var(--bg-color);
            border: 1.5px solid var(--border-color);
            border-radius: 16px;
            padding: 1rem;
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            color: var(--text-primary);
            resize: none;
            outline: none;
            transition: border-color 0.2s;
        }
        .import-textarea:focus { border-color: var(--accent-primary); }
        .import-textarea.ai-list { font-family: var(--font-family); font-size: 1rem; font-weight: 600; }

        .import-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: -4px;
          max-height: 80px;
          overflow-y: auto;
          padding: 4px 2px;
          scrollbar-width: none;
        }
        .import-suggestions::-webkit-scrollbar { display: none; }

        .import-suggestion-chip {
          background: var(--accent-secondary);
          color: var(--accent-primary);
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }
        .import-suggestion-chip:active { transform: scale(0.92); }

        .import-search-status {
          font-size: 0.7rem;
          color: var(--accent-primary);
          font-style: italic;
          font-weight: 600;
          margin-bottom: 4px;
          text-align: right;
        }

        .import-footer-actions {
            display: flex;
            gap: 12px;
            margin-top: 1.25rem;
        }
        .import-footer-actions button { flex: 1; }

        .sample-copy-btn {
            background: var(--accent-secondary);
            color: var(--accent-primary);
            border: 1px solid var(--border-color);
            font-size: 0.8rem;
            font-weight: 700;
        }

        .ai-gen-btn {
            background: linear-gradient(135deg, #5856d6 0%, #ff2d55 100%) !important;
            color: white !important;
            border: none !important;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .ai-gen-btn.loading { opacity: 0.8; }

        .spinner-mini {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        .import-error-msg {
            margin-top: 1rem;
            padding: 10px;
            background: rgba(255, 59, 48, 0.08);
            color: var(--danger-color);
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            text-align: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default BulkImportModal;
