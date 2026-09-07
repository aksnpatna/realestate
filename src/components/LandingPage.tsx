import React, { useState, useEffect } from 'react';
import '../styles/LandingPage.css';
import { Icon } from './ui';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  const [search, setSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      // Just direct to login for now, but save their intent if we wanted to
      sessionStorage.setItem('initial_search', search);
      onRegisterClick();
    }
  };

  // Background media assets - Australian landmarks
  const backgroundVideos = [
    'https://assets.mixkit.co/videos/preview/mixkit-sydney-opera-house-and-harbour-bridge-4010-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-melbourne-city-skyline-at-night-4009-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-brisbane-river-and-story-bridge-4011-large.mp4'
  ];

  const backgroundImages = [
    'https://images.unsplash.com/photo-1549488344-1f9d96336337?q=80&w=2070&auto=format&fit=crop', // Sydney Opera House
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop', // Melbourne CBD
    'https://images.unsplash.com/photo-1545389336-cf090694435e?q=80&w=2070&auto=format&fit=crop'  // Brisbane
  ];

  const [mediaIndex, setMediaIndex] = useState(0);
  
  // Auto-rotate background media
  useEffect(() => {
    const interval = setInterval(() => {
      setMediaIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-page-v2">
      {/* Dynamic Background */}
      <div className="lp-background">
        <div className="lp-background-overlay"></div>
        <img 
          src={backgroundImages[mediaIndex]} 
          alt="Australian landscape"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        >
          <source src={backgroundVideos[mediaIndex]} type="video/mp4" />
        </video>
      </div>
      {/* Premium Header */}
      <nav className="lp-header">
        <div className="lp-brand">
          <div className="lp-logo">IQ</div>
          <span className="lp-brand-name">PropertyIQ</span>
        </div>
        <div className="lp-nav-actions">
          <button onClick={onLoginClick} className="lp-btn-ghost">Log in</button>
          <button onClick={onRegisterClick} className="lp-btn-primary">Start Free Trial</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-badge">✨ The new standard in property research</div>
          <h1 className="lp-hero-title">
            Find the right suburb for your <span className="lp-text-gradient">life and budget</span>
          </h1>
          <p className="lp-hero-subtitle">
            Skip the spreadsheets. PropertyIQ analyzes 13,000+ suburbs instantly to match your borrowing capacity, investment strategy, or lifestyle needs.
          </p>

          <form className="lp-search-box" onSubmit={handleSearchSubmit}>
            <Icon name="search" size={24} className="lp-search-icon" />
            <input 
              type="text" 
              placeholder="e.g. Best investment suburbs in QLD under $800k..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lp-search-input"
            />
            <button type="submit" className="lp-search-btn">
              <span>Analyze</span>
              <Icon name="arrow-right" size={18} className="lp-search-arrow" />
            </button>
          </form>

          {/* Quick Start Suggestions */}
          <div className="lp-quick-start">
            <span className="lp-quick-label">Quick start:</span>
            <div className="lp-quick-tags">
              <button 
                className="lp-quick-tag" 
                onClick={() => { setSearch('Best suburbs for first home buyers in Melbourne'); }}
              >
                First home buyers
              </button>
              <button 
                className="lp-quick-tag" 
                onClick={() => { setSearch('High rental yield suburbs in Brisbane'); }}
              >
                High rental yield
              </button>
              <button 
                className="lp-quick-tag" 
                onClick={() => { setSearch('Suburbs with 4+ bedroom houses near CBD'); }}
              >
                Family suburbs
              </button>
            </div>
          </div>

          <div className="lp-social-proof">
            <div className="lp-trust-badges">
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>13,000+ Suburbs Analyzed</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>Official ABS & SQM Data</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>AI-Powered Insights</span>
              </div>
            </div>
            <div className="lp-sp-logos">
              <span>ABS Census</span>
              <span className="lp-dot">•</span>
              <span>SQM Research</span>
              <span className="lp-dot">•</span>
              <span>Valuer General</span>
            </div>
          </div>
        </div>
      </section>

      {/* Persona Section */}
      <section className="lp-personas">
        <div className="lp-container">
          <h2 className="lp-section-title">Built for every property strategy</h2>
          <div className="lp-grid-3">
            
            <div className="lp-persona-card">
              <div className="lp-persona-icon"><Icon name="home" size={32} /></div>
              <h3>First Home Buyers</h3>
              <p>Find suburbs where you can actually afford to buy, factoring in stamp duty, LMI, and true borrowing capacity.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> True Affordability Calculator</li>
                <li><Icon name="check" size={16} /> Official School Zones</li>
                <li><Icon name="check" size={16} /> Livability Scores</li>
              </ul>
              <button onClick={onRegisterClick} className="lp-btn-outline">I'm a Buyer</button>
            </div>

            <div className="lp-persona-card lp-persona-featured">
              <div className="lp-persona-icon"><Icon name="chart" size={32} /></div>
              <h3>Property Investors</h3>
              <p>Discover high-yield, high-growth pockets before the market catches on. Full cashflow and depreciation modelling.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> Pre-tax & Post-tax Cashflow</li>
                <li><Icon name="check" size={16} /> 10-Year Growth Forecasts</li>
                <li><Icon name="check" size={16} /> AI Bull/Bear Committee</li>
              </ul>
              <button onClick={onRegisterClick} className="lp-btn-primary">I'm an Investor</button>
            </div>

            <div className="lp-persona-card">
              <div className="lp-persona-icon"><Icon name="brief" size={32} /></div>
              <h3>Buyer's Agents</h3>
              <p>Generate world-class, white-labeled decision briefs for your clients backed by deterministic, explainable data.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> Client Audit Trails (PDF)</li>
                <li><Icon name="check" size={16} /> Full Data Provenance</li>
                <li><Icon name="check" size={16} /> Confidence Bands</li>
              </ul>
              <button onClick={onRegisterClick} className="lp-btn-outline">I'm an Agent</button>
            </div>

          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="lp-how-it-works">
        <div className="lp-container">
          <div className="lp-split">
            <div className="lp-split-text">
              <h2 className="lp-section-title text-left">Stop guessing. Start knowing.</h2>
              <p className="lp-lead">We process millions of data points across the country every week so you don't have to.</p>
              
              <div className="lp-step">
                <div className="lp-step-number">1</div>
                <div>
                  <h4>Tell us your strategy</h4>
                  <p>Set your budget, deposit, and goals (yield vs growth).</p>
                </div>
              </div>
              <div className="lp-step">
                <div className="lp-step-number">2</div>
                <div>
                  <h4>Ask anything</h4>
                  <p>Use our AI search to find "suburbs with 3+ bed houses near train stations under $900k".</p>
                </div>
              </div>
              <div className="lp-step">
                <div className="lp-step-number">3</div>
                <div>
                  <h4>Get the full picture</h4>
                  <p>View rich suburb profiles with market pulses, demographic shifts, and exact cashflow projections.</p>
                </div>
              </div>
            </div>
            <div className="lp-split-image">
              <div className="lp-mock-card">
                <div className="lp-mock-header">
                  <div>
                    <h5>Point Cook, VIC 3030</h5>
                    <span className="lp-mock-badge">High Growth</span>
                  </div>
                  <div className="lp-mock-score">84</div>
                </div>
                <div className="lp-mock-metrics">
                  <div>
                    <span>Median House</span>
                    <strong>$780,000</strong>
                  </div>
                  <div>
                    <span>Rental Yield</span>
                    <strong>4.2%</strong>
                  </div>
                </div>
                <div className="lp-mock-chart"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-logo small">IQ</div>
            <span>PropertyIQ</span>
          </div>
          <div className="lp-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
            <a href="#">Contact</a>
          </div>
          <p className="lp-footer-copy">© 2026 PropertyIQ. All rights reserved. ABN: 12 345 678 901</p>
        </div>
      </footer>
    </div>
  );
}
