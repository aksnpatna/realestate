import '../index.css';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  return (
    <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-cyan)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
            IQ
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>PropertyIQ</span>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={onLoginClick} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>Log in</button>
          <button onClick={onRegisterClick} style={{ background: 'var(--accent-cyan)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem', transition: 'background 0.2s' }}>Start Free Trial</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '80px 20px', textAlign: 'center', background: 'linear-gradient(to bottom, #F8FAFC, #FFFFFF)' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)', maxWidth: '900px', margin: '0 auto', lineHeight: 1.1 }}>
          Make Smarter Property Decisions with <span style={{ color: 'var(--accent-cyan)' }}>Institutional-Grade Data</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '700px', margin: '24px auto 32px auto', lineHeight: 1.5 }}>
          Subdivision precedents, demand signals, and AI-powered suburb profiling — all in one platform designed for investors and professionals.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button onClick={onRegisterClick} style={{ background: 'var(--accent-cyan)', color: '#fff', padding: '14px 28px', fontSize: '1.1rem', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}>
            Start Free Trial
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '14px 28px', fontSize: '1.1rem', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
            See How It Works
          </button>
        </div>
      </section>

      {/* Trust Bar */}
      <section style={{ padding: '40px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '20px' }}>Data Powered By</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', opacity: 0.6 }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ABS Census 2021</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>NSW Valuer General</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>OpenStreetMap</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PropTrack</span>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '50px', color: 'var(--text-primary)' }}>Tailored for your strategy</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          
          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '15px' }}>For First Home Buyers</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-secondary)' }}>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ Affordability ceiling calculator</li>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ Official school catchment zones</li>
              <li>✓ Livability & walkability scores</li>
            </ul>
          </div>

          <div className="glass-card" style={{ padding: '30px', border: '2px solid var(--accent-cyan)' }}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '15px' }}>For Investors</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-secondary)' }}>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ Cashflow & yield modeling</li>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ Real subdivision precedents</li>
              <li>✓ AI Committee (Bull/Bear insights)</li>
            </ul>
          </div>

          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '15px' }}>For Buyer's Agents</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-secondary)' }}>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ White-label suburb reports</li>
              <li style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)', marginBottom: '10px' }}>✓ Full technical provenance</li>
              <li>✓ Data quality confidence bands</li>
            </ul>
          </div>

        </div>
      </section>

      {/* Pricing Preview */}
      <section style={{ padding: '80px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-glass)' }}>
        <h2 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '50px', color: 'var(--text-primary)' }}>Simple, transparent pricing</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
          
          <div className="glass-card" style={{ padding: '40px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Quant Investor</h3>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '20px 0' }}>$99<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo</span></div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Everything an individual investor needs to outperform the market.</p>
            <button onClick={onRegisterClick} style={{ width: '100%', padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Start 7-Day Trial</button>
          </div>

          <div className="glass-card" style={{ padding: '40px', width: '100%', maxWidth: '400px', background: 'var(--accent-primary)', color: '#fff' }}>
            <div style={{ display: 'inline-block', background: 'var(--accent-cyan)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '15px' }}>MOST POPULAR</div>
            <h3 style={{ fontSize: '1.5rem', color: '#fff' }}>Professional</h3>
            <div style={{ fontSize: '3rem', fontWeight: 800, margin: '20px 0' }}>$249<span style={{ fontSize: '1rem', opacity: 0.8, fontWeight: 400 }}>/mo</span></div>
            <p style={{ opacity: 0.9, marginBottom: '30px' }}>For Buyer's Agents and Brokers. Includes white-label reports and client portal.</p>
            <button onClick={onRegisterClick} style={{ width: '100%', padding: '12px', background: '#fff', border: 'none', color: 'var(--accent-primary)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Start 7-Day Trial</button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', padding: '40px 20px', background: 'var(--bg-dark)', borderTop: '1px solid var(--border-glass)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>Privacy Policy</a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>Terms of Use</a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>Contact</a>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>© 2026 PropertyIQ. All rights reserved. ABN: 12 345 678 901</p>
      </footer>
    </div>
  );
}
