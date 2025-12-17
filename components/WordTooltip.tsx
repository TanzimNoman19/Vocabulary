/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef } from 'react';

interface WordTooltipProps {
  word: string;
  text: string;
  pos?: string;
  x: number;
  y: number;
  onOpen: () => void;
  onClose: () => void;
}

const WordTooltip: React.FC<WordTooltipProps> = ({ word, text, pos, x, y, onOpen, onClose }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const TOOLTIP_WIDTH = 250;
  const SCREEN_PADDING = 10;
  const halfWidth = TOOLTIP_WIDTH / 2;
  
  // Calculate constrained left position
  let tooltipLeft = x - halfWidth;
  tooltipLeft = Math.max(SCREEN_PADDING, tooltipLeft);
  tooltipLeft = Math.min(window.innerWidth - TOOLTIP_WIDTH - SCREEN_PADDING, tooltipLeft);
  
  // Calculate arrow position relative to tooltip container
  const arrowLeft = (x - tooltipLeft) - 6;

  // Calculate top position. If too close to top of screen, flip below
  let tooltipTop = y - 120;
  let isFlipped = false;
  
  if (tooltipTop < SCREEN_PADDING) {
      tooltipTop = y + 30; // Show below the cursor/word
      isFlipped = true;
  }

  // Handle outside clicks and scrolling
  useEffect(() => {
    const handleDismiss = (event: Event) => {
        // For clicks, check if click is inside the tooltip
        if (event.type === 'mousedown' || event.type === 'click' || event.type === 'touchstart') {
            if (tooltipRef.current && tooltipRef.current.contains(event.target as Node)) {
                return;
            }
        }
        onClose();
    };

    // Add listeners
    // Capture phase for scroll is important to detect scrolling of any parent container
    window.addEventListener('scroll', handleDismiss, true); 
    window.addEventListener('resize', handleDismiss);
    document.addEventListener('mousedown', handleDismiss);
    document.addEventListener('touchstart', handleDismiss);

    return () => {
        window.removeEventListener('scroll', handleDismiss, true);
        window.removeEventListener('resize', handleDismiss);
        document.removeEventListener('mousedown', handleDismiss);
        document.removeEventListener('touchstart', handleDismiss);
    };
  }, [onClose]);

  return (
    <div 
        ref={tooltipRef}
        className="tooltip" 
        style={{ 
            top: tooltipTop,
            left: tooltipLeft
        }}
        onClick={(e) => e.stopPropagation()}
    >
        <div className="tooltip-header">
            <div>
                <strong>{word}</strong>
                {pos && <span className="tooltip-pos">{pos}</span>}
            </div>
            <button 
                className="wiki-icon-btn" 
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                }}
                title="Open Details"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </button>
        </div>
        <p style={{ whiteSpace: 'pre-line' }}>{text}</p>
        <div 
            className="tooltip-arrow" 
            style={{ 
                left: arrowLeft,
                top: isFlipped ? -6 : 'auto',
                bottom: isFlipped ? 'auto' : -6,
                transform: isFlipped ? 'rotate(180deg)' : 'none'
            }}
        ></div>
    </div>
  );
};

export default WordTooltip;