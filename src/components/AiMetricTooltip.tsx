import React, { useState } from 'react';

interface AiMetricTooltipProps {
  metricName: string;
  contextStr: string;
  children: React.ReactNode;
}

export default function AiMetricTooltip({ metricName, contextStr, children }: AiMetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleClick = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && !explanation) {
      setLoading(true);
      try {
        const res = await fetch('/api/slack-llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: `What is ${metricName}?`, context: contextStr })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setExplanation(data.response);
        } else {
          setExplanation('Failed to load explanation.');
        }
      } catch (err) {
        setExplanation('Error fetching from AI agent.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="u-0e44c33d">
      {children}
      <button 
        onClick={handleClick}
        title={`AI Explanation for ${metricName}`}
        className="u-2b48cf67"
      >
        ?
      </button>

      {isOpen && (
        <div className="u-591134d7">
          <div className="u-f55dc2cc">
            <span>🤖 AI Insight</span>
            <button onClick={() => setIsOpen(false)} className="u-ae9cf90d">×</button>
          </div>
          {loading ? (
            <div className="u-341d7b94">Asking AI...</div>
          ) : (
            <div className="u-6c4f7c02">{explanation}</div>
          )}
        </div>
      )}
    </div>
  );
}
