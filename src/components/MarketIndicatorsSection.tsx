/**
 * MarketIndicatorsSection.tsx — Investor persona view.
 *
 * Boomscore-style: each market indicator rendered with label, value, trend arrow,
 * and one-line "labeled impact" explaining why it drives capital growth. Anchored
 * on demand-to-supply ratio (Boomscore's north-star).
 *
 * Uses only fields already ingested in the V3 pipeline. No new data.
 */
import { memo } from 'react'

interface Props {
  suburb: Record<string, any>
}

interface IndicatorCard {
  label: string
  value: string | number
  trend: 'up' | 'down' | 'neutral' | null
  impact: string
  key_metric?: boolean
}

const MarketIndicatorsSection = memo(function MarketIndicatorsSection({ suburb }: Props) {
  const s = suburb

  // Absorption rate proxy: sold / stock per month
  const sold12m = Number(s.houseSold12m) || 0
  const stockOnMarket = Number(s.houseStockOnMarket) || 1
  const absorptionRate = stockOnMarket > 0 ? (sold12m / 12 / stockOnMarket * 100).toFixed(1) : null

  const indicators: IndicatorCard[] = [
    {
      label: 'Demand / Supply Ratio',
      value: s.supplyDemandRatio != null ? Number(s.supplyDemandRatio).toFixed(2) : '—',
      trend: s.supplyDemandRatio != null ? (s.supplyDemandRatio < 0.5 ? 'up' : 'down') : null,
      impact: 'Demand-to-supply is Boomscore\'s anchor: low ratio = tight market precedes price pressure.',
      key_metric: true,
    },
    {
      label: 'Absorption Rate (mo)',
      value: absorptionRate != null && Number(absorptionRate) > 0 ? `${absorptionRate}% of stock/mo` : 'Insuff. Data',
      trend: absorptionRate != null && Number(absorptionRate) > 0 ? (Number(absorptionRate) > 15 ? 'up' : 'down') : null,
      impact: '% of active stock sold each month. >15% = rapid absorption, <5% = soft market.',
    },
    {
      label: 'Days on Market',
      value: s.houseDaysOnMarket != null && s.houseDaysOnMarket > 0 ? `${s.houseDaysOnMarket} days` : 'Insuff. Data',
      trend: s.houseDaysOnMarket != null && s.houseDaysOnMarket > 0 ? (s.houseDaysOnMarket < 30 ? 'up' : 'down') : null,
      impact: 'Fewer days = higher competition. <30 days typically signals seller advantage.',
    },

    {
      label: 'Vacancy Rate',
      value: s.vacancyRate != null ? `${Number(s.vacancyRate).toFixed(1)}%` : '—',
      trend: s.vacancyRate != null ? (s.vacancyRate < 2 ? 'up' : 'down') : null,
      impact: '<2% = tight rental market. Low vacancy supports rental yield and investor demand.',
    },
    {
      label: 'Price 12M Change',
      value: s.houseMedianPrice12mChangePct != null ? `${Number(s.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(s.houseMedianPrice12mChangePct).toFixed(1)}%` : '—',
      trend: s.houseMedianPrice12mChangePct != null ? (s.houseMedianPrice12mChangePct > 0 ? 'up' : 'down') : null,
      impact: 'Trailing realised price growth. 12-month window avoids short-term noise.',
    },
    {
      label: 'Price / Rent Ratio',
      value: s.priceToRentRatio != null ? `${Number(s.priceToRentRatio).toFixed(1)}x` : '—',
      trend: s.priceToRentRatio != null ? (s.priceToRentRatio > 25 ? 'down' : 'up') : null,
      impact: '>25x = expensive vs renting. Lower ratio favours cashflow investors.',
    },
    {
      label: 'Price / Income Ratio',
      value: s.priceToIncomeRatio != null ? `${Number(s.priceToIncomeRatio).toFixed(1)}x` : '—',
      trend: s.priceToIncomeRatio != null ? (s.priceToIncomeRatio > 10 ? 'down' : 'neutral') : null,
      impact: '>10x = high barrier. Below state avg suggests room for price growth.',
    },
    {
      label: 'Vendor Discounting',
      value: s.houseMedianPrice12mChangePct != null && Number(s.houseMedianPrice12mChangePct) < -2
        ? `${Math.abs(Number(s.houseMedianPrice12mChangePct)).toFixed(1)}% avg drop`
        : 'Low or none',
      trend: s.houseMedianPrice12mChangePct != null ? (s.houseMedianPrice12mChangePct < -2 ? 'down' : 'up') : null,
      impact: 'Proxy: 12m price decline suggests vendor discounting. Buyers have negotiation power.',
    },
    {
      label: 'Investor %',
      value: s.investorRate != null ? `${Number(s.investorRate).toFixed(0)}%` : '—',
      trend: null,
      impact: 'High investor-rate suburbs face concentration risk when market turns.',
    },
    {
      label: 'Yield Trend (House)',
      value: s.houseGrossRentalYieldTrend != null ? `${Number(s.houseGrossRentalYieldTrend) >= 0 ? '+' : ''}${Number(s.houseGrossRentalYieldTrend).toFixed(2)}%` : '—',
      trend: s.houseGrossRentalYieldTrend != null ? (s.houseGrossRentalYieldTrend > 0 ? 'up' : 'down') : null,
      impact: 'Rising yield = rent growing faster than price. Good for cashflow investors.',
    },
  ]

  return (
    <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Market Indicators</h3>
        <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px' }}>
          Investor View
        </span>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Each indicator contributes to the capital-growth picture. Green = tailwind (positive signal). Red = headwind.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        {indicators.map(ind => {
          const borderColor = ind.key_metric
            ? 'var(--accent-cyan)'
            : 'var(--border-glass)'
          return (
            <div
              key={ind.label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {ind.label}
                </span>
                {ind.trend === 'up' && <span style={{ color: '#10b981', fontSize: '0.75rem' }}>▲</span>}
                {ind.trend === 'down' && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>▼</span>}
                {ind.trend === 'neutral' && <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>◆</span>}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {ind.value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {ind.impact}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default MarketIndicatorsSection
