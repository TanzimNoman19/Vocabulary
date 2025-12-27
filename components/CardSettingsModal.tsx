
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import type { VisibilitySettings } from '../App';

interface CardSettingsModalProps {
  settings: VisibilitySettings;
  onUpdate: (settings: VisibilitySettings) => void;
  onClose: () => void;
}

const CardSettingsModal: React.FC<CardSettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const toggle = (key: keyof VisibilitySettings) => {
    onUpdate({ ...settings, [key]: !settings[key] });
  };

  const sections: { key: keyof VisibilitySettings, label: string }[] = [
    { key: 'ipa', label: 'IPA Pronunciation' },
    { key: 'definition', label: 'Definition' },
    { key: 'bengali', label: 'Bengali Meaning' },
    { key: 'context', label: 'Sentence Context' },
    { key: 'synonyms', label: 'Synonyms' },
    { key: 'antonyms', label: 'Antonyms' },
    { key: 'family', label: 'Word Family' },
    { key: 'etymology', label: 'Etymology (Origin)' },
    { key: 'usageNotes', label: 'Usage Notes' }
  ];

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-container" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
        <div className="auth-header" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Card Customization</h3>
          <button onClick={onClose} style={{ fontSize: '1.5rem' }}>&lt;</button>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Choose which sections to display on the back of your flashcards.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sections.map(section => (
            <label 
              key={section.key} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--accent-secondary)',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{section.label}</span>
              <div 
                onClick={() => toggle(section.key)}
                style={{
                  width: '44px',
                  height: '24px',
                  background: settings[section.key] ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderRadius: '12px',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  background: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '3px',
                  left: settings[section.key] ? '23px' : '3px',
                  transition: 'left 0.2s'
                }} />
              </div>
            </label>
          ))}
        </div>
        
        <button 
          className="auth-btn primary" 
          onClick={onClose}
          style={{ marginTop: '2rem' }}
        >
          Close & Save
        </button>
      </div>
    </div>
  );
};

export default CardSettingsModal;
