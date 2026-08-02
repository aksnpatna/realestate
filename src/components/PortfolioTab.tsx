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
    <div className="portfolio-container u-ad4e8983">
      <div className="u-e1fcf348">
        <div>
          <h2>Your Property Portfolio</h2>
          <p className="u-c7477801">Track your real-time estimated equity based on live market data.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="u-74abb916"
        >
          {showAddForm ? 'Cancel' : '+ Add Property'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddProperty} className="u-672ceb74">
          <h3>Add a Property</h3>
          <div className="u-5b85ed1b">
            <div>
              <label className="u-0eaebd20">Suburb</label>
              <select 
                required
                value={newProp.suburb_id}
                onChange={e => setNewProp({...newProp, suburb_id: e.target.value})}
                className="u-fa331ade"
              >
                <option value="">Select a suburb...</option>
                {suburbsData.map(s => (
                  <option key={s.id} value={s.id}>{s.name}, {s.state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="u-0eaebd20">Address</label>
              <input 
                required
                type="text" 
                placeholder="123 Fake Street"
                value={newProp.address}
                onChange={e => setNewProp({...newProp, address: e.target.value})}
                className="u-fa331ade"
              />
            </div>
            <div>
              <label className="u-0eaebd20">Purchase Price</label>
              <input 
                required
                type="number" 
                placeholder="e.g. 750000"
                value={newProp.purchase_price}
                onChange={e => setNewProp({...newProp, purchase_price: e.target.value})}
                className="u-fa331ade"
              />
            </div>
            <div>
              <label className="u-0eaebd20">Purchase Date</label>
              <input 
                required
                type="date" 
                value={newProp.purchase_date}
                onChange={e => setNewProp({...newProp, purchase_date: e.target.value})}
                className="u-fa331ade"
              />
            </div>
          </div>
          <button type="submit" className="u-82479b55">Save Property</button>
        </form>
      )}

      {loading ? (
        <div>Loading your portfolio...</div>
      ) : properties.length === 0 ? (
        <div className="u-44864b57">
          <h3>No properties saved yet!</h3>
          <p className="u-c7477801">Click "Add Property" to track your real estate equity.</p>
        </div>
      ) : (
        <div className="u-0cc0da79">
          {properties.map(prop => {
            const equity = calculateEquity(prop);
            const suburb = suburbsData.find(s => s.id === prop.suburb_id);
            const currentEst = suburb?.metrics?.medianPrice;
            
            return (
              <div key={prop.id} className="u-14cd4b60">
                <h3 className="u-e7d0cf43">{prop.address}</h3>
                <div className="u-8ba3c0a0">{suburb?.name}, {suburb?.state}</div>
                
                <div className="u-64fdd282">
                  <div>
                    <div className="u-fc193050">Purchase Price</div>
                    <div className="u-e0cfe6f3">{formatCurrency(prop.purchase_price)}</div>
                    <div className="u-fc193050">on {prop.purchase_date}</div>
                  </div>
                  <div>
                    <div className="u-fc193050">Current Est. Value</div>
                    <div className="u-e0cfe6f3">{currentEst ? formatCurrency(currentEst) : 'N/A'}</div>
                    <div className="u-fc193050">based on median</div>
                  </div>
                </div>

                <div className="u-00146d2c" style={{borderLeft: equity && equity > 0 ? '4px solid #10b981' : (equity && equity < 0 ? '4px solid #ef4444' : '4px solid var(--border)')}}>
                  <div className="u-1b947f92">Estimated Equity</div>
                  <div className="u-ecf38f3d" style={{color: equity && equity > 0 ? '#10b981' : (equity && equity < 0 ? '#ef4444' : 'var(--text)')}}>
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
