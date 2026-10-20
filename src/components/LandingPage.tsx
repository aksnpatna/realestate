import React, { useState } from 'react';
import '../styles/LandingPage.css';
import { Icon } from './ui';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onViewSamples?: () => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick, onViewSamples }: LandingPageProps) {
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



  return (
    <div className="landing-page-v2">
      {/* Animated Gradient Background */}
      <div className="lp-background">
        <div className="lp-background-overlay"></div>
      </div>
      {/* Premium Header */}
      <nav className="lp-header">
        <div className="lp-brand">
          <div className="lp-logo">IQ</div>
          <span className="lp-brand-name">PropertyIQ</span>
        </div>
        <div className="lp-nav-actions">
          {onViewSamples && <button onClick={onViewSamples} className="lp-btn-ghost">Sample Reports</button>}
          <button onClick={onLoginClick} className="lp-btn-ghost">Log in</button>
          <button onClick={onRegisterClick} className="lp-btn-primary">Get Started Free</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-badge">Suburb research made simple</div>
          <h1 className="lp-hero-title">
            Find the right suburb for your <span className="lp-text-gradient">life and budget</span>
          </h1>
          <p className="lp-hero-subtitle">
            Skip the spreadsheets. PropertyIQ brings together public suburb data for 13,000+ suburbs to help you compare where to buy, based on your budget, goals and lifestyle.
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
                  <span>I'm researching suburbs for my first home</span>
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
                  <span>I'm comparing suburbs for investment</span>
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
                  <span>I'm looking for a family-friendly suburb</span>
                </div>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
              </button>
            </div>
          </div>

          <div className="lp-social-proof">
            <div className="lp-trust-badges">
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>13,000+ Suburbs Covered</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>Regularly Updated</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>Official ABS & Government Data</span>
              </div>
              <div className="lp-trust-badge">
                <Icon name="check" size={16} />
                <span>AI-Assisted Suburb Summaries</span>
              </div>
            </div>
            <div className="lp-sp-logos">
              <span>ABS Census</span>
              <span className="lp-dot">•</span>
              <span>ACARA</span>
              <span className="lp-dot">•</span>
              <span>OpenStreetMap</span>
            </div>
          </div>
        </div>
      </section>

      {/* Persona Section */}
      <section className="lp-personas">
        <div className="lp-container">
          <h2 className="lp-section-title">Suburb research for every buyer</h2>
          <div className="lp-grid-3">
            
            <div className="lp-persona-card">
              <div className="lp-persona-icon"><Icon name="home" size={32} /></div>
              <h3>First Home Buyers</h3>
              <p>Shortlist suburbs that fit your budget and lifestyle, with school catchments and livability information.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> Affordability Calculator</li>
                <li><Icon name="check" size={16} /> School Zone Mapping</li>
                <li><Icon name="check" size={16} /> Livability Scores</li>
              </ul>
              <button onClick={onRegisterClick} className="lp-btn-outline">I'm a Buyer</button>
            </div>

            <div className="lp-persona-card lp-persona-featured">
              <div className="lp-persona-icon"><Icon name="chart" size={32} /></div>
              <h3>Property Investors</h3>
              <p>Compare suburb-level rental yields, market trends and demographics to decide where to focus your search.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> Suburb Yield &amp; Rent Trends</li>
                <li><Icon name="check" size={16} /> Historical Market Charts</li>
                <li><Icon name="check" size={16} /> Demographic Insights</li>
              </ul>
              <button onClick={onRegisterClick} className="lp-btn-primary">I'm an Investor</button>
            </div>

            <div className="lp-persona-card">
              <div className="lp-persona-icon"><Icon name="brief" size={32} /></div>
              <h3>Buyer's Agents</h3>
              <p>Produce suburb briefs for your clients with every metric traced back to its source.</p>
              <ul className="lp-feature-list">
                <li><Icon name="check" size={16} /> Exportable Suburb Briefs</li>
                <li><Icon name="check" size={16} /> Data Source Transparency</li>
                <li><Icon name="check" size={16} /> Data Quality Indicators</li>
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
              <h2 className="lp-section-title text-left">Stop guessing. Start comparing.</h2>
              <p className="lp-lead">We bring public and open suburb data together in one place so you don't have to.</p>
              
              <div className="lp-step">
                <div className="lp-step-number">1</div>
                <div>
                  <h4>Tell us what matters</h4>
                  <p>Set your budget and priorities such as yield, growth, schools or lifestyle.</p>
                </div>
              </div>
              <div className="lp-step">
                <div className="lp-step-number">2</div>
                <div>
                  <h4>Ask anything</h4>
                  <p>Use our AI search to ask things like "suburbs near train stations with good schools".</p>
                </div>
              </div>
              <div className="lp-step">
                <div className="lp-step-number">3</div>
                <div>
                  <h4>Explore the suburb</h4>
                  <p>View suburb profiles with market trends, demographics and amenities.</p>
                </div>
              </div>
            </div>
            <div className="lp-split-image">
              <div className="lp-mock-card">
                <div className="lp-mock-header">
                  <div>
                    <h5>Sample suburb profile</h5>
                    <span className="lp-mock-badge">Illustrative example</span>
                  </div>
                </div>
                <div className="lp-mock-metrics">
                  <div>
                    <span>Median House</span>
                    <strong>$—</strong>
                  </div>
                  <div>
                    <span>Rental Yield</span>
                    <strong>—%</strong>
                  </div>
                </div>
                <div className="lp-mock-chart"></div>
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
            <h2 className="lp-section-title">Four steps to a shortlist of suburbs</h2>
            <p className="lp-section-description">
              Suburb research only: we help you decide where to look. We do not value, assess or recommend individual properties.
            </p>
          </div>
          <div className="lp-process-flow">
            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="search" size={24} />
              </div>
              <span className="lp-process-number">STEP 01</span>
              <h3>Set your criteria</h3>
              <p className="lp-process-question">“Where should I look?”</p>
              <p>Enter your budget, goals and priorities such as schools, transport and lifestyle.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="chart" size={24} />
              </div>
              <span className="lp-process-number">STEP 02</span>
              <h3>Compare suburbs</h3>
              <p className="lp-process-question">“How do these suburbs stack up?”</p>
              <p>Side-by-side suburb metrics for market trends, demographics and amenities.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="check" size={24} />
              </div>
              <span className="lp-process-number">STEP 03</span>
              <h3>Check the risks</h3>
              <p className="lp-process-question">“What should I watch for?”</p>
              <p>Suburb-level data-quality flags and the known gaps behind each metric.</p>
            </div>

            <div className="lp-process-step">
              <div className="lp-process-icon">
                <Icon name="brief" size={24} />
              </div>
              <span className="lp-process-number">STEP 04</span>
              <h3>Save your research</h3>
              <p className="lp-process-question">“What did I find?”</p>
              <p>Keep a suburb brief to revisit, or share with your broker or buyer's agent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="lp-trust">
        <div className="lp-container">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Why people use PropertyIQ</h2>
          </div>
          <div className="lp-trust-grid">
            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="check" size={24} />
              </div>
              <h3>Suburb-focused</h3>
              <p>Built for choosing where to buy, not for pricing a specific property.</p>
            </div>

            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="chart" size={24} />
              </div>
              <h3>Evidence-led</h3>
              <p>Each metric shows its source and a data-quality indicator.</p>
            </div>

            <div className="lp-trust-card">
              <div className="lp-trust-icon">
                <Icon name="search" size={24} />
              </div>
              <h3>Transparent</h3>
              <p>General information only, not financial or valuation advice.</p>
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
            <button onClick={() => onViewSamples?.()} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:'inherit',padding:0}}>Sample Reports</button>
            <button onClick={() => window.location.href = '?view=privacy'} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:'inherit',padding:0}}>Privacy Policy</button>
            <button onClick={() => window.location.href = '?view=terms'} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:'inherit',padding:0}}>Terms of Use</button>
            <a href="#">Contact</a>
          </div>
          <p className="lp-footer-copy">© 2026 PropertyIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
