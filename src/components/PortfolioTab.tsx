import React, { useState, useEffect } from 'react';
import type { SuburbData } from '../data/suburbs';

interface PortfolioProperty {
  id: number;
  suburb_id: string;
  address: string;
  purchase_price: number;
  purchase_date: string;
}

interface PortfolioTabProps {
  suburbsData: SuburbData[];
}

export default function PortfolioTab({ suburbsData }: PortfolioTabProps) {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProp, setNewProp] = useState({
    suburb_id: '',
    address: '',
    purchase_price: '',
    purchase_date: ''
  });

  const loadProperties = () => {
    setLoading(true);
    fetch('/api/portfolio', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setProperties(data.properties || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          suburb_id: newProp.suburb_id,
          address: newProp.address,
          purchase_price: parseFloat(newProp.purchase_price),
          purchase_date: newProp.purchase_date
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowAddForm(false);
        setNewProp({ suburb_id: '', address: '', purchase_price: '', purchase_date: '' });
        loadProperties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateEquity = (prop: PortfolioProperty) => {
    const suburb = suburbsData.find(s => s.id === prop.suburb_id);
    if (!suburb || !suburb.metrics?.medianPrice) return null;
    return suburb.metrics.medianPrice - prop.purchase_price;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="portfolio-container" style={{ padding: '20px', color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2>Your Property Portfolio</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Track your real-time estimated equity based on live market data.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: '10px 20px', background: 'var(--accent)', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          {showAddForm ? 'Cancel' : '+ Add Property'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddProperty} style={{ background: 'var(--surface)', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid var(--border)' }}>
          <h3>Add a Property</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Suburb</label>
              <select 
                required
                value={newProp.suburb_id}
                onChange={e => setNewProp({...newProp, suburb_id: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="">Select a suburb...</option>
                {suburbsData.map(s => (
                  <option key={s.id} value={s.id}>{s.name}, {s.state}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Address</label>
              <input 
                required
                type="text" 
                placeholder="123 Fake Street"
                value={newProp.address}
                onChange={e => setNewProp({...newProp, address: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Purchase Price</label>
              <input 
                required
                type="number" 
                placeholder="e.g. 750000"
                value={newProp.purchase_price}
                onChange={e => setNewProp({...newProp, purchase_price: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Purchase Date</label>
              <input 
                required
                type="date" 
                value={newProp.purchase_date}
                onChange={e => setNewProp({...newProp, purchase_date: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          <button type="submit" style={{ padding: '10px 20px', background: 'var(--accent)', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Save Property</button>
        </form>
      )}

      {loading ? (
        <div>Loading your portfolio...</div>
      ) : properties.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'var(--surface)', borderRadius: '12px' }}>
          <h3>No properties saved yet!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Click "Add Property" to track your real estate equity.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {properties.map(prop => {
            const equity = calculateEquity(prop);
            const suburb = suburbsData.find(s => s.id === prop.suburb_id);
            const currentEst = suburb?.metrics?.medianPrice;
            
            return (
              <div key={prop.id} style={{ background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--accent)' }}>{prop.address}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>{suburb?.name}, {suburb?.state}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Purchase Price</div>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(prop.purchase_price)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>on {prop.purchase_date}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Est. Value</div>
                    <div style={{ fontWeight: 600 }}>{currentEst ? formatCurrency(currentEst) : 'N/A'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>based on median</div>
                  </div>
                </div>

                <div style={{ padding: '15px', background: 'var(--bg)', borderRadius: '8px', borderLeft: equity && equity > 0 ? '4px solid #10b981' : (equity && equity < 0 ? '4px solid #ef4444' : '4px solid var(--border)') }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Equity</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: equity && equity > 0 ? '#10b981' : (equity && equity < 0 ? '#ef4444' : 'var(--text)') }}>
                    {equity !== null ? (equity > 0 ? '+' : '') + formatCurrency(equity) : 'Calculating...'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
