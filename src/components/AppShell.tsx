import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, BottomSheet, Icon, Button } from './ui';
import type { IconName } from './ui';
import PersonaSwitcher from './PersonaSwitcher';
import './AppShell.css';

export type ViewId = 'ask' | 'buy-finder' | 'heatmap' | 'profile' | 'portfolio' | 'saved' | 'gearing' | 'purchase-plan' | 'calculators';

interface AppShellProps {
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  persona: string;
  onPersonaChange: (p: any) => void;
  onLogout: () => void;
  showProfile: boolean;
  children: React.ReactNode;
}

const DESKTOP_TABS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'ask', label: 'Ask', icon: 'search' },
  { id: 'buy-finder', label: 'Buy Finder', icon: 'home' },
  { id: 'heatmap', label: 'Heatmap', icon: 'map' },
  { id: 'profile', label: 'Suburb Profile', icon: 'chart' },
  { id: 'portfolio', label: 'Portfolio', icon: 'wallet' },
  { id: 'saved', label: 'Saved', icon: 'heart' },
];

const MOBILE_TABS: { id: string; label: string; icon: IconName; view?: ViewId }[] = [
  { id: 'ask', label: 'Ask', icon: 'search', view: 'ask' },
  { id: 'buy-finder', label: 'Buy', icon: 'home', view: 'buy-finder' },
  { id: 'heatmap', label: 'Map', icon: 'map', view: 'heatmap' },
  { id: 'saved', label: 'Saved', icon: 'heart', view: 'saved' },
  { id: 'more', label: 'More', icon: 'more' },
];

const MORE_ITEMS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Suburb Profile', icon: 'chart' },
  { id: 'portfolio', label: 'Portfolio', icon: 'wallet' },
  { id: 'gearing', label: 'Cashflow & Gearing', icon: 'brief' },
  { id: 'purchase-plan', label: 'Purchase Plan', icon: 'wallet' },
  { id: 'calculators', label: 'Calculators', icon: 'plus' },
];

export const AppShell: React.FC<AppShellProps> = ({
  currentView, onViewChange, persona, onPersonaChange, onLogout, showProfile, children,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewAnnounce, setViewAnnounce] = useState('');

  useEffect(() => {
    const label = DESKTOP_TABS.find(t => t.id === currentView)?.label || MOBILE_TABS.find(t => t.id === currentView)?.label || currentView;
    setViewAnnounce(`Loaded ${label}`);
  }, [currentView]);

  const desktopTabItems = DESKTOP_TABS.map(t => ({ ...t }));
  const activeTab = desktopTabItems.find(t => t.id === currentView);

  const handleMoreSelect = useCallback((view: ViewId) => {
    onViewChange(view);
    setMoreOpen(false);
  }, [onViewChange]);

  return (
    <div className="app-shell">
      {/* Skip to content */}
      <a href="#main-content" className="app-shell__skip">Skip to main content</a>

      {/* View-change announcer */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{viewAnnounce}</div>

      {/* ── Header ── */}
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__logo">IQ</span>
          <h1 className="app-shell__title">YieldSense</h1>
        </div>
        <div className="app-shell__header-actions">
          <PersonaSwitcher activePersona={persona as any} onChange={onPersonaChange} />
          <Button variant="ghost" size="sm" onClick={onLogout}>Log out</Button>
        </div>
      </header>

      {/* ── Desktop Tabs ── */}
      <nav className="app-shell__nav-desktop" aria-label="Main navigation">
        <Tabs
          tabs={desktopTabItems}
          active={currentView}
          onChange={(id) => onViewChange(id as ViewId)}
        />
      </nav>

      {/* ── Content ── */}
      <main id="main-content" className="app-shell__main">
        {showProfile && activeTab && <p className="app-shell__context">{activeTab.label}</p>}
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="app-shell__nav-mobile" aria-label="Mobile navigation">
        {MOBILE_TABS.map(tab => (
          tab.id === 'more' ? (
            <button
              key="more"
              className={`app-shell__mob-tab ${moreOpen ? 'app-shell__mob-tab--active' : ''}`}
              onClick={() => setMoreOpen(true)}
              aria-label="More options"
            >
              <Icon name="more" size={22} />
              <span className="app-shell__mob-label">More</span>
            </button>
          ) : (
            <button
              key={tab.id}
              className={`app-shell__mob-tab ${currentView === tab.view ? 'app-shell__mob-tab--active' : ''}`}
              onClick={() => tab.view && onViewChange(tab.view)}
              aria-current={currentView === tab.view ? 'page' : undefined}
              aria-label={tab.label}
            >
              <Icon name={tab.icon} size={22} />
              <span className="app-shell__mob-label">{tab.label}</span>
            </button>
          )
        ))}
      </nav>

      {/* ── More Sheet (mobile) ── */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <MenuItems
          items={MORE_ITEMS}
          currentView={currentView}
          onSelect={handleMoreSelect}
        />
        <hr className="app-shell__divider" />
        <MenuItems
          items={[
            { id: 'settings' as ViewId, label: 'Settings', icon: 'settings' as IconName },
            { id: 'logout' as ViewId, label: 'Log out', icon: 'log-out' as IconName },
          ]}
          currentView={currentView}
          onSelect={(id) => { if (id === 'logout') onLogout(); else handleMoreSelect(id); }}
        />
      </BottomSheet>
    </div>
  );
};

function MenuItems({ items, currentView, onSelect }: {
  items: { id: ViewId | string; label: string; icon: IconName }[];
  currentView: string;
  onSelect: (id: any) => void;
}) {
  return (
    <div className="app-shell__menu">
      {items.map(item => (
        <button
          key={item.id}
          className={`app-shell__menu-item ${currentView === item.id ? 'app-shell__menu-item--active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
