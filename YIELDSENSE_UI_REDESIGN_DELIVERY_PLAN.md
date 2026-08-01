# YieldSense: World-Class UI Redesign — Delivery Packet

**Status:** Implementation-ready plan for a delivery agent
**Audience:** Autonomous implementation agent + product owner
**Scope:** End-to-end redesign of the YieldSense web experience to a world-class, mobile-first, accessible, conversion-oriented product: design system, app shell & navigation, every major screen, mobile UX, accessibility (WCAG 2.2 AA), performance budgets, monetisation UX, UI pre-mortem, phased implementation, tests & acceptance criteria.
**Hard constraints:**
- Do NOT change backend API contracts (`/api/v3/*`). All redesign work is presentation-layer only, except where explicitly listed in Phase 0 (bug fixes).
- Do NOT remove, hide, reword or demote any compliance element: disclaimers, DQ badges, stale flags, "not lender approval" labels, evidence citations, `insufficient_evidence` states. These are the product (see `YIELDSENSE_AI_SEARCH_DELIVERY_PLAN.md` §2.2 — trust is the moat).
- No new runtime framework dependencies beyond those listed in §8.4. No Tailwind, no CSS-in-JS library, no react-router in this cycle.
**Companion docs:** `YIELDSENSE_AI_SEARCH_DELIVERY_PLAN.md` (backend/search), `user_journey.md`, `ai_search.md`.

---

## Part 0 — Pre-flight decisions (product owner sign-off before Phase 1)

Each decision has a **default**; the implementing agent applies the default if no override is given.

| # | Decision | Options | Default |
|---|---|---|---|
| D1 | Brand unification. Today the title says "PropertyIQ", the landing logo says "PropertyIQ", the in-app header says "YieldSense", the tour says "Real Estate Engine". | (a) Unify on **YieldSense** everywhere, "IQ" mark retained as logo glyph; (b) unify on PropertyIQ | **(a) YieldSense**. "Ask YieldSense" is already the flagship feature name; one brand, one voice. `index.html` title, LandingPage, header, print stylesheet, footer, OnboardingTour copy all updated in Phase 1. |
| D2 | Styling architecture | (a) CSS custom properties + plain component CSS files; (b) Tailwind; (c) CSS-in-JS | **(a)**. Zero new dependencies, matches existing stack, enables runtime theming via tokens. Inline `style={{}}` for cosmetics is deprecated (allowed only for truly dynamic values, e.g. chart dimensions). |
| D3 | Dark mode | Ship now / tokens-ready later | **Tokens-ready later (Phase 5, optional)**. All colors flow through semantic tokens so dark mode is a token-file swap; shipping two themes now doubles QA surface for zero monetisation gain (see F9 pre-mortem). |
| D4 | Navigation model | react-router / state tabs + URL sync | **State tabs + URL query-param sync** (`?view=ask&suburb=…`) — shareable URLs without a router dependency this cycle. Router is a deliberate future step. |
| D5 | Pricing shown on landing | Current landing shows $49/$99/$249; AI plan §2.3 anchors Plus ~$19–29, Investor ~$49, Pro ~$99 | **Align to AI plan §2.3:** Free · Plus $24/mo · Investor $49/mo · Pro $99/mo. Final numbers are a product-owner override (D5-override), but both tiers and anchors must be consistent across landing, paywall and settings. |

---

## Part 1 — Current-State UI Audit (verified 2026-08-01)

This audit is the defect register the redesign must eliminate. Every item is real and file-referenced.

### 1.1 Strengths to preserve

1. **Content depth is already world-class**: verdict panels, evidence tables with true as-of + stale badges, DQ warnings, persona verdicts, follow-up chips, assumptions pills, affordability blocks with labelled assumptions. The redesign's job is to make this *legible*, not to add more data.
2. Solid token *seed* exists in `src/index.css` (`:root` lines 4–22): slate/blue/indigo palette, 3-tier shadow scale, Inter font.
3. Code splitting exists for 8 heavy components (`React.lazy` in `App.tsx:29-37`).
4. Global `:focus-visible` outline exists (`index.css:30-33`).
5. Print stylesheet exists (`index.css:1633-1703`) — buyer's agents print briefs; keep and upgrade it.

### 1.2 Defect register (the "why this redesign" list)

**Design system & consistency**
- U1. ~700 inline `style={{}}` blocks across App (379), AskYieldSense (140), BuyFinder (110), LandingPage (65). No spacing/radius/type/z-index tokens — radii are ad-hoc (4…20px), font sizes 0.62rem–3.5rem inline.
- U2. **Undefined CSS variables in production**: `var(--accent)`, `var(--surface)`, `var(--bg)`, `var(--text)`, `var(--border)`, `var(--text-tertiary)` (PortfolioTab.tsx:81-185, UserFavoritesTab.tsx:32-61, TermsOfUseModal.tsx:37-95, AiMetricTooltip.tsx:46-80, App.tsx:1850,2127) and `var(--radius-md)` (ProfileSectionNav.tsx:63) resolve to *nothing* — PortfolioTab is effectively unstyled.
- U3. **Dark-theme remnants on a light UI**: neon `#00e5ff`, `#00d282`, `rgba(255,255,255,0.05)` glass panels inside AskYieldSense, DecisionBrief, BuyFinder; dark Leaflet popup; CARTO-dark legend card on light map (YieldHeatmap.tsx:90). AskYieldSense's textarea is dark (`rgba(0,0,0,0.2)`) on a white card.
- U4. Dead code: `theme.css` and `App.css` never imported; `OnboardingTour.tsx` never imported; `.old_app_jsx`, `App_old.tsx`, `.panel_a.tsx`, `.rest.tsx`, `.ternary` (68KB) in repo root.
- U5. Brand split (D1) + favicon purple bolt unrelated to palette.

**Mobile**
- U6. No mobile navigation pattern: tab bar just scrolls horizontally; no bottom nav, no drawer; "Tools" is a native `<select>` (App.tsx:689-699).
- U7. Comparison/evidence tables are `overflow-x:auto` + `white-space:nowrap` — pinch-and-scroll tables are the #1 mobile frustration for a data product.
- U8. Touch targets below 44px: zone pills ~24px tall, chips ~28px, tab buttons shrink at 480px.
- U9. School table responsive pattern is broken: CSS expects `td::before { content: attr(data-label) }` (index.css:1583) but the `<td>`s never set `data-label` (App.tsx:2020-2027, 2060-2073) → stacked cards render with empty labels.
- U10. No `safe-area-inset` handling; no sticky primary action on mobile; map overlays mock WMS layers (Iowa State nexrad demo server as "Flood Risk", SuburbMap.tsx:166-186) — must be labelled or removed.

**Accessibility**
- U11. No skip link; no `role="tablist"/tab/tabpanel`; no `aria-current`; no `aria-live` for Ask results/loading/errors; spinner is a bare div.
- U12. Suburb combobox not keyboard-operable (onMouseDown-only rows, App.tsx:807-829); no `role="combobox"`/`aria-activedescendant`.
- U13. Colour-only signals throughout: winner ticks, DQ colours, grade badges, map legend. Focus outline removed on `<summary>` without replacement (App.tsx:1205,1263,1341). School expanders are `<h3 onClick>` — not buttons.
- U14. Emoji-only meaning in headings/buttons; Leaflet emoji divIcon markers have no text alternative.

**Performance**
- U15. Main chunk **~967 KB** (`dist/assets/index-*.js`): leaflet + react-leaflet + vectorgrid + recharts all eagerly bundled although map/chart views are tab-gated. No `manualChunks`. Font loaded via render-blocking Google Fonts `@import` (index.css:1); no preconnect/preload.
- U16. No skeleton loaders (plain-text Suspense fallbacks; border-spinner for Ask), no image strategy (none needed — no `<img>`), no bundle budget enforced.

**Conversion & trust**
- U17. Landing: pricing uses undefined var background (LandingPage.tsx:109), dead `href="#"` footer links, no product imagery, no sample-brief preview (the strongest sales artifact), no social proof, pricing tiers contradict AI plan §2.3.
- U18. No paywall/upgrade UX at all despite freemium model (5 free briefs/mo); no usage meter; no shareable-brief upsell for agents.
- U19. Loading and empty states are an afterthought (no first-run empty state for Ask — just a bare form; no illustrations; no "what you get" preview).

