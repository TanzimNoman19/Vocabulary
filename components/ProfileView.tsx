
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
              max-width: 600px;
              margin: 0 auto;
          }
          .profile-header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5rem;
              padding: 0 4px;
          }
          .view-title { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--accent-primary); letter-spacing: -0.5px; }
          .sync-status-badge {
              font-size: 0.6rem;
              font-weight: 800;
              color: var(--success-color);
              background: rgba(0, 200, 83, 0.08);
              padding: 6px 12px;
              border-radius: 20px;
              letter-spacing: 0.8px;
              text-transform: uppercase;
          }

          .offline-alert {
              margin-bottom: 1.5rem;
              padding: 14px 18px;
              background: rgba(255, 59, 48, 0.08);
              color: var(--danger-color);
              border-radius: 20px;
              font-size: 0.85rem;
              font-weight: 600;
              border: 1px solid rgba(255, 59, 48, 0.15);
              display: flex;
              gap: 12px;
              align-items: center;
              line-height: 1.4;
          }
          .alert-icon { font-size: 1.3rem; }

          .guest-cta-card {
              background: var(--accent-primary);
              border-radius: 28px;
              padding: 1.75rem;
              color: white;
              margin-bottom: 2rem;
              box-shadow: 0 12px 30px rgba(88, 86, 214, 0.25);
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
              position: relative;
              overflow: hidden;
          }
          .guest-cta-card::before {
              content: '';
              position: absolute;
              top: -50px;
              right: -50px;
              width: 150px;
              height: 150px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 50%;
          }
          .cta-content h3 { margin: 0; font-size: 1.4rem; font-weight: 900; }
          .cta-content p { margin: 10px 0 0 0; font-size: 0.95rem; opacity: 0.9; line-height: 1.5; }
          .cta-button {
              background: white;
              color: var(--accent-primary);
              padding: 14px;
              border-radius: 16px;
              font-weight: 800;
              font-size: 1rem;
              transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              border: none;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
          .cta-button:active { transform: scale(0.96); }

          .profile-card {
              background: var(--card-bg);
              border-radius: 32px;
              padding: 2.5rem 1.5rem;
              text-align: center;
              box-shadow: var(--shadow-md);
              border: 1px solid var(--border-color);
              margin-bottom: 1.5rem;
          }

          .avatar-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1.25rem;
              margin-bottom: 2.5rem;
          }
          .avatar-circle {
              width: 92px; height: 92px;
              background: linear-gradient(135deg, var(--accent-primary), #ff2d55);
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 2.25rem; font-weight: 900; color: white;
              box-shadow: 0 10px 25px rgba(88, 86, 214, 0.25);
              border: 4px solid var(--card-bg);
          }
          .avatar-circle.guest {
              background: var(--bg-color);
              color: var(--accent-primary);
              box-shadow: none;
              border: 2px dashed var(--accent-primary);
          }
          .user-name { margin: 0; font-size: 1.75rem; font-weight: 900; letter-spacing: -0.8px; color: var(--text-primary); }
          .user-subtext { color: var(--text-secondary); font-size: 0.95rem; margin: 6px 0 0 0; font-weight: 500; }

          .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 2.5rem; }
          .stat-box {
              background: var(--bg-color);
              padding: 1.25rem 0.5rem;
              border-radius: 20px;
              text-align: center;
              border: 1px solid var(--border-color);
              display: flex; flex-direction: column; align-items: center; gap: 8px;
              min-width: 0;
          }
          .stat-box.learning { background: rgba(255, 193, 7, 0.05); color: #f57f17; border-color: rgba(255, 193, 7, 0.15); }
          .stat-box.mastered { background: rgba(0, 200, 83, 0.05); color: #2e7d32; border-color: rgba(0, 200, 83, 0.15); }
          .stat-val { font-size: 1.6rem; font-weight: 900; line-height: 1; letter-spacing: -0.5px; }
          .stat-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.7; }
          .stat-icon { opacity: 0.7; transform: scale(0.9); }

          .readiness-section {
              text-align: left;
              background: var(--bg-color);
              padding: 1.5rem;
              border-radius: 24px;
              margin-bottom: 2.5rem;
              border: 1px solid var(--border-color);
          }
          .readiness-header { display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center; }
          .readiness-label { font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); letter-spacing: 0.8px; text-transform: uppercase; }
          .readiness-value { font-size: 1rem; font-weight: 900; color: var(--accent-primary); }
          .progress-track { width: 100%; height: 10px; background: var(--accent-secondary); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); }
          .progress-fill { height: 100%; background: var(--accent-primary); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 12px; }
          .readiness-footer { font-size: 0.8rem; color: var(--text-muted); margin-top: 12px; font-weight: 700; text-align: center; }

          .action-stack { display: flex; flex-direction: column; }
          .settings-trigger-btn {
              width: 100%;
              padding: 1.1rem;
              border-radius: 18px;
              font-weight: 800;
              font-size: 1rem;
              display: flex; align-items: center; justify-content: center;
              gap: 12px;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              background: var(--bg-color); 
              color: var(--text-primary); 
              border: 1.5px solid var(--border-color); 
              box-shadow: var(--shadow-sm);
          }
          .settings-trigger-btn:hover { border-color: var(--accent-primary); background: var(--card-bg); transform: translateY(-1px); }
          .settings-trigger-btn:active { background: var(--accent-secondary); transform: scale(0.98); }
          .btn-icon { font-size: 1.25rem; }
        `}</style>
    </div>
  );
};

export default ProfileView;
