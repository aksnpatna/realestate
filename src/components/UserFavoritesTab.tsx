import { useState, useEffect } from 'react';
import type { SuburbData } from '../data/suburbs';

interface UserFavoritesTabProps {
  suburbsData: SuburbData[];
  onSelectSuburb: (suburb: SuburbData) => void;
}

export default function UserFavoritesTab({ suburbsData, onSelectSuburb }: UserFavoritesTabProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorites', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setFavorites(data.favorites || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const favoriteSuburbs = favorites
    .map(id => suburbsData.find(s => s.id === id))
    .filter((s): s is SuburbData => s != null);

  return (
    <div className="favorites-container" style={{ padding: '20px', color: 'var(--text)' }}>
      <h2>Your Saved Suburbs</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Access your shortlisted properties and suburbs in one place.
      </p>

      {loading ? (
        <div>Loading your favorites...</div>
      ) : favoriteSuburbs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'var(--surface)', borderRadius: '12px' }}>
          <h3>No favorites yet!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Click the ❤️ icon on any suburb profile to save it here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {favoriteSuburbs.map(suburb => (
            <div key={suburb.id} 
                 style={{ 
                   background: 'var(--surface)', 
                   padding: '20px', 
                   borderRadius: '12px',
                   border: '1px solid var(--border)',
                   cursor: 'pointer',
                   transition: 'transform 0.2s, border-color 0.2s'
                 }}
                 onClick={() => onSelectSuburb(suburb)}
                 onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                 onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <h3 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>{suburb.name}</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>State:</strong> {suburb.state}</div>
                <div><strong>Median Price:</strong> ${suburb.metrics?.medianPrice?.toLocaleString() || 'N/A'}</div>
                <div><strong>Rental Yield:</strong> {suburb.metrics?.rentalYield}%</div>
                <div><strong>DQ Score:</strong> {suburb.dqScore}/100</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
