/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const DiscoverySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="discovery-overlay">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Discovery Mix</h3>
            <button onClick={onClose}>✕</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>FOCUSED</span>
            <span>RANDOM</span>
        </div>
        <input type="range" style={{ width: '100%' }} />
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Adjusts how often new random words appear vs. your saved words.
        </p>
    </div>
  );
};

export default DiscoverySettings;
