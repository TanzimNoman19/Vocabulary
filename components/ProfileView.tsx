
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { SRSItem } from '../services/srsService';
import AuthModal from './AuthModal';

interface ProfileViewProps {
  user: any;
  savedCount: number;
  srsData: Record<string, SRSItem>;
  onSignOut: () => void;
  onLogin: () => void;
  onOpenHistory: () => void;
  isOnline: boolean;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, savedCount, srsData, onSignOut, onLogin, onOpenHistory, isOnline }) => {
  const [showAuth, setShowAuth] = useState(false);

  const learningCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel > 0 && i.masteryLevel < 5).length;
  const masteredCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel >= 5).length;

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="profile-view">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Profile</h2>
        
        {!isOnline && (
            <div style={{ marginBottom: '1rem', padding: '12px', background: '#fff3cd', color: '#856404', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #ffeeba' }}>
                Offline: Cloud sync is disabled. Progress will be saved locally.
            </div>
        )}

        <div className="profile-card">
            <div className="avatar-circle">
                {displayName[0].toUpperCase()}
            </div>
            
            <div className="account-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACCOUNT</div>
            <h1 style={{ margin: '0.5rem 0', fontSize: '1.8rem' }}>{displayName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email || (isOnline ? 'Sign in to sync with cloud' : 'Cloud sync unavailable offline')}</p>

            <div className="stats-grid">
                <div className="stat-box">
                    <div className="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    </div>
                    <div className="stat-val">{savedCount}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-box" style={{ background: '#fff9c4', color: '#f57f17' }}>
                    <div className="stat-icon" style={{ color: '#f57f17' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                    <div className="stat-val">{learningCount}</div>
                    <div className="stat-label" style={{ color: '#f57f17' }}>Learning</div>
                </div>
                <div className="stat-box" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                    <div className="stat-icon" style={{ color: '#2e7d32' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                    </div>
                    <div className="stat-val">{masteredCount}</div>
                    <div className="stat-label" style={{ color: '#2e7d32' }}>Mastered</div>
                </div>
            </div>
            
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  onClick={onOpenHistory}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'var(--accent-secondary)',
                    color: 'var(--accent-primary)',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  VIEW HISTORY
                </button>

                <button 
                    onClick={user ? onSignOut : () => setShowAuth(true)}
                    disabled={!isOnline && !user}
                    style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        fontWeight: '600',
                        color: user ? 'var(--danger-color)' : 'var(--text-primary)',
                        opacity: (!isOnline && !user) ? 0.5 : 1
                    }}
                >
                    {user ? 'SIGN OUT' : (isOnline ? 'LOG IN / SIGN UP' : 'LOGIN UNAVAILABLE')}
                </button>
            </div>
        </div>

        {showAuth && isOnline && <AuthModal onClose={() => setShowAuth(false)} onSignOut={() => {}} userDisplayName={null} userEmail={null} />}
    </div>
  );
};

export default ProfileView;
