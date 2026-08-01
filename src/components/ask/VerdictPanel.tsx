import React from 'react';
import './VerdictPanel.css';

interface VerdictEntry {
  metric: string; leader?: string | null; edge_pct: number;
  direction: string; framing: string; values: Record<string, number | null>;
  context_note?: string | null;
}
interface PersonaVerdict { persona: string; leader?: string | null; scores: Record<string, number>; weights_used: Record<string, number>; }
export interface VerdictBlock { framing: string; per_metric: VerdictEntry[]; by_persona: PersonaVerdict[]; tradeoffs: string[]; }

export const VerdictPanel: React.FC<{ verdict: VerdictBlock | null | undefined }> = ({ verdict }) => {
  if (!verdict) return null;
  const personaLeaders = verdict.by_persona?.filter(p => p.leader) || [];
  const tradeoffs = verdict.tradeoffs || [];
  return (
    <div className="av-verdict">
      {verdict.framing === 'clear_leader' && personaLeaders.length > 0 && (
        <div className="av-verdict__section av-verdict__section--success">
          <p className="av-verdict__heading av-verdict__heading--success">Verdict by persona</p>
          <div className="av-verdict__chips">
            {personaLeaders.map(p => (
              <span key={p.persona} className="av-verdict__chip">
                <strong>{p.persona.replace(/_/g, ' ')}:</strong> {p.leader}
              </span>
            ))}
          </div>
        </div>
      )}
      {tradeoffs.length > 0 && (
        <div className="av-verdict__section av-verdict__section--warning">
          <p className="av-verdict__heading av-verdict__heading--warning">Trade-offs to consider</p>
          <ul className="av-verdict__list">
            {tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};
