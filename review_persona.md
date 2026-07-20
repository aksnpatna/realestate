
## Scope of this review
The repo already contains two rigorous internal reviews — `suggestion.md` (product/model architecture: Buy Finder, deterministic BuyFit score, calibrated probability, AI evidence grounding) and `review_latest_withtest.md` (blocking defects + required test plan: affordability bug, unenforced min-yield, evidence provenance, decision-brief consistency). Those remain the priority engineering backlog and are not repeated here.

This review adds a lens those docs don't cover: **which of the three real personas (First Home Buyer, Investor, Buyers Agent) is the app actually built for today, what each one still can't do, and what direct competitors (realestate.com.au, domain.com.au, boomscore.com.au) already offer that this app doesn't** — to guide what to build once the NPD data licensing/cost model lands.

## 1. Who the app is built for today
`user_journey.md` centres the entire journey on **Priya** — a first-time *investor*, optimizing for yield/serviceability/growth. Everything (Buy Finder weights, Cashflow/Gearing, ROI, AI Committee framed as Bull/Bear/Urban-Planner) is investor-shaped. There is currently **no distinct experience** for a First Home Buyer or a Buyers Agent — they'd use the same investor-oriented controls with irrelevant fields (minimum yield, gearing) and missing ones (grants, stamp duty concessions, client management).

## 2. Persona gap analysis

### 2.1 First Home Buyer (FHB) — largely unserved today
An FHB's core questions are different from an investor's: *"Can I actually afford to live here?"*, *"What government help am I eligible for?"*, *"Is this a safe/liveable suburb for my family, not just a good yield?"*

| Missing capability | Why it matters | Reference (who has it) |
|---|---|---|
| First Home Guarantee / shared-equity & state grant eligibility calculator | FHBs routinely qualify for 5% deposit schemes, stamp duty exemptions/concessions — a huge swing in required deposit that the app's affordability model (already flagged as broken in `review_latest_withtest.md` §4.1) doesn't even model | domain.com.au / realestate.com.au "First Home Buyer" guide hubs |
| Stamp duty & LMI calculator, state-specific | Directly changes the "available deposit after costs" number the backend review already says must be computed correctly | Both major portals surface this at point of search |
| Owner-occupier livability weighting (schools, commute, family amenity) as a *primary* score, not a side-panel | Buy Finder's weights (`w_g`, `w_y`, `w_a`...) in `suggestion.md` §3.1 are investor-return-shaped; an FHB doesn't care about rental yield `Y` at all | realestate.com.au school-catchment overlay is a first-class map layer, not a secondary metric |
| "Genuine savings" / time-to-deposit planner | FHBs plan forward from savings rate, not backward from a fixed deposit like Priya | Not offered by any of the three competitors either — could be a differentiator |
| Rent-vs-buy comparison | Common FHB decision point, absent entirely | realestate.com.au / domain.com.au editorial calculators |

**Recommendation**: Add a `buyer_type` selector (`first_home_buyer | investor | buyers_agent`) at the top of Buy Finder that swaps the weight defaults, hides irrelevant investor fields (min yield, gearing), and surfaces FHB-specific fields (grant eligibility, stamp duty concession, LTV with LMI).

### 2.2 Investor — closest fit, but missing portfolio & monitoring features
The core journeys (1-7 in `user_journey.md`) are well-built for a single-property investor decision. Gaps appear once you consider a *repeat* investor or an investor tracking the market over time:

