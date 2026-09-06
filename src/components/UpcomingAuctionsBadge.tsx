import { useState, useEffect } from 'react';
import type { SuburbData } from '../data/suburbs';

interface UpcomingAuctionsBadgeProps {
  suburb: SuburbData;
}

export default function UpcomingAuctionsBadge({ suburb }: UpcomingAuctionsBadgeProps) {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!suburb || !suburb.id) return;
    setLoading(true);
    fetch(`/api/suburbs/${suburb.id}/auctions`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok' && data.auctions) {
          setAuctions(data.auctions);
        } else {
          setAuctions([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch auctions:', err);
        setAuctions([]);
      })
      .finally(() => setLoading(false));
  }, [suburb.id]);

  if (loading || auctions.length === 0) return null;

  // Assume auctions array has latest week's count. 
  // Depending on SQM format, it could be objects like { date: "2026-09-01", count: 12 }
  // Let's sum up any recent ones, or just show the latest.
  const latestCount = auctions[auctions.length - 1]?.count || auctions[auctions.length - 1]?.scheduled || 0;

  if (!latestCount) return null;

  return (
    <div className="u-e2ab3d4f" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: 'rgba(234, 179, 8, 0.2)', // Yellow-ish
      color: '#ca8a04',
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.85rem',
      fontWeight: 'bold',
      border: '1px solid rgba(234, 179, 8, 0.4)'
    }}>
      <span>🔨</span> {latestCount} Upcoming Auction{latestCount !== 1 ? 's' : ''}
    </div>
  );
}
