/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { SRSItem } from '../services/srsService';

interface SavedWordsListProps {
  savedWords: string[];
  srsData: Record<string, SRSItem>;
  onNavigate: (word: string) => void;
}

const SavedWordsList: React.FC<SavedWordsListProps> = ({ savedWords, srsData, onNavigate }) => {
  return (
    <div className="saved-list-view">
      <div className="list-header">Saved Words</div>
      
      {savedWords.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
              No words saved yet.
          </div>
      ) : (
          savedWords.map(word => {
              const item = srsData[word];
              const isMastered = item && item.masteryLevel >= 5;
              const isLearning = item && item.masteryLevel > 0 && item.masteryLevel < 5;
              
              let badgeClass = 'new';
              let badgeText = 'NEW';
              if (isMastered) { badgeClass = 'mastered'; badgeText = 'MASTERED'; }
              else if (isLearning) { badgeClass = 'learning'; badgeText = 'LEARNING'; }

              return (
                  <div key={word} className="word-card-row" onClick={() => onNavigate(word)}>
                      <div className="row-content">
                          <h3>
                              {word}
                              <span className={`mini-badge ${badgeClass}`}>{badgeText}</span>
                          </h3>
                          <p className="row-def">Tap to view details</p>
                      </div>
                      <div className="row-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ff2d55" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      </div>
                  </div>
              );
          })
      )}
    </div>
  );
};

export default SavedWordsList;
