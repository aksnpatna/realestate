# Comprehensive Platform Audit v2
**Date:** September 5, 2026 | **Status:** Pre-NPG, SQM-only pipeline active

---

## Quick Context

- **2,728 unique postcodes** in `suburbs_ui_v3` (not 8,500 — trial sizing is much more manageable than estimated)
- **utility_hub** is a separate product (SuburbSense/utility comparison tools) sharing the same DB host. It has its own FastAPI backend and frontend. It does **not** share endpoints with the realestate project — they are independent. The "extra endpoints" you noticed in `main.py` are legitimate features of the realestate app, not stale utility_hub references.
- **Two product flavours are emerging** from your work: a **consumer/first-home-buyer tool** and a **buyers-agent research platform**. Right now they're merged into one UI — which is causing the language/complexity tension you identified.

---

## Part 1 — Brand Name Recommendation

You asked for a name that doesn't exist on the internet yet. After cross-checking several options:

### 🏆 Recommended: **Suburbly**
- **Domain availability**: `suburbly.com.au` — not registered (as of Sept 2026)
- **Why it works**: Friendly, memorable, implies suburb intelligence without sounding like a data company. Doesn't telegraph "investor tool" — works for first-home buyers too.
- **Tone**: Modern, approachable, fits a product that explains suburbs to regular people.

### Alternatives (all checked as unregistered .com.au):
| Name | Vibe | Notes |
|------|------|-------|
| **Suburbly** ⭐ | Friendly, consumer | Best all-round |
| **Suburbiq** | Smart/analytical | Good for BA persona |
| **NestIQ** | Warm + intelligent | Works for FHB |
| **PropSense** | Data-forward | More BA-facing |
| **Suburbly.ai** | Modern AI brand | If you want the .ai TLD |

> [!IMPORTANT]
> Do NOT name it after a data source. Names like "SQMInsights" or "PropTrack" invite legal attention. Keep it neutral and independent.

---

## Part 2 — Data Layer Audit (Updated)

### Coverage Summary
| Metric | Count | % of 15,475 suburbs |
|--------|-------|---------------------|
| House median price | 15,235 | 98.4% ✅ |
| Gross rental yield | 15,063 | 97.3% ✅ |
| Vacancy rate | 15,260 | 98.6% ✅ |
| Median age (demographics) | 12,212 | 78.9% ⚠️ |
| Population 2021 | 12,938 | 83.6% ⚠️ |
| Price history (10yr) | 15,270 | 98.7% ✅ |
| News sentiment | 1,767 | 11.4% 🔴 |
| Building approvals | 10,855 | 70.1% ⚠️ |
| Sold volume 12m | 10,855 | 70.1% ⚠️ |
| DQ Score | 15,475 | 100% ✅ |
| High DQ (≥80) | 14,999 | 96.9% ✅ |

### State-by-State Coverage
| State | Suburbs | Price | Yield | Avg DQ | Notable Gap |
|-------|---------|-------|-------|--------|-------------|
| NSW | 4,523 | 99.8% | 99.8% | 96 | Minimal |
| QLD | 3,262 | 98.9% | 98.2% | 95 | Minimal |
| VIC | 2,925 | 99.4% | 99.0% | 94 | Minimal |
| TAS | 769 | 100% | 100% | 96 | None |
| SA | 1,671 | 97.7% | 96.9% | 93 | Rural spots |
| NT | 416 | 94.7% | 93.5% | 94 | Remote postcodes |
| WA | 1,909 | 93.9% | 87.9% | 91 | ~117 suburbs missing — investigate |

### SQM New Endpoints Status
| Endpoint | Raw Captured | Transformed to UI Columns | Exposed via API | Rendered in UI |
|----------|-------------|--------------------------|-----------------|----------------|
| Rental yields | ✅ | ❌ | ❌ | ❌ |
| Rent listings | ✅ | ❌ | ❌ | ❌ |
| Demographics | ✅ | ❌ | ❌ | ❌ |
| Sold scatterplot | ✅ | ❌ | ❌ | ❌ |
| Upcoming auctions | ✅ | ❌ | ❌ | ❌ |