---

## Part 2 — Design Principles (the "world-class" bar)

These principles govern every screen decision. They are testable, not aspirational.

1. **Trust is the aesthetic.** Every data point visibly carries provenance (source, as-of, quality). Design makes honesty *beautiful*: DQ badges, stale flags, citation chips and disclaimers are first-class styled components — never muted, never below the fold. *Test: a first-time user can answer "where does this number come from?" in one tap on any metric.*
2. **One job per screen.** Each view answers one question: Ask = "research this", Buy Finder = "rank for me", Brief = "decide", Cashflow = "model money", Portfolio = "track". Anything not serving the job is demoted or removed. *Test: 5-second test — users can state the page's purpose from a screenshot.*
3. **Progressive disclosure.** Summary → explanation → evidence. No screen shows more than ~7±2 primary elements before interaction. Every depth layer is one tap away, never cluttered by default.
4. **Mobile-first, literally.** Layouts, tables and maps are designed at 360×800 first, then enhanced. No desktop pattern (hover, multi-column density, wide tables) may ship without a designed mobile equivalent.
5. **Speed is a feature.** Perceived performance via skeletons and instant nav feedback; real performance via the budgets in Part 8. *A data product that feels slow feels untrustworthy.*
6. **Accessible by default (WCAG 2.2 AA).** Keyboard-complete, screen-reader-complete, contrast-passing, no colour-only meaning. Accessibility work is not a phase — it is an acceptance criterion on every component.
7. **Restraint with delight.** One brand accent scale, consistent 8px rhythm, max 2 typefaces (we use 1), motion ≤ 250ms and purposeful (state changes, never decoration), emoji removed from UI chrome (kept only where they carry persona meaning in content, with text labels).
8. **Sell the outcome, not the data.** Marketing and paywall surfaces show the *decision artifact* (a real sample brief) — "see exactly what you'll get" — because §2.2 of the AI plan proves the artifact is the moat.

---

## Part 3 — Design System ("YieldSense DS v1")

### 3.1 Token architecture (three tiers)

`src/styles/tokens.css` — **primitive → semantic → component** tiers. All color usage must reference semantic tokens; component styles reference component tokens.

**Tier 1 — Primitives** (raw scales; never used directly by components):

```css
:root {
  /* Slate */
  --slate-50:#F8FAFC; --slate-100:#F1F5F9; --slate-200:#E2E8F0; --slate-300:#CBD5E1;
  --slate-400:#94A3B8; --slate-500:#64748B; --slate-600:#475569; --slate-700:#334155;
  --slate-800:#1E293B; --slate-900:#0F172A;
  /* Brand blue (primary) */
  --blue-50:#F0F9FF; --blue-100:#E0F2FE; --blue-500:#0EA5E9; --blue-600:#0284C7;
  --blue-700:#0369A1; --blue-800:#075985;
  /* Indigo (secondary) */
  --indigo-100:#E0E7FF; --indigo-600:#4F46E5; --indigo-700:#4338CA; --indigo-800:#3730A3;
  /* Semantic hues */
  --emerald-50:#ECFDF5; --emerald-100:#D1FAE5; --emerald-600:#059669; --emerald-700:#047857;
  --amber-50:#FFFBEB;  --amber-100:#FEF3C7;  --amber-600:#D97706;  --amber-700:#B45309;
  --red-50:#FEF2F2;    --red-100:#FEE2E2;    --red-600:#DC2626;    --red-700:#B91C1C;
}
```

**Tier 2 — Semantic** (meaning; light theme values; dark-ready):

```css
:root {
  --bg-app: var(--slate-100);        --bg-surface: #FFFFFF;
  --bg-surface-raised: #FFFFFF;      --bg-surface-sunken: var(--slate-50);
  --bg-brand-subtle: var(--blue-50); --bg-brand: var(--blue-600); --bg-brand-hover: var(--blue-700);
  --text-1: var(--slate-900); --text-2: var(--slate-700); --text-3: var(--slate-500);
  --text-on-brand: #FFFFFF;
  --border-1: var(--slate-200); --border-2: var(--slate-300); --border-focus: var(--blue-600);
  /* Status — each with surface + text + icon triple, never colour-alone */
  --status-success-bg: var(--emerald-50); --status-success-text: var(--emerald-700); --status-success-border:#A7F3D0;
  --status-warning-bg: var(--amber-50);   --status-warning-text: var(--amber-700);   --status-warning-border:#FDE68A;
  --status-danger-bg:  var(--red-50);     --status-danger-text:  var(--red-700);     --status-danger-border:#FECACA;
  --status-info-bg:    var(--blue-50);    --status-info-text:    var(--blue-700);    --status-info-border:#BAE6FD;
  /* Evidence/DQ semantics (mapped from existing Evidence: High/Medium/Limited/Unavailable) */
  --dq-high-bg: var(--emerald-50); --dq-high-text: var(--emerald-700);
  --dq-medium-bg: var(--blue-50);  --dq-medium-text: var(--blue-700);
  --dq-limited-bg: var(--amber-50); --dq-limited-text: var(--amber-700);
  --dq-unavailable-bg: var(--slate-100); --dq-unavailable-text: var(--slate-500);
}
```

**Tier 3 — Spacing / radius / type / elevation / motion / z-index:**

```css
:root {
  /* 4px base scale */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
  /* Radius */
  --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-xl:24px; --radius-full:999px;
  /* Type scale — 1.25 ratio, fluid headings via clamp() */
  --font-sans:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  --text-xs:0.75rem; --text-sm:0.875rem; --text-base:1rem; --text-lg:1.125rem;
  --text-xl:1.25rem; --text-2xl:1.5rem;
  --text-3xl:clamp(1.75rem,1.4rem+1.5vw,2.25rem);
  --text-4xl:clamp(2.1rem,1.6rem+2.5vw,3rem);
  --leading-tight:1.25; --leading-normal:1.5; --leading-relaxed:1.65;
  /* Elevation */
  --shadow-1:0 1px 2px rgba(15,23,42,.05);
  --shadow-2:0 4px 6px -1px rgba(15,23,42,.08),0 2px 4px -2px rgba(15,23,42,.06);
  --shadow-3:0 10px 15px -3px rgba(15,23,42,.10),0 4px 6px -4px rgba(15,23,42,.06);
  --shadow-4:0 20px 25px -5px rgba(15,23,42,.10),0 8px 10px -6px rgba(15,23,42,.05);
  /* Motion */
  --dur-fast:120ms; --dur-med:200ms; --dur-slow:300ms;
  --ease-standard:cubic-bezier(.2,0,0,1); --ease-emphasized:cubic-bezier(.3,0,.2,1);
  /* Z-index scale — the ONLY allowed stacking values */
  --z-base:0; --z-sticky:10; --z-overlay:100; --z-sheet:200; --z-modal:300; --z-toast:400; --z-tooltip:500;
}
```

