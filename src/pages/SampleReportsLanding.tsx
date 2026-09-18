import React, { useState, useEffect } from 'react';
import { SampleReport } from '../components/SampleReport';
import '../styles/SampleReportsLanding.css';

interface SampleReportMeta {
  id: string;
  title: string;
  description: string;
}

const SAMPLES: SampleReportMeta[] = [
  { id: 'brisbane-growth', title: 'Brisbane Growth Corridor Comparison', description: 'Side-by-side comparison of two established Brisbane suburbs with schools, transit, and growth metrics.' },
  { id: 'sydney-investment', title: 'Sydney Investment Hotspots Under $900K', description: 'Discovery search across NSW for cashflow-positive investment opportunities.' },
  { id: 'melbourne-first-home', title: 'Melbourne First Home Buyer: Footscray vs Sunshine', description: 'Affordability-focused comparison for first home buyers in Melbourne\'s west.' },
  { id: 'perth-regional', title: 'Perth Regional Growth Analysis', description: 'Single suburb deep-dive with risk metrics, volatility, and Sharpe ratio analysis.' },
  { id: 'brisbane-schools', title: 'Brisbane Schools & Lifestyle Search', description: 'Spatial graph search combining school quality, greenspace proximity, and budget constraints.' },
];

export const SampleReportsLanding: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  if (selectedId) {
    return <SampleReport reportId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setEmailSubmitted(true);
    }
  };

  return (
    <div className="srl">
      <div className="srl__container">
        {onBack && (
          <button onClick={onBack} className="srl__back">← Back</button>
        )}

        {/* Hero */}
        <div className="srl__hero">
          <div className="srl__badge">Sample Reports</div>
          <h1 className="srl__title">
            See exactly what you get before you pay.
          </h1>
          <p className="srl__subtitle">
            Every report shows its work — metrics, sources, dates, reasoning steps, and confidence scores.
            No black-box scores. No "trust me" recommendations. Just transparent data and auditable methodology.
          </p>
        </div>

        {/* Pricing */}
        <div className="srl__pricing">
          <div className="srl__pricing-card srl__pricing-card--free" onClick={() => console.log('Analytics: pricing_clicked', { tier: 'free' })}>
            <h3>Free Scorecard</h3>
            <div className="srl__price">$0</div>
            <ul>
              <li>5 key metrics per suburb</li>
              <li>1 comparison per day</li>
              <li>Watermarked</li>
            </ul>
          </div>
          <div className="srl__pricing-card srl__pricing-card--featured" onClick={() => console.log('Analytics: pricing_clicked', { tier: '29' })}>
            <div className="srl__pricing-badge">Most Popular</div>
            <h3>Full Report</h3>
            <div className="srl__price">$29</div>
            <ul>
              <li>20+ metrics with provenance</li>
              <li>Risk analysis (volatility, Sharpe ratio)</li>
              <li>Reasoning trace + confidence scores</li>
              <li>Verdict & trade-offs</li>
              <li>Shareable link (7-day expiry)</li>
              <li>Printable PDF</li>
            </ul>
          </div>
          <div className="srl__pricing-card" onClick={() => console.log('Analytics: pricing_clicked', { tier: '99' })}>
            <h3>Professional</h3>
            <div className="srl__price">$99<span className="srl__price-period">/mo</span></div>
            <ul>
              <li>Unlimited reports</li>
              <li>Branded (white-label)</li>
              <li>Bulk generation</li>
              <li>CRM export</li>
              <li>Multi-seat access</li>
            </ul>
          </div>
        </div>

        {/* Sample reports grid */}
        <div className="srl__section-header">
          <h2>Explore Sample Reports</h2>
          <p>Click any report to see the full output — this is exactly what a paid report looks like.</p>
        </div>

        <div className="srl__grid">
          {SAMPLES.map((s, i) => (
            <div key={s.id} className="srl__card" onClick={() => {
              // Track which report gets clicked
              if (typeof window !== 'undefined') {
                console.log('Analytics: sample_report_clicked', { reportId: s.id, reportIndex: i + 1 });
                // In production: send to analytics endpoint
              }
              setSelectedId(s.id);
            }}>
              <div className="srl__card-number">Report {String(i + 1).padStart(2, '0')}</div>
              <h3 className="srl__card-title">{s.title}</h3>
              <p className="srl__card-desc">{s.description}</p>
              <button className="srl__card-btn">
                View Full Report →
              </button>
            </div>
          ))}
        </div>

        {/* Email capture */}
        <div className="srl__email-capture">
          {!emailSubmitted ? (
            <>
              <h3>Want a custom report for your suburb?</h3>
              <p>Drop your email and we'll send you a free custom report.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) {
                  // Track email capture
                  if (typeof window !== 'undefined') {
                    console.log('Analytics: email_captured', { email });
                    // In production: send to analytics endpoint
                  }
                  setEmailSubmitted(true);
                }
              }} className="srl__email-form">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="srl__email-input"
                />
                <button type="submit" className="srl__email-btn">Get Free Report</button>
              </form>
            </>
          ) : (
            <div className="srl__email-success">
              <h3>✓ Thanks! We'll be in touch.</h3>
              <p>Check your inbox — your free custom report is on its way.</p>
            </div>
          )}
        </div>

        {/* What makes us different */}
        <div className="srl__differentiators">
          <h2>Why our reports are different</h2>
          <div className="srl__diff-grid">
            <div className="srl__diff-item">
              <h4>📋 Every metric sourced</h4>
              <p>Every number shows its source (ABS, ACARA, SQM, CoreLogic), the date it was collected, and a data quality score.</p>
            </div>
            <div className="srl__diff-item">
              <h4>🔍 Full reasoning trace</h4>
              <p>See every step: how we parsed your question, what data we used, how we compared suburbs, and why we arrived at the verdict.</p>
            </div>
            <div className="srl__diff-item">
              <h4>⚖️ Deterministic verdicts</h4>
              <p>Our comparison engine is code, not a black-box LLM. Every winner is computed from transparent rules with edge percentages.</p>
            </div>
            <div className="srl__diff-item">
              <h4>📊 Risk-adjusted returns</h4>
              <p>We compute 10-year price volatility and Sharpe ratios — risk metrics that most free tools don't provide.</p>
            </div>
            <div className="srl__diff-item">
              <h4>🚫 No "best suburb" promises</h4>
              <p>We don't rank suburbs or promise returns. We give you the data and methodology to make your own informed decision.</p>
            </div>
            <div className="srl__diff-item">
              <h4>🔐 Privacy-first</h4>
              <p>PII is masked at input. No sensitive financial data stored. Full data export and deletion on demand.</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="srl__disclaimer">
          <p>
            <strong>Disclaimer:</strong> All reports are general research only and do not constitute financial,
            investment, legal, tax, or valuation advice. Historical data does not guarantee future performance.
            Data sourced from ABS, ACARA, OpenStreetMap, SQM Research, and CoreLogic/NPG.
          </p>
        </div>
      </div>
    </div>
  );
};
