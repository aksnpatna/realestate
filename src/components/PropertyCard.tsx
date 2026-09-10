import React from 'react';
import { Icon } from './ui';
import './PropertyCard.css';

interface PropertyCardProps {
  address: string;
  suburb: string;
  price?: string;
  rent?: string;
  beds?: number;
  baths?: number;
  cars?: number;
  area?: number;
  image?: string;
  equity?: string;
  timeframe?: string;
  badge?: string;
  onView?: () => void;
  onAsk?: () => void;
}

export function PropertyCard({ 
  address, 
  suburb, 
  price, 
  rent, 
  beds, 
  baths, 
  cars, 
  area,
  image = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070&auto=format&fit=crop',
  equity,
  timeframe,
  badge = 'FOR SALE',
  onView,
  onAsk
}: PropertyCardProps) {
  return (
    <div className="property-card">
      <div className="property-image-container">
        <img 
          src={image} 
          alt={address} 
          className="property-image"
          loading="lazy"
        />
        <div className="property-badge">{badge}</div>
        {equity && timeframe && (
          <div className="property-equity">
            <strong>{equity} <i>equity*</i></strong>
            <span>{timeframe}</span>
          </div>
        )}
      </div>
      
      <div className="property-details">
        <h3 className="property-address">{address}</h3>
        <p className="property-suburb">{suburb}</p>
        
        <div className="property-features">
          {beds && (
            <div className="property-feature">
              <Icon name="bed" size={16} />
              <span>{beds} bed</span>
            </div>
          )}
          {baths && (
            <div className="property-feature">
              <Icon name="bath" size={16} />
              <span>{baths} bath</span>
            </div>
          )}
          {cars && (
            <div className="property-feature">
              <Icon name="car" size={16} />
              <span>{cars} car</span>
            </div>
          )}
          {area && (
            <div className="property-feature">
              <Icon name="ruler" size={16} />
              <span>{area}m²</span>
            </div>
          )}
        </div>
        
        <div className="property-pricing">
          {price && <div className="property-price">{price}</div>}
          {rent && <div className="property-rent">{rent}</div>}
        </div>
        
        <div className="property-actions">
          {onView && (
            <button className="property-action" onClick={onView}>
              VIEW LISTING ↗
            </button>
          )}
          {onAsk && (
            <button className="property-action" onClick={onAsk}>
              ASK ABOUT THIS →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}