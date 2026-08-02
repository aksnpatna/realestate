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
    <div className="favorites-container u-ad4e8983">
      <h2>Your Saved Suburbs</h2>
      <p className="u-d819ecc7">
        Access your shortlisted properties and suburbs in one place.
      </p>

      {loading ? (
        <div>Loading your favorites...</div>
      ) : favoriteSuburbs.length === 0 ? (
        <div className="u-44864b57">
          <h3>No favorites yet!</h3>
          <p className="u-c7477801">Click the ❤️ icon on any suburb profile to save it here.</p>
        </div>
      ) : (
        <div className="u-5df052bb">
          {favoriteSuburbs.map(suburb => (
            <div key={suburb.id} 
                 className="u-b47ef40f"
                 onClick={() => onSelectSuburb(suburb)}
                 onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                 onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <h3 className="u-e7d0cf43">{suburb.name}</h3>
              <div className="u-b037fb1b">
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
