import React from 'react';
import '../styles/LegalPages.css';

export const TermsOfUse: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="legal-page">
      {onBack && (
        <button onClick={onBack} className="legal-back">← Back</button>
      )}
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: {new Date().toISOString().split('T')[0]}</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using PropertyIQ ("the Service"), you agree to be bound by these Terms of Use.
        If you do not agree, do not use the Service.
      </p>

      <h2>2. Nature of the Service</h2>
      <p>
        PropertyIQ is a <strong>research and comparison tool</strong>. It provides data-driven suburb
        comparisons using publicly available and licensed datasets. The Service:
      </p>
      <ul>
        <li>Presents metrics sourced from ABS, ACARA, OSM, SQM Research, and CoreLogic/NPG</li>
        <li>Computes deterministic comparisons using transparent, auditable methodology</li>
        <li>Discloses data dates, sources, and quality scores for every metric</li>
        <li>Shows its reasoning pipeline (reasoning chain) for every result</li>
      </ul>

      <h2>3. NOT Financial Advice</h2>
      <p>
        <strong>The Service does not provide financial, legal, tax, lending, or valuation advice.</strong>
        All content is general research only. It does not take into account your personal objectives,
        financial situation, or needs. You should:
      </p>
      <ul>
        <li>Consult a licensed financial adviser before making investment decisions</li>
        <li>Consult a licensed conveyancer or solicitor for legal matters</li>
        <li>Consult a licensed mortgage broker or lender for borrowing capacity</li>
        <li>Conduct your own independent due diligence</li>
      </ul>
      <p>
        The presence of a disclaimer does not override misleading or deceptive conduct prohibitions
        under Australian law. We strive for accuracy but do not guarantee completeness or timeliness
        of any data point.
      </p>

      <h2>4. Data Accuracy & Limitations</h2>
      <ul>
        <li>All metrics display an "as of" date and data quality score</li>
        <li>Stale data is flagged with warning indicators</li>
        <li>Some data may be estimated where verified sources are unavailable</li>
        <li>Historical data does not guarantee future performance</li>
        <li>Suburb-level data may not reflect street-level or property-level conditions</li>
      </ul>

      <h2>5. Permitted Use</h2>
      <p>You may use the Service for:</p>
      <ul>
        <li>Personal property research and comparison</li>
        <li>Professional research as a buyer's agent, mortgage broker, or property professional</li>
        <li>Educational and informational purposes</li>
      </ul>

      <h2>6. Prohibited Use</h2>
      <p>You may NOT:</p>
      <ul>
        <li>Scrape, bulk-download, or redistribute data from the Service</li>
        <li>Use the Service to mislead consumers or provide personalised financial advice</li>
        <li>Attempt to reverse-engineer, decompile, or bypass security measures</li>
        <li>Use the Service for any illegal purpose</li>
        <li>Submit queries containing prompt injection or attempts to manipulate the AI</li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <ul>
        <li>The Service's code, methodology, and reasoning engine are our intellectual property</li>
        <li>Third-party data is subject to the respective source's licensing terms</li>
        <li>You retain ownership of queries you submit; we retain a licence to use anonymised queries for improvement</li>
        <li>Generated reports may be shared via shareable links subject to your subscription tier</li>
      </ul>

      <h2>8. Privacy</h2>
      <p>
        Your use of the Service is subject to our Privacy Policy, which describes how we collect, use,
        and protect your data in accordance with the Australian Privacy Principles.
      </p>

      <h2>9. Service Availability</h2>
      <ul>
        <li>The Service is provided on an "as available" basis without uptime guarantees</li>
        <li>We may modify, suspend, or discontinue any feature at any time</li>
        <li>AI synthesis features depend on third-party LLM providers and may degrade or fail</li>
        <li>Maintenance windows may cause temporary unavailability</li>
      </ul>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for:
      </p>
      <ul>
        <li>Any financial loss arising from decisions made using the Service</li>
        <li>Inaccurate, stale, or missing data from third-party sources</li>
        <li>Service interruptions or AI synthesis failures</li>
        <li>Any indirect, consequential, or punitive damages</li>
      </ul>

      <h2>11. Rate Limits</h2>
      <p>
        The Service enforces rate limits to ensure fair usage. Free tier users are limited to 200
        research briefs per day. Exceeding limits may result in temporary throttling.
      </p>

      <h2>12. Changes to Terms</h2>
      <p>
        We may update these Terms at any time. Material changes will be notified via in-app notification.
        Continued use after changes constitutes acceptance.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by the laws of Australia. Disputes will be resolved in the appropriate
        Australian jurisdiction.
      </p>

      <h2>14. Contact</h2>
      <p>For enquiries: legal@propertyiq.app</p>
    </div>
  );
};
