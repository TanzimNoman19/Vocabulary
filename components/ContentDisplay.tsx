
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ContentDisplayProps {
  content: string;
  isLoading: boolean;
  onWordClick: (word: string) => void;
}

// Helper: Renders text where individual words are clickable
const InteractiveText: React.FC<{ text: string; onWordClick: (word: string) => void }> = ({ text, onWordClick }) => {
  const words = text.split(/(\s+)/).filter(Boolean); // Keep whitespace for spacing

  return (
    <>
      {words.map((word, index) => {
        // Only make non-whitespace words clickable
        if (/\S/.test(word)) {
          const cleanWord = word.replace(/[.,!?;:()"']/g, '');
          if (cleanWord) {
            return (
              <button
                key={index}
                onClick={() => onWordClick(cleanWord)}
                className="interactive-word"
                aria-label={`Learn more about ${cleanWord}`}
              >
                {word}
              </button>
            );
          }
        }
        // Render whitespace as-is
        return <span key={index}>{word}</span>;
      })}
    </>
  );
};

// Helper: Parses content into sections based on "### HEADER"
const FormattedContent: React.FC<{ content: string; onWordClick: (word: string) => void }> = ({ content, onWordClick }) => {
  // Split content by "### HEADER_NAME"
  const parts = content.split(/(?=### )/g);

  return (
    <div className="wiki-content">
      {parts.map((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return null;

        // Check if this part starts with a header
        if (trimmed.startsWith('### ')) {
          const firstLineEnd = trimmed.indexOf('\n');
          let header = '';
          let body = '';

          if (firstLineEnd !== -1) {
            header = trimmed.substring(4, firstLineEnd).trim(); // Remove "### "
            body = trimmed.substring(firstLineEnd + 1).trim();
          } else {
            header = trimmed.substring(4).trim();
          }

          if (!header) return null;

          return (
            <section key={index} className="wiki-section">
              <h3 className="wiki-section-title">{header}</h3>
              <div className="wiki-section-body">
                <p>
                  <InteractiveText text={body} onWordClick={onWordClick} />
                </p>
              </div>
            </section>
          );
        } else {
          // Content before any header (e.g. initial Pronunciation line)
          return (
            <div key={index} className="wiki-intro">
               <p style={{ fontSize: '1.2rem', fontStyle: 'italic', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
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
  // We render content even if loading (streaming)
  return (
    <div>
      <FormattedContent content={content} onWordClick={onWordClick} />
      {isLoading && <span className="blinking-cursor">|</span>}
    </div>
  );
};

export default ContentDisplay;
