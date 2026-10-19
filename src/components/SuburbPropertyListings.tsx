import React, { useState, useEffect } from 'react';
import { PropertyCard } from './PropertyCard';
import './SuburbPropertyListings.css';

interface SuburbProperty {
  id: number;
  address: string;
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
}

interface SuburbPropertyListingsProps {
  suburbName?: string;
  state?: string;
  postcode?: string;
  properties?: SuburbProperty[];
  onViewProperty?: (propertyId: number) => void;
  onAskAbout?: (propertyId: number) => void;
}

export function SuburbPropertyListings({ 
  suburbName = '',
  state = '',
  postcode = '',
  properties = [],
  onViewProperty,
  onAskAbout
}: SuburbPropertyListingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localProperties, setLocalProperties] = useState<SuburbProperty[]>(properties);

  useEffect(() => {
    setLocalProperties(properties);
    setIsLoading(false);
  }, [properties]);

  const handleViewProperty = (propertyId: number) => {
    if (onViewProperty) {
      onViewProperty(propertyId);
    } else {
      console.log('Viewing property:', propertyId);
    }
  };

  const handleAskAbout = (propertyId: number) => {
    if (onAskAbout) {
      onAskAbout(propertyId);
    } else {
      console.log('Asking about property:', propertyId);
    }
  };

  return (
    <section className="suburb-property-listings">
      <div className="suburb-property-listings-header">
        <h2 className="suburb-property-listings-title">
          Properties in {suburbName}
        </h2>
        <p className="suburb-property-listings-subtitle">
          Recent sales and properties for sale in {suburbName}, {state} {postcode}
        </p>
      </div>

      {isLoading ? (
        <div className="suburb-property-listings-loading">
          <div className="loading-spinner">Loading properties...</div>
        </div>
      ) : localProperties.length > 0 ? (
        <div className="suburb-property-listings-grid">
          {localProperties.map((property) => (
            <PropertyCard
              key={property.id}
              address={property.address}
              suburb={`${suburbName}, ${state} ${postcode}`}
              price={property.price}
              rent={property.rent}
              beds={property.beds}
              baths={property.baths}
              cars={property.cars}
              area={property.area}
              image={property.image}
              equity={property.equity}
              timeframe={property.timeframe}
              badge={property.badge}
              onView={() => handleViewProperty(property.id)}
              onAsk={() => handleAskAbout(property.id)}
            />
          ))}
        </div>
      ) : (
        <div className="suburb-property-listings-empty">
          <div className="empty-state">
            <h3>No properties available</h3>
            <p>Check back soon for the latest properties in {suburbName}</p>
          </div>
        </div>
      )}
    </section>
  );
}