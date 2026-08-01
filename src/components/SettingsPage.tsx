import React from 'react';
import { Card, Button } from './ui';
import PersonaSwitcher from './PersonaSwitcher';
import './SettingsPage.css';

interface SettingsPageProps {
  persona: string;
  onPersonaChange: (p: string) => void;
  financialProfile: any;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  persona, onPersonaChange, financialProfile, onLogout,
}) => (
  <div className="sp">
    <h2 className="sp__title">Settings</h2>

    <Card className="sp__section">
      <h3 className="sp__heading">Profile</h3>
      <div className="sp__grid">
        <div className="sp__field">
          <label className="sp__label">Persona</label>
          <PersonaSwitcher activePersona={persona as any} onChange={onPersonaChange} />
        </div>
      </div>
    </Card>

    <Card className="sp__section">
      <h3 className="sp__heading">Your Numbers</h3>
      <p className="sp__desc">These are used in research briefs to personalise affordability and borrowing capacity.</p>
      <div className="sp__grid">
        <div className="sp__field">
          <label className="sp__label">Budget</label>
          <span className="sp__value">${Number(financialProfile?.budget || 850000).toLocaleString()}</span>
        </div>
        <div className="sp__field">
          <label className="sp__label">Deposit</label>
          <span className="sp__value">${Number(financialProfile?.deposit || 170000).toLocaleString()}</span>
        </div>
        <div className="sp__field">
          <label className="sp__label">Annual Income</label>
          <span className="sp__value">${Number(financialProfile?.annualIncome || 150000).toLocaleString()}</span>
        </div>
      </div>
      <p className="sp__hint">Edit these directly in Ask YieldSense or Buy Finder — they sync automatically.</p>
    </Card>

    <Card className="sp__section">
      <h3 className="sp__heading">Plan & Usage</h3>
      <p className="sp__desc">Free tier — 5 research briefs per month. Past briefs remain readable forever.</p>
      <Button variant="primary" size="sm" style={{ marginTop: 'var(--space-3)' }}>Upgrade</Button>
    </Card>

    <Card className="sp__section">
      <h3 className="sp__heading">Data & Privacy</h3>
      <p className="sp__desc">Your data is never shared. You can request a full export or account deletion at any time.</p>
      <div className="sp__actions">
        <Button variant="secondary" size="sm">Export my data</Button>
        <Button variant="ghost" size="sm">Delete account</Button>
      </div>
    </Card>

    <div className="sp__footer">
      <Button variant="danger" size="sm" onClick={onLogout}>Log out</Button>
    </div>
  </div>
);
