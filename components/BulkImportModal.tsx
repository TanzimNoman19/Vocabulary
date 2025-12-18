/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { CardData } from '../services/geminiService';

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
    "synonyms": "luck, fluke",
    "antonyms": "misfortune",
    "difficulty": "Intermediate"
  },
  {
    "word": "Ephemeral",
    "pos": "adjective",
    "ipa": "/əˈfemərəl/",
    "definition": "Lasting for a very short time.",
    "bengali": "ক্ষণস্থায়ী",
    "family": "ephemerally (adv), ephemerality (noun)",
    "context": "The beauty of a sunset is ephemeral, lasting only a few minutes.",
    "synonyms": "fleeting, transitory",
    "antonyms": "permanent, eternal",
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
          difficulty: item.difficulty || ''
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
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
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
          Paste a JSON array of words. You can generate this using an external AI tool.
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