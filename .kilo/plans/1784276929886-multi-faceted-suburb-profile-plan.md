# Multi-Faceted Suburb Profile Plan

**Goal:** Turn the POC from a single Priya decision-support tool into a multi-faceted web serving Priya (first-home-buyer), a Retail Investor, and a Buyer's Agent — clarify the confusing scoring, surface ingested-but-hidden data, fix the scroll/loss-of-focus profile, and add a "where in this suburb / pockets to avoid" layer.

**Parent plan:** `/home/aksai/projects/realestate/.kilo/plans/1784276929886-multi-faceted-suburb-profile-plan.md`

## Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Scoring clarity | Unify + relabel. Keep 3 distinct scores; rename for clarity; add a Score Legend; one-line "what this number means" under each. Do NOT merge into one composite. |
| 2 | Personas | 3: Priya (first-home-buyer), Investor, Buyer's Agent. Persona toggle changes default BuyFinder weights + which profile sections/panels are visible. |
| 3 | Navigation | Sticky section sub-nav with scroll-spy + anchor jumps. Keep single-scroll profile, fix focus-loss via sticky rail. |
| 4 | House search / pockets | Pocket/Street risk layer inside profile. Reuse already-ingested suburb data; approximate pockets via SA1/mesh-block. No live listings integration yet. |
| 5 | Hidden data | Persona-gated reveal. BuyFinder-priyable fields stay minimal; Investor gets market indicators; Buyer's Agent gets full technical set (crime, social housing, subdivision, cadastre, provenance, DQ issues). |
| 6 | Buyer Fit durability | Add durable storage in this plan. Reuse existing `UserModel`/`get_current_user` infra; store saved decision snapshots server-side keyed to user. |
| 7 | Pocket data approach | Suburb + SA1/mesh-block approximation. No new heavy ETL. |

## Current state (from code inspection)

- **Profile UI:** `src/App.tsx` is 1615 lines, renders stacked panels A/B/C/AI with long scroll. Already has sticky sidebar (`a640ae3 heritage commit`).
- **Scores surfaced:** `Growth Score` (header, `_compute_growth_score` at `backend/main.py:718`, hard cap 92), `Buyer Fit` (`backend/buyfinder.py:161`), `DQ` (confidence badge). None have inline "what this means" text — root cause of test-user confusion.
- **Ingested but under-surfaced (`backend/models_v3.py`):** `crime_rate` (only in V3 panel + raw value `main.py:534`), `social_housing_pct` + dwellings (`181-185`), `approved_subdivisions_12m` + `min_approved_subdivision_sqm` (`169-170`), `construction_sqkm`/`greenfield_sqkm`/`brownfield_sqkm` (`173-175`), worship breakdown (`151-158`), shelter/community/retirement (`162-164`), `building_approvals_12m` (`146`), `unemployment_rate` (`145`), `infrastructure_investment` (`147`), cadastral (`189-191`), `abs_sourced_fields` provenance (`195`).
- **Growth Score factors** (`main.py:825`) ARE returned to API but NOT rendered in profile header — a key hidden-data gap causing score confusion.
- **API routes exist:** `/api/suburbs/{id}` (842), `/api/v3/suburbs/{id}` (1659), `/api/osm/boundary` (1800, returns geojson), `/api/suburbs/{id}/decision-brief` (1069), `/api/buy-finder/rank` (1971), `/api/favorites` (1640,1646).
- **Boomscore lessons applied:** (a) headline score with labeled indicator causes — Growth Score already returns factors, just need to surface them; (b) each market indicator shown with trend arrow and "labeled impact" wording; (c) demand-to-supply ratio is Boomscore's anchor — `supply_demand_ratio` is already ingested but not visibly anchored.

## Scope (in / out)

**In scope:**
- Score relabel + inline meaning + Score Legend component.
- Persona switcher (3 personas) wired into App + BuyFinder defaults + profile section visibility.
- Sticky section sub-nav with scroll-spy on the profile view.
- Persona-gated expandable Technical/Provenance sections surfacing the 12 hidden fields with trend + labeled impact.
- Growth Score factors surfaced in profile header as labeled indicator list.
- Persistent Buyer Fit snapshots (server-side, keyed to logged-in user).
- Pocket risk layer: suburb-level + SA1/mesh-block approximation using existing ingested crime, social housing, OSM, cadastral data, surfaced on the existing `SuburbMap`.

**Out of scope (follow-up):**
- Live listings feed integration (REI/REA/OnTheHouse).
- Street-level hazard ETL (flood/bushfire mesh-block ingestion).
- Single composite headline score.
- Mobile redesign beyond existing sticky work.
- Auth/login changes (reuse existing `UserModel`).

## Implementation tasks (ordered)

### Phase 1 — Scoring clarity (low risk, high value)

