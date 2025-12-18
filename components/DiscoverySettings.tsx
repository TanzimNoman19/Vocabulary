/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const DiscoverySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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
                    fontSize: '1.2rem', 
                    color: 'var(--text-muted)',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>FOCUSED</span>
                <span>RANDOM</span>
            </div>
            <input 
              type="range" 
              style={{ 
                width: '100%', 
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer'
              }} 
            />
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: '1.4' }}>
                Adjusts how often new random words appear vs. your saved words.
            </p>
        </div>
    </div>
  );
};

export default DiscoverySettings;