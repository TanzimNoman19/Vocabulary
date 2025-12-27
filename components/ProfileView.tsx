
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
  isOnline: boolean;
  onResetSRS: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, savedCount, cachedCount, srsData, onSignOut, onLogin, isOnline, onResetSRS }) => {
  const [showAuth, setShowAuth] = useState(false);

  const learningCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel > 0 && i.masteryLevel < 5).length;
  const masteredCount = Object.values(srsData).filter((i: SRSItem) => i.masteryLevel >= 5).length;

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest Explorer';
  const isGuest = !user;

  const cachePercentage = savedCount > 0 ? Math.round((cachedCount / savedCount) * 100) : 100;

  return (
    <div className="profile-view">
        <div className="profile-header-bar">
          <h2 className="view-title">Profile</h2>
          {!isGuest && (
            <span className="sync-status-badge">
              CLOUD SYNC ACTIVE
            </span>
          )}
        </div>
        
        {!isOnline && (
            <div className="offline-alert">
                <span className="alert-icon">⚠️</span>
                <span>You're currently offline. Data won't sync until you reconnect.</span>
            </div>
        )}

        {isGuest && (
            <div className="guest-cta-card">
                <div className="cta-content">
                    <h3>Unlock Cloud Sync</h3>
                    <p>Create an account to save your vocabulary across devices and never lose your progress.</p>
                </div>
                <button className="cta-button" onClick={() => setShowAuth(true)}>
                    Join LexiFlow
                </button>
            </div>
        )}

        <div className="profile-card">
            <div className="avatar-section">
              <div className={`avatar-circle ${isGuest ? 'guest' : ''}`}>
                  {isGuest ? 'G' : displayName[0].toUpperCase()}
              </div>
              <div className="user-details">
                <h1 className="user-name">{displayName}</h1>
                <p className="user-subtext">{user?.email || 'Local data only'}</p>
              </div>
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

            <div className="readiness-section">
                <div className="readiness-header">
                    <span className="readiness-label">OFFLINE READINESS</span>
                    <span className="readiness-value">{cachePercentage}%</span>
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${cachePercentage}%` }}></div>
                </div>
                <p className="readiness-footer">
                    {cachedCount} of {savedCount} words study-ready offline
                </p>
            </div>
            
            <div className="action-stack">
                <button className="settings-trigger-btn" onClick={() => setShowAuth(true)}>
                  <span className="btn-icon">{isGuest ? '🔑' : '⚙️'}</span>
                  <span>{isGuest ? 'Sign In' : 'Account Settings'}</span>
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
                userDisplayName={isGuest ? null : displayName} 
                userEmail={user?.email} 
                onResetSRS={onResetSRS}
            />
        )}

        <style>{`
          .profile-view {
              padding-top: 0.5rem;
          }
          .profile-header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5rem;
          }
          .view-title { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--accent-primary); letter-spacing: -0.5px; }
          .sync-status-badge {
              font-size: 0.65rem;
              font-weight: 800;
              color: var(--success-color);
              background: rgba(0, 200, 83, 0.08);
              padding: 5px 12px;
              border-radius: 20px;
              letter-spacing: 0.5px;
          }

          .offline-alert {
              margin-bottom: 1.5rem;
              padding: 12px 16px;
              background: rgba(255, 59, 48, 0.08);
              color: var(--danger-color);
              border-radius: 16px;
              font-size: 0.85rem;
              font-weight: 600;
              border: 1px solid rgba(255, 59, 48, 0.15);
              display: flex;
              gap: 12px;
              align-items: center;
          }
          .alert-icon { font-size: 1.2rem; }

          .guest-cta-card {
              background: var(--accent-primary);
              border-radius: 24px;
              padding: 1.5rem;
              color: white;
              margin-bottom: 2rem;
              box-shadow: 0 12px 30px rgba(88, 86, 214, 0.25);
              display: flex;
              flex-direction: column;
              gap: 1.2rem;
          }
          .cta-content h3 { margin: 0; font-size: 1.3rem; font-weight: 800; }
          .cta-content p { margin: 8px 0 0 0; font-size: 0.9rem; opacity: 0.9; line-height: 1.4; }
          .cta-button {
              background: white;
              color: var(--accent-primary);
              padding: 12px;
              border-radius: 14px;
              font-weight: 800;
              font-size: 0.95rem;
              transition: transform 0.2s;
          }
          .cta-button:active { transform: scale(0.96); }

          .profile-card {
              background: var(--card-bg);
              border-radius: 28px;
              padding: 2rem 1.5rem;
              text-align: center;
              box-shadow: var(--shadow-md);
              border: 1px solid var(--border-color);
              margin-bottom: 1.5rem;
          }

          .avatar-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1rem;
              margin-bottom: 2rem;
          }
          .avatar-circle {
              width: 84px; height: 84px;
              background: linear-gradient(135deg, var(--accent-primary), #ff2d55);
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 2rem; font-weight: 800; color: white;
              box-shadow: 0 8px 20px rgba(88, 86, 214, 0.2);
          }
          .avatar-circle.guest {
              background: var(--accent-secondary);
              color: var(--accent-primary);
              box-shadow: none;
              border: 2px dashed var(--accent-primary);
          }
          .user-name { margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.5px; }
          .user-subtext { color: var(--text-secondary); font-size: 0.9rem; margin: 4px 0 0 0; }

          .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 2rem; }
          .stat-box {
              background: var(--bg-color);
              padding: 1rem 0.5rem;
              border-radius: 18px;
              text-align: center;
              border: 1px solid var(--border-color);
              display: flex; flex-direction: column; align-items: center; gap: 6px;
          }
          .stat-box.learning { background: rgba(255, 193, 7, 0.04); color: #f57f17; border-color: rgba(255, 193, 7, 0.1); }
          .stat-box.mastered { background: rgba(0, 200, 83, 0.04); color: #2e7d32; border-color: rgba(0, 200, 83, 0.1); }
          .stat-val { font-size: 1.5rem; font-weight: 800; line-height: 1; }
          .stat-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
          .stat-icon { opacity: 0.6; }

          .readiness-section {
              text-align: left;
              background: var(--bg-color);
              padding: 1.25rem;
              border-radius: 20px;
              margin-bottom: 2rem;
              border: 1px solid var(--border-color);
          }
          .readiness-header { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
          .readiness-label { font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); letter-spacing: 0.5px; }
          .readiness-value { font-size: 0.9rem; font-weight: 800; color: var(--accent-primary); }
          .progress-track { width: 100%; height: 8px; background: var(--accent-secondary); border-radius: 10px; overflow: hidden; }
          .progress-fill { height: 100%; background: var(--accent-primary); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 10px; }
          .readiness-footer { font-size: 0.75rem; color: var(--text-muted); margin-top: 10px; font-weight: 600; text-align: center; }

          .action-stack { display: flex; flex-direction: column; }
          .settings-trigger-btn {
              width: 100%;
              padding: 1rem;
              border-radius: 16px;
              font-weight: 700;
              font-size: 1rem;
              display: flex; align-items: center; justify-content: center;
              gap: 12px;
              transition: all 0.2s;
              background: var(--bg-color); 
              color: var(--text-primary); 
              border: 1px solid var(--border-color); 
          }
          .settings-trigger-btn:active { background: var(--accent-secondary); transform: scale(0.98); }
        `}</style>
    </div>
  );
};

export default ProfileView;
