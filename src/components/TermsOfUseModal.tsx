import React, { useState, useEffect } from 'react';

export default function TermsOfUseModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem('terms_accepted');
    if (!hasAccepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = async () => {
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_type: 'terms_of_use_v1' })
      });
    } catch (e) {
      console.error('Consent logging failed', e);
    }
    localStorage.setItem('terms_accepted', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        background: 'var(--surface)',
        padding: '30px',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        color: 'var(--text)'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
          Terms of Use & Legal Disclaimer
        </h2>
        
        <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <p>Before accessing this platform, you must read and agree to the following terms:</p>
          
          <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginTop: '20px' }}>1. No Financial or Investment Advice</h3>
          <p>
            The data, predictive forecasts, and models provided on this platform are for <strong>general informational purposes only</strong>. 
            They do not constitute financial, investment, real estate, or tax advice. You should consult a licensed financial advisor 
            before making any investment decisions.
          </p>

          <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginTop: '20px' }}>2. Past Performance & Forecasting Risks</h3>
          <p>
            Historical performance of a suburb is not a reliable indicator of future capital growth or rental yields. 
            All predictive models and forecasts represent statistical probabilities based on algorithmic assumptions, 
            not guarantees. 
          </p>

          <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginTop: '20px' }}>3. Third-Party Data Sources</h3>
          <p>
            This platform ingests data from third-party sources including government registries, the Australian Bureau of Statistics (ABS), 
            and commercial vendors. We do not guarantee the completeness, timeliness, or accuracy of the underlying source data.
          </p>

          <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginTop: '20px' }}>4. Limitation of Liability</h3>
          <p>
            By using this platform, you agree that your use of the data is entirely at your own risk. To the maximum extent permitted by law, 
            our total aggregate liability arising from or related to your use of the platform is strictly capped at the total amount you paid 
            to access the platform over the previous 12 months, or $100 AUD, whichever is lower.
          </p>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button 
            onClick={() => window.location.href = 'https://google.com'}
            style={{
              padding: '12px 24px', background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: '8px', cursor: 'pointer'
            }}>
            I Decline
          </button>
          <button 
            onClick={handleAccept}
            style={{
              padding: '12px 24px', background: 'var(--accent)', border: 'none',
              color: '#000', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0,255,200,0.3)'
            }}>
            I Accept & Understand
          </button>
        </div>
      </div>
    </div>
  );
}
