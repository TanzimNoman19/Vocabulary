
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import type { VocabLevel } from '../services/dictionaryService';

interface DiscoverySettingsProps {
  mix: number;
  onMixChange: (val: number) => void;
  level: VocabLevel;
  onLevelChange: (val: VocabLevel) => void;
  onClose: () => void;
}

const DiscoverySettings: React.FC<DiscoverySettingsProps> = ({ mix, onMixChange, level, onLevelChange, onClose }) => {
  const levels: { id: VocabLevel, label: string }[] = [
    { id: 'basic', label: 'Basic' },
    { id: 'intermediate', label: 'Intermed.' },
    { id: 'gre', label: 'GRE' },
    { id: 'ielts', label: 'IELTS' },
    { id: 'expert', label: 'Expert' }
  ];

  return (
    <div className="auth-overlay" onClick={onClose}>
        <div className="discovery-overlay" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Explore Preferences</h3>
                <button onClick={onClose} style={{ fontSize: '1.6rem', fontWeight: 300 }}>&lt;</button>
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
                <label className="section-label">VOCABULARY TARGET LEVEL</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {levels.map(lvl => (
                        <button 
                            key={lvl.id}
                            onClick={() => onLevelChange(lvl.id)}
                            style={{
                                padding: '12px 6px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                background: level === lvl.id ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                                color: level === lvl.id ? 'white' : 'var(--accent-primary)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {lvl.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
                <label className="section-label">DISCOVERY MIX</label>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Library (Review)</span>
                    <span>Explore (Random)</span>
                </div>
                <input type="range" min="0" max="100" value={mix} onChange={(e) => onMixChange(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', height: '8px' }} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: '1.4', textAlign: 'center' }}>
                    Currently showing a <b>{100-mix}% review</b> and <b>{mix}% new word</b> balance.
                </p>
            </div>
            
            <button className="auth-btn primary" onClick={onClose} style={{ marginTop: '1rem' }}>
                Save Preferences
            </button>
        </div>
    </div>
  );
};

export default DiscoverySettings;
