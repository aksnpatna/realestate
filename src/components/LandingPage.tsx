import '../index.css';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  return (
    <div className="landing-page u-22e1be61">
      {/* Navigation Bar */}
      <nav className="u-a3f866f9">
        <div className="u-8773684b">
          <div className="u-6555dcac">
            IQ
          </div>
          <span className="u-4ada1008">PropertyIQ</span>
        </div>
        <div className="u-1da4ebc4">
          <button onClick={onLoginClick} className="u-99b63727">Log in</button>
          <button onClick={onRegisterClick} className="u-40e81e13">Start Free Trial</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="u-e4086149">
        <h1 className="u-0b5594bc">
          Deterministic, Explainable <span className="u-d03afae3">Property Decisions</span>
        </h1>
        <p className="u-43d329b0">
          Combine your borrowing capacity with our transparent ASX-integrated Market Predictor. 
          Generate permanent, confidence-labelled Decision Briefs — no black boxes, just evidence.
        </p>
        <div className="u-ae9308b9">
          <button onClick={onRegisterClick} className="u-b7b2347c">
            Start Free Trial
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="u-8fb67853">
            See How It Works
          </button>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="u-4547d3ea">
        <p className="u-e8d24f87">Data Powered By</p>
        <div className="u-08549bd7">
          <span className="u-6f9cb5cc">ABS Census 2021</span>
          <span className="u-6f9cb5cc">NSW Valuer General</span>
          <span className="u-6f9cb5cc">OpenStreetMap</span>
          <span className="u-6f9cb5cc">PropTrack</span>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="u-6c00ba47">
        <h2 className="u-95351c5b">Tailored for your strategy</h2>
        <div className="u-56f5f064">
          
          <div className="glass-card u-73ebddc1">
            <h3 className="u-23be1dc6">For First Home Buyers</h3>
            <ul className="u-4e7e6136">
              <li className="u-6c6f5f6c">✓ Stamp duty + LMI calculator for your actual budget</li>
              <li className="u-6c6f5f6c">✓ Official school catchment zones</li>
              <li>✓ Livability & walkability scores</li>
            </ul>
          </div>

          <div className="glass-card u-8a3a404a">
            <h3 className="u-23be1dc6">For Investors</h3>
            <ul className="u-4e7e6136">
              <li className="u-6c6f5f6c">✓ Cashflow after tax — includes depreciation schedule</li>
              <li className="u-6c6f5f6c">✓ Real subdivision precedents</li>
              <li>✓ AI Committee (Bull/Bear insights)</li>
            </ul>
          </div>

          <div className="glass-card u-73ebddc1">
            <h3 className="u-23be1dc6">For Buyer's Agents</h3>
            <ul className="u-4e7e6136">
              <li className="u-6c6f5f6c">✓ Client Audit Trail — exports to PDF</li>
              <li className="u-6c6f5f6c">✓ Full technical provenance</li>
              <li>✓ Data quality confidence bands</li>
            </ul>
          </div>

        </div>
      </section>

      {/* Pricing Preview */}
      <section className="u-6f089a6f">
        <h2 className="u-95351c5b">Simple, transparent pricing</h2>
        <div className="u-4767a8a9">
          
          <div className="glass-card u-6368b938">
            <h3 className="u-214f49e9">Broker Starter</h3>
            <div className="u-b2307aa4">$49<span className="u-bb6159f5">/mo</span></div>
            <p className="u-d819ecc7">For Mortgage Brokers. Unlocks the Borrower PDF Pack instantly.</p>
            <button onClick={onRegisterClick} className="u-9ee80c60">Start 7-Day Trial</button>
          </div>

          <div className="glass-card u-6368b938">
            <h3 className="u-214f49e9">DIY</h3>
            <div className="u-b2307aa4">$99<span className="u-bb6159f5">/mo</span></div>
            <p className="u-d819ecc7">Everything an individual investor needs to outperform the market.</p>
            <button onClick={onRegisterClick} className="u-9ee80c60">Start 7-Day Trial</button>
          </div>

          <div className="glass-card u-809fb142">
            <div className="u-475cdd40">MOST POPULAR</div>
            <h3 className="u-3f287d59">Buyer's Agent</h3>
            <div className="u-bc79c119">$249<span className="u-88f3db57">/mo</span></div>
            <p className="u-dc6fb551">Includes Client Audit Trail, white-label reports and client portal.</p>
            <button onClick={onRegisterClick} className="u-499f5128">Start 7-Day Trial</button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="u-32dfae0d">
        <div className="u-e1518401">
          <a href="#" className="u-0a657d02">Privacy Policy</a>
          <a href="#" className="u-0a657d02">Terms of Use</a>
          <a href="#" className="u-0a657d02">Contact</a>
        </div>
        <p className="u-13bd73a0">© 2026 PropertyIQ. All rights reserved. ABN: 12 345 678 901</p>
      </footer>
    </div>
  );
}
