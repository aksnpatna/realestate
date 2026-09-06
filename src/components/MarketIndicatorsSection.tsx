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
import MarketCycleClock from './MarketCycleClock'

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
      label: 'Price 1M Change',
      value: s.houseMedianPrice1mChangePct != null ? `${Number(s.houseMedianPrice1mChangePct) > 0 ? '+' : ''}${Number(s.houseMedianPrice1mChangePct).toFixed(1)}%` : '—',
      trend: s.houseMedianPrice1mChangePct != null ? (s.houseMedianPrice1mChangePct > 0 ? 'up' : 'down') : null,
      impact: 'Recent price momentum. Shows short-term market direction over the last 30 days.',
    },
    {
      label: 'Price 3M Change',
      value: s.houseMedianPrice3mChangePct != null ? `${Number(s.houseMedianPrice3mChangePct) > 0 ? '+' : ''}${Number(s.houseMedianPrice3mChangePct).toFixed(1)}%` : '—',
      trend: s.houseMedianPrice3mChangePct != null ? (s.houseMedianPrice3mChangePct > 0 ? 'up' : 'down') : null,
      impact: 'Quarterly price trend. Indicates emerging market patterns and seasonal effects.',
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
    <>
      <MarketCycleClock suburb={suburb} />
      
      <div className="glass-card u-ca1a383a">
      <div className="u-47a97aa0">
        <h3 className="u-b5fda34d">Market Indicators</h3>
        <span className="u-c140bfd4">
          Investor View
        </span>
      </div>
      <p className="u-547cbd02">
        Each indicator contributes to the capital-growth picture. Green = tailwind (positive signal). Red = headwind.
      </p>
      <div className="u-aa1ef56a">
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
              <div className="u-4beeb81e">
                <span className="u-65b450cb">
                  {ind.label}
                </span>
                {ind.trend === 'up' && <span className="u-3d3df2b8">▲</span>}
                {ind.trend === 'down' && <span className="u-b4891944">▼</span>}
                {ind.trend === 'neutral' && <span className="u-f294072d">◆</span>}
              </div>
              <div className="u-5dcc8599">
                {ind.value}
              </div>
              <div className="u-fc193050">
                {ind.impact}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </>
  )
})

export default MarketIndicatorsSection