**Breakpoint tokens** (documented in tokens.css header comment; CSS custom properties can't be used in media queries, so the *values* are canonical here and used literally):
`--bp-sm: 480px` · `--bp-md: 768px` · `--bp-lg: 1024px` · `--bp-xl: 1440px`. Mobile-first: base styles target 320–479px; enhance at each breakpoint.

**Legacy mapping (Phase 0 must-do):** keep the old names as aliases during migration so nothing breaks mid-flight — `--bg-dark→--bg-app`, `--bg-card→--bg-surface`, `--border-glass→--border-1`, `--text-primary→--text-1`, `--text-secondary→--text-2`, `--text-muted→--text-3`, `--accent-cyan→--bg-brand`, `--accent-purple→--indigo-700`, `--success/--warning/--danger→semantic status tokens`, `--shadow-sm/md/lg→--shadow-1/2/3`. Then **add every missing var referenced in U2** (`--accent`, `--surface`, `--bg`, `--text`, `--border`, `--text-tertiary`, `--radius-md`) mapped to real values, and delete usages file-by-file in Phases 1–4. A CI lint rule (§12.1 T-perf) fails the build on any *undefined* `var(--…)` reference.

### 3.2 Core primitives (`src/components/ui/`)

New folder of unopinionated, fully accessible primitives. Each ships with: component + CSS file + unit test + Storybook-style demo section on a hidden `/dev/ui` view (state-gated, dev-only flag — no router, so a `?dev=ui` query param renders the catalog).

| Primitive | Notes |
|---|---|
| `Button` | variants: primary/secondary/ghost/danger; sizes sm(32px)/md(40px)/lg(48px); loading state with spinner + label retention; full-width option for mobile |
| `Card` | surface + padding scale + optional hover elevation; `Card.Header/Body/Footer` |
| `Badge` | status variants (success/warning/danger/info/neutral) — **icon + text always** (kills colour-only signals); includes `DQBadge` mapping High/Medium/Limited/Unavailable and `StaleBadge` |
| `Chip` | filter/follow-up chip; min-height 40px on touch; selected state with `aria-pressed` |
| `Tabs` | `role="tablist"/tab/tabpanel`, arrow-key roving, `aria-current`; used by app shell + ProfileSectionNav |
| `Modal` / `Sheet` | focus trap, `aria-modal`, ESC close, scroll-lock; `Sheet` = mobile bottom-sheet variant with safe-area padding (used for mobile filters, disambiguation, paywall) |
| `Skeleton` | text/rect/card variants; shimmer respects `prefers-reduced-motion` |
| `Tooltip` | keyboard-focusable, `aria-describedby`, tap-to-toggle on touch (replaces title-attr and AiMetricTooltip internals) |
| `EmptyState` | icon + headline + body + CTA slot |
| `Toast` | aria-live polite, 4s auto-dismiss, action slot |
| `TextField` / `NumberField` / `Select` / `Slider` / `Toggle` | labelled, error + hint slots, 44px touch targets |
| `Combobox` | full ARIA 1.2 combobox pattern (keyboard nav, `aria-activedescendant`, async loading) — replaces App.tsx suburb search |
| `CitationChip` | `[1]`-style chip expanding an evidence popover (source, as-of, calculation) |
| `Icon` | single SVG icon set (~20 icons, inline stroke icons: search, home, map, chart, brief, wallet, heart, user, menu, close, chevron, check, warn, info, external, share, print, download) — replaces UI-chrome emoji |

**Migration rule:** primitives replace inline-styled equivalents screen-by-screen in Phases 1–4; a screen is "done" only when it contains zero cosmetic inline styles and zero hardcoded hexes (grep-verified).

### 3.3 Typography & iconography rules

- Inter only; load locally (see §8.2 — no render-blocking Google `@import`). Headings: sentence case, weight 600–700; no all-caps below `12px`; eyebrow labels use `--text-xs` + `letter-spacing:.04em` + `--text-3`.
- Emoji: removed from buttons, tabs, headings and badges; replaced by `Icon`. Persona names keep a small icon glyph (SVG), never emoji-only.
- Numeric data uses `font-variant-numeric: tabular-nums` everywhere numbers align (tables, KPI cards).

### 3.4 Motion & interaction standards

- Durations: hover/state `--dur-fast`, panel/sheet `--dur-med`, page transitions `--dur-slow` max; all `@media (prefers-reduced-motion: reduce)` → instant.
- Skeletons (not spinners) for any content area > 300ms expected load; spinners allowed only inside buttons.
- Optimistic nav feedback: tab press shows active state immediately, content streams in.
- No layout shift: skeletons reserve final dimensions; images/charts have fixed aspect ratios (target CLS < 0.05).

---

## Part 4 — Information Architecture & App Shell

### 4.1 Navigation model

**Desktop (≥1024px):** slim left rail (72px icons + labels, collapsible to 56px) OR keep top tab bar — **default: refined top tab bar** to minimise layout churn. Order reflects the money journey:

`Ask ✦` · `Buy Finder` · `Heatmap` · `Suburb Profile` · `Portfolio` · `Saved` · overflow `Tools ▾` (Price Ceiling, Cashflow & Gearing*, Purchase Plan, Calculators) — *hidden for FHB persona, as today.

Rules: real `Tabs` primitive (U11 fix), URL-synced (`?view=`), visible focus, active indicator = 2px brand underline + label weight (not colour alone).

**Mobile (<768px):** **bottom tab bar** (fixed, safe-area-padded, 56px + inset): `Ask` · `Buy Finder` · `Map` · `Saved` · `More` (sheet with Profile/Portfolio/Tools/Settings/Log out). Max 5 destinations, ≥44px targets, label + icon, active = icon + label brand colour. The old horizontally-scrolling tab row is deleted.

**Header (all sizes):** brand mark + name (D1), persona switcher (segmented control on desktop, bottom-sheet selector on mobile), plan/usage pill ("Free · 3 briefs left" → opens upgrade sheet, §9), settings/account menu. Sticky, `--z-sticky`, backdrop blur, `env(safe-area-inset-top)` padded.

### 4.2 Page scaffolding

- `.page` container: `max-width: 1200px; margin-inline: auto; padding-inline: clamp(16px, 4vw, 32px)`. Reading content (briefs, summaries) constrained to `68ch` for legibility; data tables full-width.
- Consistent page header: `PageTitle` (h1, `--text-3xl`) + one-line purpose subtitle (`--text-3`) + primary action slot.
- Breadcrumb not needed (flat IA), but every deep view gets a back affordance on mobile.

### 4.3 Cross-surface continuity (the workflow moat)

The §2.2 "workflow continuity" promise becomes visible: a persistent **context bar** appears under the header whenever a suburb/scenario is active — showing `Suburb · Budget · Persona` chips — and every surface (Ask → Brief → Cashflow) inherits it. Each surface's primary CTA points to the next journey step (as today's handoff buttons do, restyled as the standard `Button` + labelled "Next: …" pattern).

---

## Part 5 — Screen-by-Screen Redesign Specifications

Each spec: **goal → layout → mobile variant → states (loading/empty/error/partial) → monetisation hooks → acceptance notes**. All screens use DS primitives; zero inline cosmetic styles at completion.

### 5.1 Landing / marketing (unauthenticated)

**Goal:** communicate "decisions, not data" in 5 seconds; convert to free signup.
**Structure:**
1. Header: brand, `Log in` (ghost), `Start free` (primary). Sticky, shrinks on scroll.
2. Hero: H1 "Know which suburb fits your money — with evidence, not opinions." Sub: "YieldSense combines 80+ verified suburb metrics with your real borrowing power to produce citation-backed research briefs." Primary CTA `Start free — 5 briefs/mo`, secondary `See a sample brief` (scrolls to §4). Trust bar: "ABS · ACARA · OSM · State Valuer-General · SQM" as text (no fake logos).
3. **Interactive teaser**: a disabled-but-real Ask query box pre-filled with "Compare Kenmore and Indooroopilly for a $2M family home" → click opens the sample brief modal (no auth). This is the product selling itself.
4. Sample brief preview: full-width screenshot-grade render of a real (anonymised, static-fixture) comparison brief — verdict panel, evidence badges, citations visible. Caption: "Every number cited. Every claim bounded."
5. "How it works" 3 steps: Ask in plain English → Evidence-cited brief → Decide with your numbers.
6. Persona cards (5): FHB / Investor / Buyer's Agent / Broker / Developer — each: pain (1 line), artifact (1 line), CTA to pricing anchor.
7. Pricing (D5): Free $0 (5 briefs/mo, suburb profiles) · **Plus $24** (unlimited briefs, saved conversations, cashflow) · **Investor $49** (yield/vacancy suite, portfolio) · **Pro $99** (shareable client briefs, exports, white-label). Most-popular highlight on Plus. Honest line under grid: "Data-quality flags and disclaimers are never paywalled."
8. Comparison strip vs alternatives (from AI plan §2.1): "SQM raw stats $100+/mo · CoreLogic $180+/mo · YieldSense decisions from $24" — factual, non-disparaging.
9. FAQ (5 items: data sources, is-this-advice→no, coverage, cancel anytime, NPG provenance) + footer (working links: Terms, Privacy, Contact, Status).
**Mobile:** single column, hero text 28px+, sticky bottom `Start free` bar after 50% scroll.
**States:** none (static). **Perf:** this page is the LCP-critical surface — no leaflet/recharts on it, system-font-first paint.
**Acceptance:** 5-second test passes ("research briefs with cited evidence for property buyers"); every link resolves; Lighthouse SEO ≥ 95.

