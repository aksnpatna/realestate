import React, { useCallback, useRef } from 'react';
import { Icon, type IconName } from './Icon';
import './Tabs.css';

interface Tab {
  id: string; label: string; icon?: IconName; count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className = '' }) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;
    else return;
    e.preventDefault();
    tabRefs.current[nextIdx]?.focus();
  }, [tabs.length]);

  return (
    <div className={`ui-tabs ${className}`} role="tablist" aria-orientation="horizontal">
      {tabs.map((tab, idx) => (
        <button
          key={tab.id}
          ref={el => { tabRefs.current[idx] = el; }}
          role="tab"
          aria-selected={active === tab.id}
          aria-current={active === tab.id ? 'page' : undefined}
          tabIndex={active === tab.id ? 0 : -1}
          className={`ui-tabs__tab ${active === tab.id ? 'ui-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
        >
          {tab.icon && <Icon name={tab.icon} size={18} />}
          <span className="ui-tabs__label">{tab.label}</span>
          {tab.count != null && <span className="ui-tabs__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
};
