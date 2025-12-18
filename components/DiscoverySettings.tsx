/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface DiscoverySettingsProps {
  value: number;
  onChange: (val: number) => void;
  onClose: () => void;
}

const DiscoverySettings: React.FC<DiscoverySettingsProps> = ({ value, onChange, onClose }) => {
  return (
    <div 
      className="discovery-backdrop" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 1000, 
        background: 'transparent' 
      }} 
      onClick={onClose}
    >
        <div 
          className="discovery-overlay" 
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto'
          }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Discovery Mix</h3>
                <button 
                  onClick={onClose}
                  style={{ 
                    fontSize: '1.6rem', 
                    color: 'var(--text-muted)',
                    padding: '4px 12px',
                    fontWeight: 300
                  }}
                >
                  &lt;
                </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>FOCUSED (Saved)</span>
                <span>RANDOM (New)</span>
            </div>
            <input 
              type="range" 
              min="0"
              max="100"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              style={{ 
                width: '100%', 
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer'
              }} 
            />
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: '1.4' }}>
                {value < 20 ? 'Showing mostly your saved vocabulary.' : 
                 value > 80 ? 'Discovering mostly new random words.' : 
                 'A balanced mix of review and discovery.'}
            </p>
        </div>
    </div>
  );
};

export default DiscoverySettings;