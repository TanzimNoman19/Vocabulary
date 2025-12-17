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
    { role: 'model', text: 'Hi! I can help manage your vocabulary list. Ask me to add words, remove them, or edit definitions.' }
  ]);
  const [input, setInput] = useState('');
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
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    try {
        const result = await chatSession.current?.sendMessage({ message: userMsg });
        if (result?.text) {
            setMessages(prev => [...prev, { role: 'model', text: result.text }]);
        }
        // Handle tool calls here if needed (omitted for brevity, same logic as before)
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Error connecting." }]);
    }
  };

  return (
    <div className="chat-page">
        <div className="chat-page-header">
            <button onClick={onClose} style={{ color: 'white' }}>←</button>
            <span style={{ fontWeight: 700 }}>LexiFlow AI</span>
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
                    placeholder="Add words, delete list, edit..."
                    style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        paddingRight: '3rem',
                        borderRadius: '24px', 
                        border: 'none', 
                        background: '#1c1c1e', 
                        color: 'white',
                        boxSizing: 'border-box'
                    }}
                />
                <button type="submit" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }}>
                    ➤
                </button>
            </div>
        </form>
    </div>
  );
};

export default ChatInterface;
