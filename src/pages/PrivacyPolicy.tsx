import React from 'react';
import '../styles/LegalPages.css';

export const PrivacyPolicy: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="legal-page">
      {onBack && (
        <button onClick={onBack} className="legal-back">← Back</button>
      )}
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: {new Date().toISOString().split('T')[0]}</p>

      <h2>1. Overview</h2>
      <p>
        PropertyIQ ("we", "us", "our") operates a suburb research and comparison platform for Australian
        property investors and home buyers. This Privacy Policy explains what data we collect, why we collect it,
        and how you can control it.
      </p>
      <p>
        We are committed to complying with the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth).
      </p>

      <h2>2. What Data We Collect</h2>
      <table className="legal-table">
        <thead>
          <tr><th>Data Type</th><th>Examples</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Account data</td>
            <td>Email, hashed password</td>
            <td>Authentication, account management</td>
          </tr>
          <tr>
            <td>Query data</td>
            <td>Search questions, suburb selections</td>
            <td>Processing research requests, improving results</td>
          </tr>
          <tr>
            <td>Financial inputs</td>
            <td>Budget, income, deposit (optional)</td>
            <td>Affordability calculations only — not stored as financial records</td>
          </tr>
          <tr>
            <td>Conversation history</td>
            <td>Multi-turn ask conversations</td>
            <td>Enabling follow-up questions within a session</td>
          </tr>
          <tr>
            <td>Usage analytics</td>
            <td>Page views, tab clicks, feature usage</td>
            <td>Product improvement, no third-party tracking</td>
          </tr>
        </tbody>
      </table>

      <h2>3. What We Do NOT Collect</h2>
      <ul>
        <li>Bank account numbers, credit card numbers, or payment details (we do not process payments)</li>
        <li>Property ownership records or title details</li>
        <li>Identity documents (driver's licence, passport, Medicare)</li>
        <li>Biometric data</li>
        <li>Sensitive information (health, race, religion, political opinion, sexual orientation)</li>
      </ul>

      <h2>4. PII Masking</h2>
      <p>
        All natural-language queries are automatically scrubbed for personally identifiable information
        before processing. Email addresses, phone numbers, and Tax File Numbers (TFNs) are masked
        at the input layer and never stored in unmasked form.
      </p>

      <h2>5. Data Storage & Security</h2>
      <ul>
        <li>Data is stored in PostgreSQL databases hosted on our infrastructure in Australia</li>
        <li>Passwords are hashed using bcrypt — never stored in plaintext</li>
        <li>All network traffic is encrypted in transit (TLS/HTTPS)</li>
        <li>Database access is restricted to authenticated application servers</li>
        <li>Production and development databases are fully separated</li>
        <li>Access logs and database backups are maintained</li>
      </ul>

      <h2>6. Data Retention</h2>
      <ul>
        <li>Account data: retained while your account is active; deleted within 30 days of account closure</li>
        <li>Conversation history: retained for 90 days, then automatically purged</li>
        <li>Analytics data: aggregated and anonymised; raw event logs retained for 12 months</li>
        <li>Ask briefs (research reports): retained while your account is active; deletable on request</li>
      </ul>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of all data we hold about you</li>
        <li><strong>Correction</strong> — request correction of inaccurate data</li>
        <li><strong>Deletion</strong> — request deletion of your account and all associated data</li>
        <li><strong>Opt-out</strong> — unsubscribe from analytics or communication at any time</li>
        <li><strong>Complaint</strong> — lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
      </ul>
      <p>
        To exercise any of these rights, use the in-app data deletion function (Settings → Delete My Data)
        or contact us at privacy@propertyiq.app
      </p>

      <h2>8. Third-Party Data Sources</h2>
      <p>We display data from the following third-party sources. We do not share your personal data with these sources:</p>
      <ul>
        <li>Australian Bureau of Statistics (ABS) — Census and demographic data</li>
        <li>ACARA — School ICSEA scores and school zone data</li>
        <li>OpenStreetMap (OSM) — Transit, parks, amenity, and POI data</li>
        <li>SQM Research — Vacancy rates and rental market data</li>
        <li>CoreLogic/NPG — Median prices, rental data, market metrics</li>
      </ul>

      <h2>9. No Selling of Data</h2>
      <p>
        We do not sell, rent, or trade your personal data to any third party. We do not use your data
        for targeted advertising. Analytics are used solely for internal product improvement.
      </p>

      <h2>10. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management. We do not use third-party
        advertising cookies. Analytics cookies (if enabled) are first-party only.
      </p>

      <h2>11. Children</h2>
      <p>
        Our service is not directed to children under 18. We do not knowingly collect data from children.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be notified via in-app
        notification or email. Continued use after changes constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>For privacy enquiries: privacy@propertyiq.app</p>
      <p>For data deletion requests: Use Settings → Delete My Data, or email privacy@propertyiq.app</p>
    </div>
  );
};
