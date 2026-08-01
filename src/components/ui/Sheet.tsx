import React, { useEffect, useRef, useCallback } from 'react';
import { Icon } from './Icon';
import './Sheet.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      sheetRef.current?.focus();
      return () => { document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = ''; };
    }
    return void 0;
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="ui-sheet__backdrop" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Sheet'}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <header className="ui-sheet__header">
          {title && <h2 className="ui-sheet__title">{title}</h2>}
          <button className="ui-sheet__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </div>
  );
};

/* Bottom-sheet variant used on mobile for menus, filters, disambiguation */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      ref.current?.focus();
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-bs__backdrop" onClick={onClose}>
      <div ref={ref} className="ui-bs" role="dialog" aria-modal="true" aria-label={title || 'Menu'} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="ui-bs__handle" aria-hidden="true" />
        {title && <h3 className="ui-bs__title">{title}</h3>}
        <div className="ui-bs__body">{children}</div>
      </div>
    </div>
  );
};
