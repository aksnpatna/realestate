# AI Usage Enhancement Plan

*Base commit hash: f0b09717524934be070fbe772a7722dca93fc8f9*

## Context
- **AI News Sentiment** displayed in the UI (App.tsx / App_old.tsx) shows a score 0‑10 with a label (Bullish/Neutral/Bearish) derived from `backend/ai_agent.py::get_news_sentiment`.
- **AI Investment Committee** (Panel D) runs a multi‑agent LangGraph workflow defined in `backend/ai_agent.py` (`run_investment_committee`). It produces arguments from Bull, Bear, Urban Planner and a final verdict.
- Both features are optional for the user; they are triggered by a button that sets `isAnalyzingAI`.
- The backend has graceful fallback when AI services are unavailable, but UI messages are minimal.

## Goals
1. Make AI‑driven insights more coherent and trustworthy for end‑users looking for a house or investment opportunity.
2. Improve discoverability and clarity of what each AI component does.
3. Reduce unnecessary API calls and improve performance.
4. Provide guidance and documentation for future developers.

## Recommendations
### 1. UI/UX Improvements
- **Unified AI Panel**: Combine Sentiment and Committee into a single expandable section titled **"AI Real‑Estate Insight"** with two tabs: *Sentiment* and *Committee*.
- **Loading Indicator**: Replace the plain text `Analyzing...` with a spinner and show progress messages (e.g., "Fetching news…", "Running Bull analysis…", "Finalising verdict").
- **Tooltips**: Add tooltip icons explaining the score range, how the sentiment is calculated, and what the committee verdict means.
- **Result Summary**: After the committee runs, display a concise one‑sentence summary plus a **"Details"** toggle that expands the full Bull/Bear/Urban arguments and catalysts.
- **Error Handling**: Show user‑friendly alerts when the AI service is unavailable (e.g., "AI analysis temporarily unavailable – please try again later").

### 2. Backend Enhancements
- **Caching Layer**: Store `get_news_sentiment` and `run_investment_committee` results in the DB with a configurable TTL (default 12 h). Add a helper `cache_result(key, func, ttl)` to wrap calls.
- **Sentiment Algorithm Upgrade**: Replace the simple keyword counting with a lightweight sentiment model (e.g., HuggingFace `distilbert-base-uncased-finetuned-sst-2-english`) for more nuanced scores. Keep the fallback to keyword method if the model cannot be loaded.
- **Result Normalisation**: Ensure both sentiment and committee return a **score 0‑10** and a **short label**; expose these through a new `ai_summary` endpoint used by the UI.
- **Graceful Degradation**: If any LLM provider fails, fall back to the next provider but also include a `provider_used` field for transparency.

### 3. Documentation & Developer Guidance
- **README Section**: Add an **AI Usage** section describing the purpose of the sentiment and committee, required environment variables, and caching behavior.
- **Inline Comments**: In `backend/ai_agent.py`, add docstrings to each node function summarising inputs/outputs and failure modes.
- **Feature Flags**: Introduce a config flag `ENABLE_AI_INSIGHTS` (default true) that can be toggled for performance testing.

## High‑Level Implementation Steps
1. **Create UI component** `AIInsightPanel.tsx` that wraps existing sentiment and committee UI, adds tabs, spinner, and tooltips.
2. Refactor `App.tsx` to import and render `AIInsightPanel`.
3. Add caching decorator in `backend/utils.py` (or new file) and apply to `get_news_sentiment` and `run_investment_committee`.
4. Integrate a lightweight sentiment model (add to `requirements.txt`), update `get_news_sentiment` to use it when available.
5. Extend the LangGraph state with `provider_used` and expose through the committee API.
6. Update environment configuration to include `ENABLE_AI_INSIGHTS` flag.
7. Write documentation updates (README, code comments).
8. Add unit tests for the new caching layer and for the fallback provider logic.

## Validation
- **Functional**: Verify UI displays sentiment score, label, and committee verdict correctly for a sample suburb.
- **Performance**: Measure API call count before and after caching (expect >50 % reduction on repeated requests).
- **Reliability**: Simulate LLM provider failure and confirm fallback to the next provider with appropriate UI notice.
- **User Acceptance**: Conduct a quick walkthrough with a stakeholder (house‑hunter) to ensure the insight is clear and actionable.

## Open Questions
- Preferred sentiment model size vs. cold‑start latency in the current deployment environment?
- Should the UI allow the user to manually refresh cached results before TTL expiry?
- Are there regulatory considerations for displaying AI‑generated investment advice that need a disclaimer?

---
*Plan prepared for implementation by an execution‑capable agent.*
