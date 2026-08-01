import React, { useState } from 'react';
import './EvidenceTable.css';

export const EvidenceTable: React.FC<{ evidence: any[] }> = ({ evidence }) => {
  const [expanded, setExpanded] = useState(false);
  if (!evidence?.length) return null;
  return (
    <div className="av-evidence">
      <button className="av-evidence__toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? '▾ Hide evidence sources' : '▸ Show evidence sources'} ({evidence.length} metrics)
      </button>
      {expanded && (
        <div className="av-evidence__table-wrap">
          <table className="av-evidence__table">
            <thead>
              <tr>
                <th>Metric</th><th>Value</th><th>Source</th><th>As of</th><th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {evidence.slice(0, 30).map((e, i) => (
                <tr key={e.id || i} className={i % 2 === 0 ? 'av-evidence__row--zebra' : ''}>
                  <td>{e.metric}</td>
                  <td>{typeof e.value === 'number' ? (e.unit?.includes('$') ? `$${e.value.toLocaleString()}` : e.unit === '%' ? `${e.value.toFixed(2)}%` : e.value.toLocaleString()) : String(e.value ?? '—')}</td>
                  <td>{e.source}</td>
                  <td className={e.is_stale ? 'av-evidence__stale' : ''}>{e.as_of}{e.is_stale ? ' ⚠ stale' : ''}</td>
                  <td className={e.quality === 'verified' ? 'av-evidence__verified' : ''}>{e.quality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
