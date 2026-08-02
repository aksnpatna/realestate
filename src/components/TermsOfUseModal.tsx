import { useState, useEffect } from 'react';

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
    <div className="u-f766e765">
      <div className="u-0768652a">
        <h2 className="u-61478fc7">
          Terms of Use & Legal Disclaimer
        </h2>
        
        <div className="u-51bedf1b">
          <p>Before accessing this platform, you must read and agree to the following terms:</p>
          
          <h3 className="u-82eb8033">1. No Financial or Investment Advice</h3>
          <p>
            The data, predictive forecasts, and models provided on this platform are for <strong>general informational purposes only</strong>. 
            They do not constitute financial, investment, real estate, or tax advice. You should consult a licensed financial advisor 
            before making any investment decisions.
          </p>

          <h3 className="u-82eb8033">2. Past Performance & Forecasting Risks</h3>
          <p>
            Historical performance of a suburb is not a reliable indicator of future capital growth or rental yields. 
            All predictive models and forecasts represent statistical probabilities based on algorithmic assumptions, 
            not guarantees. 
          </p>

          <h3 className="u-82eb8033">3. Third-Party Data Sources</h3>
          <p>
            This platform ingests data from third-party sources including government registries, the Australian Bureau of Statistics (ABS), 
            and commercial vendors. We do not guarantee the completeness, timeliness, or accuracy of the underlying source data.
          </p>

          <h3 className="u-82eb8033">4. Limitation of Liability</h3>
          <p>
            By using this platform, you agree that your use of the data is entirely at your own risk. To the maximum extent permitted by law, 
            our total aggregate liability arising from or related to your use of the platform is strictly capped at the total amount you paid 
            to access the platform over the previous 12 months, or $100 AUD, whichever is lower.
          </p>
        </div>

        <div className="u-a7459d7b">
          <button 
            onClick={() => window.location.href = 'https://google.com'}
            className="u-ff1aa552">
            I Decline
          </button>
          <button 
            onClick={handleAccept}
            className="u-c01bf0f6">
            I Accept & Understand
          </button>
        </div>
      </div>
    </div>
  );
}
