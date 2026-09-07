import { useState, useEffect, useRef, memo } from 'react';
import { Icon } from './ui';
import '../styles/ChatView.css';

// ─── Types ────────────────────────────────────────────────────────
interface DiscoveryResponse {
  guardrail: boolean;
  message?: string | null;
  summary?: string | null;
  query_understood: any;
  results: any[];
  disclaimer: string;
}
interface AskResponseV2 {
  request_id: string;
  status: string;
  intent: any;
  headline?: string;
  verdict?: any;
  summary: string;
  research_priority: string;
  comparison: any[];
  supports: any[];
  risks: any[];
  unknowns: string[];
  next_steps: string[];
  evidence: any[];
  data_quality: any;
  disclaimer: string;
  discovery?: DiscoveryResponse | null;
  follow_ups?: {label:string;question:string;conversation_id?:string}[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  nlpResult?: AskResponseV2;
  clarification?: string;
  isInitial?: boolean;
}

export default memo(function ChatView({
  setActiveSuburb, setActiveTab
}: {
  setActiveSuburb?: (s: any) => void;
  setActiveTab?: (t: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load initial search from Landing Page
  useEffect(() => {
    const initial = sessionStorage.getItem('initial_search');
    if (initial) {
      sessionStorage.removeItem('initial_search');
      handleSend(initial);
    } else {
      // Welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: "Hi, I'm PropertyIQ, your AI Buyer's Agent. How can I help you find your next property?",
          isInitial: true
        }
      ]);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (query: string) => {
    if (!query.trim()) return;
    
    // Add User Message
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/v3/ask/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }), signal: abortRef.current.signal,
      });
      
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      setIsTyping(false);

      if (data.status === 'needs_clarification') {
        const qText = data.intent?.clarification?.questions?.[0] || "I need a bit more context. Could you specify a state, city, or area?";
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', clarification: qText }]);
        return;
      }

      // Add AI Message with full NLP result payload
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', nlpResult: data as AskResponseV2 }]);
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Sorry, I encountered an error. Please try again." }]);
      }
    }
  };

  const renderAiMessage = (msg: ChatMessage) => {
    if (msg.isInitial || msg.text) {
      return <div className="chat-text">{msg.text}</div>;
    }
    if (msg.clarification) {
      return <div className="chat-text">{msg.clarification}</div>;
    }

    const { nlpResult: nlp, id } = msg;
    if (!nlp) return null;

    const hasDiscovery = nlp.discovery && nlp.discovery.results && nlp.discovery.results.length > 0;

    return (
      <div className="chat-generative-ui">
        {/* Story Card summary */}
        {nlp.headline && <h3 className="chat-headline">{nlp.headline}</h3>}
        {nlp.summary && <p className="chat-summary">{nlp.summary}</p>}

        {nlp.supports && nlp.supports.length > 0 && (
          <div className="chat-story-card chat-supports">
            <h4><Icon name="check" size={16} /> Key Strengths</h4>
            <ul>{nlp.supports.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {/* Discovery Suburbs Carousel */}
        {hasDiscovery && (
          <div className="chat-discovery-carousel">
            <h4>Recommended Areas</h4>
            <div className="chat-discovery-grid">
              {nlp.discovery!.results.map((sub: any, idx: number) => {
                const growthScore = sub.metrics?.growthScore || sub.growthScore || 50;
                const scoreColor = growthScore > 75 ? 'var(--success)' : growthScore > 50 ? 'var(--warning)' : 'var(--danger)';
                const priceStr = sub.houseMedianPrice ? `$${(sub.houseMedianPrice / 1000000).toFixed(2)}M` : 
                                 (sub.metrics?.medianPrice ? `$${(sub.metrics.medianPrice / 1000000).toFixed(2)}M` : 'N/A');
                const yieldStr = sub.houseGrossRentalYield ? `${sub.houseGrossRentalYield.toFixed(1)}%` : 
                                 (sub.metrics?.rentalYield ? `${sub.metrics.rentalYield.toFixed(1)}%` : 'N/A');
                
                return (
                  <div key={`${id}-${idx}-${sub.suburb_id}`} className="chat-suburb-card" onClick={() => {
                    if (setActiveSuburb) setActiveSuburb({ id: sub.suburb_id, name: sub.suburb, state: sub.state, postcode: sub.postcode, ...sub });
                    if (setActiveTab) setActiveTab('profile');
                  }}>
                    <div className="csc-header">
                      <div>
                        <h5>{sub.suburb}, {sub.state}</h5>
                        <span className="csc-postcode">{sub.postcode}</span>
                      </div>
                      <div className="csc-score" style={{color: scoreColor, borderColor: scoreColor}}>
                        {growthScore}
                      </div>
                    </div>
                    <div className="csc-metrics">
                      <div className="csc-metric"><span>Price</span><strong>{priceStr}</strong></div>
                      <div className="csc-metric"><span>Yield</span><strong>{yieldStr}</strong></div>
                    </div>
                    <button className="csc-view-btn">View Profile <Icon name="arrow-right" size={14} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow Ups */}
        {nlp.follow_ups && nlp.follow_ups.length > 0 && (
          <div className="chat-followups">
            {nlp.follow_ups.map((fu, idx) => (
              <button key={idx} onClick={() => handleSend(fu.question)} className="chat-followup-btn">
                {fu.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-view">
      <div className="chat-feed">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message-row ${msg.role}`}>
            <div className={`chat-bubble ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="chat-text">{msg.text}</div>
              ) : (
                renderAiMessage(msg)
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="chat-message-row assistant">
            <div className="chat-bubble assistant typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }} className="chat-input-form">
          <input
            type="text"
            placeholder="Ask PropertyIQ anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!inputValue.trim() || isTyping}>
            <Icon name="arrow-right" size={20} />
          </button>
        </form>
        <div className="chat-hint">
          Try: "Compare Point Cook and Tarneit" or "Where can I find 6% yield under $600k?"
        </div>
      </div>
    </div>
  );
});
