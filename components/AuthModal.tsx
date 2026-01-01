
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { supabase, checkSupabaseConnection } from '../services/supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
  onResetSRS?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, userDisplayName, userEmail, onSignOut, onResetSRS }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [signupSuccess, setSignupSuccess] = useState(false);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Destructive Action Confirmation State
  const [confirmingAction, setConfirmingAction] = useState<'wipe' | 'reset' | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    let timer: number;
    if (cooldownRemaining > 0) {
      timer = window.setInterval(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setMessage(null);
    setShowTroubleshoot(false);

    try {
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

  const startDestructiveAction = (action: 'wipe' | 'reset') => {
    setConfirmingAction(action);
    setConfirmationInput('');
    setCooldownRemaining(2); // 2-second cooldown to prevent mis-clicks
  };

  const cancelDestructiveAction = () => {
    setConfirmingAction(null);
    setConfirmationInput('');
  };

  const performDestructiveAction = async () => {
    if (loading || cooldownRemaining > 0) return;
    
    setLoading(true);
    try {
      if (confirmingAction === 'reset') {
        if (onResetSRS) onResetSRS();
        setMessage({ text: 'SRS progress has been reset to level 0.', type: 'success' });
        setConfirmingAction(null);
      } else if (confirmingAction === 'wipe') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from('user_data').delete().eq('user_id', user.id);
          if (error) throw error;
          window.location.reload();
        }
      }
    } catch (e: any) {
      setMessage({ text: "Error: " + e.message, type: 'error' });
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
        <div className="auth-container manage-account-container" onClick={(e) => e.stopPropagation()}>
          <div className="auth-header">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{confirmingAction ? 'Dangerous Action' : 'Account Settings'}</h3>
            {!confirmingAction && (
              <button onClick={onClose} className="close-x-btn" style={{ background: 'var(--accent-secondary)', padding: '8px', borderRadius: '12px', display: 'flex' }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}
          </div>
          
          {confirmingAction ? (
            <div className="destructive-confirmation-view">
              <div className="warning-banner">
                <span className="warning-icon">⚠️</span>
                <p>
                  {confirmingAction === 'wipe' 
                    ? "This will permanently delete all your saved words and progress from the cloud. This cannot be undone."
                    : "This will reset all your word mastery levels back to 'New'. Your library of words will remain."}
                </p>
              </div>

              <p className="challenge-prompt">
                Please type <span className="challenge-word">{confirmingAction === 'wipe' ? 'WIPE' : 'RESET'}</span> to confirm:
              </p>
              
              <input 
                className="challenge-input"
                autoFocus
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value.toUpperCase())}
                placeholder="Type here..."
                disabled={loading}
              />

              <div className="confirmation-actions">
                <button 
                  className="auth-btn cancel-btn" 
                  onClick={cancelDestructiveAction}
                  disabled={loading}
                >
                  Go Back
                </button>
                <button 
                  className={`auth-btn confirm-destructive-btn ${loading ? 'loading' : ''}`}
                  disabled={loading || cooldownRemaining > 0 || confirmationInput !== (confirmingAction === 'wipe' ? 'WIPE' : 'RESET')}
                  onClick={performDestructiveAction}
                >
                  {cooldownRemaining > 0 ? `Wait (${cooldownRemaining}s)` : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="manage-profile-header">
                  <div className="profile-badge">
                      {userDisplayName?.[0].toUpperCase() || 'U'}
                  </div>
                  <div className="profile-info">
                      <h4 className="profile-name">{userDisplayName}</h4>
                      <p className="profile-email">{userEmail}</p>
                  </div>
              </div>

              {message && (
                <div style={{ padding: '12px', borderRadius: '12px', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid currentColor', background: message.type === 'success' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 59, 48, 0.1)', color: message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {message.text}
                </div>
              )}

              <div className="settings-list">
                  <div className="settings-section">
                      <label className="section-label">General</label>
                      <button className="settings-item" onClick={onClose}>
                          <span className="item-icon">📝</span>
                          <div className="item-text">
                              <span className="item-title">Update Profile</span>
                              <span className="item-desc">Change your display name</span>
                          </div>
                          <span className="item-arrow">›</span>
                      </button>
                  </div>

                  <div className="settings-section destructive-zone">
                      <label className="section-label">Safe-Guard Area</label>
                      <button className="settings-item" onClick={() => startDestructiveAction('reset')}>
                          <span className="item-icon">🔄</span>
                          <div className="item-text">
                              <span className="item-title">Reset Progress</span>
                              <span className="item-desc">Restart SRS learning history</span>
                          </div>
                      </button>
                      <button className="settings-item danger" onClick={() => startDestructiveAction('wipe')}>
                          <span className="item-icon">🗑️</span>
                          <div className="item-text">
                              <span className="item-title">Wipe Cloud Data</span>
                              <span className="item-desc">Permanently delete all library data</span>
                          </div>
                      </button>
                  </div>

                  <div className="settings-section">
                      <button className="auth-btn logout-btn" onClick={onSignOut}>
                          Sign Out
                      </button>
                  </div>
              </div>
            </>
          )}

          <div className="account-footer-info">
              LexiFlow v2.5 • Secured Session
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} className="close-x-btn" style={{ background: 'var(--accent-secondary)', padding: '8px', borderRadius: '12px', display: 'flex' }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
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
                    style={{ color: 'var(--accent-primary)', fontWeight: 800, background: 'none', padding: '4px' }}
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
