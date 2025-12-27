
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { CardData } from '../services/dictionaryService';

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (words: Record<string, CardData>) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'Copy Sample' | 'Copied!'>('Copy Sample');

  const sampleJson = `[
  {
    "word": "Serendipity",
    "pos": "noun",
    "ipa": "/ˌserənˈdipitē/",
    "definition": "The occurrence of events by chance in a happy or beneficial way.",
    "bengali": "ভাগ্যক্রমে ঘটা আনন্দদায়ক ঘটনা",
    "family": "serendipitous (adj)",
    "context": "Winning the lottery was a pure act of serendipity.",
    "synonyms": "luck, fluke, providence",
    "antonyms": "misfortune, bad luck",
    "etymology": "Coined by Horace Walpole in 1754 from the Persian fairy tale 'The Three Princes of Serendip'.",
    "usage_notes": "Commonly used in literature to describe unexpected scientific discoveries.",
    "difficulty": "Intermediate"
  },
  {
    "word": "Pernicious",
    "pos": "adjective",
    "ipa": "/pərˈniSHəs/",
    "definition": "Having a harmful effect, especially in a gradual or subtle way.",
    "bengali": "অত্যন্ত ক্ষতিকারক",
    "family": "perniciously (adv)",
    "context": "The pernicious influences of social media can affect mental health.",
    "synonyms": "harmful, damaging, destructive, inimical",
    "antonyms": "beneficial, benign",
    "etymology": "Derived from Latin 'perniciosus' meaning 'destructive'.",
    "usage_notes": "Often used in political or social commentary regarding toxic ideologies.",
    "difficulty": "Advanced"
  }
]`;

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array.");
      
      const newCache: Record<string, CardData> = {};
      parsed.forEach((item: any) => {
        if (!item.word) return;
        newCache[item.word] = {
          pos: item.pos || '',
          ipa: item.ipa || '',
          definition: item.definition || '',
          bengali: item.bengali || '',
          family: item.family || '',
          context: item.context || '',
          synonyms: item.synonyms || '',
          antonyms: item.antonyms || '',
          difficulty: item.difficulty || '',
          etymology: item.etymology || '',
          usage_notes: item.usage_notes || ''
        };
      });

      onImport(newCache);
      onClose();
    } catch (e: any) {
      setError(e.message || "Invalid JSON format.");
    }
  };

  const handleCopy = async () => {
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
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error("Fallback copy failed");
      }
      
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy Sample'), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      setJsonInput(sampleJson);
      setError("Clipboard access denied. Sample text has been loaded into the box below for manual copy.");
      setCopyStatus('Copy Sample');
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div 
        className="auth-container" 
        style={{ maxWidth: '420px', width: '95%' }}
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="auth-header">
          <h3>Bulk Import</h3>
          <button 
            onClick={onClose} 
            aria-label="Close modal"
            style={{ 
              fontSize: '1.6rem', 
              color: 'var(--text-secondary)',
              padding: '4px 12px',
              borderRadius: '8px',
              background: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 300
            }}
          >
            &lt;
          </button>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Paste a JSON array of words. Enriched fields like Etymology and Usage Notes are now supported.
        </p>

        {error && (
          <div style={{ 
            color: 'var(--danger-color)', 
            fontSize: '0.8rem', 
            marginBottom: '1rem', 
            background: 'rgba(255, 59, 48, 0.1)', 
            padding: '8px', 
            borderRadius: '8px' 
          }}>
            {error}
          </div>
        )}

        <textarea 
          style={{
            width: '100%',
            height: '200px',
            background: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            resize: 'none'
          }}
          placeholder="Paste JSON here..."
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            className="auth-btn primary" 
            onClick={handleImport}
            disabled={!jsonInput.trim()}
            style={{ padding: '16px' }}
          >
            Import All Words
          </button>
          
          <button 
            className="auth-btn" 
            onClick={handleCopy} 
            style={{ 
              border: '2px solid var(--accent-primary)',
              color: copyStatus === 'Copied!' ? 'var(--success-color)' : 'var(--accent-primary)',
              fontWeight: '700',
              background: 'var(--accent-secondary)',
              padding: '14px'
            }}
          >
            {copyStatus}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
