/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';
import { generateStorySegment, getShortDefinition, STORY_PROMPTS } from '../services/geminiService';

interface StoryViewProps {
  onClose: () => void;
  onNavigate: (word: string) => void;
}

const StoryView: React.FC<StoryViewProps> = ({ onClose, onNavigate }) => {
  // Phase 1: Setup
  const [prompt, setPrompt] = useState(STORY_PROMPTS[0]);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Phase 2: Reading
  const [segments, setSegments] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Tooltip State
  const [tooltip, setTooltip] = useState<{ word: string, text: string, x: number, y: number } | null>(null);
  const [tooltipLoading, setTooltipLoading] = useState(false);

  // Input Ref for resizing
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Handle Mix Button
  const handleMix = () => {
    const random = STORY_PROMPTS[Math.floor(Math.random() * STORY_PROMPTS.length)];
    setPrompt(random);
  };

  // Start Story
  const handleProceed = async () => {
    if (!prompt.trim()) return;
    setHasStarted(true);
    setIsLoading(true);
    try {
      const segment = await generateStorySegment(prompt);
      setSegments([segment]);
      setCurrentIndex(0);
    } catch (e) {
      console.error(e);
      // Fallback
      setHasStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Next Part
  const handleNextPart = async () => {
    // If we already have the next segment in history, just move forward
    if (currentIndex < segments.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return;
    }

    // Generate new segment
    setIsLoading(true);
    try {
      // Pass the last 2 segments as context
      const context = segments.slice(-2).join(' ');
      const nextSegment = await generateStorySegment(prompt, context);
      setSegments(prev => [...prev, nextSegment]);
      setCurrentIndex(prev => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPart = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  // --- Interactive Word Logic ---
  
  // Timer for long press
  const pressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const startPress = (e: React.MouseEvent | React.TouchEvent, word: string) => {
    isLongPress.current = false;
    
    // Get Coordinates
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    pressTimer.current = window.setTimeout(async () => {
      isLongPress.current = true;
      // Show Tooltip
      setTooltip({ word, text: 'Loading...', x: clientX, y: clientY });
      setTooltipLoading(true);
      const def = await getShortDefinition(word);
      setTooltip({ word, text: def, x: clientX, y: clientY });
      setTooltipLoading(false);
    }, 600); // 600ms hold
  };

  const endPress = (e: React.MouseEvent | React.TouchEvent, word: string) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent, word: string) => {
    // If it was a long press, do nothing (tooltip already handled)
    // If short click, navigate
    if (!isLongPress.current) {
        // Simple click -> Navigation
        setTooltip(null); // Close tooltip if open
        onNavigate(word);
    }
  };

  const closeTooltip = () => setTooltip(null);

  // Helper to render story text
  const renderInteractiveText = (text: string) => {
    const words = text.split(/(\s+)/).filter(Boolean);
    return words.map((word, i) => {
      if (/\S/.test(word)) {
        const cleanWord = word.replace(/[.,!?;:()"']/g, '');
        if (cleanWord) {
          return (
            <span
              key={i}
              className="story-word"
              onMouseDown={(e) => startPress(e, cleanWord)}
              onMouseUp={(e) => endPress(e, cleanWord)}
              onMouseLeave={(e) => endPress(e, cleanWord)}
              onTouchStart={(e) => startPress(e, cleanWord)}
              onTouchEnd={(e) => endPress(e, cleanWord)}
              onClick={(e) => handleClick(e, cleanWord)}
            >
              {word}
            </span>
          );
        }
      }
      return <span key={i}>{word}</span>;
    });
  };

  if (!hasStarted) {
    return (
      <div className="story-overlay">
        <div className="story-container setup">
            <div className="story-header">
                <h3>Story Mode</h3>
                <button onClick={onClose} className="close-button">Close</button>
            </div>
            
            <div className="story-setup-content">
                <p className="story-instruction">
                    Enter a prompt or keywords to generate a vocabulary-rich story.
                </p>
                <div className="input-wrapper">
                    <textarea 
                        ref={textAreaRef}
                        className="story-input" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. A mystery in Victorian London..."
                    />
                    <button className="mix-btn" onClick={handleMix} title="Random Prompt">
                        ↻
                    </button>
                </div>
                
                <button className="proceed-btn" onClick={handleProceed} disabled={!prompt.trim() || isLoading}>
                    {isLoading ? 'Generating...' : 'Proceed'}
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="story-overlay" onClick={closeTooltip}>
      <div className="story-container reading">
        <div className="story-header">
            <h3>Chapter {currentIndex + 1}</h3>
            <button onClick={onClose} className="close-button">Close</button>
        </div>

        <div className="story-content">
            {isLoading && segments.length === currentIndex ? (
                <div className="story-loading">
                    <div className="spinner"></div>
                    <p>Writing next part...</p>
                </div>
            ) : (
                <div className="story-text">
                    {renderInteractiveText(segments[currentIndex])}
                </div>
            )}
        </div>

        <div className="story-controls">
            <button 
                className="nav-btn-story" 
                onClick={handlePrevPart} 
                disabled={currentIndex === 0 || isLoading}
            >
                Previous
            </button>
            <button 
                className="nav-btn-story primary" 
                onClick={handleNextPart}
                disabled={isLoading}
            >
                {currentIndex === segments.length - 1 ? 'Next Part' : 'Next Page'}
            </button>
        </div>

        {tooltip && (
            <div 
                className="tooltip" 
                style={{ top: tooltip.y - 60, left: Math.min(tooltip.x - 50, window.innerWidth - 220) }}
                onClick={(e) => e.stopPropagation()}
            >
                <strong>{tooltip.word}</strong>
                <p>{tooltip.text}</p>
                {/* Visual arrow */}
                <div className="tooltip-arrow"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StoryView;
