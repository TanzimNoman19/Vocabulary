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

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose, onNavigate, savedWords, setSavedWords }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I can help you manage your vocabulary list or find new words. Try saying "Add serendipity and petrichor to my list".' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSession = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize session once
    chatSession.current = createChatSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToolCall = async (functionCalls: any[]) => {
    const functionResponseParts = [];

    for (const call of functionCalls) {
      const { name, args, id } = call;
      let result = {};

      console.log(`[Chat] Executing tool: ${name}`, args);

      try {
        if (name === 'addWordsToCollection') {
          const newWords = args.words as string[];
          setSavedWords(prev => {
             // Avoid duplicates
             const combined = new Set([...prev, ...newWords]);
             return Array.from(combined);
          });
          result = { success: true, added: newWords, message: `Added ${newWords.join(', ')}` };
        } else if (name === 'removeWordsFromCollection') {
          const removeWords = (args.words as string[]).map(w => w.toLowerCase());
          setSavedWords(prev => prev.filter(w => !removeWords.includes(w.toLowerCase())));
          result = { success: true, removed: removeWords };
        } else if (name === 'navigateToWord') {
          const word = args.word as string;
          onNavigate(word);
          result = { success: true, navigatedTo: word };
        } else if (name === 'getSavedWords') {
          result = { words: savedWords };
        }
      } catch (e) {
        result = { error: String(e) };
      }

      // Wrap the response in 'functionResponse' to match the Part type
      functionResponseParts.push({
        functionResponse: {
          id,
          name,
          response: { result },
        }
      });
    }

    // Send tool result back to model
    if (chatSession.current && functionResponseParts.length > 0) {
      try {
        const response = await chatSession.current.sendMessage({ message: functionResponseParts });
        const text = response.text;
        if (text) {
          setMessages(prev => [...prev, { role: 'model', text }]);
        }
        
        // Handle chained tool calls (recursive)
        if (response.functionCalls && response.functionCalls.length > 0) {
          await handleToolCall(response.functionCalls);
        }
      } catch (err) {
        console.error("Error sending tool response:", err);
        setMessages(prev => [...prev, { role: 'model', text: 'Error executing commands.' }]);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !chatSession.current || isLoading) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatSession.current.sendMessage({ message: userText });
      
      // 1. Handle Text Response
      if (response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }

      // 2. Handle Function Calls (The app control logic)
      if (response.functionCalls && response.functionCalls.length > 0) {
        await handleToolCall(response.functionCalls);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error processing that request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        <div className="chat-header">
          <h3>Assistant</h3>
          <button onClick={onClose} className="close-button">Close</button>
        </div>
        
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.text}
            </div>
          ))}
          {isLoading && <div className="message model loading">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="chat-input-area">
          <input 
            type="text" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask to add words, define, etc..."
            className="chat-input"
            autoFocus
          />
          <button type="submit" className="chat-send-btn" disabled={isLoading || !inputValue}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;