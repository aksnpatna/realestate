import { useState } from 'react';
import { trackEvent } from '../services/analytics';

interface ShareReportProps {
  suburbName: string;
  suburbId: string;
}

export default function ShareReport({ suburbName, suburbId }: ShareReportProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/report/${suburbId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      trackEvent('share_report', { suburb_id: suburbId, suburb_name: suburbName });
    });
  };

  return (
    <button 
      onClick={handleShare}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        color: 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 500,
        transition: 'all 0.2s',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{copied ? '✓' : '⎘'}</span>
      {copied ? 'Link Copied!' : 'Share Report'}
    </button>
  );
}
