
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { supabase, checkSupabaseConnection } from '../services/supabaseClient';

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
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setMessage(null);
    setShowTroubleshoot(false);

    try {
      // Step 1: Attempt the actual auth request first
      // This is better than pre-checking as pre-checking can sometimes trigger CORS errors themselves
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        if (!username.trim()) throw new Error("Username is required");
        
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
          setMessage({ text: 'Activation email sent! Please check your inbox.', type: 'success' });
        } else {
          onClose(); 
        }
      }
    } catch (error: any) {
      console.error("Supabase Auth Error:", error);
      
      let errorMsg = error.message || 'An unexpected error occurred.';
      const errorCode = error.status || error.code || 'UNKNOWN';

      if (errorMsg.includes('fetch') || errorCode === 'UNKNOWN') {
        errorMsg = 'Connection Error: We cannot reach the authentication server. This usually happens if the project is paused (free tier) or your network is blocking the request.';
        setShowTroubleshoot(true);
      } else if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (errorMsg.includes('email_not_confirmed')) {
        errorMsg = 'Email not confirmed. Please check your inbox for the activation link.';
      }

      setMessage({ 
        text: errorMsg, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setMessage({ text: 'Running connection diagnostics...', type: 'success' });
    const isReachable = await checkSupabaseConnection();
    if (isReachable) {
        setMessage({ text: 'Server is reachable! Try signing in again. If it still fails, check your email/password.', type: 'success' });
    } else {
        setMessage({ text: 'Server UNREACHABLE. Please log in to your Supabase dashboard and ensure the project is not paused.', type: 'error' });
    }
  };

  if (userEmail) {
    return (
      <div className="auth-overlay" onClick={onClose}>
        <div className="auth-container" onClick={(e) => e.stopPropagation()}>
          <div className="auth-header">
            <h3>Account Settings</h3>
            <button onClick={onClose} className="close-button" style={{ fontSize: '1.6rem', fontWeight: 300, padding: '0 8px' }}>&lt;</button>
          </div>
          <div className="auth-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Account Holder:</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{userDisplayName}</p>
            <p className="auth-email" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 2rem 0' }}>{userEmail}</p>
            
            <div className="auth-actions" style={{ marginTop: '2rem' }}>
               <button onClick={onSignOut} className="auth-btn logout">Sign Out</button>
            </div>
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
                fontSize: '0.8rem',
                lineHeight: '1.4',
                background: message.type === 'error' ? 'rgba(255, 59, 48, 0.08)' : 'rgba(0, 200, 83, 0.08)',
                color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
                border: `1px solid ${message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'}`
            }}>
              {message.text}
              {showTroubleshoot && (
                  <button 
                    onClick={runDiagnostics}
                    style={{ 
                        marginTop: '10px', 
                        display: 'block', 
                        textDecoration: 'underline', 
                        fontWeight: 'bold', 
                        color: 'inherit',
                        fontSize: '0.75rem' 
                    }}
                  >
                    Run Connection Diagnostics
                  </button>
              )}
            </div>
        )}

        {signupSuccess ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Please check your email <b>{email}</b> to activate your account.
            </p>
            <button className="auth-btn primary" style={{ marginTop: '1.5rem' }} onClick={() => { setSignupSuccess(false); setIsLogin(true); setMessage(null); }}>
                Back to Login
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
                  disabled={loading}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              minLength={6}
              disabled={loading}
            />
            
            <button type="submit" className="auth-btn primary" disabled={loading}>
              {loading ? 'Connecting...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>

            <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isLogin ? "New to LexiFlow? " : "Already registered? "}
                <button 
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setIsLogin(!isLogin); setMessage(null); setShowTroubleshoot(false); }}
                >
                    {isLogin ? 'Create Account' : 'Sign In'}
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