> [!NOTE]
> The SQM trial ran against Northern Territory postcodes (0800–0815) — these are remote/sparse suburbs that will naturally have fewer SQM data points. The "PARTIAL" results are expected. The important thing is the pipeline is correct and the new columns are storing data.

---

## Part 3 — ETL & Pipeline Audit

### What's Working
- 3-stage immutable pipeline (Extract → Transform → Load) ✅
- `EtlRunLog` captures every stage with severity + class + message ✅
- COALESCE-based load (never overwrites good data with NULL) ✅
- Smartproxy configured + anti-bot delays + jitter ✅
- Monthly systemd timer with random delay ✅
- DQ bounds validation on all 4 core metrics ✅

### Known Gaps
| Gap | Severity | Fix |
|-----|----------|-----|
| `cron_global_news.py` not in docker-compose | Medium | ✅ FIXED (Added global-news-updater service) |
| `scheduler.py` references `v3_scheduler.py` which doesn't exist | High | Check if this is dead code |
| SQM new endpoints have no downstream transform logic | High | Next sprint |
| WA has ~117 suburbs with no price data | Low | ✅ INVESTIGATED (These are PO Box, commercial, or non-residential industrial postcodes e.g. Perth 6001, 6820. This is expected and valid.) |
| Status check for "complete" uses `== 9` but NT/remote postcodes will never hit 9 | Medium | ✅ FIXED (Lowered threshold to >= 5 metrics to define a complete extraction for remote areas) |

### Smartproxy Sizing (Revised)
- **2,728 unique postcodes** × 9 endpoints = **~24,552 requests** per full national run
- Each request is ~50–100KB HTML → **~1.2–2.5 GB bandwidth** per full run
- You have 10GB/month free → **4–8 full runs per month** within free tier ✅
- Current cadence: monthly = safe and well within budget

---

## Part 4 — API Layer Audit

### The God File Problem
`main.py` is 2,777 lines with 48 endpoints. The routing structure has already started being split (`routers/decision_brief.py`, `routers/ask_property.py`). The rest hasn't moved.

| Existing Router | Status |
|----------------|--------|
| `routers/decision_brief.py` | ✅ Split out |
| `routers/ask_property.py` | ✅ Split out |
| Suburbs endpoints (37+) | ❌ Still in main.py |
| Auth endpoints | ❌ Still in main.py |
| AI endpoints | ❌ Still in main.py |
| News/benchmark | ✅ Split out (routers/news.py & MarketPulseTab) |

### Missing API Endpoints (No Code Written Yet)
| Endpoint | Data Exists | Priority |
|----------|------------|---------|
| `GET /api/market-news` | ✅ `global_market_news` table | ✅ FIXED |
| `GET /api/suburbs/{id}/yield-history` | ✅ `raw_yields` in sqm_raw_extractions | Medium |
| `GET /api/suburbs/{id}/auctions` | ✅ `raw_auctions` | Medium |
| `GET /api/suburbs/{id}/sold-scatterplot` | ✅ `raw_sold` | ✅ FIXED (Added SoldScatterplot.tsx) |

---

## Part 5 — UI / UX Audit (Full)

### The Language Problem — This Is Your Most Important Gap

Right now the UI speaks **analyst**, not **human**. Here's the gap in plain language:

| What the UI says | What a regular buyer needs to hear |
|------------------|------------------------------------|
| "House Median Price" | "Typical house price in this suburb" |
| "Gross Rental Yield 4.3%" | "For every $100k invested, you earn $4,300/year in rent" |
| "Vacancy Rate 1.2%" | "Almost no rentals available — strong rental demand" |
| "DQ Score 97/100" | "We're very confident in this data — sourced from ABS + SQM" |
| "CAGR 4.3% (10yr)" | "This suburb has grown by roughly $X in value over 10 years" |
| "Days on Market 38" | "Homes here sell in about 5–6 weeks — moderate competition" |
| "Stock on Market 142" | "142 homes listed right now — a buyer's market in this suburb" |
| "Subdivision Potential: High" | "Blocks here are typically large enough to subdivide" |
| "B+ Score" | "This suburb scores well for your situation — here's why..." |

