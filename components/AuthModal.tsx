
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, userDisplayName, userEmail, onSignOut }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [signupSuccess, setSignupSuccess] = useState(false);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Proactive guard for offline state
    if (!navigator.onLine) {
        setMessage({ text: 'You are currently offline. Please connect to the internet to perform account actions.', type: 'error' });
        return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        if (!username.trim()) {
            throw new Error("Username is required");
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setSignupSuccess(true);
          setMessage({ text: 'Check your email for a confirmation link to complete registration.', type: 'success' });
        } else {
          onClose();
        }
      }
    } catch (error: any) {
      console.error("Auth process error:", error);
      let errorMsg = error.message || 'Authentication failed. Please check your credentials and try again.';
      
      // Specifically identify network failures which present as "Failed to fetch" in the browser
      if (errorMsg.includes('fetch') || errorMsg.includes('Network') || errorMsg.includes('Failed to')) {
          errorMsg = 'Unable to connect to the authentication server. This is usually due to a poor internet connection or a firewall blocking the service. Please try again in a few moments.';
      }
      
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (userEmail) {
    return (
      <div className="auth-overlay" onClick={onClose}>
        <div className="auth-container" onClick={(e) => e.stopPropagation()}>
          <div className="auth-header">
            <h3>Account</h3>
            <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
          </div>
          <div className="auth-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Signed in as:</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{userDisplayName}</p>
            {userDisplayName !== userEmail && (
                <p className="auth-email" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 2rem 0' }}>{userEmail}</p>
            )}
            
            <div className="auth-actions" style={{ marginTop: '2rem' }}>
               <button onClick={onSignOut} className="auth-btn logout">Sign Out</button>
            </div>
            <p className="auth-note" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
                Progress is automatically synced to the cloud.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h3>{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
        </div>
        
        {message && (
            <div className={`auth-message ${message.type}`} style={{ 
                marginBottom: '1rem', 
                padding: '12px', 
                borderRadius: '12px', 
                fontSize: '0.85rem',
                lineHeight: '1.4',
                background: message.type === 'error' ? 'rgba(255, 59, 48, 0.08)' : 'rgba(0, 200, 83, 0.08)',
                color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
                border: `1px solid ${message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'}`
            }}>
              {message.text}
            </div>
        )}

        {signupSuccess ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📩</div>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                Verification link sent to <strong>{email}</strong>. 
                Please check your inbox (and spam) to activate your account.
            </p>
            <button 
                className="auth-btn primary" 
                style={{ marginTop: '1.5rem' }}
                onClick={() => {
                    setSignupSuccess(false);
                    setIsLogin(true);
                    setMessage(null);
                }}
            >
                Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="auth-form">
            {!isLogin && (
              <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                  className="auth-input"
                  minLength={3}
                  style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              minLength={6}
              style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
            />
            
            <button type="submit" className="auth-btn primary" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--accent-primary)', color: 'white', fontWeight: '700', marginTop: '8px' }}>
              {loading ? 'Authenticating...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>

            <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
                    style={{ color: 'var(--accent-primary)', fontWeight: '700', marginLeft: '4px' }}
                >
                    {isLogin ? 'Sign Up' : 'Log In'}
                </button>
                </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
