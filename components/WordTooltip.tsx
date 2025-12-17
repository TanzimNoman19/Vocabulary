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
  const TOOLTIP_WIDTH = 260;
  const SCREEN_PADDING = 12; // Padding from screen edges
  
  // 1. Calculate Horizontal Position (X) to keep tooltip on screen
  // Start by centering tooltip on the click point
  let tooltipLeft = x - (TOOLTIP_WIDTH / 2);
  
  // Constrain left edge
  if (tooltipLeft < SCREEN_PADDING) {
    tooltipLeft = SCREEN_PADDING;
  }
  
  // Constrain right edge
  // Ensure it doesn't overflow the window width
  if (tooltipLeft + TOOLTIP_WIDTH > window.innerWidth - SCREEN_PADDING) {
    tooltipLeft = window.innerWidth - TOOLTIP_WIDTH - SCREEN_PADDING;
  }
  
  // 2. Calculate Vertical Position (Y)
  // Default: Above the word
  const ESTIMATED_HEIGHT = 160; 
  let tooltipTop = y - 10; // Start slightly above touch point
  let isFlipped = false;
  
  // Check if space above is insufficient
  if (tooltipTop - ESTIMATED_HEIGHT < SCREEN_PADDING) {
      tooltipTop = y + 30; // Flip to below the touch point
      isFlipped = true;
  } else {
      tooltipTop = tooltipTop - ESTIMATED_HEIGHT; // Move up
  }

  // 3. Calculate Arrow Position
  // The arrow must point to 'x'. Its position relative to the tooltip container is (x - tooltipLeft).
  // We offset by 6px (half the arrow width of 12px) to center it.
  let arrowLeft = x - tooltipLeft - 6;

  // Clamp arrow so it doesn't detach from the tooltip corners (rounded corners)
  const minArrow = 16;
  const maxArrow = TOOLTIP_WIDTH - 28;
  arrowLeft = Math.max(minArrow, Math.min(maxArrow, arrowLeft));

  // Handle outside clicks and scrolling
  useEffect(() => {
    const handleDismiss = (event: Event) => {
        if (event.type === 'mousedown' || event.type === 'click' || event.type === 'touchstart') {
            if (tooltipRef.current && tooltipRef.current.contains(event.target as Node)) {
                return;
            }
        }
        onClose();
    };

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

  // Separate English and Bengali parts based on newlines
  const parts = text.trim().split('\n').filter(p => p.trim().length > 0);
  const englishDef = parts[0] || '';
  const bengaliDef = parts.slice(1).join('\n').trim();

  return (
    <div 
        ref={tooltipRef}
        className="tooltip" 
        style={{ 
            top: tooltipTop,
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
            maxWidth: `calc(100vw - ${SCREEN_PADDING * 2}px)`, // Safety for small screens
            background: '#000000',
            color: '#FFFFFF',
            border: '1px solid #333'
        }}
        onClick={(e) => e.stopPropagation()}
    >
        {/* Header Layout: Word on Left, Button on Right */}
        <div className="tooltip-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 1, marginRight: '8px' }}>
                {/* Yellow Word */}
                <strong style={{ color: '#FFD700', fontSize: '1.1rem', display: 'block', lineHeight: '1.2' }}>{word}</strong>
                {pos && <span style={{ color: '#bbb', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>{pos}</span>}
            </div>

             {/* Redirect Button on Top Right */}
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                }}
                title="Open Card"
                style={{ 
                    color: '#FFF', 
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    flexShrink: 0
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
            </button>
        </div>
        
        <div className="tooltip-body" style={{ marginTop: '0.5rem' }}>
            <p className="english-def" style={{ margin: '0 0 8px 0', lineHeight: '1.4', fontSize: '0.9rem', color: '#fff' }}>
                {englishDef}
            </p>
            {bengaliDef && (
                <span className="bengali-text" style={{ color: '#e0e0e0', display: 'block', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                    {bengaliDef}
                </span>
            )}
        </div>

        <div 
            className="tooltip-arrow" 
            style={{ 
                left: arrowLeft,
                top: isFlipped ? -6 : 'auto',
                bottom: isFlipped ? 'auto' : -6,
                transform: isFlipped ? 'rotate(180deg)' : 'none',
                borderTopColor: isFlipped ? 'transparent' : '#000',
                borderBottomColor: isFlipped ? '#000' : 'transparent'
            }}
        ></div>
    </div>
  );
};

export default WordTooltip;