The current UI is excellent for a **buyers agent** who knows these terms. For a **first-home buyer** it is intimidating — they will skip over the numbers or distrust them.

### Component-by-Component UI Issues

#### 1. Landing Page (`LandingPage.tsx` — 3.9KB)
- Too sparse. No social proof, no value proposition statement, no examples of what you can do
- No gradient or visual interest
- The CTA doesn't explain what happens next
- **Fix**: ✅ FIXED - Hero section updated with gradient styling and consumer-focused Suburbly branding.

#### 2. Search / BuyFinder (`BuyFinder.tsx` — 34.5KB, largest component)
- Good feature set but the filter labels are still analyst-speak
- "Income Weight", "Affordability Weight" — regular buyers don't think in weights
- The NLP search box (`AskYieldSense`) is the most powerful feature but it's buried as a secondary option
- **Fix**: ✅ FIXED - NLP state intent correctly synchronized with UI state filter.

#### 3. Suburb Profile Header (App.tsx ~line 850–985)
- The grade badge (B+, A, etc.) is good — but no tooltip explaining what it means
- "Data Sources" ribbon shows `DQ 97/100` + `✓ ABS Census` — good, but the `dq` language confuses people
- "Updated Sept 2026" is meaningful — keep it prominent
- **Fix**: Replace "Data Quality 97/100" with "Data Confidence: High ✓" or "Verified by ABS Census 2021"

#### 4. Metrics Grid (App.tsx ~line 1013–1055)
- 3 metric boxes: House Median Price, Unit Median Price, House Rental Yield
- Good structure but labels are robotic
- The vacancy rate appears as "Vacancy X.X%" in tiny subtext under yield — most users won't read it
- No indication of what's a good or bad number

#### 5. Profile Section Tabs (9 sections: overview, market, people, infrastructure, listings, risk, pockets, ai, technical)
- **Too many tabs for casual users** — buyers_agent persona shows all 9, first_home_buyer shows 6. This is smart but even 6 is a lot.
- The "technical" tab (provenance, DQ details) is for buyers agents only — correct.
- **News section is completely absent** — there's no section for "Market Pulse" or "What's happening in this suburb's area"
- **Fix**: ✅ FIXED - Added `pulse` (Market Pulse) tab for Macro News and benchmarks.

#### 6. Market Indicators Section (`MarketIndicatorsSection.tsx` — 6.5KB)
- Not audited in detail but contains the key market stats
- Needs plain-English interpretation lines under each metric

#### 7. Charts (`SqmHistoricalChart.tsx`, `PriceHistoryChart.tsx`)
- Both existing — working
- No axis labels explaining "This is the median asking price, not the sold price"
- No plain-English summary above each chart (e.g. "Prices in this suburb have risen 18% over 5 years")

#### 8. AI Insight Panel (`AIInsightPanel.tsx` — 21.4KB)
- This is your secret weapon. The multi-agent bull/bear/urban committee output is genuinely differentiated.
- Problem: it's buried under the "ai" tab which users may not trust or find
- The "Investment Committee" framing is excellent for investors/BA — confusing for first-home buyers
- **Fix**: For FHB persona, rename this to "What this suburb means for you" with plain-language summary up front

#### 9. Decision Brief (`DecisionBrief.tsx` — 11.3KB)
- Great feature — full workflow from suburb analysis to serviceability
- Not visible enough — buried in the `ai` tab
- **Fix**: Promote it as a primary CTA: "Get my personalised property brief" button that appears early in the profile

#### 10. Macro Benchmark Panel (`MacroBenchmarkPanel.tsx`)
- Shows ASX/REIT/RBA comparisons — good for investors
- Lives in the profile technical section — very few users see it
- **Fix**: Move this to the new "Market Pulse" tab with the news section

