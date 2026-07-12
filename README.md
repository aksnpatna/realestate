# RealEstate Engine — V3

Australian real estate investment analytics platform. Multi-agent AI analysis, ABS government data integration, interactive PostGIS maps, and live suburb dashboards.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | React 19 + TypeScript + Vite + Leaflet + Recharts |
| Backend API | FastAPI + SQLAlchemy + PostGIS |
| AI | LangGraph multi-agent committee + HuggingFace Transformers sentiment |
| Data | PostgreSQL/PostGIS + OSM + ABS Census + ACARA schools |
| Caching | Redis (primary) + DB fallback |
| Infrastructure | Docker Compose (6 containers) |

## Quick Start

```bash
cp .env.example .env   # configure API keys
docker compose up -d    # starts all 6 containers
```

## AI Usage

### AI Insights Panel

The suburb profile has a unified "AI Insights" panel with two analysis modes:

1. **News Sentiment** — Scans live media for market sentiment on a 0-10 scale
   - ≥7: Bullish · 4-6: Neutral · <4: Bearish
   - Uses HuggingFace `distilbert-base-uncased-finetuned-sst-2-english` transformer with keyword fallback
   - Sources: DuckDuckGo (primary), Tavily (fallback)

2. **Investment Committee** — Multi-agent LangGraph pipeline
   - 🐂 Bull Agent (Anna): yield, growth, demand drivers
   - 🐻 Bear Agent (Alex): risk, affordability, macro headwinds
   - 🏙️ Urban Planner: demographics, schools, gentrification
   - 📋 CIO Supervisor: final Buy/Hold/Pass verdict + playbook

### Required Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENABLE_AI_INSIGHTS` | Master kill switch for AI features | `true` |
| `AI_CACHE_TTL` | Cache TTL in seconds (both Redis + DB) | `604800` (7 days) |
| `NVIDIA_API_KEY` | LLM: Llama 3.1 70B via NVIDIA | — |
| `GROQ_API_KEY` | LLM: Llama 3.3 70B via Groq | — |
| `DEEPSEEK_API_KEY` | LLM: DeepSeek Chat | — |
| `OPENAI_API_KEY` | LLM: GPT-4o Mini | — |
| `TAVILY_API_KEY` | Web search (news sentiment + committee) | — |
| `REDIS_HOST` | Redis hostname | `realestate-redis` |
| `AI_CACHE_TTL` | Seconds before AI results expire | `604800` |

LLM providers are tried in priority order: NVIDIA → Groq → DeepSeek → OpenAI → local Ollama.

### Caching Behaviour

Three-layer cache for AI results:

```
Browser → Nginx → API
                    ├── Layer 1: DB cache (SuburbUIV3.news_sentiment / ai_insights)
                    │     TTL: AI_CACHE_TTL seconds. Instant on cache hit.
                    ├── Layer 2: Redis cache (ai_sentiment:{name}:{state} / ai_committee:{suburb}:{state})
                    │     TTL: AI_CACHE_TTL seconds. Falls through on Redis failure.
                    └── Layer 3: Fresh fetch (Tavily → HuggingFace/LLM)
```

**Fallback chain**: Redis failure → function call still works (DB cache + fresh fetch). No single point of failure for AI features.

**Provider transparency**: API responses include `provider_used` (sentiment: `transformers` or `keyword`) and `llm_provider` (committee: `nvidia/llama-3.1-70b`, `groq/llama-3.3-70b`, etc.).

### Disclaimer

**AI-generated insights are for informational purposes only.** Scores and verdicts are statistical models based on publicly available data and media sentiment. They do not constitute financial, investment, or real estate advice. Always consult a qualified professional before making investment decisions. Past performance does not guarantee future results.

## Data Sources

- 70% government: ABS Census, ACARA school rankings, state government open data
- 30% scraped: OnTheHouse property data (transformed, not displayed raw)

## Deployment

```bash
docker compose build realestate backend
docker compose up -d
```

Services: `realestate-engine` (frontend, :8082), `realestate-backend` (API, :8000), `realestate-db` (PostGIS), `realestate-redis`, `realestate-tileserv` (pg_tileserv), `realestate-osm-updater`
