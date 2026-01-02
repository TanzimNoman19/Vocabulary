
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encodeBase64, decodeBase64, decodeAudioData, float32ToInt16 } from '../services/audioUtils';
import { CardData, capitalize } from '../services/dictionaryService';

interface LiveConversationViewProps {
  onSaveWord: (word: string) => void;
  savedWords: string[];
}

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

const LiveConversationView: React.FC<LiveConversationViewProps> = ({ onSaveWord, savedWords }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [transcription, setTranscription] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [capturedWords, setCapturedWords] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  const currentInputText = useRef('');
  const currentOutputText = useRef('');

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    setTranscription([]);
    setCapturedWords([]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isCameraOn });
      streamRef.current = stream;

      if (isCameraOn && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Audio input
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = float32ToInt16(inputData);
              const base64 = encodeBase64(new Uint8Array(pcm16.buffer));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
            
            // Vision input
            if (isCameraOn) {
              frameIntervalRef.current = window.setInterval(() => {
                if (canvasRef.current && videoRef.current) {
                  const canvas = canvasRef.current;
                  const video = videoRef.current;
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(async (blob) => {
                      if (blob) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          sessionPromise.then(s => s.sendRealtimeInput({
                            media: { data: base64, mimeType: 'image/jpeg' }
                          }));
                        };
                        reader.readAsDataURL(blob);
                      }
                    }, 'image/jpeg', 0.6);
                  }
                }
              }, 1000);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio output
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
              source.onended = () => activeSourcesRef.current.delete(source);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop());
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Transcription
            if (message.serverContent?.inputAudioTranscription) {
              currentInputText.current += message.serverContent.inputAudioTranscription.text;
            }
            if (message.serverContent?.outputAudioTranscription) {
              currentOutputText.current += message.serverContent.outputAudioTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = currentInputText.current.trim();
              const modelText = currentOutputText.current.trim();
              
              if (userText || modelText) {
                setTranscription(prev => [
                  ...prev,
                  ...(userText ? [{ role: 'user', text: userText } as const] : []),
                  ...(modelText ? [{ role: 'model', text: modelText } as const] : [])
                ].slice(-10)); // Keep last 10 turns
                
                // Vocab Extraction Heuristic
                if (modelText) {
                  const words = modelText.split(/\s+/).filter(w => w.length > 5 && !['vocabulary', 'everything', 'something'].includes(w.toLowerCase()));
                  const uniqueNew = Array.from(new Set(words.map(w => capitalize(w.replace(/[.,!?;:]/g, '')))))
                    .filter(w => !savedWords.includes(w));
                  setCapturedWords(prev => Array.from(new Set([...prev, ...uniqueNew])).slice(0, 5));
                }
              }
              currentInputText.current = '';
              currentOutputText.current = '';
            }
          },
          onerror: (e) => {
            console.error('Live Error:', e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: `You are LexiFlow's Vocab Mentor. 
            Help the user learn new words. 
            When they show you an object via camera, name it and give a sophisticated vocabulary word related to it.
            Keep explanations conversational and encouraging. 
            If you mention a complex word, define it briefly.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  return (
    <div className="live-view-container">
      <div className="live-header">
        <h2 className="live-title">Live Session</h2>
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'online' : (isConnecting ? 'connecting' : 'offline')}`} />
          <span>{isConnected ? 'Active' : (isConnecting ? 'Connecting...' : 'Ready')}</span>
        </div>
      </div>

      <div className="live-visual-area">
        {isCameraOn ? (
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        ) : (
          <div className="voice-visualization">
            <div className={`wave-circle ${isConnected ? 'active' : ''}`}>
               <div className="inner-pulse" />
            </div>
            {!isConnected && !isConnecting && (
              <p className="hint-text">Connect to start talking</p>
            )}
          </div>
        )}

        <div className="transcription-overlay">
          {transcription.map((t, i) => (
            <div key={i} className={`transcription-line ${t.role}`}>
              <span className="text">{t.text}</span>
            </div>
          ))}
          {isConnecting && <div className="transcription-line model loading">Waiting for Gemini...</div>}
        </div>
      </div>

      <div className="captured-words-section">
        <div className="section-label">CAPTURED VOCABULARY</div>
        <div className="captured-grid">
          {capturedWords.length > 0 ? (
            capturedWords.map(word => (
              <button key={word} className="captured-word-chip" onClick={() => {
                onSaveWord(word);
                setCapturedWords(prev => prev.filter(w => w !== word));
              }}>
                <span className="word">{word}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            ))
          ) : (
            <p className="empty-hint">Talk to discover words</p>
          )}
        </div>
      </div>

      <div className="live-controls">
        <button className={`control-btn ${isMicOn ? 'active' : 'muted'}`} onClick={() => setIsMicOn(!isMicOn)}>
          {isMicOn ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          )}
        </button>

        {!isConnected ? (
          <button className={`main-connect-btn ${isConnecting ? 'loading' : ''}`} onClick={startSession} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'CONNECT LIVE'}
          </button>
        ) : (
          <button className="main-disconnect-btn" onClick={stopSession}>
            DISCONNECT
          </button>
        )}

        <button className={`control-btn ${isCameraOn ? 'active' : ''}`} onClick={() => setIsCameraOn(!isCameraOn)} disabled={isConnected}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </button>
      </div>

      <style>{`
        .live-view-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          background: #000;
          color: #fff;
          padding-bottom: 120px;
        }

        .live-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .live-title { margin: 0; font-size: 1.4rem; font-weight: 800; }
        .status-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; opacity: 0.8; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.online { background: #4ade80; box-shadow: 0 0 10px #4ade80; }
        .status-dot.connecting { background: #fbbf24; animation: pulse 1s infinite; }
        .status-dot.offline { background: #52525b; }

        .live-visual-area {
          flex: 1;
          background: #18181b;
          border-radius: 32px;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .camera-preview video { width: 100%; height: 100%; object-fit: cover; }
        
        .voice-visualization { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .wave-circle {
          width: 120px; height: 120px;
          border-radius: 50%;
          background: rgba(88, 86, 214, 0.1);
          border: 2px solid rgba(88, 86, 214, 0.3);
          display: flex; align-items: center; justify-content: center;
        }
        .wave-circle.active { border-color: var(--accent-primary); animation: glow 2s infinite; }
        .inner-pulse { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-primary); }
        .wave-circle.active .inner-pulse { animation: pulse 1.5s infinite; }

        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(88, 86, 214, 0.2); } 50% { box-shadow: 0 0 40px rgba(88, 86, 214, 0.5); } }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.6; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.8); opacity: 0.6; } }

        .hint-text { font-size: 0.8rem; color: #71717a; font-weight: 600; }

        .transcription-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          padding: 1.5rem;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .transcription-line { font-size: 0.95rem; font-weight: 600; line-height: 1.4; max-width: 85%; }
        .transcription-line.user { align-self: flex-end; color: #a5b4fc; text-align: right; }
        .transcription-line.model { align-self: flex-start; color: #fff; }
        .transcription-line.loading { opacity: 0.6; font-style: italic; }

        .captured-words-section { margin-bottom: 1.5rem; }
        .section-label { font-size: 0.7rem; font-weight: 800; color: #71717a; margin-bottom: 0.75rem; letter-spacing: 1px; }
        .captured-grid { display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px; }
        .captured-word-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 12px;
          background: #27272a; border: 1px solid #3f3f46;
          color: #fff; font-size: 0.85rem; font-weight: 700;
          transition: all 0.2s;
        }
        .captured-word-chip:active { transform: scale(0.95); background: #3f3f46; }
        .empty-hint { font-size: 0.85rem; color: #52525b; font-style: italic; margin: 0; }

        .live-controls { display: flex; align-items: center; gap: 1rem; }
        .control-btn {
          width: 56px; height: 56px; border-radius: 18px;
          background: #27272a; border: 1px solid #3f3f46;
          color: #fff; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .control-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); }
        .control-btn.muted { color: #f87171; background: rgba(248, 113, 113, 0.1); border-color: rgba(248, 113, 113, 0.2); }
        .control-btn:disabled { opacity: 0.3; }

        .main-connect-btn {
          flex: 1; height: 56px; border-radius: 18px;
          background: #fff; color: #000; font-weight: 800; font-size: 0.95rem;
          letter-spacing: 0.5px; transition: all 0.2s;
        }
        .main-disconnect-btn {
          flex: 1; height: 56px; border-radius: 18px;
          background: #ef4444; color: #fff; font-weight: 800; font-size: 0.95rem;
          letter-spacing: 0.5px; transition: all 0.2s;
        }
        .main-connect-btn:active, .main-disconnect-btn:active { transform: scale(0.98); }
        .main-connect-btn.loading { opacity: 0.7; }
      `}</style>
    </div>
  );
};

export default LiveConversationView;