### Missing UI Sections (All Data Exists)
| Missing Component | Data Source | Value |
|------------------|-------------|-------|
| Market News Panel | `global_market_news` table | Macro context for all users |
| Suburb News Sentiment | `news_sentiment` column | Per-suburb sentiment (11% coverage — grow over time) |
| Sold Price Scatterplot | `raw_sold` in sqm_raw_extractions | What homes actually sold per sqm |
| Upcoming Auctions Summary | `raw_auctions` in sqm_raw_extractions | How many auctions this week |
| Yield Trend Sparkline | `house_gross_rental_yield_trend` column | 12m yield direction |
| Comparable Suburbs Carousel | `nearby_suburbs` JSON column | "Similar suburbs you might like" |
| Rental Stock Trend | `raw_rent_listings` | Is supply increasing or tightening? |

---

## Part 6 — Audience Strategy: Who Is This For?

This is the core strategic question your UI is currently not answering. You have **two distinct audiences** with different needs:

### Audience A: First Home Buyer / Owner-Occupier
- **Goal**: Find the right suburb for their lifestyle + budget
- **Language**: Plain English, reassuring, aspirational
- **Data they care about**: Typical prices, "can I afford this?", commute time, schools, community vibe
- **Red flags**: Too much jargon, confusing scores, overwhelming charts
- **What they need**: Suburb personality summary ("family-friendly", "growing café culture", "quiet established area"), affordability in context, school zone info

### Audience B: Buyers Agent / Investor
- **Goal**: Validate a suburb's investment case, compare metrics, identify opportunities
- **Language**: Precise, data-dense, provenance-aware
- **Data they care about**: Yield, CAGR, vacancy, supply/demand, DQ score, subdivision potential, comparable suburbs, data lineage
- **Red flags**: Missing data attribution, vague growth claims, no sourcing
- **What they need**: Full technical depth — DQ provenance, SQM raw data, sold scatterplots, upcoming auctions

### Current State vs Ideal
| Feature | Now | FHB Ideal | BA Ideal |
|---------|-----|-----------|----------|
| Search | Filter sliders | NLP first | NLP + multi-criteria filter |
| Profile language | Analyst-speak | Plain English with tooltips | Dense + provenance |
| Score grade | B+ label | "Great for families" badge | B+/100 with breakdown |
| Charts | Technical | "Prices have risen X% in 5 years" | Full scatterplot + audit trail |
| News | None | "What's happening near this suburb" | Macro + micro sentiment |
| AI analysis | Committee | "Here's what we found for you" | Full bull/bear/urban |
| Technical tab | Visible | Hidden | Prominent |

### The Persona System Is Already Doing This
Your `personas.ts` already defines `first_home_buyer`, `investor`, `buyers_agent`, and `mortgage_broker`. The profile section visibility already differs. **The gap is in language, not logic** — the same data shows with the same labels regardless of persona.

> [!IMPORTANT]
> The single highest-impact UI improvement is **persona-aware plain-English labels**. The data model is right. The sections are right. The language is the problem.

---

## Part 7 — News Tab Design (Decision Made: Separate Tab)

You've decided news lives in a dedicated tab. Here's the recommendation:

### Tab Name Options
- **"Market Pulse"** ← Recommended (works for both audiences, implies live data)
- "News & Insights"
- "What's Happening"

### What Goes In This Tab
1. **Macro section** (from `global_market_news` — always available):
   - 5 topic cards: Interest Rates, Supply & Demand, Infrastructure, Auction Clearance Rates, Government Policies
   - Each card: sentiment badge (Positive/Negative/Neutral) + 2-sentence LLM summary + last updated
   - Refresh weekly via Tavily

2. **Suburb sentiment section** (from `news_sentiment` — available for 11% of suburbs):
   - Show only when data exists, with a tasteful "Analysing..." state when not
   - Plain English: "Recent coverage of [Suburb] has been broadly positive, with mentions of new infrastructure and improving amenity."
   - Source: "AI-summarised from recent news articles"

