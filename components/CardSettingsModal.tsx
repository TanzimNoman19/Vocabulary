
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import type { VisibilitySettings } from '../App';

interface CardSettingsModalProps {
  visibility: VisibilitySettings;
  onUpdateVisibility: (v: VisibilitySettings) => void;
  explorePackSize: number;
  onUpdatePackSize: (n: number) => void;
  definitionStyle: string;
  onUpdateDefinitionStyle: (s: string) => void;
  theme: 'light' | 'dark';
  onUpdateTheme: (t: 'light' | 'dark') => void;
  onClose: () => void;
}

type ActiveSection = 'visibility' | 'explore' | 'ai' | 'appearance' | 'advanced' | null;

const CardSettingsModal: React.FC<CardSettingsModalProps> = ({ 
    visibility, onUpdateVisibility, explorePackSize, onUpdatePackSize, definitionStyle, onUpdateDefinitionStyle, theme, onUpdateTheme, onClose 
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  const toggleSection = (section: ActiveSection) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  const toggleVisibility = (key: keyof VisibilitySettings) => {
    onUpdateVisibility({ ...visibility, [key]: !visibility[key] });
  };

  const sections: { key: keyof VisibilitySettings, label: string }[] = [
    { key: 'definition', label: 'Definition' },
    { key: 'bengali', label: 'Bengali Meaning' },
    { key: 'context', label: 'Sentence Context' },
    { key: 'synonyms', label: 'Synonyms' },
    { key: 'antonyms', label: 'Antonyms' },
    { key: 'family', label: 'Word Family' },
    { key: 'usageNotes', label: 'Usage Notes' }
  ];

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button onClick={onClose} className="header-close-btn" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="modal-scroll-area">
          <div className="settings-stack">
            
            <div className={`accordion-box ${activeSection === 'appearance' ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => toggleSection('appearance')}>
                <div className="header-text">
                  <span className="header-emoji">🎨</span>
                  <span>Appearance</span>
                </div>
                <svg className="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div className="accordion-content">
                <p className="content-hint">Choose your preferred application theme.</p>
                <div className="segmented-selector">
                  <button 
                    className={`segment-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => onUpdateTheme('light')}
                  >
                    Light
                  </button>
                  <button 
                    className={`segment-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => onUpdateTheme('dark')}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>

            <div className={`accordion-box ${activeSection === 'visibility' ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => toggleSection('visibility')}>
                <div className="header-text">
                  <span className="header-emoji">👁️</span>
                  <span>Card Visibility</span>
                </div>
                <svg className="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div className="accordion-content">
                <p className="content-hint">Toggle which details appear on the back of your flashcards.</p>
                <div className="visibility-grid">
                  {sections.map(section => (
                    <div key={section.key} className="toggle-row" onClick={() => toggleVisibility(section.key)}>
                      <span className="toggle-label">{section.label}</span>
                      <div className={`modern-switch ${visibility[section.key] ? 'on' : ''}`}>
                        <div className="switch-thumb" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`accordion-box ${activeSection === 'explore' ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => toggleSection('explore')}>
                <div className="header-text">
                  <span className="header-emoji">🧭</span>
                  <span>Explore Mode</span>
                </div>
                <svg className="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div className="accordion-content">
                <div className="slider-group">
                  <div className="slider-labels">
                    <span className="slider-title">Pack Size</span>
                    <span className="slider-val">{explorePackSize} words</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="15" 
                    step="1"
                    value={explorePackSize} 
                    onChange={(e) => onUpdatePackSize(parseInt(e.target.value))} 
                    className="ios-slider"
                  />
                  <p className="content-hint">How many new words Gemini generates per explore pack.</p>
                </div>
              </div>
            </div>

            <div className={`accordion-box ${activeSection === 'ai' ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => toggleSection('ai')}>
                <div className="header-text">
                  <span className="header-emoji">🤖</span>
                  <span>AI Content Style</span>
                </div>
                <svg className="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div className="accordion-content">
                <div className="segmented-selector">
                  {['concise', 'standard', 'detailed'].map(style => (
                    <button 
                      key={style} 
                      className={`segment-btn ${definitionStyle === style ? 'active' : ''}`}
                      onClick={() => onUpdateDefinitionStyle(style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="content-hint">"Concise" uses shorter definitions. "Detailed" provides more nuance.</p>
              </div>
            </div>

          </div>
        </div>

        <div className="modal-footer">
          <button className="auth-btn primary full-save-btn" onClick={onClose}>
            Save & Exit
          </button>
        </div>

        <style>{`
          .settings-modal {
            width: 95%;
            max-width: 420px;
            height: 80vh;
            max-height: 700px;
            background: var(--card-bg);
            border-radius: 32px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 30px 60px -12px rgba(0,0,0,0.3);
            animation: settingsSlideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          @keyframes settingsSlideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          .modal-header {
            flex-shrink: 0;
            padding: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            background: var(--card-bg);
          }

          .modal-title { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; }

          .header-close-btn {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: var(--accent-secondary);
            color: var(--accent-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .header-close-btn:active { transform: scale(0.9); }

          .modal-scroll-area {
            flex: 1;
            overflow-y: auto;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            -webkit-overflow-scrolling: touch;
          }

          .settings-stack {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding-bottom: 1rem;
          }

          .modal-footer {
            flex-shrink: 0;
            padding: 1.5rem;
            background: var(--card-bg);
            border-top: 1px solid var(--border-color);
          }

          .full-save-btn { width: 100%; font-weight: 800; font-size: 1rem; height: 56px; border-radius: 18px; }

          .accordion-box {
            background: var(--bg-color);
            border: 2px solid var(--border-color);
            border-radius: 24px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .accordion-box.active {
            border-color: var(--accent-primary);
            background: var(--card-bg);
            box-shadow: 0 10px 30px -10px rgba(88, 86, 214, 0.1);
          }

          .accordion-header {
            padding: 1.25rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
          }
          .accordion-header:hover { background: rgba(88, 86, 214, 0.02); }

          .header-text { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 1.05rem; color: var(--text-primary); }
          .header-emoji { font-size: 1.2rem; }

          .chevron { 
            color: var(--text-muted); 
            transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); 
          }
          .accordion-box.active .chevron { transform: rotate(180deg); color: var(--accent-primary); }

          .accordion-content {
            padding: 0 1.5rem 1.5rem 1.5rem;
            display: none;
            flex-direction: column;
            gap: 1rem;
            animation: fadeInDown 0.3s ease-out;
          }
          .accordion-box.active .accordion-content { display: flex; }

          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .content-hint { font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.4; font-weight: 500; }

          .visibility-grid { display: flex; flex-direction: column; gap: 8px; }
          .toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 14px;
            background: var(--accent-secondary);
            border-radius: 16px;
            cursor: pointer;
            transition: transform 0.1s;
          }
          .toggle-row:active { transform: scale(0.98); }
          .toggle-label { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }

          .modern-switch {
            width: 48px;
            height: 26px;
            background: var(--text-muted);
            border-radius: 20px;
            position: relative;
            transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .modern-switch.on { background: var(--accent-primary); }
          .switch-thumb {
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            position: absolute;
            top: 3px;
            left: 3px;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
          }
          .modern-switch.on .switch-thumb { transform: translateX(22px); }

          .slider-group { display: flex; flex-direction: column; gap: 12px; }
          .slider-labels { display: flex; justify-content: space-between; align-items: center; }
          .slider-title { font-weight: 800; color: var(--text-primary); font-size: 0.95rem; }
          .slider-val { background: var(--accent-primary); color: white; padding: 4px 10px; border-radius: 10px; font-size: 0.85rem; font-weight: 800; }

          .ios-slider {
            width: 100%;
            height: 8px;
            background: var(--border-color);
            border-radius: 4px;
            outline: none;
            accent-color: var(--accent-primary);
            cursor: pointer;
          }

          .segmented-selector {
            display: grid;
            grid-template-columns: 1fr 1fr;
            background: var(--accent-secondary);
            padding: 4px;
            border-radius: 16px;
            gap: 4px;
          }
          .accordion-box[class*="ai"] .segmented-selector {
            grid-template-columns: 1fr 1fr 1fr;
          }
          .segment-btn {
            padding: 10px 4px;
            font-size: 0.8rem;
            font-weight: 800;
            border-radius: 12px;
            color: var(--accent-primary);
            transition: all 0.25s;
          }
          .segment-btn.active {
            background: var(--accent-primary);
            color: white;
            box-shadow: 0 4px 12px rgba(88, 86, 214, 0.2);
          }
        `}</style>
      </div>
    </div>
  );
};

export default CardSettingsModal;
