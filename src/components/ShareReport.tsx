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
      className="u-9b858c9f"
    >
      <span className="u-ce0fd88b">{copied ? '✓' : '⎘'}</span>
      {copied ? 'Link Copied!' : 'Share Report'}
    </button>
  );
}
