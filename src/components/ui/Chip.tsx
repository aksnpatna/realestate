import React from 'react';
import './Chip.css';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({ label, selected = false, onClick, removable = false, onRemove, className = '' }) => {
  const base = `ui-chip ${selected ? 'ui-chip--selected' : ''} ${onClick ? 'ui-chip--clickable' : ''} ${className}`;
  return (
    <span
      className={base}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
    >
      {label}
      {removable && onRemove && (
        <button className="ui-chip__remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={`Remove ${label}`}>&times;</button>
      )}
    </span>
  );
};
