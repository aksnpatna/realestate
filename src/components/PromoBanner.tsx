import { useState, useEffect } from 'react';

export default function PromoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const BANNER_ID = 'promo_banner_v1_subdivision';

  useEffect(() => {
    const dismissed = localStorage.getItem('dismissed_banner');
    if (dismissed !== BANNER_ID) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{
      background: 'var(--accent-purple)',
      color: '#fff',
      padding: '10px 20px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px',
      position: 'relative',
      zIndex: 100,
      fontSize: '0.9rem',
      fontWeight: 500
    }}>
      <span>🎉 <strong>New:</strong> Real subdivision minimum lot sizes now available for 5,000+ NSW suburbs.</span>
      <button 
        onClick={() => {
          localStorage.setItem('dismissed_banner', BANNER_ID);
          setIsVisible(false);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          position: 'absolute',
          right: '15px',
          fontSize: '1.2rem',
          padding: '0 5px'
        }}
        aria-label="Dismiss banner"
      >
        ×
      </button>
    </div>
  );
}
