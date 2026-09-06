import { useState, useEffect } from 'react';
import MacroBenchmarkPanel from './MacroBenchmarkPanel';

interface MarketNewsItem {
  id: number;
  topic: string;
  sentiment_label: string;
  sentiment_score: number;
  summary: string;
  articles_analyzed: number;
  last_updated: string;
}

export default function MarketPulseTab() {
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/market-news')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNews(data);
        } else {
          setError('Failed to load news');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="market-pulse-tab u-da039bfe">
      <h3 className="u-e4df4f18" style={{ marginBottom: '1.5rem' }}>Macro Market Pulse</h3>
      
      {loading ? (
        <div className="u-a4f43f78">Loading market insights...</div>
      ) : error ? (
        <div className="u-d4cf3a38">{error}</div>
      ) : news.length === 0 ? (
        <div className="u-a4f43f78">No recent market news available.</div>
      ) : (
        <div className="news-grid u-e87e972e" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginBottom: '2rem' }}>
          {news.map(item => {
            const isPositive = item.sentiment_label.toLowerCase() === 'positive';
            const isNegative = item.sentiment_label.toLowerCase() === 'negative';
            const badgeColor = isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--warning)';
            const badgeBg = isPositive ? 'rgba(16,185,129,0.1)' : isNegative ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
            
            return (
              <div key={item.id} className="glass-card u-f5f90c74" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.topic}</h4>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    color: badgeColor,
                    backgroundColor: badgeBg
                  }}>
                    {item.sentiment_label.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                  {item.summary}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Analyzed {item.articles_analyzed} articles • Updated {new Date(item.last_updated).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="u-e4df4f18" style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>Investor Benchmarks</h3>
      <MacroBenchmarkPanel />
    </div>
  );
}