1. **Backend: expose growth score factor labels** in `/api/suburbs/{id}` and `/api/v3/suburbs/{id}` responses. `_compute_growth_score` already returns `factors` dict — ensure both routes include `growthScoreFactors` with friendly labels per factor (e.g. `{"key":"price_cagr","label":"Price growth (10yr CAGR)","points":12,"max":25,"raw":...}`). Add `demandSupplyRatio` as an explicit anchored indicator (Boomscore-style anchor). File: `backend/main.py` (~530, ~851, ~975, ~1254).
2. **Backend: add labeled score metadata** — new helper returning per-score "what this means" plain-English strings, model_version, and disclaimer text. Used by frontend Score Legend. File: `backend/poc_config.py` or new `backend/score_meta.py`.
3. **Frontend: Score Legend component** — `src/components/ScoreLegend.tsx`. Renders the 3 scores with: name, value, range, one-line definition, "not a forecast" caveat, expandable factor breakdown (uses `growthScoreFactors`). Anchor tooltip "?" on each score in `App.tsx` header.
4. **Frontend: relabel** — `Growth Score` → `Market Momentum` with subtitle `Deterministic momentum, not a price forecast`. `Confidence` → `Data Confidence`. `Buyer Fit` already clear. Update `src/App.tsx` (lines ~688, ~668) and `src/components/DecisionBrief.tsx`. Keep internal ids unchanged to avoid breaking API contracts.

**Validation:** existing tests in `DecisionBrief.test.tsx`, `BuyFinder.test.tsx` must pass; expect snapshot text changes for the relabel. Manually confirm all 3 scores render the legend.

### Phase 2 — Persona system

5. **Shared persona contract** — `src/data/personas.ts`. Defines `PersonaId = 'first_home_buyer' | 'investor' | 'buyers_agent'`. Each entry: `defaultWeights`, `visibleProfileSections`, `showTechnical`, `headlineScore`, `description`. Mirrors `BuyFinderWeights` in `backend/buyfinder.py:23`.
6. **Persona switcher UI** — new `src/components/PersonaSwitcher.tsx` placed in top nav near tab bar (`App.tsx:455`). Persists choice in `localStorage`. On change: updates BuyFinder default weights (passed via existing `financialProfile` prop) and sets a `persona` context value consumed by the profile renderer.
7. **Backend: persona-aware BuyFinder defaults** — extend `/api/buy-finder/rank` (`buyfinder.py:42`) to accept optional `buyer_profile` mapping to persona default weights when client doesn't override. Backward compatible.
8. **Frontend: profile section visibility driven by persona** — wrap each profile section (Panel A/B/C/AI/Technical) with a `isVisibleForPersona` check against `personas.ts`. Buyer's Agent: all on. Investor: market + indicators + risk. Priya: defaults + decision brief. Technical/Provenance gated to `showTechnical`.

**Validation:** new unit test `Personas.test.tsx` checking section visibility per persona; existing `BuyFinder.test.tsx` to confirm default-weight path still works.

### Phase 3 — Hidden data surfacing (persona-gated)

