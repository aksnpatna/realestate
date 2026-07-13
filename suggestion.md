The app has a strong base: a real suburb profile, map, affordability/cash-flow tools, historical charts, comparable-suburb clustering, a deterministic growth score, a Monte Carlo risk component, and an AI committee. The main product opportunity is to make the answer to “where should I buy?” decisive, comparable, and inspectable.

At present, the profile view is rich but cognitively busy, and its label “Growth Probability” overstates what the current score represents. The score is a weighted heuristic, not a calibrated probability of an investment outcome. Rename it to Investment Fit Score until it has been back-tested and calibrated.

One important data/legal point: transforming OnTheHouse data does not by itself avoid contractual, copyright, database-right, or access-control restrictions. Whether collection is permitted depends on their terms, the acquisition method, retained fields, use, redistribution, and jurisdiction. Treat scraped data as a non-authoritative signal, keep provenance, minimize retention, avoid publishing raw or reconstructable content, and seek written permission or a licensed feed before production use.

UI And Data Representation

The best improvement is a new first-class Buy Finder tab, placed before the detailed Suburb Profile. It should start with the buyer’s actual constraints:

Purchase budget, deposit, borrowing limit, property type, holding horizon, target state/region.
Goal selection: capital growth, income, first-home affordability, family/livability, or balanced.
Hard exclusions: flood/bushfire exposure, minimum yield, maximum vacancy, commute ceiling, school requirement, no apartments, and data-quality threshold.
Adjustable preferences with visible weights, such as growth 
35
%
35%, income 
25
%
25%, downside risk 
20
%
20%, affordability 
15
%
15%, livability 
5
%
5%.
Return a ranked shortlist, not one opaque winner. Each row should show:

Display	Why it matters
Fit score and rank	The deterministic result for the buyer’s chosen settings
Confidence band	Data completeness, freshness, sample size, and model stability
Expected 3/5-year return range	P10 / P50 / P90, clearly labelled as a model scenario
Downside probability	Probability of a specified decline threshold over the horizon
Affordability and cash flow	Purchase price, deposit, estimated repayments, yield, cash-flow range
Top three drivers	“High yield”, “low vacancy”, “population growth”
Top two risks	“High supply pipeline”, “stale sales data”, “flood overlay”
Evidence freshness	Exact dates and source badges per metric
Use a scatterplot as the primary shortlist visual:

X-axis: affordability or median price.
Y-axis: risk-adjusted expected return.
Bubble size: data confidence.
Colour: buyer-fit score.
Clicking a point opens a compact comparison drawer.
This lets people see trade-offs quickly, rather than treating rank #1 as automatically correct.

For individual suburb profiles, reduce the first viewport to:

“Fit for your goal” verdict.
Price, repayment, yield, expected range, and downside risk.
Three evidence-backed reasons and two risks.
“Compare with alternatives” action.
Move dense demographics, listings, amenities, detailed charts, and AI debate into expandable sections. Show source and last-updated labels directly beside every consequential number, not only in the page header.

The Deterministic “Best Suburb” Model

You already have the beginnings in _compute_growth_score(), risk_engine.py, rank_suburbs.py, and the K-means comparable-suburb feature. Build on that rather than introducing another parallel score.

Create a versioned, user-weighted model:

BuyFit
=
w
g
G
+
w
y
Y
+
w
a
A
+
w
d
D
+
w
l
L
−
w
r
R
−
w
s
S
BuyFit=w 
g
​
 G+w 
y
​
 Y+w 
a
​
 A+w 
d
​
 D+w 
l
​
 L−w 
r
​
 R−w 
s
​
 S
Where:

G
G: growth signal from historical price growth, population/jobs growth, and demand trend.
Y
Y: income signal from sustainable net yield, vacancy, and rent growth.
A
A: affordability from buyer-specific borrowing, deposit, repayment stress, and entry price.
D
D: demand/supply balance from days on market, clearance, stock, approvals, and vacancy.
L
L: livability or family fit from commute, schools, services, and amenity access.
R
R: downside risk from market volatility, mortgage stress, environmental overlays, and concentration.
S
S: supply-pipeline risk from approvals, zoning, and future dwelling density.
Key rules:

Score house and unit markets separately. A suburb can be attractive for houses and weak for units.
Normalize metrics within comparable markets, for example state, metro/regional cohort, property type, and price band. Comparing a $500k regional unit with a $2m Sydney house using the same raw thresholds will mislead.
Put data quality into a separate confidence measure. Do not bury missing-data penalties inside the investment score.
Version every run: model_version, source snapshot date, feature values, weights, and result.
Let users change weights, but show the default and explain the impact of their changes.
Add a sensitivity panel: “This suburb remains top 10 if growth weight changes from 
35
%
35% to 
20
%
20%.” That is much more valuable than a single score.
The current predictive_ai_engine.py should not influence production rankings until refactored: it contains mock infrastructure and environmental events determined from postcode modulo arithmetic. Replace these with authoritative, dated geographic overlays from state planning portals, flood/bushfire agencies, and actual project datasets. Synthetic risk signals in a buying recommendation are a serious trust problem.

Probability And Time-Based Validation

Make probabilities empirical, not LLM-authored.

Define a target before modelling, for example:

