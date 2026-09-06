import { useState, useEffect } from 'react';
import SoldScatterplot from './SoldScatterplot';
import SqmHistoricalChart from './SqmHistoricalChart';

interface SqmDashboardProps {
  suburbId: string;
}

export default function SqmDashboard({ suburbId }: SqmDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!suburbId) return;
    setLoading(true);
    fetch(`/api/suburbs/${suburbId}/sqm`)
      .then(res => res.json())
      .then(json => {
        if (json.has_sqm_data) {
          setData(json.data);
        } else {
          setData(null);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [suburbId]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading SQM Market Data...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>Error loading SQM data: {error}</div>;
  }

  if (!data) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No historical SQM market data available for this suburb yet.</div>;
  }

  return (
    <div className="sqm-dashboard">
      <h3 style={{ marginBottom: '1.5rem' }}>Recent Sold Properties</h3>
      <SoldScatterplot sqmData={data} />
      
      <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>Vacancy Rate Trends</h3>
      <SqmHistoricalChart sqmData={data} />
    </div>
  );
}
