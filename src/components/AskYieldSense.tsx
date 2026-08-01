import React, { useState, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SuburbMetric {
  label: string;
  value: number | null;
  unit: string;
  is_stale: boolean;
}

interface SuburbComparison {
  suburb_id: string;
  name: string;
  metrics: SuburbMetric[];
}

interface AskResponse {
  request_id: string;
  status: string;
  intent: any;
  assumptions: any[];
  summary: string;
  research_priority: string;
  comparison: SuburbComparison[];
  supports: any[];
  risks: any[];
  unknowns: string[];
  next_steps: string[];
  evidence: any[];
  data_quality: any;
  disclaimer: string;
}

interface DiscoveryMetrics {
  median_price?: number | null;
  yield_pct?: number | null;
  vacancy_rate?: number | null;
  population_cagr?: number | null;
  school_quality?: number | null;
  transit_accessibility?: number | null;
  parks_count?: number | null;
  safety_score?: number | null;
  top_school_name?: string | null;
  price_12m_change_pct?: number | null;
}

interface DiscoveryResult {
  suburb_id?: string;
  name: string;
  state: string;
  postcode?: string;
  match_score: number;
  dist_km?: number | null;
  why_selected: string[];
  metrics: DiscoveryMetrics;
}

interface DiscoveryResponse {
  guardrail: boolean;
  message?: string | null;
  summary?: string | null;
  query_understood: any;
  results: DiscoveryResult[];
  disclaimer: string;
}

// ─── V2 Types ────────────────────────────────────────────────────────────────
interface VerdictEntry {
  metric: string; leader?: string | null; edge_pct: number;
  direction: string; framing: string; values: Record<string, number | null>;
  context_note?: string | null;
}
interface PersonaVerdict { persona: string; leader?: string | null; scores: Record<string, number>; weights_used: Record<string, number>; }
interface VerdictBlock { framing: string; per_metric: VerdictEntry[]; by_persona: PersonaVerdict[]; tradeoffs: string[]; }
interface AffordabilityBlock { serviceability_passed?: boolean | null; borrowing_capacity?: number | null; monthly_repayment?: number | null; stamp_duty?: number | null; }
interface AskResponseV2 extends AskResponse { headline?: string; verdict?: VerdictBlock | null; affordability?: AffordabilityBlock | null; follow_ups?: {label:string;question:string;conversation_id?:string}[]; query_understood?: any; discovery?: DiscoveryResponse | null; }

// ─── Metric human explanations ──────────────────────────────────────────────
interface MetricExplanation { label: string; good: boolean | null; text: string; }
type ExplainerFn = (val: number | string, unit: string) => MetricExplanation;

const METRIC_EXPLAINERS: Record<string, ExplainerFn> = {
  'Median House Price': (v) => ({ label: 'Median House Price', good: null,
    text: `At $${((v as number) / 1000).toFixed(0)}k, ${(v as number) > 1_500_000 ? 'this is a premium suburb — high entry cost but typically strong liquidity and price resilience.' : (v as number) > 900_000 ? 'this is a mid-to-upper tier suburb with a broad but selective buyer pool.' : 'this is relatively accessible, with strong owner-occupier and first-home-buyer interest.'}` }),
  'Median Unit Price': (v) => ({ label: 'Median Unit Price', good: null,
    text: `Units at $${((v as number) / 1000).toFixed(0)}k. ${(v as number) > 700_000 ? 'Premium unit market — check strata levies carefully before committing.' : 'Relatively accessible for units.'}` }),
  'Median House Rent': (v) => ({ label: 'Weekly Rent', good: (v as number) > 600,
    text: `$${(v as number).toFixed(0)}/week. ${(v as number) > 900 ? 'Very strong rental demand — landlord pricing power is high.' : (v as number) > 600 ? 'Solid rent achievable — healthy tenant pool keeps vacancies low.' : 'Below-average rent may compress yields and cashflow.'}` }),
  'Gross House Yield': (v) => ({ label: 'Gross Yield', good: (v as number) >= 4,
    text: `${(v as number).toFixed(2)}% gross yield. ${(v as number) >= 5 ? 'Excellent — likely close to cash-flow neutral or positive after expenses.' : (v as number) >= 4 ? 'Acceptable — will need top-up from salary but manageable for most investors.' : (v as number) >= 3 ? 'Low yield — common in high-growth suburbs. Plan for ongoing out-of-pocket costs.' : 'Very low yield — this is almost purely a capital growth play; cashflow will be negative.'}` }),
  'Vacancy Rate': (v) => ({ label: 'Vacancy Rate', good: (v as number) < 3,
    text: `${(v as number).toFixed(2)}% vacancy. ${(v as number) < 1 ? 'Critically tight — strong upward rent pressure, very low risk of extended vacancy.' : (v as number) < 2 ? 'Tight rental market — landlords have meaningful pricing power.' : (v as number) < 3 ? 'Healthy balance — competitive but not oversupplied.' : (v as number) < 5 ? 'Elevated vacancy — negotiating power shifts to tenants; factor in potential rent discounts.' : 'High vacancy — significant oversupply risk. Avoid for pure investment.'}` }),
  'Population 5Yr CAGR': (v) => ({ label: 'Population Growth (5yr CAGR)', good: (v as number) > 2,
    text: `${(v as number).toFixed(1)}%/year population growth. ${(v as number) > 8 ? 'Exceptional — infrastructure demand and price support are very strong.' : (v as number) > 5 ? 'Above-average — good long-term demand fundamentals.' : (v as number) > 2 ? 'Solid steady growth — supports price stability and tenant demand.' : (v as number) > 0 ? 'Modest growth — stable but limited demand uplift.' : 'Population stagnant or declining — a meaningful demand risk.'}` }),
  'Investor Rate': (v) => ({ label: 'Investor Concentration', good: (v as number) < 40,
    text: `${(v as number).toFixed(0)}% investor-owned. ${(v as number) > 60 ? '⚠️ Very high — vulnerable to mass sell-off if sentiment or interest rates shift.' : (v as number) > 40 ? 'Moderate-high investor presence — monitor supply pipeline closely.' : (v as number) < 20 ? 'Owner-occupier dominated — typically price-stable with lower volatility.' : 'Healthy mix of investors and owner-occupiers.'}` }),
  'AI News Sentiment': (v) => ({ label: 'AI News Sentiment', good: v === 'Bullish',
    text: `AI sentiment analysis of recent market news. ${v === 'Bullish' ? 'Positive momentum or infrastructure news detected.' : v === 'Bearish' ? 'Negative catalysts or oversupply risks mentioned in recent media.' : 'Neutral or mixed sentiment in recent news.'}` }),
};

function explainMetric(m: SuburbMetric): MetricExplanation | null {
  const fn = METRIC_EXPLAINERS[m.label];
  return fn ? fn(m.value as any, m.unit) : null;
}

function formatValue(m: SuburbMetric): string {
  if (m.value === null) return '—';
  if (typeof m.value === 'string') return m.value;
  if (m.unit === '$') return `$${m.value.toLocaleString()}`;
  if (m.unit === '$/week') return `$${m.value.toFixed(0)}/wk`;
  if (m.unit === '%') return `${m.value.toFixed(2)}%`;
  return String(m.value);
}

function getWinner(metricLabel: string, comparisons: SuburbComparison[]): string | null {
  if (comparisons.length < 2) return null;
  const lowerBetter = ['Vacancy Rate', 'Investor Rate'];
  const vals = comparisons.map(c => ({ name: c.name, v: c.metrics.find(m => m.label === metricLabel)?.value ?? null }));
  if (vals.some(x => x.v === null)) return null;
  if (typeof vals[0].v === 'string') return null; // Can't easily math-compare strings like sentiment
  if (vals[0].v === vals[1].v) return 'tie';
  const best = lowerBetter.includes(metricLabel)
    ? vals.reduce((a, b) => (a.v as number) < (b.v as number) ? a : b)
    : vals.reduce((a, b) => (a.v as number) > (b.v as number) ? a : b);
  return best.name;
}

// ─── Intent detector ────────────────────────────────────────────────────────
interface DetectedIntent {
  goal: string; suburbs: { name: string; state: string }[];
  needsClarification: boolean; clarifyingQ?: string; propertyType: string;
  isDiscovery?: boolean; needsMLFallback?: boolean;
}

const KNOWN_SUBURBS = [
  { pattern: /kenmore/i, name: 'Kenmore', state: 'QLD' },
  { pattern: /indooroopilly/i, name: 'Indooroopilly', state: 'QLD' },
  { pattern: /point cook/i, name: 'Point Cook', state: 'VIC' },
  { pattern: /werribee/i, name: 'Werribee', state: 'VIC' },
  { pattern: /glen waverley/i, name: 'Glen Waverley', state: 'VIC' },
  { pattern: /doncaster/i, name: 'Doncaster', state: 'VIC' },
  { pattern: /box hill/i, name: 'Box Hill', state: 'VIC' },
  { pattern: /footscray/i, name: 'Footscray', state: 'VIC' },
  { pattern: /brunswick/i, name: 'Brunswick', state: 'VIC' },
  { pattern: /fitzroy/i, name: 'Fitzroy', state: 'VIC' },
  { pattern: /st kilda/i, name: 'St Kilda', state: 'VIC' },
  { pattern: /richmond/i, name: 'Richmond', state: 'VIC' },
  { pattern: /surry hills/i, name: 'Surry Hills', state: 'NSW' },
  { pattern: /newtown/i, name: 'Newtown', state: 'NSW' },
  { pattern: /bondi/i, name: 'Bondi', state: 'NSW' },
  { pattern: /chatswood/i, name: 'Chatswood', state: 'NSW' },
  { pattern: /parramatta/i, name: 'Parramatta', state: 'NSW' },
  { pattern: /norwood/i, name: 'Norwood', state: 'SA' },
  { pattern: /glenelg/i, name: 'Glenelg', state: 'SA' },
  { pattern: /prospect/i, name: 'Prospect', state: 'SA' },
  { pattern: /marion/i, name: 'Marion', state: 'SA' },
];

function parseBudget(text: string): number | null {
  const match = text.match(/(?:budget|under|for|of)\s*\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?(?:\s*illion)?\b/);
  if (match) {
    let num = parseFloat(match[1]);
    const suffix = match[2]?.toLowerCase();
    if (suffix === 'm' || (num < 1000 && text.toLowerCase().includes('million'))) num *= 1000000;
    else if (suffix === 'k') num *= 1000;
    if (num >= 10000 && num <= 20000000) return num;
  }
  const rawMatch = text.match(/\b([1-9]\d{4,7})\b/);
  if (rawMatch) {
    const parsed = parseInt(rawMatch[1], 10);
    if (parsed >= 10000) return parsed;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return matrix[b.length][a.length];
}

function detectIntent(text: string): DetectedIntent {
  const suburbs = KNOWN_SUBURBS.filter(p => p.pattern.test(text)).map(p => ({ name: p.name, state: p.state }));
  const propertyType = /unit|apartment|flat|strata/i.test(text) ? 'unit' : 'house';
  const isInterstate = /interstate|moving (to|from)|which state|best state/i.test(text);
  const isInvestment = /invest|yield|cashflow|rental income|passive|portfolio/i.test(text);

  // Fuzzy State Detection (incl. typos & capital cities)
  const stateMatch = text.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania|Northern Territory|Australian Capital Territory|queesnland|nsww|vctoria|sotuh australia|sydney|melbourne|brisbane|adelaide|perth)\b/i);

  // ── Geo/Discovery patterns — check FIRST before suburb lookup ──────────────
  const GEO_PATTERNS = [
    /\b(north|south|east|west|north-?east|north-?west|south-?east|south-?west)\s+of\b/i,
    /within\s+\d+\s*km\b/i,
    /\d+\s*km\s+(from|north|south|east|west)\b/i,
    /\b(near|around|close to)\s+(sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra)\b/i,
    /\bregional\b.*(yield|school|growth|safe)/i,
    /\b(best|highest|lowest|top)\s+(school|yield|return|transit|transport|cafe|park|safety|area|neighbourhood|neighborhood|suburb|rental)\b/i,
    /suburb.*\b(with|having|that have)\s+(high|good|great|best|most)\b/i,
    /\bwhich suburb(s)?\b/i,
    /\bfind (me )?(a )?suburb/i,
    /\bfind (me )?(a |an )?(area|neighbourhood|neighborhood|location|place)\b/i,
    /\blooking for (a |an |some )?(area|suburb|neighbourhood|neighborhood|place)\b/i,
    /\brecommend (a |an |some |me )?(area|suburb|neighbourhood|neighborhood|place)\b/i,
    /\bsuburbs?\b.*\b(in|near|around)\s+(sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra|NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i,
  ];
  const isGeoDiscovery = GEO_PATTERNS.some(p => p.test(text));

  if (isGeoDiscovery) {
    const hasCityOrState = stateMatch || /\b(sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra|regional)\b/i.test(text);
    if (!hasCityOrState) {
       return { goal: 'suburb_discovery', suburbs: [], needsClarification: true, propertyType, isDiscovery: true, clarifyingQ: "I didn't catch a specific area in your query. Which city, state, or region would you like to search in?" };
    }
    return { goal: 'suburb_discovery', suburbs: [], needsClarification: false, propertyType, isDiscovery: true };
  }
  
  let detectedState = null;
  if (stateMatch) {
     const raw = stateMatch[1].toUpperCase();
     if (raw.includes('NSW') || raw.includes('NEW') || raw.includes('SYDNEY')) detectedState = 'NSW';
     else if (raw.includes('VIC') || raw.includes('MELBOURNE')) detectedState = 'VIC';
     else if (raw.includes('QLD') || raw.includes('QUEEN') || raw.includes('BRISBANE')) detectedState = 'QLD';
     else if (raw.includes('SA') || raw.includes('SOUTH') || raw.includes('ADELAIDE')) detectedState = 'SA';
     else if (raw.includes('WA') || raw.includes('WEST') || raw.includes('PERTH')) detectedState = 'WA';
     else if (raw.includes('TAS')) detectedState = 'TAS';
     else if (raw.includes('NT') || raw.includes('NORTH')) detectedState = 'NT';
     else if (raw.includes('ACT') || raw.includes('CAPITAL')) detectedState = 'ACT';
  }

  // Budget Missing Zero Clarification (only trigger for suspiciously low numbers like $250 → $2.5M)
  const parsedBudget = parseBudget(text);
  if (parsedBudget && parsedBudget >= 10000 && parsedBudget <= 50000) {
     return { goal: 'single_suburb_research', suburbs, needsClarification: true, propertyType, clarifyingQ: `I noticed a budget of $${parsedBudget.toLocaleString()}. Did you mean $${(parsedBudget * 10).toLocaleString()}? Please clarify the correct amount.` };
  }

  let suggestedSuburb = '';
  if (suburbs.length === 0) {
    const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 4);
    for (const w of words) {
      for (const known of KNOWN_SUBURBS) {
        if (levenshtein(w.toLowerCase(), known.name.toLowerCase()) <= 2) {
          suggestedSuburb = known.name;
          break;
        }
      }
      if (suggestedSuburb) break;
    }
  }

  if (isInterstate && suburbs.length === 0)
    return { goal: 'interstate_discovery', suburbs: [], needsClarification: true, propertyType,
      clarifyingQ: detectedState ? `I see you're looking at ${detectedState}. To pull verified data, could you specify exactly which suburbs? (Or use Buy Finder to scan the whole state).` : 'Which state are you moving from, and which are you considering? (e.g. "Moving from Sydney NSW to Brisbane QLD")' };

  if (isInvestment && suburbs.length === 0) {
    if (detectedState) {
      return { goal: 'suburb_discovery', suburbs: [], needsClarification: false, propertyType, isDiscovery: true };
    }
    return { goal: 'investment_search', suburbs: [], needsClarification: true, propertyType,
      clarifyingQ: 'Which state or region would you like to find investment areas in?' };
  }

  // Out of scope handler
  const isRealEstateRelated = /suburb|house|unit|apartment|property|yield|rent|price|growth|buy|invest|market|schools|transit|safe|parks/i.test(text);
  if (suburbs.length === 0 && !isGeoDiscovery && !isInterstate && !isInvestment && !isRealEstateRelated && !stateMatch) {
      return { goal: 'single_suburb_research', suburbs: [], needsClarification: true, propertyType,
        clarifyingQ: "I can only help with Australian property research based on verified data. Could you rephrase your question to include a specific suburb, state, or property goal?" };
  }

  const isGeneralAdvice = /how much|what is|how does|should i|deposit|stamp duty|negative gearing|borrow|mortgage|advice|explain|guide/i.test(text);
  if (isGeneralAdvice) {
    return { goal: 'general_advice', suburbs: [], needsClarification: false, propertyType };
  }

  if (suburbs.length === 0)
    return { goal: 'single_suburb_research', suburbs: [], needsClarification: true, needsMLFallback: true, propertyType,
      clarifyingQ: suggestedSuburb ? `Did you mean ${suggestedSuburb}? Please confirm the exact suburb name so I can pull the correct data.` : 'Which suburb are you researching? (e.g. "Kenmore, QLD" or "Glen Waverley, VIC")' };

  // Detect specific deep-dive intents from follow-up chips
  if (/risk|downside/i.test(text)) return { goal: 'risks_analysis', suburbs, needsClarification: false, propertyType };
  if (/school|education/i.test(text)) return { goal: 'schools_analysis', suburbs, needsClarification: false, propertyType };
  if (/cashflow|projection|return/i.test(text)) return { goal: 'cashflow_projection', suburbs, needsClarification: false, propertyType };
  if (/growth|long-term|potential/i.test(text)) return { goal: 'growth_analysis', suburbs, needsClarification: false, propertyType };

  const isComparison = suburbs.length >= 2 || /compar|vs\.?|versus|or\b/i.test(text);
  return {
    goal: isComparison ? 'suburb_comparison' : isInvestment ? 'investment_search' : 'single_suburb_research',
    suburbs, needsClarification: false, propertyType,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────
interface AskYieldSenseProps {
  financialProfile?: any;
  setFinancialProfile?: (fp: any) => void;
}

export const AskYieldSense: React.FC<AskYieldSenseProps> = ({ financialProfile, setFinancialProfile }) => {
  const [question, setQuestion] = useState('');
  const [clarifyAnswer, setClarifyAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState('');
  const [pendingClarify, setPendingClarify] = useState<DetectedIntent | null>(null);
  
  const [budget, setBudget] = useState(String(financialProfile?.budget || 850000));
  const [deposit, setDeposit] = useState(String(financialProfile?.deposit || 170000));
  const [income, setIncome] = useState(String(financialProfile?.annualIncome || 150000));
  
  // Sync local changes to global financial profile
  useEffect(() => {
    if (setFinancialProfile && financialProfile) {
      setFinancialProfile({
        ...financialProfile,
        budget: Number(budget),
        deposit: Number(deposit),
        annualIncome: Number(income)
      });
    }
  }, [budget, deposit, income]);

  const [showScenarios, setShowScenarios] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const EXAMPLES = [
    'Compare Kenmore and Indooroopilly for a $2M family home',
    'Moving interstate: where do I start?',
    'Find investment areas under $900k with rental resilience',
  ];

  // ─── V2: Unified NL query (primary path) ─────────────────────────────
  const callQuery = async (q: string, convId?: string) => {
    setLoading(true); setError(''); setResult(null); setDiscoveryResult(null); setPendingClarify(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const body: any = { question: q };
      if (convId) body.conversation_id = convId;
      const res = await fetch('/api/v3/ask/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }), signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.status === 'needs_clarification' && data.intent?.clarification?.questions?.length) {
        setPendingClarify({ ...data.intent, clarifyingQ: data.intent.clarification.questions[0] } as any);
        setLoading(false);
        return;
      }
      setResult(data as AskResponseV2);
      // If this is a discovery response, also set discoveryResult for card rendering
      if ((data as AskResponseV2).discovery) {
        setDiscoveryResult((data as AskResponseV2).discovery || null);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Fallback to old intent detection + structured API
        try {
          let detected = detectIntent(q);
          detected = await resolveIntentWithFallback(detected, q);
          if (detected.needsClarification) { setPendingClarify(detected); setLoading(false); return; }
          submitWithIntent(detected, q);
          return;
        } catch (e2: any) {
          setError(err.message || 'Search failed — please try a more specific query.');
        }
      }
    } finally { setLoading(false); }
  };

  const callApi = async (intent: any) => {
    setLoading(true); setError(''); setResult(null); setDiscoveryResult(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/v3/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intent), signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setResult(await res.json());
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || 'An error occurred.');
    } finally { setLoading(false); }
  };

  const callDiscover = async (q: string, b?: string) => {
    setLoading(true); setError(''); setResult(null); setDiscoveryResult(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/v3/ask/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, budget: b ? parseFloat(b) : (budget ? parseFloat(budget) : undefined) }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: DiscoveryResponse = await res.json();
      setDiscoveryResult(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || 'Discovery failed');
    } finally { setLoading(false); }
  };

  const submitWithIntent = (detected: DetectedIntent, q: string, customBudget?: string) => {
    if (detected.isDiscovery || detected.goal === 'suburb_discovery') {
      callDiscover(q, customBudget);
      return;
    }
    callApi({
      question: q, goal: detected.goal, suburbs: detected.suburbs,
      property_type: detected.propertyType,
      tenure: detected.goal === 'investment_search' ? 'investor' : 'owner_occupier',
      budget: customBudget ? parseFloat(customBudget) : (budget ? parseFloat(budget) : undefined),
      deposit: deposit ? parseFloat(deposit) : undefined,
      annual_income: income ? parseFloat(income) : undefined,
    });
  };

  const resolveIntentWithFallback = async (detected: DetectedIntent, q: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/v3/ask/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        if (res.ok) {
          const mlIntent = await res.json();
          if (mlIntent.suburbs && mlIntent.suburbs.length > 0) {
             return {
               goal: mlIntent.goal,
               suburbs: mlIntent.suburbs,
               needsClarification: false,
               propertyType: mlIntent.property_type || 'any',
               isDiscovery: mlIntent.goal === 'interstate_discovery'
             };
          }
        }
      } catch (e) {
        console.error("ML Intent failed", e);
      }
      setLoading(false);
    return detected;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    // Primary path: use the unified NL /query endpoint
    callQuery(question);
  };

  const handleClarify = async () => {
    if (!pendingClarify || !clarifyAnswer.trim()) return;
    const fullQ = `${question} — ${clarifyAnswer}`;
    setClarifyAnswer('');
    setQuestion(fullQ);
    callQuery(fullQ);
  };

  // ── Sub-renders ────────────────────────────────────────────────────────
  const DiscoveryCards = ({ disc }: { disc: DiscoveryResponse }) => {
    const fmt = (v?: number | null, decimals = 2, suffix = '') => v != null ? `${v.toFixed(decimals)}${suffix}` : '—';
    const fmtPrice = (v?: number | null) => v != null ? `$${(v / 1000).toFixed(0)}k` : '—';
    const scoreColor = (s: number) => s >= 70 ? '#00e5ff' : s >= 50 ? '#a3e635' : '#f59e0b';

    if (disc.guardrail && disc.message) {
      return (
        <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#fbbf24', fontWeight: 600 }}>{disc.message}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Try a different direction, or use Buy Finder to scan a broader area.</p>
        </div>
      );
    }

    if (!disc.results.length) {
      return (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 18, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{disc.message || 'No suburbs found matching your criteria.'}</p>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 24 }}>
        {disc.summary && (
          <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            🔍 {disc.summary}
          </p>
        )}
        <div style={{ display: 'grid', gap: 14 }}>
          {disc.results.map((r, i) => (
            <div key={r.suburb_id || r.name} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Rank badge */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                background: i === 0 ? 'linear-gradient(135deg,#00e5ff,#0066ff)' : i === 1 ? 'rgba(163,230,53,0.3)' : 'rgba(255,255,255,0.1)',
                color: i === 0 ? '#000' : 'var(--text-primary)',
                fontWeight: 800, fontSize: '0.72rem', padding: '3px 10px', borderRadius: '14px 0 8px 0',
              }}>#{i + 1} MATCH</div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8 }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 700 }}>{r.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.state}{r.postcode ? ` ${r.postcode}` : ''}{r.dist_km ? ` · ${r.dist_km.toFixed(0)}km away` : ''}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(r.match_score) }}>{r.match_score.toFixed(0)}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>match score</div>
                </div>
              </div>

              {/* Why selected bullets */}
              <ul style={{ margin: '12px 0 12px', padding: '0 0 0 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {r.why_selected.map((w, wi) => <li key={wi} style={{ marginBottom: 3 }}>{w}</li>)}
              </ul>

              {/* Metrics row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {r.metrics.median_price != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Price: </span><strong>{fmtPrice(r.metrics.median_price)}</strong>
                  </div>
                )}
                {r.metrics.yield_pct != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Yield: </span><strong style={{ color: '#a3e635' }}>{fmt(r.metrics.yield_pct)}%</strong>
                  </div>
                )}
                {r.metrics.school_quality != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Schools: </span><strong style={{ color: '#00e5ff' }}>{fmt(r.metrics.school_quality, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.transit_accessibility != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transit: </span><strong>{fmt(r.metrics.transit_accessibility, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.vacancy_rate != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Vacancy: </span><strong>{fmt(r.metrics.vacancy_rate)}%</strong>
                  </div>
                )}
                {r.metrics.population_cagr != null && (
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Growth: </span><strong style={{ color: '#f472b6' }}>{fmt(r.metrics.population_cagr, 1)}%pa</strong>
                  </div>
                )}
              </div>

              {/* Dive deeper CTA */}
              <button
                onClick={() => {
                  const q = `Research ${r.name} ${r.state}`;
                  setQuestion(q);
                  const detected = detectIntent(q);
                  
                  // Override detection since we explicitly know the target
                  detected.goal = 'single_suburb_research';
                  detected.suburbs = [{ name: r.name, state: r.state }];
                  detected.needsClarification = false;
                  detected.isDiscovery = false;
                  
                  submitWithIntent(detected, q);
                }}
                style={{
                  background: 'linear-gradient(135deg, #00e5ff22, #0066ff22)', border: '1px solid #00e5ff44',
                  color: '#00e5ff', borderRadius: 8, padding: '7px 16px', fontSize: '0.8rem',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg,#00e5ff33,#0066ff33)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg,#00e5ff22,#0066ff22)')}
              >
                📋 Build Full Research Brief →
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          General research only — not financial, legal, or valuation advice. Data sourced from verified CoreLogic/ABS datasets.
        </p>
      </div>
    );
  };

  const ComparisonTable = ({ comparisons, evidence }: { comparisons: SuburbComparison[], evidence: any[] }) => {
    if (!comparisons.length) return null;
    const metrics = comparisons[0].metrics;
    const multi = comparisons.length > 1;

    return (
      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 700 }}>
          Side-by-side comparison {multi && `· Winner highlighted in cyan`}
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr>
              <th style={TH}>Metric</th>
              {comparisons.map(c => <th key={c.suburb_id} style={{ ...TH, textAlign: 'right', color: 'var(--text-primary)' }}>{c.name}</th>)}
              {multi && <th style={{ ...TH, textAlign: 'center', fontSize: '0.75rem' }}>Edge</th>}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, idx) => {
              const winner = getWinner(m.label, comparisons);
              const exp = explainMetric(m);
              return (
                <React.Fragment key={m.label}>
                  <tr style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                    <td style={{ ...TD, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {exp?.label ?? m.label}
                      {(() => {
                        const ev = evidence?.find(e => e.metric === m.label);
                        if (ev?.as_of) {
                          return <span style={{ marginLeft: 8, padding: '2px 6px', background: 'rgba(0, 210, 255, 0.1)', color: '#00d2ff', borderRadius: 4, fontSize: '0.65rem', textTransform: 'uppercase' }}>Verified {ev.as_of}</span>;
                        }
                        return null;
                      })()}
                      {m.is_stale && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#ffb400' }}>⚠ stale data</span>}
                    </td>
                    {comparisons.map(c => {
                      const cm = c.metrics.find(x => x.label === m.label);
                      const isW = winner === c.name;
                      return (
                        <td key={c.suburb_id} style={{ ...TD, textAlign: 'right', fontWeight: isW ? 700 : 400, color: isW ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {cm ? formatValue(cm) : '—'}{isW && multi ? ' ✓' : ''}
                        </td>
                      );
                    })}
                    {multi && (
                      <td style={{ ...TD, textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: winner && winner !== 'tie' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                        {winner === 'tie' ? 'Tie' : winner ?? '—'}
                      </td>
                    )}
                  </tr>
                  {exp && (
                    <tr style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)' }}>
                      <td colSpan={comparisons.length + (multi ? 2 : 1)} style={{ padding: '4px 12px 10px', fontSize: '0.78rem', lineHeight: 1.55 }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 4,
                          background: exp.good === true ? 'rgba(0,210,130,0.07)' : exp.good === false ? 'rgba(255,60,60,0.07)' : 'rgba(255,255,255,0.03)',
                          borderLeft: `3px solid ${exp.good === true ? '#00d282' : exp.good === false ? '#ff4444' : 'var(--border-glass)'}`,
                          color: 'var(--text-secondary)',
                        }}>
                          {exp.text}
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const VerdictPanel = ({ verdict }: { verdict: VerdictBlock | null | undefined }) => {
    if (!verdict) return null;
    const personaLeaders = verdict.by_persona?.filter(p => p.leader) || [];
    const tradeoffs = verdict.tradeoffs || [];
    return (
      <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
        {verdict.framing === 'clear_leader' && personaLeaders.length > 0 && (
          <div style={{ background: 'rgba(0,210,130,0.05)', border: '1px solid rgba(0,210,130,0.15)', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#00d282', fontWeight: 700 }}>Verdict by persona</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {personaLeaders.map(p => (
                <span key={p.persona} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,210,130,0.3)', fontSize: '0.82rem', background: 'rgba(0,210,130,0.06)' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{p.persona.replace(/_/g, ' ')}:</strong> {p.leader}
                </span>
              ))}
            </div>
          </div>
        )}
        {tradeoffs.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fbbf24', fontWeight: 700 }}>Trade-offs to consider</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {tradeoffs.map((t, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const EvidenceTable = ({ evidence }: { evidence: any[] }) => {
    const [expanded, setExpanded] = useState(false);
    if (!evidence?.length) return null;
    return (
      <div style={{ marginBottom: 22, borderTop: '1px solid var(--border-glass)', paddingTop: 16 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 700, padding: 0,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
          aria-expanded={expanded}
        >
          {expanded ? '▾ Hide evidence sources' : '▸ Show evidence sources'} ({evidence.length} metrics)
        </button>
        {expanded && (
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Metric</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'right' }}>Value</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Source</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>As of</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Quality</th>
                </tr>
              </thead>
              <tbody>
                {evidence.slice(0, 30).map((e, i) => (
                  <tr key={e.id || i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ ...TD, padding: '4px 10px', fontWeight: 600 }}>{e.metric}</td>
                    <td style={{ ...TD, padding: '4px 10px', textAlign: 'right' }}>
                      {typeof e.value === 'number' ? (e.unit.includes('$') ? `$${e.value.toLocaleString()}` : e.unit === '%' ? `${e.value.toFixed(2)}%` : e.value.toLocaleString()) : String(e.value ?? '—')}
                    </td>
                    <td style={{ ...TD, padding: '4px 10px', color: 'var(--text-secondary)' }}>{e.source}</td>
                    <td style={{ ...TD, padding: '4px 10px', color: e.is_stale ? '#ffb400' : 'var(--text-secondary)' }}>{e.as_of}{e.is_stale ? ' ⚠ stale' : ''}</td>
                    <td style={{ ...TD, padding: '4px 10px', color: e.quality === 'verified' ? '#00d282' : 'var(--text-secondary)' }}>{e.quality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const DQWarning = ({ dq }: { dq: any }) => {
    const lowSuburbs = Object.entries(dq?.suburbs ?? {}).filter(([, v]: any) => v.dq_score < 70);
    if (!lowSuburbs.length) return null;
    return (
      <div style={{ padding: '12px 16px', background: 'rgba(255,180,0,0.08)', borderLeft: '4px solid #ffb400', borderRadius: '0 8px 8px 0', marginBottom: 20 }}>
        <strong style={{ color: '#ffb400', fontSize: '0.88rem' }}>⚠️ Data Quality Alert</strong>
        <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong>{lowSuburbs.map(([id]) => id.split('_')[1]).join(', ')}</strong> has limited verified data coverage.
          Figures may be based on fewer sales or older data points — cross-check with a local agent before acting.
        </p>
      </div>
    );
  };

  return (
    <div data-build="v2-loadingfix" style={{ padding: '28px', marginBottom: '24px', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)', maxWidth: 1100, margin: '0 auto 24px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800 }}>Ask YieldSense ✨</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Natural-language property research powered by verified data — not opinions.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="Describe what you're deciding… e.g. 'Compare Kenmore and Indooroopilly for a $1.5M family home'"
          rows={3} style={{
            width: '100%', padding: '13px 14px', borderRadius: '10px', boxSizing: 'border-box',
            border: '1.5px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)',
            color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', fontSize: '0.93rem', lineHeight: 1.5, marginBottom: 12,
          }} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} type="button" onClick={() => setQuestion(ex)}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--accent-cyan)', background: 'transparent', color: 'var(--accent-cyan)', fontSize: '0.8rem', cursor: 'pointer' }}>
              {ex}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => setShowScenarios(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.83rem' }}>
            {showScenarios ? 'Hide scenario controls' : 'Set budget & income (optional)'}
          </button>
          {showScenarios && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { lbl: 'Budget ($)', val: budget, set: setBudget, step: 50000 },
                { lbl: 'Deposit ($)', val: deposit, set: setDeposit, step: 20000 },
                { lbl: 'Income ($)', val: income, set: setIncome, step: 20000 }
              ].map(({ lbl, val, set, step }) => (
                <div key={lbl}>
                  <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: 4, color: 'var(--text-secondary)' }}>{lbl}</label>
                  <input type="number" step={step} value={val} onChange={e => set(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', width: 120 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={loading || !question.trim()}
            style={{
              padding: '11px 26px', borderRadius: 8, background: 'var(--accent-cyan)', color: '#000',
              border: 'none', fontWeight: 700, fontSize: '0.93rem',
              cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !question.trim() ? 0.6 : 1, transition: 'opacity 0.2s',
            }}>
            {loading ? 'Researching…' : 'Build research brief'}
          </button>
          {loading && (
            <button type="button" onClick={() => { abortRef.current?.abort(); setLoading(false); }}
              style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Clarifying question */}
      {pendingClarify && !loading && (
        <div style={{ marginTop: 28, padding: '20px 22px', background: 'rgba(0,210,255,0.05)', borderRadius: 12, border: '1px solid rgba(0,210,255,0.18)' }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)', fontWeight: 700 }}>Follow-up question</p>
          <p style={{ margin: '0 0 14px', fontSize: '0.95rem', lineHeight: 1.6 }}>{pendingClarify.clarifyingQ}</p>
          {(pendingClarify as any).clarification?.options?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(pendingClarify as any).clarification.options.map((opt: any, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    const fullQ = `${opt.name} ${opt.state || ''}`;
                    setQuestion(fullQ);
                    setPendingClarify(null);
                    callQuery(fullQ);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent-cyan)',
                    background: 'rgba(0,210,255,0.08)', color: 'var(--accent-cyan)',
                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  {opt.name}{opt.state ? ` (${opt.state})` : ''}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={clarifyAnswer} onChange={e => setClarifyAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClarify()}
                placeholder="Your answer…"
                style={{ flex: 1, padding: '10px 13px', borderRadius: 8, border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                aria-label="Your answer"
              />
              <button onClick={handleClarify} disabled={!clarifyAnswer.trim()}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent-cyan)', color: '#000', border: 'none', fontWeight: 700, cursor: clarifyAnswer.trim() ? 'pointer' : 'not-allowed', opacity: clarifyAnswer.trim() ? 1 : 0.5 }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 28, textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
          <div style={{ width: 34, height: 34, border: '3px solid rgba(0,210,255,0.2)', borderTop: '3px solid var(--accent-cyan)', borderRadius: '50%', animation: 'ayk-spin 0.8s linear infinite', margin: '0 auto 14px' }} />
          <p style={{ margin: 0 }}>Pulling verified data and building your research brief…</p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(255,60,60,0.08)', borderLeft: '4px solid #ff4444', borderRadius: '0 8px 8px 0' }}>
          <strong style={{ color: '#ff4444' }}>Error: </strong>{error}
        </div>
      )}

      {discoveryResult && !loading && (
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border-glass)', paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🗺️ Suburb Discovery Results</h3>
            <button onClick={() => { setDiscoveryResult(null); setQuestion(''); }}
              style={{ background: 'none', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>
              ↺ New question
            </button>
          </div>
          <DiscoveryCards disc={discoveryResult} />
        </div>
      )}

      {result && !loading && !discoveryResult && (
        <div style={{ marginTop: 36, borderTop: '1px solid var(--border-glass)', paddingTop: 28 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>
                {(result as AskResponseV2).headline || 'Research Brief'}
              </h3>
              {(result as AskResponseV2).query_understood?.data_as_of && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>
                  Data as of: {(result as AskResponseV2).query_understood.data_as_of}
                </span>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Status: <strong>{result.status.replace(/_/g, ' ')}</strong>&ensp;|&ensp;Priority:&nbsp;
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.78rem',
                  background: result.research_priority === 'high' ? 'rgba(0,210,130,0.15)' : result.research_priority === 'medium' ? 'rgba(255,180,0,0.12)' : 'rgba(150,150,150,0.1)',
                  color: result.research_priority === 'high' ? '#00d282' : result.research_priority === 'medium' ? '#ffb400' : 'var(--text-secondary)',
                }}>
                  {result.research_priority.replace(/_/g, ' ').toUpperCase()}
                </span>
              </span>
            </div>
            <button onClick={() => { setResult(null); setQuestion(''); }}
              style={{ background: 'none', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>
              ↺ New question
            </button>
          </div>

          <DQWarning dq={result.data_quality} />

          {/* AI Summary */}
          <div style={{ background: 'rgba(0,210,255,0.04)', border: '1px solid rgba(0,210,255,0.12)', borderRadius: 10, padding: '16px 20px', marginBottom: 26, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-cyan)', fontWeight: 700 }}>AI Summary</p>
            <p style={{ margin: 0, fontSize: '0.93rem' }}>{result.summary}</p>
          </div>

          {/* Verdict panel (v2) */}
          <VerdictPanel verdict={(result as AskResponseV2).verdict} />

          {/* Assumptions pills */}
          {result.assumptions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {result.assumptions.map((a, i) => (
                <span key={i} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-glass)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)' }}>
                  {a.label}: <strong>{a.value}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Side-by-side table */}
          <ComparisonTable comparisons={result.comparison} evidence={result.evidence} />

          {/* Evidence table (collapsible) */}
          <EvidenceTable evidence={result.evidence} />

          {/* Supports / Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 22 }}>
            <div style={{ padding: '16px', background: 'rgba(0,210,130,0.04)', borderRadius: 10, border: '1px solid rgba(0,210,130,0.12)' }}>
              <h4 style={{ margin: '0 0 10px', color: '#00d282', fontSize: '0.88rem' }}>✅ What supports this decision</h4>
              {result.supports.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.supports.map((s, i) => <li key={i} style={{ marginBottom: 6, fontSize: '0.86rem', lineHeight: 1.5 }}>{s.claim}</li>)}
                </ul>
              ) : <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.84rem' }}>No positives identified with current data.</p>}
            </div>
            <div style={{ padding: '16px', background: 'rgba(255,60,60,0.04)', borderRadius: 10, border: '1px solid rgba(255,60,60,0.12)' }}>
              <h4 style={{ margin: '0 0 10px', color: '#ff4444', fontSize: '0.88rem' }}>⚠️ Risks & counterarguments</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.risks.map((r, i) => <li key={i} style={{ marginBottom: 6, fontSize: '0.86rem', lineHeight: 1.5 }}>{r.claim}</li>)}
              </ul>
            </div>
          </div>

          {/* Unknowns + Next steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 26 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Material unknowns</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.unknowns.map((u, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{u}</li>)}
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Your next actions</h4>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {result.next_steps.map((n, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5 }}>{n}</li>)}
              </ol>
            </div>
          </div>

          {/* Follow-up chips */}
          <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ask a follow-up:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {((result as AskResponseV2).follow_ups || []).map((fu, i) => (
                <button key={i} onClick={() => { setQuestion(fu.question); callQuery(fu.question, (fu as any).conversation_id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>{fu.label}</button>
              ))}
              {((result as AskResponseV2).follow_ups?.length ?? 0) === 0 && (
                <>
                  {result.comparison.length >= 2 && (
                    <button onClick={() => { const q = `What are the schools like near ${result.comparison.map(c => c.name).join(' and ')}?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Schools nearby?</button>
                  )}
                  <button onClick={() => { const q = `Cashflow projections if I buy in ${result.comparison[0]?.name ?? 'this suburb'} at the median price?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Cashflow projections?</button>
                  <button onClick={() => { const q = `What are the biggest risks of buying in ${result.comparison[0]?.name ?? 'this suburb'} right now?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Biggest risks?</button>
                  {result.comparison.length >= 2 && (
                    <button onClick={() => { const q = `Which of ${result.comparison.map(c => c.name).join(' or ')} has better long-term growth potential?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Long-term growth?</button>
                  )}
                </>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', borderTop: '1px dashed var(--border-glass)', paddingTop: 14 }}>
            {result.disclaimer}
          </p>
        </div>
      )}

      <style>{`@keyframes ayk-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  background: 'rgba(0,0,0,0.28)', borderBottom: '2px solid var(--border-glass)',
  color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const CHIP_STYLE: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border-glass)',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
};

