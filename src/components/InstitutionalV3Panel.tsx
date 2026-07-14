/**
 * InstitutionalV3Panel.tsx — Institutional Deep Dive
 * ===================================================
 * Complementary view to main profile. Focuses on:
 * - Yield trend analysis (house vs unit)
 * - DQ alerts & data quality
 * - Financial ratios (mortgage, price/income)
 * - Nearby suburbs comparison
 * - Recent sales summary
 * Does NOT duplicate: price/rent/stock cards, charts (main profile handles those)
 */
import { useState, useEffect, memo } from 'react';

interface V3SuburbData {
  id: string; state: string; name: string; postcode: string; isEnriched: boolean;
  house: { medianPrice: number | null; medianPrice12mChangePct: number | null; medianRent: number | null; grossRentalYield: number | null; grossRentalYieldTrend: number | null; daysOnMarket: number | null; auctionClearanceRate: number | null; stockOnMarket: number | null; sold12m: number | null };
  unit: { medianPrice: number | null; medianPrice12mChangePct: number | null; medianRent: number | null; grossRentalYield: number | null; grossRentalYieldTrend: number | null; daysOnMarket: number | null };
  market: { totalProperties: number | null; vacancyRate: number | null; supplyDemandRatio: number | null };
  demographics: { population2021: number | null; populationCagr: number | null; ownerOccupierRate: number | null; investorRate: number | null; medianAge: number | null; predominantAgeGroup: string | null; predominantOccupation: string | null; averageHouseholdSize: number | null };
  financial: { typicalMortgageBand: string | null; priceToIncomeRatio: number | null; priceToRentRatio: number | null };
  environment: { parksCount: number | null; parksCoveragePct: number | null; areaSqkm: number | null };
  demographicsDetail: any; salesSummary: any[] | null; nearbySuburbs: any[] | null;
  history10yr: any[] | null; historyRent10yr: any[] | null;
  dqScore: number; dqIssues: { field: string; issue: string; value: string; severity: string }[] | null;
  lastUpdated: string | null;
}