| Missing capability | Why it matters | Reference |
|---|---|---|
| **Market Alerts / watchlist notifications** ("tell me when a suburb crosses a buy/sell threshold") | The app has favourites (per `suggestion.md` §1) but no active alerting — pure "pull" model | boomscore.com.au's whole third pillar is "Set Market Alerts" |
| **Portfolio view** — multiple owned/target properties compared together, aggregate yield/gearing/serviceability across a portfolio | Real investors (per boomscore's own stat: "71% own only one property" — implying growth path to more) plan sequential purchases against combined serviceability | Not offered by boomscore/domain either — differentiator opportunity |
| **Nationwide ranked list ("Hotspot Finder" style)** — rank *every* eligible suburb by score, filter to top N in a few clicks | Buy Finder returns a shortlist for *entered* constraints, but there's no "just show me the top 50 nationally" browsing mode | boomscore.com.au Hotspot Finder is explicitly "rank all 15,000 suburbs by demand/supply ratio in 4 clicks" |
| Auction clearance rate / days-on-market as a live demand signal | `suggestion.md` §3.1 already lists `D` (demand/supply from days-on-market, clearance rate) as a target signal, but it's not yet wired per `DATA_WIRING_GUIDE.md` | domain.com.au publishes live Auction Results as a core page |
| Depreciation schedule / tax detail depth | Cashflow/Gearing tool exists but investors increasingly expect building-write-off + plant-and-equipment split, not just a flat assumption | Standard in dedicated investor tools (PropertyMe, Property Investment calculators) |

### 2.3 Buyers Agent — entirely unserved, and the highest-leverage gap to close
A buyers agent is not evaluating property for themselves — they're running the tool **on behalf of multiple clients** and need to produce something they can hand to a client or use in a negotiation. None of the current journeys, UI, or backend models support this.

| Missing capability | Why it matters |
|---|---|
| **Client/profile management** — save a named client's constraints (budget, deposit, objective) and reuse/re-run them, switch between clients | Today Buy Finder holds one in-session set of constraints (per `user_journey.md` Journey 3's "client-held shortlist" limitation) — there's no concept of multiple saved clients at all |
| **Shareable / exportable Decision Brief** (PDF or shareable link, white-label option) | A buyers agent's core deliverable *is* a report for the client — the current Decision Brief is browser-only and non-durable across refresh (explicitly called out as a limitation in `user_journey.md`) |
| **Side-by-side comparison mode** for 2-5 shortlisted suburbs/properties | `suggestion.md` §2.3 recommends a trade-off scatterplot for a single buyer session, but a buyers agent needs a persistent, printable comparison table across client meetings |
| **Negotiation evidence pack** — comparable recent sales, days-on-market, vendor discount stats bundled per property | This is the buyers agent's actual job; boomscore's blog content (Vendor Discounting, Stock on Market %, Absorption Rate) hints at exactly these indicators, but the app has none exposed as a report-ready pack |
| **Multi-client dashboard / audit trail** ("which clients have I placed in which suburbs, when, on what evidence") | Needed for compliance and repeat business; ties naturally into the existing `CommitteeMemory`/Model Diary infrastructure already in the codebase — could be extended to a "Client Diary" |

**Recommendation**: This persona requires the least new *data* work and the most new *product surface* — it's largely a UI/workflow layer (auth + saved profiles + export) on top of infrastructure that already exists (Buy Finder backend, Decision Brief, evidence IDs). Given the NPD data cost model is still pending, this is a good near-term, low-data-cost way to expand the app's addressable users while waiting on licensing.

## 3. Competitive feature matrix (this app vs. the three reference sites)

