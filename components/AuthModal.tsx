
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
            <h3>{confirmingAction ? 'Dangerous Action' : 'Account Settings'}</h3>
            {!confirmingAction && (
              <button onClick={onClose} className="close-x-btn">
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
                  <div className="status-dot"></div>
              </div>

              {message && (
                <div className={`settings-notification ${message.type}`}>
                  <span className="msg-icon">{message.type === 'success' ? '✓' : '!'}</span>
                  {message.text}
                </div>
              )}

              <div className="settings-list">
                  <div className="settings-group">
                      <h5 className="settings-label">User Preferences</h5>
                      <button className="settings-card" onClick={onClose}>
                          <div className="card-icon-box profile">👤</div>
                          <div className="card-text">
                              <span className="card-title">Display Profile</span>
                              <span className="card-desc">Personalize your identity</span>
                          </div>
                          <span className="card-arrow">›</span>
                      </button>
                      <button className="settings-card" onClick={onSignOut}>
                          <div className="card-icon-box logout">🚪</div>
                          <div className="card-text">
                              <span className="card-title">Sign Out</span>
                              <span className="card-desc">Securely exit your session</span>
                          </div>
                      </button>
                  </div>

                  <div className="settings-group destructive">
                      <h5 className="settings-label">Privacy & Data</h5>
                      <div className="destructive-container">
                          <button className="settings-card secondary" onClick={() => startDestructiveAction('reset')}>
                              <div className="card-icon-box reset">🔄</div>
                              <div className="card-text">
                                  <span className="card-title">Reset SRS History</span>
                                  <span className="card-desc">Start fresh with level 0</span>
                              </div>
                          </button>
                          <button className="settings-card danger" onClick={() => startDestructiveAction('wipe')}>
                              <div className="card-icon-box wipe">🗑️</div>
                              <div className="card-text">
                                  <span className="card-title">Clear All Data</span>
                                  <span className="card-desc">Permanently delete library</span>
                              </div>
                          </button>
                      </div>
                  </div>
              </div>
            </>
          )}

          <div className="account-footer-info">
              LexiFlow Advanced Engine v2.5
          </div>
        </div>
        <style>{`
          .manage-account-container {
              max-width: 420px !important;
              width: 95%;
              padding: 2.25rem !important;
              border-radius: 36px !important;
              background: var(--card-bg) !important;
          }
          .manage-profile-header {
              display: flex;
              align-items: center;
              gap: 1.25rem;
              padding: 1.5rem;
              background: linear-gradient(135deg, var(--accent-secondary), var(--bg-color));
              border-radius: 28px;
              margin-bottom: 2rem;
              border: 1px solid var(--border-color);
              position: relative;
              box-shadow: var(--shadow-sm);
          }
          .status-dot {
              position: absolute;
              top: 1.2rem;
              right: 1.2rem;
              width: 10px;
              height: 10px;
              background: var(--success-color);
              border-radius: 50%;
              box-shadow: 0 0 10px var(--success-color);
          }
          .profile-badge {
              width: 68px;
              height: 68px;
              background: linear-gradient(135deg, var(--accent-primary), #ff2d55);
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: 900;
              flex-shrink: 0;
              box-shadow: 0 8px 20px rgba(88, 86, 214, 0.3);
              border: 4px solid white;
          }
          .profile-name { margin: 0; font-size: 1.35rem; font-weight: 900; color: var(--text-primary); letter-spacing: -0.8px; }
          .profile-email { margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-secondary); opacity: 0.8; font-weight: 600; }
          
          .settings-notification {
              padding: 14px;
              border-radius: 18px;
              font-size: 0.85rem;
              font-weight: 600;
              margin-bottom: 1.5rem;
              display: flex;
              align-items: center;
              gap: 10px;
              animation: slideIn 0.3s ease;
          }
          .settings-notification.success { background: rgba(0, 200, 83, 0.08); color: var(--success-color); border: 1px solid rgba(0, 200, 83, 0.15); }
          .settings-notification.error { background: rgba(255, 59, 48, 0.08); color: var(--danger-color); border: 1px solid rgba(255, 59, 48, 0.15); }
          .msg-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: currentColor; color: white; border-radius: 50%; font-size: 0.7rem; font-weight: 900; }
          
          .settings-list {
              display: flex;
              flex-direction: column;
              gap: 2rem;
          }
          .settings-group {
              display: flex;
              flex-direction: column;
              gap: 12px;
          }
          .settings-label { 
              font-size: 0.7rem; 
              font-weight: 900; 
              color: var(--accent-primary); 
              margin: 0 0 4px 6px;
              letter-spacing: 1.5px; 
              text-transform: uppercase;
              opacity: 0.9;
          }
          .destructive-container {
              background: rgba(255, 59, 48, 0.02);
              border: 2px dashed rgba(255, 59, 48, 0.1);
              padding: 14px;
              border-radius: 28px;
              display: flex;
              flex-direction: column;
              gap: 10px;
          }
          
          .settings-card {
              display: flex;
              align-items: center;
              gap: 16px;
              padding: 16px;
              border-radius: 20px;
              background: var(--bg-color);
              border: 1.5px solid var(--border-color);
              text-align: left;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              width: 100%;
              cursor: pointer;
              line-height: normal;
          }
          .settings-card:hover { transform: translateY(-3px); border-color: var(--accent-primary); box-shadow: 0 10px 25px rgba(88, 86, 214, 0.12); }
          .settings-card:active { transform: scale(0.97); }
          
          .settings-card.danger { border-color: rgba(255, 59, 48, 0.1); background: white; }
          .settings-card.danger:hover { border-color: var(--danger-color); background: rgba(255, 59, 48, 0.02); }
          .settings-card.danger .card-title { color: var(--danger-color); }
          
          .card-icon-box {
              width: 44px;
              height: 44px;
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.25rem;
              flex-shrink: 0;
              background: var(--accent-secondary);
              color: var(--accent-primary);
          }
          .card-icon-box.logout { background: #f0f0f5; color: #555; }
          .card-icon-box.reset { background: #fff8e1; color: #ffa000; }
          .card-icon-box.wipe { background: #ffebee; color: #d32f2f; }
          
          .card-text { 
              flex: 1; 
              display: flex; 
              flex-direction: column; 
              overflow: hidden; 
              min-width: 0;
              gap: 2px;
          }
          .card-title { font-size: 1rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; }
          .card-desc { font-size: 0.8rem; color: var(--text-secondary); opacity: 0.7; font-weight: 500; }
          .card-arrow { color: var(--text-muted); font-size: 1.4rem; opacity: 0.3; margin-left: auto; }

          .destructive-confirmation-view {
              display: flex;
              flex-direction: column;
              gap: 1.75rem;
              padding: 0.5rem 0;
          }
          .warning-banner {
              background: rgba(255, 59, 48, 0.06);
              color: var(--danger-color);
              padding: 1.5rem;
              border-radius: 24px;
              display: flex;
              gap: 16px;
              font-size: 0.95rem;
              line-height: 1.5;
              font-weight: 700;
              border: 1px solid rgba(255, 59, 48, 0.1);
          }
          .warning-icon { font-size: 2.25rem; flex-shrink: 0; }
          .challenge-prompt { font-size: 1rem; font-weight: 700; text-align: center; color: var(--text-secondary); margin: 0; }
          .challenge-word { color: var(--danger-color); font-weight: 900; letter-spacing: 2px; text-decoration: underline; background: rgba(255, 59, 48, 0.05); padding: 2px 8px; border-radius: 8px; }
          
          .challenge-input {
              width: 100%;
              padding: 18px;
              border-radius: 20px;
              border: 3px solid var(--border-color);
              text-align: center;
              font-size: 1.5rem;
              font-weight: 900;
              background: var(--bg-color);
              color: var(--text-primary);
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              letter-spacing: 4px;
          }
          .challenge-input:focus { border-color: var(--danger-color); outline: none; box-shadow: 0 0 20px rgba(255, 59, 48, 0.1); transform: scale(1.02); }
          
          .confirmation-actions {
              display: flex;
              gap: 14px;
          }
          .cancel-btn { flex: 1; background: var(--bg-color); color: var(--text-primary); border: 2px solid var(--border-color); border-radius: 18px; font-weight: 800; }
          .confirm-destructive-btn { 
              flex: 1.5; 
              background: var(--danger-color); 
              color: white; 
              border-radius: 18px;
              font-weight: 900;
              box-shadow: 0 8px 20px rgba(255, 59, 48, 0.25);
          }
          .confirm-destructive-btn:disabled { background: var(--text-muted); opacity: 0.4; transform: none !important; box-shadow: none; }
          
          .account-footer-info {
              text-align: center;
              font-size: 0.65rem;
              color: var(--text-muted);
              margin-top: 3rem;
              letter-spacing: 1px;
              text-transform: uppercase;
              font-weight: 800;
              opacity: 0.6;
          }

          .auth-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5rem;
              padding-bottom: 1.25rem;
              border-bottom: 2px solid var(--accent-secondary);
          }
          .auth-header h3 {
              margin: 0;
              font-size: 1.4rem;
              font-weight: 900;
              color: var(--text-primary);
              letter-spacing: -0.8px;
          }
          .close-x-btn {
            background: var(--accent-primary);
            width: 42px;
            height: 42px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: none;
            box-shadow: 0 8px 20px rgba(88, 86, 214, 0.25);
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
          }
          .close-x-btn:hover { 
            transform: scale(1.1) rotate(90deg); 
            background: #ff2d55; 
            box-shadow: 0 10px 25px rgba(255, 45, 85, 0.35);
          }
          .close-x-btn:active { transform: scale(0.9); }
          .close-x-btn svg { width: 22px; height: 22px; }
          
          @keyframes slideIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h3>{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} className="close-x-btn">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
