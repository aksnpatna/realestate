import React, { useState } from 'react';
import '../styles/LandingPage.css';
import { Icon } from './ui';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  const [search, setSearch] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('first_home_buyer');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      // Just direct to login for now, but save their intent if we wanted to
      sessionStorage.setItem('initial_search', search);
      sessionStorage.setItem('initial_persona', selectedPersona);
      onRegisterClick();
    }
  };

  const handlePersonaChange = (e: React.MouseEvent<HTMLButtonElement>) => {
    const persona = e.currentTarget.dataset.persona;
    if (persona) {
      setSelectedPersona(persona);
    }
  };

  const backgroundVideo = 'https://alayaproperty.com/__l5e/assets-v1/3735881f-e073-485b-8db0-01142b50da58/hero.mp4';
  const backgroundPoster = 'https://alayaproperty.com/__l5e/assets-v1/bef7de29-73f7-421b-9488-dcf977845678/hero-poster.jpg';

  return (
    <div className="landing-page-v2">
      {/* Dynamic Background */}
      <div className="lp-background">
        <div className="lp-background-overlay"></div>
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          poster={backgroundPoster}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        >
          <source src={backgroundVideo} type="video/mp4" />
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

          {/* Persona Selector */}
          <div className="lp-persona-selector">
            <span className="lp-persona-label">I'm a:</span>
            <div className="lp-persona-buttons">
              <button 
                className={`lp-persona-btn ${selectedPersona === 'first_home_buyer' ? 'active' : ''}`} 
                data-persona="first_home_buyer"
                onClick={handlePersonaChange}
              >
                <Icon name="home" size={18} /> First Home Buyer
              </button>
              <button 
                className={`lp-persona-btn ${selectedPersona === 'investor' ? 'active' : ''}`} 
                data-persona="investor"
                onClick={handlePersonaChange}
              >
                <Icon name="chart" size={18} /> Investor
              </button>
              <button 
                className={`lp-persona-btn ${selectedPersona === 'buyers_agent' ? 'active' : ''}`} 
                data-persona="buyers_agent"
                onClick={handlePersonaChange}
              >
                <Icon name="brief" size={18} /> Buyer's Agent
              </button>
            </div>
          </div>

          {/* Intent Questionnaire */}
          <div className="lp-intent-section" style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', fontWeight: 500 }}>What are you trying to achieve?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                className="lp-intent-btn"
                onClick={() => {
                  sessionStorage.setItem('initial_intent', 'first_home');
                  onRegisterClick();
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Icon name="home" size={24} color="#10b981" />
                  <span>I want to buy my first home</span>
                </div>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
              </button>
              
              <button 
                className="lp-intent-btn"
                onClick={() => {
                  sessionStorage.setItem('initial_intent', 'investment');
                  onRegisterClick();
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Icon name="chart" size={24} color="#f59e0b" />
                  <span>I'm looking for an investment property</span>
                </div>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
              </button>

              <button 
                className="lp-intent-btn"
                onClick={() => {
                  sessionStorage.setItem('initial_intent', 'upgrade');
                  onRegisterClick();
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Icon name="users" size={24} color="#3b82f6" />
                  <span>I want to upgrade to a family home</span>
                </div>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
              </button>
            </div>
          </div>

          <div className="lp-social-proof">
            <div className="lp-trust-badges">
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>13,284 Suburbs Analyzed</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>Updated Weekly</span>
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


      {/* Services Section */}
      <section className="lp-services">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-eyebrow">What We Do</div>
            <h2 className="lp-section-title">Don't buy the wrong property</h2>
            <p className="lp-section-description">
              The property you choose today could affect your wealth for the next <strong>decade</strong>. 
              We make sure it's the right one — four ways to work with us.
            </p>
          </div>
          <div className="lp-services-grid">
            <div className="lp-service-card">
              <div className="lp-service-image" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070&auto=format&fit=crop)' }}>
                <span className="lp-service-tag">Most popular</span>
              </div>
              <div className="lp-service-content">
                <h3>Full Buyer Advisory</h3>
                <p>We run the whole purchase — search to keys.</p>
                <ul className="lp-service-features">
                  <li><Icon name="check" size={16} /> Search &amp; shortlist</li>
                  <li><Icon name="check" size={16} /> Due diligence</li>
                  <li><Icon name="check" size={16} /> Negotiate &amp; settle</li>
                </ul>
                <button onClick={onRegisterClick} className="lp-btn-primary">Book a Free Consult →</button>
              </div>
            </div>

            <div className="lp-service-card">
              <div className="lp-service-image" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=2070&auto=format&fit=crop)' }}>
                <span className="lp-service-tag">Already found a property?</span>
              </div>
              <div className="lp-service-content">
                <h3>Property Due Diligence</h3>
                <p>An independent second opinion before you commit.</p>
                <ul className="lp-service-features">
                  <li><Icon name="check" size={16} /> Objective assessment</li>
                  <li><Icon name="check" size={16} /> Comparable sales</li>
                  <li><Icon name="check" size={16} /> Buy / Consider / Avoid</li>
                </ul>
                <button onClick={onRegisterClick} className="lp-btn-outline">Get It Assessed →</button>
              </div>
            </div>

            <div className="lp-service-card">
              <div className="lp-service-image" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2070&auto=format&fit=crop)' }}>
                <span className="lp-service-tag">Know where you want to buy?</span>
              </div>
              <div className="lp-service-content">
                <h3>Property Sourcing</h3>
                <p>You've picked the market. We find the property.</p>
                <ul className="lp-service-features">
                  <li><Icon name="check" size={16} /> On &amp; off-market search</li>
                  <li><Icon name="check" size={16} /> Data-led shortlist</li>
                  <li><Icon name="check" size={16} /> Value vs comparable sales</li>
                </ul>
                <button onClick={onRegisterClick} className="lp-btn-outline">Find Me a Property →</button>
              </div>
            </div>

            <div className="lp-service-card">
              <div className="lp-service-image" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=2070&auto=format&fit=crop)' }}>
                <span className="lp-service-tag">Already own property?</span>
              </div>
              <div className="lp-service-content">
                <h3>Portfolio Intelligence</h3>
                <p>Buying is only the beginning — we keep watching.</p>
                <ul className="lp-service-features">
                  <li><Icon name="check" size={16} /> Value, equity and yield tracked</li>
                  <li><Icon name="check" size={16} /> Quarterly performance report</li>
                  <li><Icon name="check" size={16} /> Thesis Break Alerts</li>
                </ul>
                <button onClick={onRegisterClick} className="lp-btn-outline">Watch My Portfolio →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="lp-how-it-works">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-eyebrow">How It Works</div>
            <h2 className="lp-section-title">Four steps. Four answers.</h2>
            <p className="lp-section-description">
              Every buyer faces the same four questions. We answer each one with evidence before you commit a cent.
            </p>
          </div>
          <div className="lp-process-flow">
            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="search" size={24} />
              </div>
              <span className="lp-process-number">STEP 01</span>
              <h3>Strategy</h3>
              <p className="lp-process-question">“Where should I buy?”</p>
              <p>Your goals, budget and risk appetite become a written brief.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="chart" size={24} />
              </div>
              <span className="lp-process-number">STEP 02</span>
              <h3>Research</h3>
              <p className="lp-process-question">“Is this suburb going to grow?”</p>
              <p>30+ factors across six dimensions, with hard risk gates.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="check" size={24} />
              </div>
              <span className="lp-process-number">STEP 03</span>
              <h3>Due Diligence</h3>
              <p className="lp-process-question">“What risks am I missing?”</p>
              <p>Comparable sales, condition, zoning and hazard checks.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="brief" size={24} />
              </div>
              <span className="lp-process-number">STEP 04</span>
              <h3>Negotiate &amp; Buy</h3>
              <p className="lp-process-question">“Am I paying the right price?”</p>
              <p>We negotiate or bid on your behalf and see it to settlement.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="lp-trust">
        <div className="lp-container">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Why buyers choose PropertyIQ</h2>
          </div>
          <div className="lp-trust-grid">
            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="check" size={24} />
              </div>
              <h3>Independent</h3>
              <p>We represent you, not the seller. No commissions from vendors, ever.</p>
            </div>

            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="chart" size={24} />
              </div>
              <h3>Evidence-Led</h3>
              <p>Data, not opinion. See the why behind every recommendation.</p>
            </div>

            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="search" size={24} />
              </div>
              <h3>Transparent</h3>
              <p>Our methodology and assumptions are open and visible.</p>
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
