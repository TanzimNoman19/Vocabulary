


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { createChatSession } from '../services/geminiService';
import type { Chat } from '@google/genai';

interface ChatInterfaceProps {
  onClose: () => void;
  onNavigate: (word: string) => void;
  savedWords: string[];
  setSavedWords: React.Dispatch<React.SetStateAction<string[]>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose, onNavigate, savedWords, setSavedWords }) => {
  const [messages, setMessages] = useState<{ role: string, text: string }[]>([
    { role: 'model', text: 'Hi! I can help manage your vocabulary list. You can ask me for things like "Add 20 frequent GRE words" or "Suggest 10 words for describing food".' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatSession = useRef<Chat | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSession.current = createChatSession();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsProcessing(true);

    try {
        let response = await chatSession.current?.sendMessage({ message: userMsg });
        
        if (response?.functionCalls) {
            for (const fc of response.functionCalls) {
                if (fc.name === 'addWordsToList' && fc.args?.words) {
                    const newWords: string[] = fc.args.words;
                    
                    setSavedWords(prev => {
                        const existing = new Set(prev.map(w => w.toLowerCase()));
                        const filteredNew = newWords.filter(w => !existing.has(w.toLowerCase()));
                        return [...filteredNew, ...prev];
                    });

                    response = await chatSession.current?.sendMessage({
                      message: {
                        role: 'user', 
                        parts: [{
                          functionResponse: {
                            name: fc.name,
                            id: fc.id,
                            response: { status: 'success', addedCount: newWords.length }
                          }
                        }]
                      }
                    } as any);
                }
            }
        }

        if (response?.text) {
            setMessages(prev => [...prev, { role: 'model', text: response.text }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "I encountered an error. Please try again." }]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="auth-overlay" style={{ padding: 0 }} onClick={onClose}>
        <div className="chat-page" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div className="chat-page-header">
                <button onClick={onClose} style={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <span style={{ fontWeight: 700 }}>LexiFlow AI</span>
                {isProcessing && (
                  <div className="processing-indicator" style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>
                    AI is thinking...
                  </div>
                )}
            </div>
            
            <div className="chat-body">
                {messages.map((m, i) => (
                    <div key={i} className={`chat-bubble ${m.role}`}>
                        {m.text}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} style={{ padding: '1rem', background: '#000' }}>
                <div style={{ position: 'relative' }}>
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Add 30 GRE words..."
                        disabled={isProcessing}
                        style={{ 
                            width: '100%', 
                            padding: '1rem', 
                            paddingRight: '3rem',
                            borderRadius: '24px', 
                            border: 'none', 
                            background: '#1c1c1e', 
                            // Fixed: Wrapped 'white' in quotes to make it a string literal
                            color: 'white',
                            boxSizing: 'border-box',
                            opacity: isProcessing ? 0.6 : 1
                        }}
                    />
                    <button type="submit" disabled={isProcessing} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', opacity: isProcessing ? 0.5 : 1 }}>
                        {isProcessing ? '...' : '➤'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default ChatInterface;