/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { getShortDefinition } from '../services/geminiService';
import WordTooltip from './WordTooltip';

interface ContentDisplayProps {
  content: string;
  isLoading: boolean;
  onWordClick: (word: string) => void;
}

// InteractiveText now passes the MouseEvent to the handler
const InteractiveText: React.FC<{ text: string; onWordClick: (e: React.MouseEvent, word: string) => void }> = ({ text, onWordClick }) => {
  const words = text.split(/(\s+)/).filter(Boolean);

  return (
    <>
      {words.map((word, index) => {
        if (/\S/.test(word)) {
          const cleanWord = word.replace(/[.,!?;:()"']/g, '');
          if (cleanWord) {
            return (
              <button
                key={index}
                onClick={(e) => onWordClick(e, cleanWord)}
                className="interactive-word"
                aria-label={`Learn more about ${cleanWord}`}
              >
                {word}
              </button>
            );
          }
        }
        return <span key={index}>{word}</span>;
      })}
    </>
  );
};

const FormattedContent: React.FC<{ content: string; onWordClick: (e: React.MouseEvent, word: string) => void }> = ({ content, onWordClick }) => {
  const parts = content.split(/(?=### )/g);

  return (
    <div className="wiki-content">
      {parts.map((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          const firstLineEnd = trimmed.indexOf('\n');
          let header = '';
          let body = '';

          if (firstLineEnd !== -1) {
            header = trimmed.substring(4, firstLineEnd).trim();
            body = trimmed.substring(firstLineEnd + 1).trim();
          } else {
            header = trimmed.substring(4).trim();
          }

          if (!header) return null;

          return (
            <section key={index} className="wiki-section">
              <h3 className="wiki-section-title">{header}</h3>
              <div className="wiki-section-body">
                {/* Use whiteSpace: 'pre-line' to respect line breaks from API */}
                <p style={{ whiteSpace: 'pre-line' }}>
                  <InteractiveText text={body} onWordClick={onWordClick} />
                </p>
              </div>
            </section>
          );
        } else {
          return (
            <div key={index} className="wiki-intro">
               <p style={{ fontSize: '1.2rem', fontStyle: 'italic', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', whiteSpace: 'pre-line' }}>
                <InteractiveText text={trimmed} onWordClick={onWordClick} />
               </p>
            </div>
          );
        }
      })}
    </div>
  );
};

const ContentDisplay: React.FC<ContentDisplayProps> = ({ content, isLoading, onWordClick }) => {
  const [tooltip, setTooltip] = useState<{ word: string, text: string, pos?: string, x: number, y: number } | null>(null);

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;

    setTooltip({ word, text: 'Loading...', x: clientX, y: clientY });

    try {
        const fullDef = await getShortDefinition(word);
        
        // Match regex: (pos) Def. \n Bengali.
        // Use [\s\S]* to match newlines correctly for the Bengali definition
        const match = fullDef.match(/^(\([a-z.]+\))\s*([\s\S]*)/i);
        let pos = '';
        let defText = fullDef;

        if (match) {
            pos = match[1];
            defText = match[2];
        }

        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: defText, pos: pos } : prev));
    } catch (err) {
        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: "Definition unavailable" } : prev));
    }
  };

  const handleOpenPage = () => {
      if (tooltip) {
          onWordClick(tooltip.word); // Calls the original navigation handler
          setTooltip(null);
      }
  };

  return (
    <div onClick={() => setTooltip(null)}>
      <FormattedContent content={content} onWordClick={handleWordClick} />
      {isLoading && <span className="blinking-cursor">|</span>}
      
      {tooltip && (
          <WordTooltip 
              word={tooltip.word}
              text={tooltip.text}
              pos={tooltip.pos}
              x={tooltip.x}
              y={tooltip.y}
              onOpen={handleOpenPage}
              onClose={() => setTooltip(null)}
          />
      )}
    </div>
  );
};

export default ContentDisplay;