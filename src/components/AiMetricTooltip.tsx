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
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      {children}
      <button 
        onClick={handleClick}
        title={`AI Explanation for ${metricName}`}
        style={{ 
          background: 'var(--accent)', 
          color: 'black', 
          border: 'none', 
          borderRadius: '50%', 
          width: '20px', 
          height: '20px', 
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          padding: 0
        }}
      >
        ?
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          width: '250px',
          background: '#1e293b',
          border: '1px solid var(--accent)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
          zIndex: 9999,
          color: 'white'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>🤖 AI Insight</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
          </div>
          {loading ? (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Asking AI...</div>
          ) : (
            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{explanation}</div>
          )}
        </div>
      )}
    </div>
  );
}