function MetricCard({ label, value, suffix, trend }: {
  label: string; value: string | number | null; suffix?: string; trend?: number | null;
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>{value !== null && value !== undefined ? value : '—'}{suffix || ''}</div>
      {trend !== undefined && trend !== null && (
        <span style={{ color: trend > 0 ? '#10b981' : '#ef4444', fontSize: '0.75em' }}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function DQBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <span title={`Data Quality: ${score}/100`} style={{ background: `${color}20`, color, border: `1px solid ${color}40`, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
      DQ {score.toFixed(0)}
    </span>
  );
}

export default memo(function InstitutionalV3Panel() {
  const [suburbs, setSuburbs] = useState<V3SuburbData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<V3SuburbData | null>(null);
  const [showLowQuality, setShowLowQuality] = useState(false);

  useEffect(() => {
    fetch('/api/v3/suburbs?limit=30')
      .then(r => r.json()).then(data => { setSuburbs(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    try {
      const r = await fetch(`/api/v3/suburbs/${id}`);
      if (r.ok) setDetail(await r.json());
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading V3 panel...</div>;
  if (error) return <div className="glass-card" style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <h2 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          Institutional Deep Dive
          <span style={{ fontSize: '0.7rem', background: '#0fa9b820', color: '#0fa9b8', padding: '2px 8px', borderRadius: '4px' }}>
            V3 Pipeline
          </span>
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {suburbs.length} enriched suburbs. Complementary deep-dive — see main profile for price charts & metrics.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
        {/* Left: Suburb List */}
        <div className="glass-card" style={{ maxHeight: '550px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Enriched Suburbs</h3>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLowQuality} onChange={e => setShowLowQuality(e.target.checked)} />
              Show low-quality (DQ &lt; 70)
            </label>
          </div>
          {suburbs.filter(s => showLowQuality || s.dqScore >= 70).map(s => (
            <div key={s.id} onClick={() => loadDetail(s.id)}
              style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: '6px',
                background: selectedId === s.id ? 'rgba(15,169,184,0.1)' : 'transparent',
                border: selectedId === s.id ? '1px solid #0fa9b840' : '1px solid transparent',
                marginBottom: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{s.name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{s.state} {s.postcode}</span></span>
                <DQBadge score={s.dqScore} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: Deep Dive Detail */}
        <div>
          {!detail ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Select a suburb to view deep-dive analysis
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Header */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{detail.name}, {detail.state} {detail.postcode}</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                    Last updated: {detail.lastUpdated ? new Date(detail.lastUpdated).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <DQBadge score={detail.dqScore} />
              </div>

              {/* 1. Yield Trend Analysis */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Yield Trend Analysis</h4>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ flex: 1, padding: '10px', background: 'rgba(15,169,184,0.05)', borderRadius: '6px' }}>
                    <div style={{ color: '#0fa9b8', fontWeight: 700, marginBottom: '6px' }}>House Yield</div>
                    <MetricCard label="Gross Yield" value={detail.house.grossRentalYield?.toFixed(2) ?? '—'} suffix="%" trend={detail.house.grossRentalYieldTrend} />
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Rent ${detail.house.medianRent?.toLocaleString() ?? '—'}/wk · Median ${detail.house.medianPrice?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '10px', background: 'rgba(139,92,246,0.05)', borderRadius: '6px' }}>
                    <div style={{ color: '#8b5cf6', fontWeight: 700, marginBottom: '6px' }}>Unit Yield</div>
                    <MetricCard label="Gross Yield" value={detail.unit.grossRentalYield?.toFixed(2) ?? '—'} suffix="%" trend={detail.unit.grossRentalYieldTrend} />
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Rent ${detail.unit.medianRent?.toLocaleString() ?? '—'}/wk · Median ${detail.unit.medianPrice?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                </div>
                {detail.house.medianPrice && detail.unit.medianPrice && (
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    House premium over units: <strong style={{ color: '#0fa9b8' }}>
                      {((detail.house.medianPrice - detail.unit.medianPrice) / detail.unit.medianPrice * 100).toFixed(2)}%
                    </strong>
                  </div>
                )}
              </div>

              {/* 2. DQ Issues */}
              {detail.dqIssues && detail.dqIssues.length > 0 && (
                <div className="glass-card" style={{ padding: '12px', marginBottom: '12px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#f59e0b' }}>Data Quality Alerts ({detail.dqIssues.length})</h4>
                  {detail.dqIssues.map((issue, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '3px', padding: '2px 0' }}>
                      ⚠ <strong>{issue.field}</strong>: {issue.issue} {issue.value ? `(${issue.value})` : ''}
                      <span style={{ color: issue.severity === 'error' ? '#ef4444' : '#f59e0b', marginLeft: '4px' }}>[{issue.severity}]</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Financial Ratios + Demographics */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Financial & Demographic Deep Dive</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <MetricCard label="Mortgage Band" value={detail.financial.typicalMortgageBand} />
                  <MetricCard label="Price/Income" value={detail.financial.priceToIncomeRatio?.toFixed(2) ?? '—'} />
                  <MetricCard label="Price/Rent" value={detail.financial.priceToRentRatio?.toFixed(2) ?? '—'} />
                  <MetricCard label="Occupation" value={detail.demographics.predominantOccupation} />
                  <MetricCard label="Age Group" value={detail.demographics.predominantAgeGroup} />
                  <MetricCard label="Household Size" value={detail.demographics.averageHouseholdSize?.toFixed(2) ?? '—'} />
                  <MetricCard label="Population" value={detail.demographics.population2021?.toLocaleString() ?? '—'} />
                  <MetricCard label="Pop CAGR" value={detail.demographics.populationCagr?.toFixed(1) ?? '—'} suffix="%" />
                  <MetricCard label="Density" value={detail.environment.areaSqkm && detail.demographics.population2021 ? `${Math.round(detail.demographics.population2021 / detail.environment.areaSqkm)}/km²` : '—'} />
                </div>
              </div>

              {/* 4. Sales Summary */}
              {detail.salesSummary && detail.salesSummary.length > 0 && (
                <div className="glass-card" style={{ padding: '14px', marginBottom: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Recent Sales ({detail.salesSummary.length})</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {detail.salesSummary.map((sale: any, i: number) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px',
                        minWidth: '200px', fontSize: '0.78rem'
                      }}>
                        <div style={{ fontWeight: 600 }}>{sale.address || 'N/A'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {sale.type || '—'} · {sale.beds || '?'}bd {sale.baths || '?'}ba
                          {sale.salePrice > 0 && <span style={{ color: '#10b981', marginLeft: '8px', fontWeight: 600 }}>${sale.salePrice.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Nearby Suburbs */}
              {detail.nearbySuburbs && detail.nearbySuburbs.length > 0 && (
                <div className="glass-card" style={{ padding: '14px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Nearby Suburbs ({detail.nearbySuburbs.length})</h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {detail.nearbySuburbs.map((n: any, i: number) => (
                      <span key={i} style={{
                        background: 'rgba(15,169,184,0.06)', padding: '4px 10px',
                        borderRadius: '4px', fontSize: '0.75rem', color: '#0fa9b8'
                      }}>
                        {n.name} {n.postcode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
