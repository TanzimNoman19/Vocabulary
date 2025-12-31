
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';
import { generateStorySegment, getShortDefinition, generateCreativePrompt, CardData } from '../services/geminiService';
import WordTooltip from './WordTooltip';

export interface StoryState {
  prompt: string;
  hasStarted: boolean;
  segments: string[];
  currentIndex: number;
}

interface StoryViewProps {
  onClose: () => void;
  onNavigate: (word: string) => void;
  state: StoryState;
  onUpdateState: (newState: Partial<StoryState>) => void;
  cardCache: Record<string, CardData>; // Added cache prop
}

const StoryView: React.FC<StoryViewProps> = ({ onClose, onNavigate, state, onUpdateState, cardCache }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  // Tooltip State
  const [tooltip, setTooltip] = useState<{ word: string, text: string, pos?: string, x: number, y: number } | null>(null);
  
  // Refs
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize prompt if empty
  useEffect(() => {
    if (!state.prompt && !state.hasStarted) {
        handleMix();
    }
  }, []);

  // Handle Mix Button (AI Generated Prompt)
  const handleMix = async () => {
    setIsPromptLoading(true);
    try {
        const prompt = await generateCreativePrompt();
        onUpdateState({ prompt });
    } catch (e) {
        console.error("Failed to generate prompt", e);
    } finally {
        setIsPromptLoading(false);
    }
  };

  // Start Story
  const handleProceed = async () => {
    if (!state.prompt.trim()) return;
    onUpdateState({ hasStarted: true });
    setIsLoading(true);
    try {
      const segment = await generateStorySegment(state.prompt);
      onUpdateState({ segments: [segment], currentIndex: 0 });
    } catch (e) {
      console.error(e);
      onUpdateState({ hasStarted: false });
    } finally {
      setIsLoading(false);
    }
  };

  // Next Part
  const handleNextPart = async () => {
    if (state.currentIndex < state.segments.length - 1) {
      onUpdateState({ currentIndex: state.currentIndex + 1 });
      return;
    }

    setIsLoading(true);
    try {
      const context = state.segments.slice(-2).join(' ');
      const nextSegment = await generateStorySegment(state.prompt, context);
      onUpdateState({ 
          segments: [...state.segments, nextSegment],
          currentIndex: state.currentIndex + 1
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPart = () => {
    if (state.currentIndex > 0) {
        onUpdateState({ currentIndex: state.currentIndex - 1 });
    }
  };

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Check Cache first
    if (cardCache[word]) {
      const cached = cardCache[word];
      setTooltip({ 
        word, 
        text: `${cached.definition}\n${cached.bengali}`, 
        pos: cached.pos ? `(${cached.pos})` : undefined, 
        x: clientX, 
        y: clientY 
      });
      return;
    }

    setTooltip({ word, text: 'Loading...', x: clientX, y: clientY });
    
    try {
        const fullDef = await getShortDefinition(word);
        const match = fullDef.match(/^(\([a-z.]+\))\s*([\s\S]*)/i);
        let pos = '';
        let defText = fullDef;
        if (match) { pos = match[1]; defText = match[2]; }
        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: defText, pos: pos } : prev));
    } catch (err) {
        setTooltip(prev => (prev && prev.word === word ? { ...prev, text: "Definition unavailable" } : prev));
    }
  };

  const handleOpenPage = () => {
    if (tooltip) {
        onNavigate(tooltip.word);
        setTooltip(null);
    }
  };

  const renderInteractiveText = (text: string) => {
    const words = text.split(/(\s+)/).filter(Boolean);
    return words.map((word, i) => {
      if (/\S/.test(word)) {
        const cleanWord = word.replace(/[.,!?;:()"']/g, '');
        if (cleanWord) {
          return (
            <span
              key={i}
              className={`story-word ${tooltip?.word === cleanWord ? 'active' : ''}`}
              onClick={(e) => handleWordClick(e, cleanWord)}
            >
              {word}
            </span>
          );
        }
      }
      return <span key={i}>{word}</span>;
    });
  };

  if (!state.hasStarted) {
    return (
      <div className="story-overlay">
        <div className="story-container setup">
            <div className="story-header">
                <h3>Story Mode</h3>
                <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
            </div>
            
            <div className="story-setup-content">
                <p className="story-instruction">
                    Enter a prompt or keywords to generate a vocabulary-rich story.
                </p>
                <div className="input-wrapper">
                    <textarea 
                        ref={textAreaRef}
                        className="story-input" 
                        value={state.prompt}
                        onChange={(e) => onUpdateState({ prompt: e.target.value })}
                        placeholder={isPromptLoading ? "Generating prompt..." : "e.g. A mystery in Victorian London..."}
                        disabled={isPromptLoading}
                    />
                    <button className="mix-btn" onClick={handleMix} title="Random Prompt" disabled={isPromptLoading}>
                        {isPromptLoading ? '...' : '↻'}
                    </button>
                </div>
                
                <button className="proceed-btn" onClick={handleProceed} disabled={!state.prompt.trim() || isLoading || isPromptLoading}>
                    {isLoading ? 'Generating...' : 'Proceed'}
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="story-overlay" onClick={() => setTooltip(null)}>
      <div className="story-container reading">
        <div className="story-header">
            <h3>Chapter {state.currentIndex + 1}</h3>
            <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
        </div>

        <div className="story-content">
            {isLoading && state.segments.length === state.currentIndex ? (
                <div className="story-loading">
                    <div className="spinner"></div>
                    <p>Writing next part...</p>
                </div>
            ) : (
                <div className="story-text">
                    {state.segments[state.currentIndex] && renderInteractiveText(state.segments[state.currentIndex])}
                </div>
            )}
        </div>

        <div className="story-controls">
            <button 
                className="nav-btn-story" 
                onClick={handlePrevPart} 
                disabled={state.currentIndex === 0 || isLoading}
            >
                Previous
            </button>
            <button 
                className="nav-btn-story primary" 
                onClick={handleNextPart}
                disabled={isLoading}
            >
                {state.currentIndex === state.segments.length - 1 ? 'Next Part' : 'Next Page'}
            </button>
        </div>

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
    </div>
  );
};

export default StoryView;
