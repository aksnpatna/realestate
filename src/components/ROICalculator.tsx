import { useState, useEffect, useRef } from 'react';
import '../styles/ROICalculator.css';

const STATES = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const PRESETS = [
  { name: 'Melbourne Unit', price: 450000, rent: 450, state: 'VIC', strata: 80 },
  { name: 'Sydney Apartment', price: 750000, rent: 650, state: 'NSW', strata: 100 },
  { name: 'Brisbane House', price: 650000, rent: 550, state: 'QLD', strata: 0 },
  { name: 'Perth House', price: 550000, rent: 500, state: 'WA', strata: 0 },
];

export function ROICalculator() {
  const [purchasePrice, setPurchasePrice] = useState(600000);
  const [weeklyRent, setWeeklyRent] = useState(550);
  const [state, setState] = useState('VIC');
  const [depositPct, setDepositPct] = useState(20);
  const [interestRate, setInterestRate] = useState(6.2);
  const [strata, setStrata] = useState(0);
  const [rates, setRates] = useState(1200);
  const [water, setWater] = useState(600);
  const [insurance, setInsurance] = useState(1200);
  const [pmFeePct, setPmFeePct] = useState(6);
  const [vacancyWeeks, setVacancyWeeks] = useState(2);
  const [maintenancePct, setMaintenancePct] = useState(5);
  const [salary, setSalary] = useState(100000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const isFirstRun = useRef(true);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calc/roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_price: purchasePrice,
          weekly_rent: weeklyRent,
          state,
          deposit_pct: depositPct,
          interest_rate: interestRate,
          strata_fees: strata * 52,
          council_rates: rates * 4,
          water_rates: water * 4,
          insurance,
          pm_fee_pct: pmFeePct,
          vacancy_weeks: vacancyWeeks,
          maintenance_pct: maintenancePct,
          salary,
          depreciation: 0,
          loan_type: 'pi',
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    calculate();
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => calculate(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [purchasePrice, weeklyRent, state, depositPct, interestRate, strata, rates, water, insurance, pmFeePct, vacancyWeeks, maintenancePct, salary]);

  const applyPreset = (preset) => {
    setPurchasePrice(preset.price);
    setWeeklyRent(preset.rent);
    setState(preset.state);
    setStrata(preset.strata);
  };

  const yieldColor = (y) => y >= 4 ? '#10b981' : y >= 2.5 ? '#f59e0b' : '#ef4444';
  const cocColor = (c) => c >= 8 ? '#10b981' : c >= 4 ? '#f59e0b' : '#ef4444';

  return (
    <div className="roi-calculator">
      <div className="roi-header">
        <h1>Investment Property Calculator</h1>
        <p>Calculate net yield, cashflow and ROI for investment properties.</p>
      </div>

      <div className="investment-warning-banner">
        <strong>General information only.</strong> PropertyIQ is not a licensed financial adviser (AFSL) or credit licensee (ACL). Nothing on this site constitutes financial product advice. Property investment involves risk including potential loss of capital. These figures are estimates based on your inputs and do not constitute a guarantee of returns. Always consult a licensed financial adviser.
      </div>

      <div className="presets-row">
        <span className="presets-label">Quick presets:</span>
        {PRESETS.map(p => (
          <button key={p.name} className="preset-chip" onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="calc-grid">
        <div className="calc-form">
          <h3>Property</h3>
          <div className="form-group">
            <label htmlFor="roi-price">Purchase Price ($)</label>
            <input id="roi-price" type="number" value={purchasePrice} onChange={e => setPurchasePrice(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label htmlFor="roi-rent">Weekly Rent ($)</label>
            <input id="roi-rent" type="number" value={weeklyRent} onChange={e => setWeeklyRent(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label htmlFor="roi-state">State</label>
            <select id="roi-state" value={state} onChange={e => setState(e.target.value)}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <h3>Financing</h3>
          <div className="form-group">
            <label htmlFor="roi-deposit">Deposit (%)</label>
            <input id="roi-deposit" type="number" min="1" max="100" step="1" value={depositPct} onChange={e => setDepositPct(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label htmlFor="roi-rate">Interest Rate (%)</label>
            <input id="roi-rate" type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} />
          </div>

          <details className="form-section-collapsible">
            <summary>Holding Costs (annual)</summary>
            <div className="form-group">
              <label htmlFor="roi-strata">Strata / Body Corporate ($/wk)</label>
              <input id="roi-strata" type="number" value={strata} onChange={e => setStrata(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-rates">Council Rates ($/qtr)</label>
              <input id="roi-rates" type="number" value={rates} onChange={e => setRates(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-water">Water Rates ($/qtr)</label>
              <input id="roi-water" type="number" value={water} onChange={e => setWater(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-insurance">Insurance ($/yr)</label>
              <input id="roi-insurance" type="number" value={insurance} onChange={e => setInsurance(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-pm">PM Fee (%)</label>
              <input id="roi-pm" type="number" step="0.5" value={pmFeePct} onChange={e => setPmFeePct(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-vacancy">Vacancy (weeks/yr)</label>
              <input id="roi-vacancy" type="number" value={vacancyWeeks} onChange={e => setVacancyWeeks(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="roi-maintenance">Maintenance (%)</label>
              <input id="roi-maintenance" type="number" step="1" value={maintenancePct} onChange={e => setMaintenancePct(Number(e.target.value))} />
            </div>
          </details>

          <h3>Tax (optional)</h3>
          <div className="form-group">
            <label htmlFor="roi-salary">Salary ($/yr)</label>
            <input id="roi-salary" type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} />
          </div>

          <button className="btn btn-primary btn-full" onClick={calculate} disabled={loading}>
            {loading ? 'Calculating...' : 'Recalculate'}
          </button>
        </div>

        {result && !result.error && result.status === "success" && result.metrics && (
          <div className="calc-results">
            <h2>Investment Analysis</h2>

            <div className="verdict-card" style={{
              padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
              background: result.metrics.net_weekly_cashflow_post_tax >= 0 ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${result.metrics.net_weekly_cashflow_post_tax >= 0 ? '#a7f3d0' : '#fecaca'}`
            }}>
              <strong>{result.metrics.net_weekly_cashflow_post_tax >= 0 ? '✅ Positively geared' : '⚠️ Negatively geared'}</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                This property {result.metrics.net_weekly_cashflow_post_tax >= 0 ? 'pays you' : 'costs you'} roughly
                <strong> ${Math.abs(result.metrics.net_weekly_cashflow_post_tax).toLocaleString()}/week</strong>
                out of pocket after all costs{result.metrics.tax_rebate > 0 && `, or ~$${Math.abs(result.metrics.net_weekly_cashflow_pre_tax - result.metrics.tax_rebate / 52).toFixed(0)}/week after tax benefits`}.
                {result.metrics.net_yield_pct >= 4 ? ' Yield is above the typical 3–5% range — verify why.' : result.metrics.net_yield_pct < 2 ? ' Yield is below the typical 3–5% range — common in capital-growth areas.' : ' Yield is in the typical Australian range (3–5%).'}
              </p>
            </div>

            <div className="result-highlight dual">
              <div className="metric-block">
                <div className="big-number" style={{ color: yieldColor(result.metrics.net_yield_pct) }}>{result.metrics.net_yield_pct}%</div>
                <p>Net Yield</p>
              </div>
              <div className="metric-block">
                <div className="big-number" style={{ color: cocColor(result.metrics.cash_on_cash_return_pct) }}>{result.metrics.cash_on_cash_return_pct}%</div>
                <p>Cash-on-Cash</p>
              </div>
            </div>
            <div className={`gearing-badge ${result.metrics.gearing_status}`}>
              {result.metrics.gearing_status} Gearing
            </div>
            <div className="result-breakdown">
              <div className="result-row">
                <span>Weekly Cashflow (Pre-tax)</span>
                <strong className={result.metrics.net_weekly_cashflow_pre_tax >= 0 ? 'positive' : 'negative'}>
                  ${result.metrics.net_weekly_cashflow_pre_tax?.toLocaleString()}
                </strong>
              </div>
              <div className="result-row">
                <span>Weekly Cashflow (Post-tax)</span>
                <strong className={result.metrics.net_weekly_cashflow_post_tax >= 0 ? 'positive' : 'negative'}>
                  ${result.metrics.net_weekly_cashflow_post_tax?.toLocaleString()}
                </strong>
              </div>
              <div className="result-row">
                <span>Annual Net Income (Pre-tax)</span>
                <strong className={result.metrics.net_annual_cashflow_pre_tax >= 0 ? 'positive' : 'negative'}>
                  ${result.metrics.net_annual_cashflow_pre_tax?.toLocaleString()}
                </strong>
              </div>
              <div className="result-row">
                <span>Total Upfront</span>
                <strong>${result.metrics.total_upfront?.toLocaleString()}</strong>
              </div>
              <div className="result-row">
                <span>Stamp Duty</span>
                <strong>${result.metrics.stamp_duty?.toLocaleString()}</strong>
              </div>
              <div className="result-row">
                <span>Annual Interest</span>
                <strong>${result.metrics.annual_interest?.toLocaleString()}</strong>
              </div>
              <div className="result-row">
                <span>Total Annual Expenses</span>
                <strong>${result.metrics.annual_expenses?.toLocaleString()}</strong>
              </div>
              {result.metrics.tax_rebate > 0 && (
                <div className="result-row highlight">
                  <span>Tax Benefit (negative gearing)</span>
                  <strong>${result.metrics.tax_rebate?.toLocaleString()}</strong>
                </div>
              )}
            </div>
            <div className="data-attribution">
              Source: ATO marginal rates &middot; State Revenue Office {state}
            </div>
            <div className="calc-next-steps">
              <span>Also try:</span>
              <a href="/calculators/land-tax">Land Tax</a>
              <span>&middot;</span>
              <a href="/council-rates">Council Rates</a>
              <span>&middot;</span>
              <a href="/calculators/stamp-duty">Stamp Duty</a>
            </div>
            {result.metrics.net_yield_pct && (
              <div className="yield-context-box">
                <strong>Yield context:</strong> Australian residential gross yields typically range 3–5%. Net yield after all costs is usually 1–3% lower. Your gross yield is {result.metrics.gross_yield_pct.toFixed(2)}%.
              </div>
            )}
          </div>
        )}
      </div>

      <section className="calc-faq">
        <h3>Frequently Asked Questions</h3>
        <details className="faq-item">
          <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0', outline: 'none', listStylePosition: 'inside' }}>What is a good rental yield in Australia?</summary>
          <p style={{ padding: '0.5rem 0 0.5rem 1.2rem', color: 'var(--text-secondary)' }}>Gross rental yields of 3–5% are typical for Australian capital cities. Net yield after costs, strata, rates and vacancy is usually 1–3% lower. Regional areas often yield higher but with lower capital growth.</p>
        </details>
        <details className="faq-item">
          <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0', outline: 'none', listStylePosition: 'inside' }}>What is cash-on-cash return?</summary>
          <p style={{ padding: '0.5rem 0 0.5rem 1.2rem', color: 'var(--text-secondary)' }}>Cash-on-cash return measures annual pre-tax cashflow against the cash you invested (deposit + stamp duty + upfront costs). It shows how hard your actual dollars are working, unlike yield which is measured against the full purchase price.</p>
        </details>
        <details className="faq-item">
          <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0', outline: 'none', listStylePosition: 'inside' }}>Is negative gearing worth it?</summary>
          <p style={{ padding: '0.5rem 0 0.5rem 1.2rem', color: 'var(--text-secondary)' }}>Negative gearing means rental costs exceed rental income, and the loss can be deducted against other income. Whether it's worth it depends on your tax rate and expected capital growth — a property losing $5,000/yr needs more than $5,000/yr in capital growth just to break even.</p>
        </details>
      </section>
    </div>
  );
}