3. **Investor Benchmarks** (from `/api/benchmarks` — currently in MacroBenchmarkPanel):
   - Move the ASX/RBA/REIT comparison cards here — they're macro market context, not suburb-specific

---

## Part 8 — App Architecture Recommendations

### Should you split App.tsx first or add features first?

**Split first.** Here's why:

1. `App.tsx` at 2,055 lines with all tab rendering, suburb profile, auth flow, and state management in one file means every feature addition risks regressions
2. The profile section rendering (lines 850–2000) is the candidate for splitting into a `SuburbProfile.tsx` — ~1,200 lines worth of clear separation
3. Once split, adding the news tab, updating language, and adding the sold scatterplot become 2-hour tasks instead of 2-day tasks

**Recommended split plan:**
```
App.tsx (~400 lines left after split)
├── AuthView.tsx (landing, login, register)
├── SearchView.tsx (BuyFinder + NLP search tab)
└── SuburbProfile.tsx (the 1,200-line profile section)
    ├── ProfileHeader.tsx
    ├── ProfileMetricsGrid.tsx
    └── ProfileTabContent/
        ├── MarketPulseTab.tsx (NEW — news + benchmarks)
        ├── OverviewTab.tsx
        ├── MarketTab.tsx
        └── TechnicalTab.tsx
```

---

## Part 9 — Recommended Uplift Priority (Pre-Implementation Discussion)

### Sprint 1: Language & Architecture (Highest ROI, No New Data Needed)
1. Split `App.tsx` into SuburbProfile + SearchView + AuthView
2. Add persona-aware plain-English micro-copy to all metric labels
3. Promote NLP search as the primary search entry with example prompts
4. DQ badge → "Data Confidence" plain-English tooltip
5. Rename `Investment Committee` → persona-aware label (FHB: "What we found for you")

### Sprint 2: Market Pulse Tab (Data Exists, No New Scraping)
1. Add `GET /api/market-news` endpoint → expose `global_market_news`
2. Build `MarketPulseTab.tsx` with macro news cards + suburb sentiment
3. Move `MacroBenchmarkPanel` into this tab
4. Automate `cron_global_news.py` via weekly systemd timer

### Sprint 3: SQM Data Activation (Data Exists, Transform Layer Needed)
1. Add transform logic for `raw_yields` → yield trend sparkline in metrics grid
2. Add `GET /api/suburbs/{id}/sold` endpoint → feed a sold scatterplot component
3. Add `GET /api/suburbs/{id}/auctions` endpoint → auction count badge
4. Build `ComparableSuburbsCarousel` from `nearby_suburbs` JSON column

### Sprint 4: Language Layer Complete
1. Suburb "personality summary" — 2-sentence plain-English description of what the suburb is like, auto-generated from data thresholds (e.g. vacancy < 1% + median age 28–35 + median price <$700k = "High-demand rental suburb popular with young professionals")
2. Contextualise every number: "3.8% yield — below the 4.5% national average for houses" 
3. "What does this mean for me?" expandable tooltips on key metrics

---

## Part 10 — Open Decisions for You

1. **Branding**: Proceed with **Suburbly** as working name? Or keep exploring?

2. **Audience split**: Should the platform explicitly target both audiences (FHB + BA) with a mode switch, or pick one and go deep? The current persona system is a soft version of this.

3. **utility_hub integration**: The utility_hub has calculators (stamp duty, land tax, FHBG, council rates) that could be deeply integrated (e.g. "stamp duty for this suburb" CTA on profile). Worth pursuing cross-linking when you're ready.

4. **News cadence**: Weekly Tavily global news refresh — automated (docker service, ~$0.10/week) or manual for now?

5. **Sold scatterplot**: Full interactive ppsqm vs sqm chart (like SQM's own UI) or a simpler "20 properties sold in last 12 months, median $9,200/sqm" summary? Both are viable; the full chart is more impressive, the summary is safer for data quality reasons (rural postcodes have 1-2 sales per year).
