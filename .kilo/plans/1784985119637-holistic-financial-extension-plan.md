# Strategic Product Plan: Homeowner Wealth Dashboard (Revised)

## 1. Goal
Extend the Real Estate Engine to solve the "one-time usage and churn" problem by keeping users engaged *after* they purchase a property. 

We will pivot towards a **Homeowner & Investor Wealth Dashboard** focusing on:
1. **Property Portfolio Tracker:** Dynamic equity tracking based on live market data.
2. **Contextual AI Explainer (RAG-lite):** To explain complex metrics dynamically, reducing friction and cognitive load.
3. **Future Integrations (B2B/Partnerships):** Onboarding mortgage brokers and home designers for renovations to monetize the captive homeowner audience.

*Note: Direct financial integrations (Open Banking, Affordability tools) and ASX predictions have been removed to reduce regulatory risk and scope.*

---

## 2. Assumptions & Constraints
| Assumption | Reason |
|------------|--------|
| Focus strictly on Property Equity and Metrics. | Keeps the product focused, avoids AFSL regulatory risks, and targets the core demographic. |
| RAG chatbot back-end: reuse the organization’s existing Slack-app LLM endpoint. | Leverages existing infrastructure. |
| UI framework: React + TypeScript. | Consistency with existing codebase. |
| No changes to authentication flow; new tabs appear after login. | Maintains current security model. |

---

## 3. High-Level Design (Phased Rollout)

### Phase 1: Core Value & Retention (The Equity Dashboard)
*   **Component:** `PortfolioTab`
*   **Location:** Navigation bar (new **My Portfolio** button).
*   **Functionality:** Allows users to "Save" or "Claim" a property. The app uses existing property data models to update the estimated value monthly, showing users their real-time estimated equity.

### Phase 2: AI Metric Explainer & UI Polish (RAG-lite)
*   **Component:** `ContextualExplainer` / `ChatbotWidget`
*   **Location:** Tooltips on complex metrics + persistent floating button.
*   **Functionality:** Uses simple RAG with the existing Slack LLM backend, querying a static set of metric definitions to explain terms like "Clearance Rate" or "Rental Yield" in the context of the currently viewed suburb.

### Phase 3 (Future): Professional Partner Portal
*   **Concept:** Monetization through B2B lead generation.
*   **Functionality:** Once users have equity in their property, surface targeted offers from onboarded **Mortgage Brokers** (for refinancing) and **Home Designers/Builders** (for renovations).

---

## 4. Backend Endpoints (Proposed)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/portfolio` | GET/POST | Manage user's saved properties and retrieve current valuations. |
| `/api/slack-llm` | POST | Proxy to the Slack-app LLM endpoint for RAG queries and metrics explanation. |
| `/api/metrics-docs` | GET | Serves static metric explanations used for RAG vector store. |

---

## 5. Security & Privacy
- All new endpoints use existing `isAuthenticated` middleware.
- LLM calls include only a redacted user-ID; no PII is sent to the LLM (only metric queries).
- API keys stored in `.env` and never committed.

---

## 6. Testing Strategy
| Test Type | Scope |
|-----------|-------|
| Unit | API wrappers, portfolio valuation logic, vector store builder. |
| Integration | End-to-end flow for portfolio saving and Slack LLM proxy. |
| UI | React Testing Library snapshots; Cypress e2e for portfolio management and chatbot interaction. |

---

## 7. Open Questions (Pending Decisions)
1. **Slack LLM Endpoint:** Confirm exact URL, authentication method, and request payload format.
2. **Valuation Data Source:** Confirm we have sufficient historical/current data to provide monthly equity updates for the Portfolio tracker.
3. **Partner Onboarding:** Begin initial discussions on how we will verify and onboard Mortgage Brokers and Designers for Phase 3.