### 5.2 Auth (login / register)

- Split layout (form left, value panel right with 3 trust bullets + sample-brief thumbnail); mobile: value panel collapses to one line.
- Register: progressive (email+password → persona pick → optional finance basics). Password strength meter retained, restyled. Consent checkboxes get real labels and error states.
- Errors as inline field errors + `Toast`; `aria-live="assertive"` on error summary. Loading = button spinner, form stays visible (no full-screen swap).

### 5.3 Ask YieldSense (flagship — highest design effort)

**Goal:** the fastest path from question → trustworthy brief, and the clearest display of the evidence chain in the market.
**Layout (desktop):**
1. **Query composer** — the hero of the app. Large card, single textarea with adaptive placeholder ("Ask anything: 'Suburbs in VIC with yield above 4.5% and vacancy under 2%'"), character-count-free, Enter-to-submit (Shift+Enter newline), mic icon removed (no backend), example chips (3, rotating from the golden query set), collapsible "Your numbers" scenario row (budget/deposit/income prefilled from profile, chips not bare inputs). Submit button `Build research brief` keeps label during loading (spinner inside).
2. **Understanding header** (after response): restated understanding card — `query_understood` chips (suburbs, budget, property type, thresholds as "yield ≥ 4.5%" chips) + "Data as of …" + coverage % + `Edit` (re-opens composer prefilled) — fixes F1 in the AI pre-mortem *visually*.
3. **Answer stack** (progressive disclosure):
   a. `headline` (h2) + `research_priority` Badge + DQ Badge per §3.1 semantics.
   b. AI Summary card (`summary`), citations rendered as `CitationChip`s.
   c. **Verdict panel** — restyled as a bordered "verdict card": persona leader chips with weights tooltip, top-3 trade-offs as a labelled list, `framing` copy for balanced/insufficient_overlap.
   d. **Comparison table → responsive data display** (see 5.3a).
   e. Supports / Risks two-column cards (icons + text, not colour-only); Unknowns; Next steps (numbered).
   f. Assumptions pills + affordability block with assumptions and "not lender approval" label (styled, prominent).
   g. Evidence table (collapsed by default, `aria-expanded`, count in toggle).
   h. Follow-up chips (server-provided) + "Ask another" reset.
   i. Disclaimer footer — styled, never smaller than `--text-xs`, never `--text-3` lower-contrast than 4.5:1.
4. **Clarification flow**: disambiguation options as one-click `Chip` buttons in a `Sheet` on mobile / inline card on desktop; free-text clarification kept with `aria-label`; the original question stays visible above.
5. **Discovery results**: ranked cards — rank badge, match score (with icon + label, not colour-only), "why selected" bullets, metric pills, CTA. Guardrail/empty states get `EmptyState` + relax-recovery chips when backend supplies them (graceful client fallback chips today: "expand radius", "remove a filter").
6. **History**: saved conversations list (left rail on desktop, `Sheet` on mobile) — exists in backend (`ask/repository.py`); surface it.
**Mobile:** composer becomes full-width card with sticky submit in keyboard-safe position (`padding-bottom: env(safe-area-inset-bottom)`; `interactive-widget=resizes-content` viewport when supported); answer stack same order; comparison uses 5.3a mobile pattern; follow-ups horizontal-scroll chip row (40px targets).
**States:**
- Loading: **skeleton brief** (headline bar, summary lines, table rows shimmer) + status line "Pulling verified data…" with elapsed seconds >5s → "Still working — this can take up to 20s" + Cancel.
- Error: `EmptyState` danger + retry + "your question is saved" reassurance.
- `insufficient_evidence` / `degraded`: dedicated status banners (info/warning Badge + explanation + what-still-works list) — a degraded response must still look deliberate, not broken.
- Empty (first run): `EmptyState` with 3 example cards + "What can I ask?" link opening a query-ideas sheet (seeded from Part 5 golden categories).
**Acceptance:** every AI-plan §4.8 presentation requirement rendered; axe clean; conversation history loads; citations expand to evidence row; mobile 360px fully usable without horizontal page scroll.

#### 5.3a Comparison data display — the responsive pattern (critical)

Desktop (≥768px): metric rows × suburb columns, sticky first column, winner = ✓ icon + "Best" text + brand tint, edge column, per-metric explainer sub-row (collapsed to info icon → tooltip), `StaleBadge`/`DQBadge` inline, "not available" as em-dash + tooltip, zebra rows, `tabular-nums`.
Mobile (<768px): **column-snap card pattern** — one card per suburb, horizontally snapping scroll (`scroll-snap-type: x mandatory`), card header = suburb + DQ badge; metrics as labelled rows inside the card; a persistent "Compare by ▾" metric-picker jumps both cards to the same metric; winner indicated per metric row (icon+text). Alternative pure-stacked list is provided at <360px or when `prefers-reduced-motion`. No nowrap-full-width tables on phones. This pattern is reusable for BuyFinder results and evidence tables.

### 5.4 Buy Finder

- Form → **guided 2-step card**: (1) Your money (state, budget, deposit, type) (2) Your priorities (weight sliders as labelled `Slider`s with % readout and a total=100% indicator; investor-only fields gated by persona).
- Results: ranked `BackendResultCard`s → consistent `Card` list: rank, Buyer Fit score dial/badge, serviceability Badge, evidence-confidence Badge, supports/risks preview (2+2, expand for all), CTA row (`Decision Brief →`, `Cashflow →`, `Save ♡`).
- Comparison selection: checkbox on cards → sticky bottom "Compare (2) →" bar → comparison view uses 5.3a pattern.
- States: skeleton cards while ranking; error with retry; empty = "no suburbs match — relax a filter" with one-click relax chips.
- Keep print-to-PDF; restyle print header to brand (D1).

### 5.5 Decision Brief

