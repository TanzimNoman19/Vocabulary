
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
  cachedCount: number;
  srsData: Record<string, SRSItem>;
  onSignOut: () => void;
  onLogin: () => void;
  onOpenHistory: () => void;
  isOnline: boolean;
  onResetSRS: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, savedCount, cachedCount, srsData, onSignOut, onLogin, onOpenHistory, isOnline, onResetSRS }) => {
  const [showAuth, setShowAuth] = useState(false);

  const learningCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel > 0 && i.masteryLevel < 5).length;
  const masteredCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel >= 5).length;

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';

  const cachePercentage = savedCount > 0 ? Math.round((cachedCount / savedCount) * 100) : 100;

  return (
    <div className="profile-view">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--accent-primary)' }}>Profile</h2>
          {user && (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success-color)', background: 'rgba(0, 200, 83, 0.08)', padding: '4px 10px', borderRadius: '20px' }}>
              CLOUD SYNC ACTIVE
            </span>
          )}
        </div>
        
        {!isOnline && (
            <div style={{ marginBottom: '1.5rem', padding: '14px', background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(255, 59, 48, 0.2)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <span>Offline: Cloud sync is paused.</span>
            </div>
        )}

        <div className="profile-card">
            <div className="avatar-section">
              <div className="avatar-circle">
                  {displayName[0].toUpperCase()}
              </div>
              <div className="user-details">
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{displayName}</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>{user?.email || 'Guest Explorer'}</p>
              </div>
            </div>

            <div className="readiness-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>OFFLINE READINESS</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{cachePercentage}%</span>
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${cachePercentage}%` }}></div>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 600 }}>
                    {cachedCount} of {savedCount} words study-ready offline
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-box">
                    <div className="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    </div>
                    <div className="stat-val">{savedCount}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-box learning">
                    <div className="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                    <div className="stat-val">{learningCount}</div>
                    <div className="stat-label">Learning</div>
                </div>
                <div className="stat-box mastered">
                    <div className="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                    </div>
                    <div className="stat-val">{masteredCount}</div>
                    <div className="stat-label">Mastered</div>
                </div>
            </div>
            
            <div className="action-stack">
                <button className="primary-profile-btn" onClick={onOpenHistory}>
                  <span className="btn-icon">🕒</span>
                  <span>Review Word History</span>
                </button>

                <button className="secondary-profile-btn" onClick={() => setShowAuth(true)}>
                  <span className="btn-icon">⚙️</span>
                  <span>{user ? 'Manage Account' : 'Log In / Sign Up'}</span>
                </button>
            </div>
        </div>

        {showAuth && (
            <AuthModal 
                onClose={() => setShowAuth(false)} 
                onSignOut={() => {
                    onSignOut();
                    setShowAuth(false);
                }} 
                userDisplayName={displayName} 
                userEmail={user?.email} 
                onResetSRS={onResetSRS}
            />
        )}

        <style>{`
          .avatar-section {
              display: flex;
              align-items: center;
              gap: 1.2rem;
              text-align: left;
              margin-bottom: 2rem;
          }
          .user-details { display: flex; flex-direction: column; }
          .readiness-section {
              text-align: left;
              background: var(--accent-secondary);
              padding: 1.2rem;
              border-radius: 20px;
              margin-bottom: 2rem;
              border: 1px solid var(--border-color);
          }
          .progress-track { width: 100%; height: 8px; background: var(--bg-color); border-radius: 4px; overflow: hidden; }
          .progress-fill { height: 100%; background: var(--accent-primary); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

          .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 2rem; }
          .stat-box {
              background: var(--bg-color);
              padding: 1rem 0.5rem;
              border-radius: 16px;
              text-align: center;
              border: 1px solid var(--border-color);
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
          }
          .stat-box.learning { background: rgba(255, 193, 7, 0.05); color: #f57f17; border-color: rgba(255, 193, 7, 0.2); }
          .stat-box.mastered { background: rgba(0, 200, 83, 0.05); color: #2e7d32; border-color: rgba(0, 200, 83, 0.2); }
          
          .stat-val { font-size: 1.4rem; font-weight: 800; line-height: 1; }
          .stat-label { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
          
          .action-stack { display: flex; flex-direction: column; gap: 12px; }
          .primary-profile-btn, .secondary-profile-btn {
              width: 100%;
              padding: 1.1rem;
              border-radius: 16px;
              font-weight: 700;
              font-size: 0.95rem;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              transition: all 0.2s;
              border: none;
          }
          .primary-profile-btn { background: var(--accent-primary); color: white; box-shadow: 0 4px 15px rgba(88, 86, 214, 0.2); }
          .primary-profile-btn:active { transform: scale(0.98); box-shadow: 0 2px 8px rgba(88, 86, 214, 0.2); }
          
          .secondary-profile-btn { background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); }
          .secondary-profile-btn:active { background: var(--bg-color); }
          
          .btn-icon { font-size: 1.2rem; }
        `}</style>
    </div>
  );
};

export default ProfileView;
