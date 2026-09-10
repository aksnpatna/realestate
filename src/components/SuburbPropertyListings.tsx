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
  suburbName = 'Quakers Hill',
  state = 'NSW',
  postcode = '2763',
  properties = [
    {
      id: 1,
      address: '11 Peppertree Grove',
      price: '$850,000',
      rent: '$550 pw',
      beds: 4,
      baths: 2,
      cars: 2,
      area: 650,
      image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070&auto=format&fit=crop',
      equity: '+$600k',
      timeframe: 'in 48 months',
      badge: 'SECURED FOR CLIENT'
    },
    {
      id: 2,
      address: '14 Barley Court',
      price: '$680,000',
      rent: '$420 pw',
      beds: 3,
      baths: 2,
      cars: 1,
      area: 500,
      image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=2070&auto=format&fit=crop',
      equity: '+$100k',
      timeframe: 'before settlement',
      badge: 'SECURED FOR CLIENT'
    },
    {
      id: 3,
      address: '1 Burleigh Drive',
      price: '$720,000',
      rent: '$440 pw',
      beds: 3,
      baths: 2,
      cars: 2,
      area: 550,
      image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2070&auto=format&fit=crop',
      equity: '+$60k',
      timeframe: 'in 3 months',
      badge: 'FOR SALE'
    }
  ],
  onViewProperty,
  onAskAbout
}: SuburbPropertyListingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [localProperties, setLocalProperties] = useState<SuburbProperty[]>([]);

  useEffect(() => {
    // Simulate API call to fetch properties for this suburb
    const timer = setTimeout(() => {
      setLocalProperties(properties);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
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