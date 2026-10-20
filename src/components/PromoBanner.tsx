import { useState, useEffect } from 'react';

export default function PromoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const BANNER_ID = 'promo_banner_v2_suburb_coverage';

  useEffect(() => {
    const dismissed = localStorage.getItem('dismissed_banner');
    if (dismissed !== BANNER_ID) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="u-f28497a5">
      <span>🎉 <strong>New:</strong> Suburb-level market trends, demographics and school catchments for 13,000+ suburbs.</span>
      <button 
        onClick={() => {
          localStorage.setItem('dismissed_banner', BANNER_ID);
          setIsVisible(false);
        }}
        className="u-6fddf3e7"
        aria-label="Dismiss banner"
      >
        ×
      </button>
    </div>
  );
}
