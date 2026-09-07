import React, { useState, useEffect } from 'react';
import { BottomSheet, Icon } from './ui';
import type { IconName } from './ui';
import PersonaSwitcher from './PersonaSwitcher';
import './AppShell.css';

export type ViewId = 'ask' | 'buy-finder' | 'heatmap' | 'profile' | 'portfolio' | 'saved' | 'settings' | 'gearing' | 'purchase-plan' | 'calculators' | 'recent' | 'subscription';

interface AppShellProps {
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  persona: string;
  onPersonaChange: (p: any) => void;
  onLogout: () => void;
  showProfile: boolean;
  usage?: { used: number; limit: number };
  children: React.ReactNode;
}

const SIDEBAR_GROUPS = [
  {
    title: 'Chat',
    items: [
      { id: 'ask', label: 'New Chat', icon: 'message-circle' as IconName },
      { id: 'recent', label: 'Recent Chats', icon: 'clock' as IconName },
    ]
  },
  {
    title: 'Library',
    items: [
      { id: 'profile', label: 'Suburb Profile', icon: 'home' as IconName },
      { id: 'saved', label: 'Saved Suburbs', icon: 'heart' as IconName },
      { id: 'heatmap', label: 'Map Explorer', icon: 'map' as IconName },
    ]
  },
  {
    title: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings' as IconName },
      { id: 'subscription', label: 'Subscription', icon: 'zap' as IconName },
    ]
  }
];

const MOBILE_TABS: { id: string; label: string; icon: IconName; view?: ViewId }[] = [
  { id: 'ask', label: 'Chat', icon: 'message-circle', view: 'ask' },
  { id: 'profile', label: 'Profile', icon: 'home', view: 'profile' },
  { id: 'heatmap', label: 'Map', icon: 'map', view: 'heatmap' },
  { id: 'saved', label: 'Saved', icon: 'heart', view: 'saved' },
  { id: 'more', label: 'More', icon: 'more' },
];

export const AppShell: React.FC<AppShellProps> = ({
  currentView, onViewChange, persona, onPersonaChange, onLogout, children,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewAnnounce, setViewAnnounce] = useState('');

  useEffect(() => {
    setViewAnnounce(`Loaded ${currentView}`);
  }, [currentView]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{viewAnnounce}</div>

      {/* ── Desktop Sidebar ── */}
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__logo">IQ</span>
          <h1 className="app-shell__title">PropertyIQ</h1>
        </div>
        
        <div className="app-shell__nav-groups">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.title} className="app-shell__nav-group">
              <div className="app-shell__nav-group-title">{group.title}</div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`app-shell__nav-item ${currentView === item.id ? 'app-shell__nav-item--active' : ''}`}
                  onClick={() => onViewChange(item.id as ViewId)}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="app-shell__user-footer">
          <PersonaSwitcher activePersona={persona as any} onChange={onPersonaChange} />
          <button onClick={onLogout} className="app-shell__nav-item" style={{ opacity: 0.7, padding: '0.5rem' }}>
            <Icon name="log-out" size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* ── Content Wrapper ── */}
      <div className="app-shell__content-wrapper">
        
        {/* Mobile Header */}
        <header className="app-shell__mobile-header">
          <div className="app-shell__mobile-logo">
            <span className="app-shell__logo">IQ</span>
            <h1 className="app-shell__title">PropertyIQ</h1>
          </div>
          <PersonaSwitcher activePersona={persona as any} onChange={onPersonaChange} />
        </header>

        {/* Main Content Area */}
        <main id="main-content" className="app-shell__main">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="app-shell__nav-mobile">
          {MOBILE_TABS.map(tab => (
            tab.id === 'more' ? (
              <button
                key="more"
                className={`app-shell__mob-tab ${moreOpen ? 'app-shell__mob-tab--active' : ''}`}
                onClick={() => setMoreOpen(true)}
              >
                <Icon name="more" size={24} />
                <span className="app-shell__mob-label">More</span>
              </button>
            ) : (
              <button
                key={tab.id}
                className={`app-shell__mob-tab ${currentView === tab.view ? 'app-shell__mob-tab--active' : ''}`}
                onClick={() => tab.view && onViewChange(tab.view)}
              >
                <Icon name={tab.icon} size={24} />
                <span className="app-shell__mob-label">{tab.label}</span>
              </button>
            )
          ))}
        </nav>
      </div>

      {/* Mobile More Sheet */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="app-shell__menu">
          {SIDEBAR_GROUPS.flatMap(g => g.items).map(item => (
            <button
              key={item.id}
              className={`app-shell__menu-item ${currentView === item.id ? 'app-shell__menu-item--active' : ''}`}
              onClick={() => { onViewChange(item.id as ViewId); setMoreOpen(false); }}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          ))}
          <hr className="app-shell__divider" />
          <button className="app-shell__menu-item" onClick={onLogout}>
            <Icon name="log-out" size={20} /> Log out
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
