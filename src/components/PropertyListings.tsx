import React, { useState, useRef, useEffect } from 'react';
import { PropertyCard } from './PropertyCard';
import './PropertyListings.css';

interface Property {
  id: number;
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
}

interface PropertyListingsProps {
  properties?: Property[];
  title?: string;
  subtitle?: string;
  showEquity?: boolean;
}

export function PropertyListings({ 
  properties = [
    {
      id: 1,
      address: '11 Peppertree Grove',
      suburb: 'Quakers Hill, NSW 2763',
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
      suburb: 'Delahey, VIC 3037',
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
      suburb: 'Grovedale, VIC 3216',
      price: '$720,000',
      rent: '$440 pw',
      beds: 3,
      baths: 2,
      cars: 2,
      area: 550,
      image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2070&auto=format&fit=crop',
      equity: '+$60k',
      timeframe: 'in 3 months',
      badge: 'SECURED FOR CLIENT'
    },
    {
      id: 4,
      address: '1310 Riverway Drive',
      suburb: 'Kelso, QLD 4815',
      price: '$520,000',
      rent: '$380 pw',
      beds: 4,
      baths: 2,
      cars: 2,
      area: 700,
      image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef934?q=80&w=2070&auto=format&fit=crop',
      equity: '+$230k',
      timeframe: 'in 24 months',
      badge: 'SECURED FOR CLIENT'
    },
    {
      id: 5,
      address: '2 Deed Court',
      suburb: 'Sunshine West, VIC 3020',
      price: '$650,000',
      rent: '$410 pw',
      beds: 3,
      baths: 2,
      cars: 1,
      area: 480,
      image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=2070&auto=format&fit=crop',
      equity: '+$85k',
      timeframe: 'in 6 months',
      badge: 'SECURED FOR CLIENT'
    }
  ],
  title = 'What it looks like when it goes right',
  subtitle = 'A selection of recent client purchases — each one researched, assessed and negotiated by us, and $1.9M+ in combined estimated equity* between them.',
  showEquity = true
}: PropertyListingsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const updateScrollButtons = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', updateScrollButtons);
      updateScrollButtons();
    }

    return () => {
      if (carousel) {
        carousel.removeEventListener('scroll', updateScrollButtons);
      }
    };
  }, []);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: -300,
        behavior: 'smooth'
      });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: 300,
        behavior: 'smooth'
      });
    }
  };

  const handleViewListing = (propertyId: number) => {
    console.log('Viewing property:', propertyId);
    // In real app, this would navigate to property details
  };

  const handleAskAbout = (propertyId: number) => {
    console.log('Asking about property:', propertyId);
    // In real app, this would open a contact form or chat
  };

  return (
    <section className="property-listings">
      <div className="property-listings-header">
        <div className="eyebrow">Client Results</div>
        <h2 className="title">{title}</h2>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>

      <div className="property-listings-container">
        <button 
          className={`property-listings-arrow left ${!canScrollLeft ? 'disabled' : ''}`}
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          aria-label="Previous properties"
        >
          ←
        </button>

        <div 
          className="property-listings-carousel"
          ref={carouselRef}
          role="region"
          aria-label="Recently secured client properties — horizontally scrollable"
        >
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              address={property.address}
              suburb={property.suburb}
              price={property.price}
              rent={property.rent}
              beds={property.beds}
              baths={property.baths}
              cars={property.cars}
              area={property.area}
              image={property.image}
              equity={showEquity ? property.equity : undefined}
              timeframe={showEquity ? property.timeframe : undefined}
              badge={property.badge}
              onView={() => handleViewListing(property.id)}
              onAsk={() => handleAskAbout(property.id)}
            />
          ))}
        </div>

        <button 
          className={`property-listings-arrow right ${!canScrollRight ? 'disabled' : ''}`}
          onClick={scrollRight}
          disabled={!canScrollRight}
          aria-label="Next properties"
        >
          →
        </button>
      </div>

      <p className="property-listings-note">
        These cards show a selection of recent client purchases, not a complete record of every property we have bought. 
        *Estimated equity compares the purchase price with the most recent value estimate we hold for that property. 
        Indicative only and not financial advice; individual results vary.
      </p>
    </section>
  );
}