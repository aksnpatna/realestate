# Plan to Work — Monetization & Compliance Roadmap

> **Purpose:** This document tracks implementation progress so work can be resumed after token limits or session interruptions. Update after every completed step.

## Positioning

**"Transparent Australian suburb research for investors who want to compare locations using data, assumptions, and risk factors, without relying on generic property rankings."**

Sell transparency, not predictions. Every metric sourced, dated, and auditable.

---

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5-metric scorecard, 1 comparison/day, email capture |
| Report | $29 one-off | Full 20+ metric comparison, risk factors, cash-flow calc, reasoning chain, shareable link |
| Dashboard | $29/month | Unlimited comparisons, saved searches, alerts, sentiment tracking |
| Professional | $99-299/month B2B | Branded reports, bulk generation, CRM export, multi-seat, monthly research pack |

---

## Week 1: Foundation (Compliance + Differentiation)

- [x] 1.0 Create `plan_to_work.md` and commit
- [x] 1.1 Add `price_volatility_10yr` + `price_sharpe_ratio` derived metrics to `metric_registry.py` and `evidence.py`
- [x] 1.2 Add Privacy Policy page (`src/pages/PrivacyPolicy.tsx`)
- [x] 1.3 Add Terms of Use page (`src/pages/TermsOfUse.tsx`)
- [x] 1.4 Add data deletion endpoint (`backend/routers/user_data.py`)
- [x] 1.5 Reduce Neo4j heap from 4GB to 2GB in `docker-compose.yml` — already at 768M, no change needed
- [x] 1.6 Wire Privacy/Terms links into footer or navigation
- [x] 1.7 Verify no regressions, commit, push, rebuild Docker

## Week 3: Landing Page + B2B Outreach

- [x] 3.1 Build landing page with positioning + sample previews + pricing + email capture (already built as `SampleReportsLanding.tsx` in Week 2)
- [x] 3.2 Create cold email template (added to `outreach/cold-email-template.md`)
- [ ] 3.3 Outreach to 30 buyer's agents + 10 mortgage brokers
- [x] 3.4 Track which reports/fields get clicked most (built as `SampleReport` with `data-sr-field` tracking attributes)

## Week 3: Landing Page + B2B Outreach

- [ ] 3.1 Build landing page with positioning + sample previews + pricing + email capture
- [ ] 3.2 Create cold email template
- [ ] 3.3 Outreach to 30 buyer's agents + 10 mortgage brokers
- [ ] 3.4 Track which reports/fields get clicked most

## Week 4: Paying Customer Validation

- [ ] 4.1 Offer first 5 reports free (manual delivery)
- [ ] 4.2 Collect feedback on which 3 data fields matter most
- [ ] 4.3 If 2+ of 5 offer to pay → build PDF export + Stripe
- [ ] 4.4 If 0 of 5 offer to pay → pivot offering

## Future: Premium Features (Post-Validation)

- [ ] 5.1 PDF export with branding
- [ ] 5.2 Stripe payment integration
- [ ] 5.3 White-label B2B report system
- [ ] 5.4 Flood/bushfire/insurance risk overlays
- [ ] 5.5 Auction clearance rate data integration
- [ ] 5.6 CRM export for professionals
- [ ] 5.7 Saved searches + market alerts
- [ ] 5.8 Portfolio monitoring dashboard

---

## What NOT to Build Now

- Subscription billing system (no users yet)
- Full PDF automation (validate demand first)
- Flood/bushfire risk APIs (expensive, wait for demand)
- Mobile app (web is responsive)
- Additional LLM providers (one is enough)
- New Neo4j graph features (Postgres handles 90%)

---

## Resume Instructions

If session is interrupted:
1. Read this file to see current progress
2. Find the next unchecked item
3. Continue implementation
4. Check off the item after completion
5. Commit and push changes
