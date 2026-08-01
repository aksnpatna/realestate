import React from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'search', title, description, action }) => (
  <div className="ui-empty">
    <Icon name={icon} size={48} className="ui-empty__icon" />
    <h3 className="ui-empty__title">{title}</h3>
    {description && <p className="ui-empty__desc">{description}</p>}
    {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
  </div>
);
