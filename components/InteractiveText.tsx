/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';

interface InteractiveTextProps {
  text: string;
  onWordClick: (e: React.MouseEvent, word: string) => void;
  className?: string;
}

const InteractiveText: React.FC<InteractiveTextProps> = ({ text, onWordClick, className }) => {
  // Split by whitespace but keep delimiters to preserve spacing
  // The capturing group in split includes the separator in the result array
  const parts = text.split(/(\s+|[.,!?;:()"'])/g).filter(Boolean);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if it's a word (contains letters)
        if (/[a-zA-Z]/.test(part)) {
          const cleanWord = part.replace(/[^a-zA-Z]/g, '');
           // Render as clickable span
           return (
             <span
               key={index}
               onClick={(e) => {
                   e.stopPropagation();
                   onWordClick(e, cleanWord);
               }}
               style={{ cursor: 'pointer' }}
               className="interactive-word-span"
             >
               {part}
             </span>
           );
        }
        // Render punctuation/spaces as is
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default InteractiveText;