9. **Backend: ensure all 12 hidden fields are in the main `/api/suburbs/{id}` response** with friendly keys. Audit current `main.py` (~489-567) for missing ones: confirm `socialHousingPct`, `publicHousingDwellings`, `communityHousingDwellings`, `approvedSubdivisions12m`, `minApprovedSubdivisionSqm`, `constructionSqkm`, `greenfieldSqkm`, `brownfieldSqkm`, `buildingApprovals12m`, `unemploymentRate`, `cadastralSource`, `cadastralLastSynced`. Add where absent.
10. **Frontend: Technical & Provenance expandable** — new `src/components/TechnicalProvenanceSection.tsx`. Renders a Boomscore-style indicator grid: each field as a card with `label | value | trend arrow | one-line "why it matters"`. Section hidden behind `persona.showTechnical` (Buyer's Agent default-on; others expandable toggle). Includes ABS provenance badges from `abs_sourced_fields`, DQ issues list (already rendered in V3 panel — relocate), cadastral sync date.
11. **Frontend: Market Indicators section (Investor persona priority)** — new `src/components/MarketIndicatorsSection.tsx`. Boomscore-style: anchored demand/supply ratio card + absorption rate proxy (use `house_sold_12m` / `house_stock_on_market`), days on market, auction clearance, vacancy, vendor-discounting proxy (price 12m change trending down), each with trend arrow + labeled impact. Uses only already-ingested fields.

**Validation:** backend test asserting all 12 keys exist in response for an enriched suburb (`backend/tests/test_api.py`). Manual: persona toggle visibly changes which sections render.

### Phase 4 — Sticky section sub-nav (navigation fix)

12. **Frontend: `ProfileSectionNav.tsx`** — sticky horizontal rail with section ids: Overview · Market · People · Infrastructure · Listings · Risk · AI · Technical. Uses IntersectionObserver scroll-spy to highlight active section. Anchor-jumps on click (smooth scroll, respects sticky sidebar header). 
13. **Frontend: refactor `App.tsx` profile block** to assign stable `id`/`data-section` attributes to each existing section block (Panel A→Overview/Market, Panel B→People, infra→Infrastructure, etc.). No structural change to data flow — purely additive anchors + the nav component mounted at top of `main-content` (`App.tsx:609`). Keep all existing rendering intact behind the anchors.

**Validation:** manual scroll test — active section highlight tracks position; clicking nav jumps and does not lose sidebar context. No existing tests should break.

### Phase 5 — Durable Buyer Fit snapshots

14. **Backend: new model `UserDecisionSnapshot`** — `backend/main.py` near `UserFavorite` (132). Columns: `id`, `user_id`, `suburb_id`, `request_meta` (JSON), `result` (JSON), `created_at`, `label`. Migration via existing SQLAlchemy `create_all` startup pattern.
15. **Backend: routes** — `POST /api/buy-finder/snapshots` (store current session result + meta), `GET /api/buy-finder/snapshots` (list user's snapshots by suburb), `GET /api/buy-finder/snapshots/{id}` (load one). All `Depends(get_current_user)`.
16. **Frontend:** in `BuyFinder.tsx` `onSelectResult` handler (App.tsx:1582), after sessionStorage write, also POST snapshot when authenticated. In `App.tsx` profile load path, try loading the most-recent snapshot for the suburb when arriving without a sessionStorage result (fixes refresh loss). Show a "Last decision for this suburb (saved)" note in `DecisionBrief`.

**Validation:** new backend test `test_decision_snapshot.py` covering store/list/load + auth required. Manual: refresh after running BuyFinder — Decision Brief still populates from server.

### Phase 6 — Pocket risk layer (house search guidance)

17. **Backend: SA1/mesh-block boundary fetch** — extend `backend/osm_local.py` (or new `backend/osm_meshblock.py`) to return SA1-level boundaries within a suburb. Source: ABS ASGS 2021 SA1 boundaries via existing OSM/PostGIS or free ABS data file (one-time import). Cluster ingested suburb-level crime and social-housing data onto available SA1s where a mapping exists; otherwise clearly label the layer as "suburb-level approximation" to avoid false street-precision claims. Document the approximation honestly in UI.
18. **Backend: new route `GET /api/suburbs/{id}/pockets`** — returns geojson features with per-SA1 (or suburb) `risk_signals`: crime decile, social_housing cluster flag, construction activity (greenfield/brownfield), cadastral density, with `precision: 'sa1' | 'suburb'` disclosure.
19. **Frontend: `PocketRiskMap.tsx`** — overlays risk heatmaps on the existing `SuburbMap.tsx` (reuses Leaflet). Toggleable layers: Crime · Social Housing · Development Activity · Cadastral Density. Each feature popup shows: signal value, source, last updated, and a clear wording "street-precise only where mesh-block data exists; otherwise suburb approximation." Includes an "Avoid" advisory list panel summarising top-3 risk pockets.
20. **Frontend: integrate into profile** as a new section `Where to look inside {suburb}` placed after Market Indicators. Visible to all personas (Priya benefits from avoid guidance; buyer's agent gets full layer toggles). Doc: explicit disclaimer that this is decision-aiding due-diligence guidance, not a property-level verdict.

**Validation:** backend test `test_pockets.py` asserting geojson structure + precision disclosure. Manual: map renders over suburb boundary from existing `/api/osm/boundary`; toggles update overlay; avoid-list populated.

## Risks & mitigations

- **Score relabel breaks snapshots/tests** — keep internal ids unchanged; only change display strings. Update affected test snapshots in same task.
- **Persona adds UX complexity for Priya** — default persona = first_home_buyer; switcher is a single inline control, not a modal. Priya's default view must be visually unchanged at launch.
- **SA1 data availability sparse for some states** — `precision` field discloses approximations; never claim street-level accuracy where absent. Out-of-clarity is worse than honest approximation.
- **App.tsx is already 1615 lines** — Phase 4 must be additive only (anchors + nav component). Do NOT restructure panels in this plan; that is a separate refactor initiative.
- **Durable snapshots reuse auth** — unauthenticated users continue with sessionStorage path; server path only activates when `get_current_user` resolves.

## Definition of done

- All 3 scores in profile + Decision Brief have inline one-line meanings and access to Score Legend.
- Persona switcher works; switching persona visibly changes BuyFinder default weights and profile section visibility.
- Sticky sub-nav tracks scroll and jumps to sections; sidebar context never lost.
- All 12 previously-hidden data fields render in a Technical/Provenance section for Buyer's Agent, and Market Indicators render for Investor, both with trend + labeled impact.
- Logged-in users retain Buyer Fit decision across browser refresh.
- Pocket risk map renders with toggles + honest precision disclosure + avoid-list.

## Open questions for implementer

- Confirm whether ABS ASGS 2021 SA1 boundary file is already loaded into PostGIS, or whether a one-time download is needed for Phase 6 task 17. Check `backend/data/` and any ASGS migration script before starting Phase 6.
