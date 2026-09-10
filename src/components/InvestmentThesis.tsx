import React from 'react';

interface ResearchPoint {
  id: string;
  text: string;
}

interface InvestmentThesisProps {
  headline: string;
  summary: string;
  strengths: ResearchPoint[];
  risks: ResearchPoint[];
}

export function InvestmentThesis({
  headline,
  summary,
  strengths,
  risks
}: InvestmentThesisProps) {
  return (
    <section className="investment-thesis">
      <div className="investment-thesis__header">
        <span className="eyebrow">INVESTMENT THESIS</span>
        <h2>{headline}</h2>
        <p>{summary}</p>
      </div>

      <div className="investment-thesis__grid">
        <div>
          <h3>Why it works</h3>
          {strengths.map(item => (
            <div className="thesis-point" key={item.id}>
              <span>+</span>
              {item.text}
            </div>
          ))}
        </div>

        <div>
          <h3>What could go wrong</h3>
          {risks.map(item => (
            <div className="thesis-point thesis-point--risk" key={item.id}>
              <span>!</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}