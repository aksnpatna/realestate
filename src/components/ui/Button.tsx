import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`ui-btn ui-btn--${variant} ui-btn--${size} ${fullWidth ? 'ui-btn--full' : ''} ${loading ? 'ui-btn--loading' : ''} ${className}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
    <span className={loading ? 'ui-btn__label--hidden' : ''}>{children}</span>
  </button>
);
