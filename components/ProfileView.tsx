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
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, savedCount, srsData, onSignOut, onLogin }) => {
  const [showAuth, setShowAuth] = useState(false);

  const learningCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel > 0 && i.masteryLevel < 5).length;
  const masteredCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel >= 5).length;

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="profile-view">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Profile</h2>
        
        <div className="profile-card">
            <div className="avatar-circle">
                {displayName[0].toUpperCase()}
            </div>
            
            <div className="account-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACCOUNT</div>
            <h1 style={{ margin: '0.5rem 0', fontSize: '1.8rem' }}>{displayName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email || 'Not logged in'}</p>

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
            
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>Last Login</span>
                    <span>{new Date().toLocaleDateString()}</span>
                </div>
            </div>

            <button 
                onClick={user ? onSignOut : () => setShowAuth(true)}
                style={{ 
                    marginTop: '2rem', 
                    width: '100%', 
                    padding: '1rem', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)',
                    fontWeight: '600'
                }}
            >
                {user ? 'SIGN OUT' : 'LOG IN / SIGN UP'}
            </button>
        </div>

        {showAuth && (
            <AuthModal 
                onClose={() => setShowAuth(false)} 
                onSignOut={() => {}}
                userDisplayName={null}
                userEmail={null}
            />
        )}
    </div>
  );
};

export default ProfileView;