| Feature | This app (current) | realestate.com.au | domain.com.au | boomscore.com.au |
|---|---|---|---|---|
| Suburb-level scoring/ranking | Yes — deterministic Buy Finder (flagged as needing fixes) | Via PropTrack "Market Insights", not a single buy score | Via Domain "Suburb Profiles" | Yes — Boom Score, core product |
| Nationwide "rank everything, filter fast" browsing | No (constraint-driven shortlist only) | Partial (suburb insights search) | Partial | **Yes — Hotspot Finder, explicit selling point** |
| Property-level automated valuation (AVM) | No | **Yes — PropTrack estimate** | **Yes — "Price Guide" / "What's my home worth"** | No (suburb-level only) |
| School catchment map layer | Present per commit history (`get_schools.py`, "school zone generation") — verify it's a first-class map layer, not buried | **Yes — first-class map filter** | Yes — "Search by school" | No |
| Auction results / clearance rates | Not wired (planned per `suggestion.md`) | Yes | **Yes — dedicated Auction Results page** | Used as an indicator, not a page |
| Market alerts / notifications | No | Saved search email alerts | Saved search alerts | **Yes — core "Market Alerts" pillar** |
| AI-generated investment commentary | **Yes — unique differentiator** (Bull/Bear/Urban Planner/CIO committee) | No | No | No (uses blog content instead) |
| Cashflow/gearing/ROI calculator | **Yes** | Basic calculators only | Basic calculators only | No |
| Buyers-agent / multi-client workflow | No | No (consumer-facing only) | No (consumer-facing only) | No (single-user tool) |
| First-home-buyer specific tooling (grants, stamp duty) | No | Content hub, not integrated into search/scoring | Content hub, not integrated into search/scoring | No |
| Evidence/provenance transparency per metric | **In progress — ahead of all three** (per `suggestion.md` §2.5, `review_latest_withtest.md` §4.4) | No (opaque estimates) | No (opaque estimates) | No (opaque score) |

**Where this app is already ahead**: transparent, evidence-labelled scoring and an AI committee that explains *why* rather than just outputting a number — none of the three competitors expose reasoning or evidence at this level. That's a real differentiator worth protecting (don't let AI invent evidence — this is already `suggestion.md` §5's main point).

**Where this app is clearly behind**: nationwide fast-browse ranking (boomscore), property-level AVM and auction data (realestate.com.au/domain.com.au), and market alerting (boomscore). All three of those are gated on the pending NPD data licensing — flagging so they're prioritized once that data is available rather than re-scraped.

## 4. Prioritized recommendations (persona-weighted, data-cost aware)

Given the NPD cost model is still pending, split into **no-new-data** (ship now, reuses existing scraped/POC data) vs **needs-licensed-data** (blocked on NPD) buckets:

### Can build now (no new data required)
1. Add `buyer_type` selector to Buy Finder (FHB / Investor / Buyers Agent) that swaps default weights and visible fields — directly closes the biggest persona gap for near-zero data cost.
2. Buyers-agent client-profile save/switch + exportable/shareable Decision Brief (PDF or persisted link) — highest leverage-to-effort ratio identified in this review, and also fixes the "not durable after refresh" limitation `user_journey.md` already flags.
3. Side-by-side suburb/property comparison view (2-5 items) — extends the trade-off scatterplot already recommended in `suggestion.md` §2.3 into a persistent comparison a buyers agent or FHB can screenshot/print.
4. Rent-vs-buy and stamp-duty/LMI calculators for FHBs — pure calculation, no new data source needed beyond published state stamp-duty schedules.
5. Wire a basic watchlist notification (email/in-app) on top of the existing favourites feature — closes the Market Alerts gap without needing new data feeds.

### Blocked / dependent on NPD data licensing
6. Property-level AVM estimate (realestate.com.au/domain.com.au parity) — needs licensed property-level sales/valuation data; do not attempt to approximate with scraped data given the legal caution already raised in `suggestion.md`'s executive summary.
7. Nationwide "rank everything" Hotspot-Finder-style fast browse — technically buildable today on top of Buy Finder, but only trustworthy at scale once suburb coverage/freshness is licensed rather than scraped (ties into the DQ-threshold gating already required in `review_latest_withtest.md`).
8. Auction clearance rate / vendor discount / days-on-market indicators — these are exactly the demand-signal inputs `suggestion.md` §3.1 already wants for the `D` component of BuyFit; prioritize sourcing them from the NPD feed first.

## 5. One-line takeaway per persona
- **First Home Buyer**: currently has no dedicated experience — cheapest, highest-impact fix is a buyer-type toggle plus grant/stamp-duty/LMI calculators.
- **Investor**: best-served persona today, but missing the two things competitors are known for — nationwide fast ranking (boomscore) and live market alerts (boomscore) — plus a portfolio view for repeat investors.
- **Buyers Agent**: completely unserved despite requiring the least new data — client-profile management and exportable reports would open a new user segment almost immediately.