- Personalized mode: hero card = Fit score (large, tabular) + serviceability pass Badge + evidence-confidence Badge; drivers/risks as two labelled lists; "Responsible next steps" compliance box restyled but visually *prominent* (it's a trust feature, not fine print); broker CTA secondary (never disguised as primary).
- General mode: market snapshot card grid.
- Share/export: `Share brief` (Pro, §9) + `Print/PDF` using upgraded print stylesheet (brand header, evidence appendix, disclaimer page footer).

### 5.6 Cashflow & Gearing

- Two-pane desktop → single column mobile: inputs card (grouped: Property, Loan, Costs; sliders+fields synced) / results card.
- Results: status banner (positive/neutral/negative — icon + text + tint), monthly figure hero (`tabular-nums`, `--text-3xl`), breakdown bar chart (accessible: table alternative toggle), gearing comparison table via 5.3a pattern.
- Every assumption labelled (rate, buffer, term) — trust principle.

### 5.7 Portfolio & Saved

- Rebuild on tokens (fixes U2 completely): property cards with purchase vs current median sparkline (recharts, lazy), equity block (icon + signed value, not colour-only), add-property as `Modal` with validated `TextField`s.
- Empty state: "Track your first property" + CTA. Saved tab: favorites grid with suburb DQ badge + last-viewed date.

### 5.8 Maps (Heatmap + Suburb Profile map)

- **Lazy-load all leaflet code** (§8.2). Full-height map with floating control card (mode toggles as `Tabs`: Yield/Growth · Houses/Units) and a **bottom-sheet results list on mobile** (drag handle, 3 snap points) instead of squint-at-markers.
- Legend: `Card` with labelled swatches (pattern + colour, not colour-only), styled to theme (fixes U3 dark legend).
- Remove or truthfully label demo overlays: Iowa nexrad "Flood Risk" and OpenTopoMap "Bushfire" layers are **demo data** — default-off and labelled "Demo overlay — not Australian hazard data" until a real source ships (this is an honesty/trust defect today).
- Emoji divIcon markers → SVG pin sprites with `aria-label`s; cluster at low zoom; markers ≥ 36px hit area via transparent padding.

### 5.9 Suburb Profile (9-section page)

- `ProfileSectionNav` → sticky sub-tab bar using `Tabs` primitive with horizontal scroll + active pill; sections become routed-in-state (`?view=profile&suburb=…&section=market`) for shareability.
- Fix school table `data-label` defect (U9) via the 5.3a responsive pattern.
- KPI band at top: 4–6 persona-relevant metrics as `MetricCard`s (label, value `tabular-nums`, delta chip, info `Tooltip` with source/as-of).
- AI Insight panel: sentiment/committee tabs restyled to DS; dark remnants removed.

### 5.10 Settings, onboarding & misc

- `OnboardingTour` (driver.js, already a dep): wire it post-register, 4 steps max (Ask → Buy Finder → Brief → Portfolio), skippable, `localStorage` once-seen, mobile-aware (sheet-style tips). Or delete the dep — decide in Phase 1 (default: wire it; it exists and works).
- Settings page (new, minimal): profile numbers (budget/deposit/income), persona, plan & usage (briefs used/limit), upgrade/manage, data & privacy (export/delete per `ai_search.md` retention), theme (D3 — placeholder "coming" if Phase 5 not reached).
- `TermsOfUseModal`, `PromoBanner`, `ShareReport`: rebuild on primitives (fixes more U2).

---

## Part 6 — Mobile-First Specification (applies to every screen)

| Rule | Standard | Test |
|---|---|---|
| Layout | Design at 360×800 first; enhance at 480/768/1024/1440 | visual snapshots at 5 widths |
| Touch targets | ≥ 44×44px (Apple HIG) / 48×48dp recommended; minimum 24px with spacing per WCAG 2.2 AA | automated bounding-box audit (§12.1) |
| Safe areas | `env(safe-area-inset-*)` on header, bottom nav, sheets, sticky CTAs, toasts | iPhone notch sim check |
| Tables | Never horizontal-page-scroll; use 5.3a card pattern or in-card scroll with visible scroll hint + sticky first col | 360px e2e flow |
| Sticky actions | Primary CTA reachable without scrolling on forms (sticky bottom bar above keyboard) | mobile e2e |
| Maps | bottom-sheet results; pinch + one-finger pan (no two-finger trap); gesture-hint first run | manual + e2e |
| Typography | base ≥ 16px inputs (no iOS zoom); line length ≤ 68ch | computed-style audit |
| Network | skeletons by 300ms; retry with backoff on `TypeError: Failed to fetch`; offline banner via `navigator.onLine` | throttled e2e (Slow 4G) |
| Performance | see Part 8 budgets — measured on Moto-G-class throttling | Lighthouse mobile |
| Keyboard | composer/submit stays visible with virtual keyboard (`interactive-widget`) | device sim |

**Mobile nav summary:** bottom tab bar (Ask · Buy Finder · Map · Saved · More), 56px + safe-area, icon+label; persona switch + settings inside `More` sheet.

---

## Part 7 — Accessibility Specification (WCAG 2.2 AA)

1. **Structure:** one h1 per view; landmarks `header/nav/main/footer`; skip-to-content link (first focusable, visible on focus).
2. **Navigation:** `Tabs` pattern everywhere (roving tabindex, arrows, Home/End); `aria-current="page"` on active; bottom nav is a labelled `nav`.
3. **Forms:** every control has a programmatic label; errors linked via `aria-describedby` + error summary `aria-live="assertive"`; no placeholder-as-label.
4. **Dynamic content:** Ask response region `aria-live="polite"` with `aria-busy` during load; route/view changes announce via visually-hidden live region ("Buy Finder loaded"); toasts polite.
5. **Combobox:** full ARIA 1.2 pattern for suburb search (U12).
6. **Colour & contrast:** text ≥ 4.5:1, large text/UI ≥ 3:1 — verified by automated audit; status = icon + text + tint (U13); focus indicator 2px `--border-focus` + never removed without replacement (U13 `<summary>` fix).
7. **Touch targets:** ≥ 24×24 CSS px minimum with adequate spacing (AA 2.2), 44px design target.
8. **Motion:** `prefers-reduced-motion` → disable shimmer, snap-scroll animations, clock animation.
9. **Maps:** keyboard-operable pan/zoom (Leaflet supports; verify + document); markers have text alternatives; map regions `role="application"` with instructions; all map data available in the adjacent list (sheet) for non-visual users.
10. **Charts:** every recharts chart has a "View as table" toggle rendering the same data in a real `<table>`.
11. **Emoji:** never sole carrier of meaning (U14); decorative emoji get `aria-hidden`.

---

## Part 8 — Performance Engineering

### 8.1 Budgets (enforced in CI, §12.1)

| Metric | Budget (mobile, Moto G power / Slow 4G) | Budget (desktop) |
|---|---|---|
| Main JS chunk (gzip) | ≤ 200KB initial route | ≤ 250KB |
| Total JS first load (gzip) | ≤ 450KB (incl. lazy routes excluded) | ≤ 500KB |
| LCP | ≤ 2.5s | ≤ 1.8s |
| INP | ≤ 200ms | ≤ 200ms |
| CLS | ≤ 0.05 | ≤ 0.05 |
| Lighthouse Performance | ≥ 78 mobile / ≥ 95 desktop | — |
| Lighthouse A11y / Best Practices / SEO | 100 / 100 / ≥95 (landing) | — |
| Time to interactive Ask answer | P95 API-bound; UI must skeleton ≤ 300ms | — |

### 8.2 Concrete work

1. **Route/view-level splitting:** lazy-load `SuburbMap`, `YieldHeatmap`, `VectorGridLayer`, `SchoolZonesLayer`, `PocketRiskMap` (leaflet stack) and every recharts consumer behind view boundaries; `vite.config.ts` `manualChunks`: `vendor-react`, `vendor-leaflet`, `vendor-recharts`.
2. **Fonts:** self-host Inter (woff2, weights 400/500/600/700) in `public/fonts`, `@font-face` with `font-display:swap`, `<link rel="preload">` the 400/600 files, delete the render-blocking Google `@import`. Fallback stack renders instantly.
3. **Skeletons** replace all spinners/text fallbacks (Suspense fallbacks included).
4. **React hygiene:** memoize comparison table rows & verdict panel (they re-render on keystrokes today via parent state); `useDeferredValue` for combobox filtering; avoid state-in-parent for composer.
5. **HTTP:** leverage existing nginx gzip + immutable-safe caching (already fixed); add `Cache-Control` audit to CI (hashed assets 1h+revalidate is current policy — keep; index.html no-store — keep).
6. **Bundle watch:** `vite build --report` artifact + size gate in CI (fail if initial chunk exceeds budget by >10%).
7. No `<img>` needed; keep icons as inline SVG sprite (`icons.svg` exists — extend it).

### 8.3 Allowed dependency additions

- `axe-core` + `@axe-core/playwright` (dev), `@playwright/test` (dev), `lighthouse` + `chrome-launcher` (dev, CI audits), `focus-trap` (runtime, 3KB — Modal/Sheet), `@fontsource-variable/inter` *or* downloaded woff2 (assets, no runtime).
- Nothing else without product-owner sign-off.

---

## Part 9 — Monetisation & Conversion UX (why users pay)

The UI must continuously answer "why is this worth paying for?" — per AI plan §2.2/§2.3.

1. **The artifact sells itself:** sample brief on landing (5.1), and every free brief ends with a tasteful "Share this brief — Pro" line (agents) or "Model the cashflow — Plus" (contextual next-step upsell, *never* blocking content).
2. **Usage meter:** header pill "Free · 3 of 5 briefs left"; at 0 → upgrade `Sheet` (not a dead end): shows exactly which features unlock, monthly/annual toggle (annual −20%), `Start Plus` CTA. Free users keep read access to past briefs forever (trust).
3. **Paywall rules:** gate *workflow & volume* features (unlimited briefs, saved conversations, share links, exports, multi-scenario, portfolio >3 properties) — **never** gate honesty features (DQ flags, stale badges, disclaimers, citations). Paywall copy states this explicitly; it's a differentiator.
4. **Upgrade moments (contextual, max 1 per session):** after 3rd brief (volume), on share-click (Pro), on cashflow handoff (Plus), on export/print (Pro). Each is a `Sheet` with the artifact preview behind it.
5. **Pricing page/section:** D5 tiers, feature matrix with checkmarks, monthly/annual toggle, "cancel anytime", FAQ. All links functional.
6. **Trust badges as conversion:** "Every number cited · True data vintage · Not financial advice" strip under paywall CTA — honesty converts.
7. **Onboarding value moment:** first-run user should reach their first brief in ≤ 2 minutes (Ask pre-filled example → result). Measure funnel: signup → first brief → 3rd brief → upgrade.
8. **Buyer's-agent flow:** shareable brief link (backend exists per `ai_search.md`) gets a proper share modal (copy link, expiry note, white-label teaser for Pro).

---

## Part 10 — UI Pre-Mortem (it is March 2027 and the redesign failed — why?)

Ranked by blast radius. Scenario → root cause → mitigation (built into this plan) → detection.

### F1. The redesign buries the trust signals
**Scenario:** a "clean, minimal" redesign moves disclaimers to fine print, DQ badges to tooltips, citations behind menus. Engagement rises… and a compliance screenshot goes viral; the "trust is the product" moat evaporates.
**Root cause:** aesthetic goals overriding the honesty contract.
**Mitigation:** Hard constraint at top of this packet; `TrustAudit` test (§12.1 T-trust) asserts disclaimer/DQ/citation presence + minimum font/contrast on every brief fixture render; design review sign-off checklist.
**Detection:** automated trust test failures; sampled UX audits; support tickets "where's the source?".

### F2. Mobile tables ship as scroll-traps anyway
**Scenario:** deadline pressure → comparison/evidence tables launch as nowrap scroll boxes on phones; 60% of traffic is mobile; reviews say "unusable data app".
**Root cause:** desktop-first implementation habit.
**Mitigation:** 5.3a pattern is a *named, speced* component with its own tests (snapshot at 360/768/1440); release gate G4 requires mobile e2e comparison flow; horizontal-page-scroll detector in CI (asserts `document.documentElement.scrollWidth <= innerWidth+1` on golden views).
**Detection:** CI scroll-width assertion; mobile-session rage-tap metrics.

### F3. Performance regresses behind the pretty UI
**Scenario:** new shadows/blurs/fonts + still-eager leaflet → LCP 4.5s on 4G; bounce doubles; "slow = untrustworthy" for a data product.
**Mitigation:** Part 8 budgets as CI gates (bundle size + Lighthouse); lazy map/chart splitting is Phase 0 work, not optional; skeletons everywhere.
**Detection:** Lighthouse CI trend; bundle-size gate; real-user LCP/INP when analytics ships.

### F4. Accessibility theatre
**Scenario:** team demos keyboard once on desktop Chrome; ships with broken combobox, focus-removed summaries, colour-only badges; a WCAG complaint or lost enterprise deal follows.
**Mitigation:** a11y acceptance per component (Part 7) enforced by axe tests in CI + manual keyboard golden path (§12.2); focus-visible regression test.
**Detection:** axe CI failures; quarterly manual audit with NVDA/VoiceOver.

### F5. Paywall kills activation
**Scenario:** aggressive gating (brief #2 paywalled, past briefs locked) → free users churn before seeing value; word-of-mouth dies.
**Root cause:** monetising scarcity instead of workflow.
**Mitigation:** §9 rules (5 free briefs, past briefs always readable, honesty never gated, max 1 upsell/session); funnel instrumentation on signup→brief→upgrade.
**Detection:** activation rate (first brief ≤ 2 min), free→Plus conversion, churn interviews.

### F6. The redesign breaks the backend contract silently
**Scenario:** "harmless" frontend refactor drops `conversation_id` (this exact bug exists today — AskYieldSense.tsx:344-349 builds `body` then sends `JSON.stringify({question})`), or renames a field; multi-turn quietly dies in production.
**Mitigation:** Phase 0 contract tests: MSW-mocked golden API fixtures + component tests asserting request payloads; no-API-change constraint; the conversation_id bug is Phase 0 P0.
**Detection:** request-payload unit tests; e2e multi-turn test (K-section golden flows).

### F7. Brand split persists
**Scenario:** landing says PropertyIQ, header says YieldSense, emails say IQ — users suspect a scam clone; support burns time.
**Mitigation:** D1 decided pre-Phase 1; a `brand` grep test in CI fails on forbidden legacy strings in user-visible copy.
**Detection:** CI grep; copy review checklist.

### F8. Migration half-done: zombie hybrid UI
**Scenario:** tokens + primitives land on Ask and Buy Finder, but Portfolio/profile keep undefined vars and dark remnants; the app looks *less* credible than before — polished next to broken.
**Mitigation:** phased per-screen "done" definition (zero inline cosmetic styles, zero undefined vars, zero hardcoded hexes — grep-verified per screen); undefined-var build error (§3.1); per-screen checklist tracked in the phase exit criteria, not vibes.
**Detection:** oxlint custom rules + grep gates per screen; visual review.

### F9. Dark mode rushed → double QA, half-broken
**Scenario:** someone ships dark mode mid-redesign; every screen now has 2× states; contrast bugs multiply; nothing ships on time.
**Mitigation:** D3 — tokens-ready, theme later; if approved in Phase 5, it ships with its own axe + contrast pass.
**Detection:** scope discipline; phase gates.

### F10. Motion/skeleton chaos
**Scenario:** shimmer on everything, 500ms easings, CLS spikes from unsized skeletons; app feels *slower* despite faster loads.
**Mitigation:** §3.4 motion standards + skeletons reserve final dimensions; reduced-motion media query; CLS budget 0.05 enforced.
**Detection:** Lighthouse CLS; reduced-motion snapshot tests.

### F11. Map overlays imply data we don't have
**Scenario:** a user makes a purchase decision influenced by the "Flood Risk" layer — which is an Iowa weather demo. Legal/trust catastrophe.
**Mitigation:** 5.8 removes/labels demo overlays (Phase 4, P0-trust); overlay registry requires `source` + `as_of` before display.
**Detection:** overlay source audit test; trust review.

### F12. Redesign ships without measurement → no learning loop
**Scenario:** no funnel metrics, no before/after; six months later nobody knows if the redesign worked.
**Mitigation:** §9.7 funnel events + Part 8 budgets from day one (lightweight, privacy-safe: first-party event log to existing backend, no third-party tracker in this cycle); weekly review alongside AI-plan metrics.
**Detection:** dashboard exists before GA; release notes cite numbers.

---

## Part 11 — Implementation Plan (phased, agent-executable)

**Rules for the agent:** work strictly phase-by-phase; each phase lists files and exit criteria; do not refactor backend; run `npm test`, `npm run lint`, `npm run build` before marking any phase complete; keep `YIELDSENSE_AI_SEARCH_DELIVERY_PLAN.md` contracts intact.

### Phase 0 — Foundations, bug fixes & hygiene (0.5 wk)

1. **P0 bugs:**
   - Fix multi-turn drop: `AskYieldSense.tsx` `callQuery` sends the constructed `body` (including `conversation_id`) instead of `JSON.stringify({question: q})` (lines 344–349).
   - Remove frontend dead parsers from the primary path (plan-mandated deletion): `detectIntent`, `KNOWN_SUBURBS`, `parseBudget`, and frontend `METRIC_EXPLAINERS` (server owns explainers). Keep a single network-failure path: show error state, not a divergent local parse. (Aligns with AI plan Appendix A deletions.)
   - Fix undefined CSS vars (U2): add legacy aliases + missing vars to tokens; PortfolioTab/UserFavoritesTab/TermsOfUseModal/AiMetricTooltip become visibly styled immediately.
   - Fix school table `data-label`s (U9) or replace with 5.3a pattern if Phase 4 pulls it forward.
   - Label/remove demo map overlays (F11 quick fix: default-off + "Demo" badge).
2. **Tokens & base styles:** create `src/styles/tokens.css` (full Part 3 spec incl. legacy aliases), `src/styles/base.css` (reset, focus, typography, reduced-motion, print preservation), import order in `index.css`; keep existing classes working.
3. **Tooling:** add dev deps (`@playwright/test`, `axe-core`, `@axe-core/playwright`, `lighthouse`, `chrome-launcher`, `focus-trap`); Playwright config (5 viewport projects); axe vitest helper; bundle-size gate script; undefined-var grep gate; `?dev=ui` catalog shell.
4. **Perf quick wins:** lazy-load leaflet stack + recharts consumers; `manualChunks`; self-host Inter + preload; delete Google `@import`.
5. **Cleanup:** delete `theme.css`, `App.css`, `App_old.tsx`, `.old_app_jsx`, `.panel_a.tsx`, `.rest.tsx`, `.ternary`, `App.tsx.backup` (verify git history retains them).
**Exit:** build green; bundle-size gate shows initial JS ≤ budget + 15% headroom trending down; all existing tests pass; multi-turn e2e (follow-up inherits suburbs) passes; PortfolioTab renders styled; maps load only on map views (verify chunk graph).

### Phase 1 — Design system, app shell, landing & auth (1 wk)

1. Build all Part 3.2 primitives + tests + `?dev=ui` catalog entries.
2. App shell: header (D1 brand), desktop tabs via `Tabs`, mobile bottom nav + `More` sheet, persona switcher (segmented/sheet), usage pill (reads existing usage endpoint if available, else static "Free"), skip link, landmarks, view-change announcer, URL sync (`?view=`).
3. Landing redesign (5.1) incl. working pricing (D5), sample-brief modal (static fixture), real footer links (Terms/Privacy reuse TermsOfUseModal content; Contact = mailto; Status optional placeholder page).
4. Auth screens (5.2) + post-register persona step; wire `OnboardingTour` (4 steps, once-seen) or delete dep (default: wire).
5. Brand sweep: title, favicon alignment (recolor bolt to brand or replace with simple "Y" mark), print header, footer, tour copy; CI brand-grep gate.
**Exit:** axe 0 critical/serious on landing/auth/shell; keyboard-only signup→first-brief path passes; Lighthouse landing ≥ 95 perf (it's static) / SEO ≥ 95; visual snapshots at 5 widths; brand-grep clean.

### Phase 2 — Ask YieldSense experience (1.5 wk)

1. Rebuild Ask per 5.3/5.3a on primitives: composer, understanding header, answer stack (headline/priority/DQ, summary with `CitationChip`s, verdict card, comparison 5.3a, supports/risks, unknowns/next steps, assumptions + affordability, evidence table, follow-ups, disclaimer), clarification `Sheet`, discovery cards, history rail/sheet.
2. States: skeleton brief, error, insufficient/degraded banners, first-run `EmptyState` + query-ideas sheet.
3. aria-live result region + `aria-busy`; combobox migration for any suburb inputs; remove all dark remnants & inline styles from this file (target: AskYieldSense.tsx shrinks to composition only; subcomponents under `src/components/ask/`: `QueryComposer`, `UnderstandingHeader`, `AnswerStack`, `VerdictCard`, `ComparisonDisplay`, `EvidenceTable`, `CitationChip` wiring, `FollowUpChips`, `DiscoveryCards`, `ClarificationSheet`, `AskHistory`).
4. Unit tests: payload contract (incl. conversation_id), status-rendering matrix (complete/needs_clarification/insufficient_evidence/degraded), citation expand, follow-up click behaviour; Playwright: golden Ask flow desktop + mobile, clarification disambiguation click, multi-turn inheritance.
**Exit:** AI-plan §4.8 presentation requirements all visually verified; axe clean on all states; 360px flow has zero horizontal page scroll (CI assertion); `TrustAudit` test green; file contains no cosmetic inline styles (grep).

### Phase 3 — Decision surfaces (1 wk)

1. Buy Finder (5.4): guided form, result cards, compare bar, comparison via shared `ComparisonDisplay`.
2. Decision Brief (5.5): hero score card, compliance box, share modal (Pro), print stylesheet v2.
3. Cashflow & Gearing (5.6): grouped inputs, status banner, chart + table toggle.
4. Portfolio & Saved (5.7): token rebuild, cards, add modal, empty states.
5. Settings (5.10) minimal page.
**Exit:** per-screen "done" gates (no inline cosmetics, no undefined vars, axe clean); e2e: buy-finder→brief→cashflow chain desktop+mobile; print PDF visual check.

### Phase 4 — Maps, profile & data viz (1 wk)

1. Maps (5.8): lazy loading verified, themed legend, mobile bottom-sheet results, SVG markers, overlay source registry + demo labels.
2. Suburb Profile (5.9): `Tabs` section nav + URL section sync, KPI MetricCards, school table via 5.3a, AI panel restyle.
3. Charts: recharts theme module (token colours, Inter, tabular-nums) + "view as table" toggle on all charts.
4. MarketCycleClock, ScoreLegend, QuickRoiCalculator, MyPurchasePlan, Calculators, MacroBenchmarkPanel, MarketIndicatorsSection, TechnicalProvenanceSection, SqmHistoricalChart, PriceHistoryChart → DS pass (each is small; batch through primitives).
**Exit:** map tab loads zero leaflet on initial route (chunk graph); mobile map sheet usable with one hand; all charts have table alternatives; per-screen gates green.

### Phase 5 — Monetisation, polish & release (0.5–1 wk + beta)

1. Paywall/upgrade sheets + usage meter wiring (backend usage endpoints per AI plan Phase 5; if not live, ship UI behind `ENABLE_PAYWALL` flag, off by default).
2. Share-brief Pro flow end-to-end.
3. Funnel events (signup, first_brief, third_brief, upgrade_view, upgrade_click, share_click) → first-party endpoint.
4. Optional D3 dark theme (only if explicitly approved): token file + toggle + full axe/contrast re-run.
5. Final sweep: every screen "done" gate, full test matrix (Part 12), Lighthouse CI on key routes, release notes with before/after numbers.
**Exit:** all release gates in §12.2 pass.

**Total: ~4.5–5.5 weeks + beta.** Sequencing note: Phases 1–2 deliver visible transformation (shell + flagship); do not start Phase 3 until Phase 2 exits — depth over breadth (F8).

---

## Part 12 — Test Scenarios & Acceptance Criteria

### 12.1 Test matrix (all automated unless marked manual)

| ID | Layer | Must test | Pass condition |
|---|---|---|---|
| T-unit | Primitives (`src/components/ui/*`) | variants, disabled/loading, keyboard, aria attrs | vitest+RTL green; ≥ 90% meaningful branch coverage on primitives |
| T-contract | API payload integrity | Ask composer sends exact schema incl. `conversation_id`; no dropped fields (regression for F6) | MSW-mocked tests assert serialized bodies |
| T-state | Ask status matrix | complete / needs_clarification / insufficient_evidence / degraded / error / loading render correctly | fixture-driven snapshot+role tests |
| T-trust | Honesty contract | disclaimer, DQ badge, stale badge, citations, "not lender approval" present & visible on every brief fixture; contrast of these elements ≥ 4.5:1; never below `--text-xs` | automated on 4 brief fixtures |
| T-a11y | axe (vitest + Playwright) | every primitive, every screen, every state | 0 critical/serious; moderate reviewed & ticketed |
| T-kbd | Keyboard golden path (manual + Playwright) | tab through: skip link → nav → ask → clarify → expand evidence → follow-up → verdict tooltips | completes with visible focus throughout |
| T-combo | Combobox | type, arrow, enter, esc, async results, touch | ARIA-pattern unit tests |
| T-resp | Responsive | snapshots at 320/360/768/1024/1440 for landing, ask-empty, ask-brief, buy-finder, brief, cashflow, profile, heatmap | no horizontal page scroll (programmatic assertion); no overlap/clipping in review |
| T-touch | Touch targets | every interactive element ≥ 24px min (44px design target on primary paths) | automated bounding-box audit script |
| T-perf | Performance | bundle gate + Lighthouse CI on landing + authenticated shell | Part 8 budgets; initial chunk ≤ 200KB gzip |
| T-e2e | Playwright flows | signup→first brief; ask golden flow (desktop+mobile); multi-turn K-flow; buy-finder→brief→cashflow; portfolio add; map sheet; upgrade sheet open/close | green on Chromium + WebKit (mobile Safari engine) |
| T-map | Maps | lazy chunk loads only on map views; overlay registry labels; mobile sheet snap points | chunk-graph assertion + e2e |
| T-print | Print/PDF | brief print stylesheet renders brand header + evidence appendix + disclaimer | visual check (manual) + no console errors |
| T-visual | Visual regression | Playwright screenshot diffs on golden screens | diffs reviewed; threshold ≤ 0.1% for unrelated changes |
| T-copy | Brand/copy | CI grep for legacy brand strings, "PropertyIQ", demo-overlay unlabeled strings | zero matches outside allowlist |
| T-vars | CSS integrity | CI grep: no `var(--…)` reference undefined in loaded stylesheets; no hex literals in component files (tokens only) | zero violations post-Phase-0 (allowlist during migration, shrinking per phase) |
| T-motion | Reduced motion | shimmer/snap disabled under `prefers-reduced-motion` | snapshot + computed-style tests |

### 12.2 Release gates (all must pass before GA)

1. **G1 Contract:** zero failing tests; backend API contracts untouched (only Phase-0 listed fixes); golden backend suite (`backend/tests/eval/test_golden.py` once its fixture bugs are fixed — coordinate with AI plan owner) unaffected.
2. **G2 Accessibility:** axe 0 critical/serious across all screens/states; keyboard golden path manual pass; VoiceOver smoke (Ask flow) + NVDA smoke (Windows if available) — manual, recorded.
3. **G3 Mobile:** 360×800 complete golden flow with zero horizontal page scroll; touch-target audit clean; bottom-nav + sheets verified on iOS Safari simulator and Chrome Android emulator.
4. **G4 Performance:** Part 8 budgets met on landing + authenticated shell; bundle gate green; skeletons on all async surfaces.
5. **G5 Trust:** T-trust green; demo overlays labelled; disclaimers/DQ/citations visually verified per screen (checklist sign-off).
6. **G6 Monetisation:** paywall rules honoured (honesty features ungated — automated test: free-tier fixture still renders DQ/citations/disclaimers); max-1-upsell-per-session rule implemented.
7. **G7 Feature flag:** `ENABLE_PAYWALL` off → zero paywall UI; redesign behind no flag (it's the product), but paywall is.

### 12.3 Product-level acceptance criteria

1. A first-time user can state what YieldSense does and why it's different within 5 seconds on the landing page (moderated, n=5, ≥ 4/5 correct: "evidence-cited property research/decisions").
2. A new user reaches their first completed brief in ≤ 2 minutes from signup (instrumented: median across beta cohort).
3. A first-home buyer, an investor and a buyer's agent each complete their flagship journey (AI plan §2.3) on a **phone** in under 5 minutes, unassisted (moderated, 5/persona pre-GA).
4. Any metric on any screen can be traced to source + as-of within one tap (sampled audit, 20 random metrics).
5. SUS (System Usability Scale) ≥ 80 in the moderated sessions; "I would trust this number" ≥ 4/5 average on the brief screen.
6. Beta funnel: ≥ 40% of new signups complete a first brief; ≥ 25% of those complete a third; upgrade-sheet view→click ≥ 10% (measure, don't gate on exact numbers for v1 — but report weekly).
7. Zero accessibility criticals and zero trust-test failures in production for the beta window.

---

## Appendix A — Files the agent will touch

**New:**
`src/styles/tokens.css`, `src/styles/base.css`,
`src/components/ui/{Button,Card,Badge,Chip,Tabs,Modal,Sheet,Skeleton,Tooltip,EmptyState,Toast,TextField,NumberField,Select,Slider,Toggle,Combobox,CitationChip,Icon}.tsx` (+ `.css` each + `.test.tsx` each),
`src/components/ask/{QueryComposer,UnderstandingHeader,AnswerStack,VerdictCard,ComparisonDisplay,EvidenceTable,FollowUpChips,DiscoveryCards,ClarificationSheet,AskHistory}.tsx`,
`src/components/DevUiCatalog.tsx` (query-param gated),
`tests/e2e/*.spec.ts` (Playwright), `tests/axe.helper.ts`, `tests/msw/*` or fetch-mock helpers,
`scripts/check-css-vars.mjs`, `scripts/check-touch-targets.mjs`, `scripts/bundle-size-gate.mjs`,
`public/fonts/Inter-*.woff2`.

**Modified (major):**
`src/App.tsx` (shell, nav, landing removal → component, URL sync), `src/components/AskYieldSense.tsx` (rebuild as composition), `src/components/LandingPage.tsx`, `src/components/BuyFinder.tsx`, `src/components/DecisionBrief.tsx`, `src/components/CashflowGearing.tsx`, `src/components/PortfolioTab.tsx`, `src/components/UserFavoritesTab.tsx`, `src/components/SuburbMap.tsx`, `src/components/YieldHeatmap.tsx`, `src/components/VectorGridLayer.tsx`, `src/components/PersonaSwitcher.tsx`, `src/components/ProfileSectionNav.tsx`, `src/components/AIInsightPanel.tsx`, `src/components/TermsOfUseModal.tsx`, `src/components/PromoBanner.tsx`, `src/components/OnboardingTour.tsx` (wire or delete), `src/index.css` (slim to imports + legacy bridge), `src/mobile.css` (merge into responsive component styles), `index.html` (fonts, meta, OG tags, D1 title), `vite.config.ts` (manualChunks), `package.json` (dev deps + scripts: `test:e2e`, `test:a11y`, `lhci`).

**Deleted:** `src/theme.css`, `src/App.css`, `src/App.tsx.backup`, repo-root legacy artifacts (`App_old.tsx`, `.old_app_jsx`, `.panel_a.tsx`, `.rest.tsx`, `.ternary`), frontend `detectIntent`/`KNOWN_SUBURBS`/`parseBudget`/`METRIC_EXPLAINERS` (Phase 0), `backend/ask/intent_classifier.py` (AI-plan deletion — coordinate, backend agent owns).

## Appendix B — Component "done" definition (per-screen exit checklist)

A screen is DONE only when all are true and grep-verified:
1. Zero cosmetic inline `style={{}}` (dynamic-value exceptions documented in code comment).
2. Zero hardcoded hex/rgb literals outside tokens.css.
3. Zero undefined `var(--…)` references; zero legacy var names.
4. All interactive elements are DS primitives with labels; targets ≥ 44px primary / ≥ 24px min.
5. States implemented: loading (skeleton), empty, error, partial/degraded (where applicable).
6. axe clean; keyboard path recorded; `aria-live` where async content lands.
7. Snapshot tests at 320/360/768/1024/1440 committed; no horizontal page scroll.
8. Trust elements present and styled (disclaimer/DQ/citations) where data renders.
9. Emoji removed from chrome; icons via `Icon`; charts have table toggle.
10. Unit tests + (for flows) Playwright coverage merged.

## Appendix C — Relationship to other packets

- `YIELDSENSE_AI_SEARCH_DELIVERY_PLAN.md` owns backend truth (intent pipeline, evidence, verdict, policy, provenance). This packet owns **presentation of those contracts** — including making fallback-ladder statuses (`needs_clarification`, `insufficient_evidence`, `degraded`) first-class designed states, and fixing the two frontend-side items that plan mandates (conversation_id wiring, dead-parser deletion). Backend gaps found in the 2026-08-01 verification (fallback rungs 3–5, numeric-claim checker wiring, observability counters, PostGIS discovery, golden set 30/52, NPG adapter, verdict fixture) are **backend follow-ups**, listed here only so they are not lost; they do not block this redesign, but the Ask UI must render correctly both with and without them (graceful `status`-driven states).
- `ai_search.md` P0 security items (ownership, share tokens) remain prerequisites for the share/Pro flows in Phase 5.
- Naming: this packet keeps **YieldSense** per D1; if the product owner overrides to PropertyIQ, it is a label-only change confined to Phase 1's brand sweep.
