import React from 'react';
import './DQWarning.css';

export const DQWarning: React.FC<{ dq: any }> = ({ dq }) => {
  const lowSuburbs = Object.entries(dq?.suburbs ?? {}).filter(([, v]: any) => v.dq_score < 70);
  if (!lowSuburbs.length) return null;
  return (
    <div className="av-dqw">
      <strong className="av-dqw__title">Data Quality Alert</strong>
      <p className="av-dqw__body">
        <strong>{lowSuburbs.map(([id]) => (id as string).split('_')[1]).join(', ')}</strong> has limited verified data coverage.
        Figures may be based on fewer sales or older data points — cross-check with a local agent before acting.
      </p>
    </div>
  );
};
