
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
  const [isVerifying, setIsVerifying] = useState(false); // New state for OTP mode
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(''); // State for the code
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        // Sign Up Flow
        if (!username.trim()) {
            throw new Error("Username is required");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
                username: username.trim()
            }
          }
        });
        if (error) throw error;
        
        // Switch to Verification Mode instead of closing
        setIsVerifying(true);
        setMessage({ text: 'Confirmation code sent to your email!', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'Authentication failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });
      if (error) throw error;
      
      // Verification successful, user is now logged in
      onClose();
    } catch (error: any) {
      setMessage({ text: error.message || 'Verification failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (userEmail) {
    return (
      <div className="auth-overlay">
        <div className="auth-container">
          <div className="auth-header">
            <h3>Account</h3>
            <button onClick={onClose} className="close-button">✕</button>
          </div>
          <div className="auth-body">
            <p style={{ color: 'var(--text-color-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Signed in as:</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{userDisplayName}</p>
            {userDisplayName !== userEmail && (
                <p className="auth-email" style={{ fontSize: '0.9rem', color: 'var(--text-color-muted)', margin: '0 0 2rem 0' }}>{userEmail}</p>
            )}
            
            <div className="auth-actions" style={{ marginTop: '2rem' }}>
               <button onClick={onSignOut} className="auth-btn logout">Sign Out</button>
            </div>
            <p className="auth-note">Your vocabulary list is syncing with the cloud.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-container">
        <div className="auth-header">
          <h3>
            {isVerifying ? 'Enter Code' : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h3>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        {message && (
            <div className={`auth-message ${message.type}`} style={{ marginBottom: '1rem' }}>
              {message.text}
            </div>
        )}

        {isVerifying ? (
          // --- OTP VERIFICATION FORM ---
          <form onSubmit={handleVerify} className="auth-form">
            <p style={{textAlign: 'center', fontSize: '0.9rem'}}>
                Please enter the verification code sent to <strong>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="Code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              className="auth-input"
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem' }}
            />
            <button type="submit" className="auth-btn primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button 
              type="button" 
              className="auth-link-btn" 
              onClick={() => setIsVerifying(false)}
              style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
            >
              Back to Sign Up
            </button>
          </form>
        ) : (
          // --- LOGIN / SIGNUP FORM ---
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
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              minLength={6}
            />
            
            <button type="submit" className="auth-btn primary" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>
        )}
        
        {!isVerifying && (
          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                className="auth-link-btn"
                onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