“Outperform the state/property-type median total return over 36 months after purchase.”
“Avoid a nominal price decline greater than 
5
%
5% over 24 months.”
“Achieve gross yield greater than 
x
%
x% while vacancy remains below 
y
%
y%.”
Then train a simple, explainable probabilistic model, initially logistic regression or gradient boosting with calibration:

P
(
outperform in 36 months
∣
X
)
P(outperform in 36 months∣X)
Use time-based splits only. For example, train on suburbs as known in 2013-2019, validate on 2020-2022, and test on 2023 onward. Never randomly split time-series suburb data, because that leaks future market conditions into training.

Show:

Predicted probability, such as “
61
%
61% estimated chance of 3-year outperformance.”
Calibration: among prior recommendations around 
60
%
60%, how often did they actually succeed?
Reliability band: “
61
%
±
9
61%±9 points” based on data quality and model uncertainty.
Model scorecard by state, property type, price band, and model version.
A weekly or monthly Model Diary can track each historical recommendation with its original feature snapshot and subsequent outcome. This is the correct way to observe model behaviour over time and earn user trust.

How AI Should Improve

Persisting raw_metrics_payload alongside committee outputs in CommitteeMemory is a good audit start. It is not yet training-quality data.

Do not fine-tune on the current 500 analyses. That would mostly teach a model to reproduce your existing prompts and potentially inaccurate outputs. First build a clean learning dataset:

Immutable analysis ID, model/prompt/provider/version, timestamp, input snapshot hash, sources and source dates.
Structured committee outputs validated with Pydantic or JSON Schema: verdict, evidence IDs, confidence, assumptions, risks, and disallowed claims.
User feedback separated from financial outcome labels. “Helpful” is not the same as “predictively correct.”
Outcome labels at 6, 12, 24, and 36 months, benchmarked against appropriate state and property-type indexes.
Human-review status: unreviewed, verified, incorrect, superseded.
Explicit consent and privacy policy before using individual user inputs for training.
The AI’s role should be explanation and evidence synthesis, not score creation. The flow should be:


Require every AI claim to reference an input field or source excerpt. If it cannot cite an evidence item, it should say it cannot determine the point. Add an insufficient_evidence result rather than forcing Buy/Hold/Pass.

Your current few-shot retrieval uses mostly growth score and yield similarity. Improve it using property type, state/market cohort, price band, vacancy, data recency, and eventually verified outcome quality. Never retrieve analyses that have later been shown to be wrong without clearly marking them as counterexamples.

Also replace regex-dependent parsing with schema-constrained output. The AI response should include confidence, evidence_ids, assumptions, unknowns, and a recommendation limited to informational language.

Pre-Mortem

Assume this product failed. These are the likeliest reasons and fixes:

Failure mode	Early warning	Fix
Users interpret scores as financial advice	“Which suburb should I definitely buy?” and overreliance on #1 rank	Use “fit” and “estimated probability,” expose uncertainty, require a comparison shortlist, and obtain legal review of claims/disclaimers
Scraped source is blocked or challenged	CAPTCHA/rate-limit spikes, legal notice, inconsistent data	Stop relying on transformed scraping as a legal defence; use licensed/official feeds, provenance, retention policy, source kill switch, and counsel review
Ranking looks precise but performs poorly	Weak out-of-time performance, probability calibration error	Back-test by time period, publish scorecards, set a model promotion gate, and roll back weak model versions
AI invents catalysts or omits risks	Claims lack primary-source support	Restrict AI to supplied evidence, enforce source IDs, add citation validation and insufficient_evidence outcomes
Data staleness causes false signals	Sources older than SLA, mismatched timestamps	Metric-level freshness badges, automatic decay in confidence, refresh jobs, and no ranking below a quality threshold
Users are overwhelmed by the dashboard	Low comparison usage, high profile-tab abandonment	Make Buy Finder the default task flow; progressive disclosure for detailed data
Model is biased toward data-rich suburbs	Rankings cluster in well-covered areas	Separate confidence from score, cohort-based normalisation, coverage dashboards, and “not enough evidence” states
Fine-tuning amplifies earlier AI mistakes	Repeated language and unchanged verdict distribution	Do not train on unverified outputs; train only on curated examples plus realised outcomes
Cost/latency of AI grows with users	Cache misses, provider failures, rising API bill	Cache evidence and analysis separately, asynchronous jobs, circuit breakers, provider monitoring, and deterministic fallback summaries
Environmental/planning risk damages trust	Incorrect or mock risk flags discovered by users	Remove mock predictive inputs; use authoritative GIS layers, date them, and show the source and coverage limitations
Recommended Delivery Order

Correct score language, remove mock predictive signals from production, and add metric-level source/freshness/confidence.
Build the Buy Finder shortlist with buyer constraints, transparent weights, and compare mode.
Create the versioned deterministic BuyFit model, property-type cohorts, and sensitivity analysis.
Add empirical probability modelling, time-based backtesting, calibration, and the Model Diary.
Harden AI with structured outputs, evidence citations, confidence/unknowns, and immutable audit records.
Only after sufficient reviewed, outcome-labelled data exists, evaluate whether fine-tuning materially beats the constrained prompting approach.
This sequence makes the app more useful immediately while creating the evidence discipline needed for credible AI later.

