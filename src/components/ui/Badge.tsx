import React from 'react';
import { Icon, type IconName } from './Icon';
import './Badge.css';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dq-high' | 'dq-medium' | 'dq-limited' | 'dq-unavailable';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: IconName;
  children: React.ReactNode;
}

const iconForVariant: Record<BadgeVariant, IconName> = {
  success: 'check', warning: 'warning', danger: 'warning', info: 'info',
  neutral: 'info', 'dq-high': 'check', 'dq-medium': 'info', 'dq-limited': 'warning', 'dq-unavailable': 'warning',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', icon, children }) => (
  <span className={`ui-badge ui-badge--${variant}`}>
    <Icon name={icon || iconForVariant[variant]} size={14} />
    <span>{children}</span>
  </span>
);
