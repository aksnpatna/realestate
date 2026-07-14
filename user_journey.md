# Real Estate POC: Buyer Journey README

## What This App Is For

This POC helps a buyer turn a broad property question into a transparent shortlist and a structured decision conversation.

It is designed for a buyer who wants to understand:

1. what price range is sensible to plan around;
2. which suburbs fit their financial situation and stated priorities;
3. why a suburb appeared in the shortlist;
4. what could make the decision go wrong;
5. what information is supported by evidence and what remains uncertain.

The application is a decision-support tool. It is not lender approval, personal financial advice, a property valuation, or a prediction of future property prices.

## The Core Journey

```text
Planning question
  -> Price Ceiling
  -> Personalised Buyer Fit shortlist
  -> Selected suburb Decision Brief
  -> Evidence, risks and AI challenge
  -> Indicative Cashflow follow-up
```

The key design rule is continuity: after a buyer selects a suburb from Buy Finder, the Decision Brief must retain the exact score, affordability result, drivers, risks and assumptions that produced that shortlist result.

## Example Buyer Persona

**Name:** Priya  
**Goal:** Buy a first investment property in Victoria within the next 12 months.  
**Situation:** Has savings for a deposit, a stable salary, an existing monthly debt commitment, and wants reasonable rental yield without stretching serviceability.  
**Decision style:** Wants a shortlist she can explain to a partner or broker, not a black-box recommendation.

## Journey 1: "What Price Should I Plan Around?"

### Priya's question

> I have a deposit. Roughly what purchase price could it support after upfront costs?

### App experience

Priya begins in **Price Ceiling**. She enters:

- deposit amount;
- intended loan-to-value ratio;
- state.

The app presents an **indicative maximum purchase price** and makes the assumptions visible. It does not show a suburb ranking on this screen.

### What the app satisfies

- Gives Priya a simple planning range before she starts comparing locations.
- Makes upfront costs visible rather than treating the full deposit as available for the property price.
- Directs Priya to Buy Finder for a personalised suburb shortlist.

### Important boundary

The Price Ceiling is an estimate for planning. It is not a loan pre-approval and it does not decide which suburb Priya should buy.

## Journey 2: "Which Suburbs Fit My Situation?"

### Priya's question

> Given my income, debt, deposit, risk tolerance and minimum yield, which available suburbs are worth examining first?

### App experience

Priya opens **Buy Finder** and enters the information that affects her shortlist:

- budget and deposit;
- annual income;
- existing monthly debt;
- interest rate and serviceability buffer;
- loan term and purchase-cost allowance;
- state, buyer profile and investment preferences;
- minimum yield and preference weights where relevant.

When she selects **Find suburbs**, the app sends the full request to the backend. The backend produces the deterministic Buyer Fit shortlist.

### What Priya sees for each suburb

- **Buyer Fit score:** a transparent fit measure for her stated inputs, not a future-growth prediction.
- **Serviceability:** whether the estimated repayment is supportable under the stated assumptions.
- **Evidence label:** High, Medium, Limited or Unavailable.
- **Supports:** the strongest factors supporting inclusion.
- **Risks and unknowns:** factors that may weaken the decision or require further checking.
- **View decision:** opens the selected suburb's personalised Decision Brief.

### What the app satisfies

- Uses the same backend rules for every buyer rather than silently reordering results in the browser.
- Considers financial capacity, costs, serviceability, preferences and evidence eligibility together.
- Excludes or clearly identifies suburbs that fail hard requirements such as the selected minimum yield.
- Makes a failed serviceability result visible instead of calling an under-budget property affordable.

### Important boundary

Buyer Fit is a deterministic decision-support score, not advice or a recommendation to buy. The result is only as relevant as Priya's entered assumptions and the available data.

## Journey 3: "Why Is This Suburb On My Shortlist?"

### Priya's question

> This suburb has a Buyer Fit score of 78. What specifically produced that score, and does it still fit my situation after I open the profile?

### App experience

Priya selects **View decision** from the result card. The application:

1. loads the full suburb profile for maps, history and supporting detail;
2. retains the selected backend Buyer Fit result and the assumptions used to create it;
3. opens the **Decision Brief**.

The Decision Brief presents the same personalised Buyer Fit score, serviceability result, drivers, risks, unknowns and evidence label that appeared in the shortlist.

Priya can expand **Based on your latest Buy Finder assumptions** to inspect the assumptions behind the decision.

### What the app satisfies

- Preserves the decision context instead of silently recalculating with generic/default buyer inputs.
- Separates the personalised decision from the broader suburb profile.
- Gives Priya an explanation she can review with a partner, broker or adviser.

### Direct profile visits

If Priya opens a suburb without coming from Buy Finder, the app labels it **General Market Snapshot** and prompts her to run Buy Finder for a personalised decision.

### Important boundary

The current POC uses a client-held shortlist response. The personalised decision persists while Priya stays in the browser session, but it is not currently durable after a full browser refresh. She can rerun Buy Finder to create the decision again.

## Journey 4: "How Strong Is The Information?"

### Priya's question

> Can I trust the information behind this result, or is the result based on sparse or incomplete data?

### App experience

The normal decision view shows a plain-language **Evidence** label:

| Label | Meaning for Priya |
|---|---|
| `Evidence: High` | The result has comparatively strong available coverage for the POC's eligibility rules. |
| `Evidence: Medium` | The result is usable, with some coverage or confidence limitations. |
| `Evidence: Limited` | The result has material gaps and needs extra verification before action. |
| `Evidence: Unavailable` | The app cannot support a dependable evidence-based assessment. |

When Priya needs detail, she expands **Evidence details** to see technical eligibility, data quality, source references and unknowns.

### What the app satisfies

- Keeps engineering terminology out of the primary buyer decision.
- Does not hide uncertainty or missing data.
- Gives a technical reviewer deeper information without making the ordinary buyer journey cryptic.

### Important boundary

Evidence labels describe the POC's available data and eligibility controls. They do not guarantee that a source is complete, current for every field, or appropriate for a specific purchase decision.

## Journey 5: "What Could Go Wrong?"

### Priya's question

> Before I get attached to this suburb, what risks, trade-offs and downside situations should I discuss?

### App experience

The **Decision Brief** highlights risks and unknowns from Buyer Fit. Priya can then open **AI Committee** for a visible challenge layer that considers the available sources and context.

The AI Committee may provide bullish, bearish and planning perspectives. It is not allowed to alter the deterministic Buyer Fit score or rank.

The app can also show a **price-decline scenario** and an **illustrative scenario change** for discussion.

### What the app satisfies

- Encourages Priya to test the decision rather than simply accept a high score.
- Keeps AI commentary separate from the ranking authority.
- Uses scenario language that does not claim an expected return, forecast or calibrated probability.

### Important boundary

AI commentary can be unavailable when evidence is insufficient. An unavailable state is not a positive verdict. Scenarios are illustrative model outputs, not forecasts.

## Journey 6: "Could This Property Work As An Investment?"

### Priya's question

> If I pursue this suburb, what might the property cashflow look like using my own assumptions?

### App experience

From the selected suburb, Priya opens **Cashflow/Gearing**. The tool uses the selected suburb's available price and rent values as convenient starting points, then lets her examine assumptions such as:

- purchase price and deposit;
- rent;
- interest rate;
- ongoing costs;
- tax and depreciation assumptions where shown.

### What the app satisfies

- Connects an indicative cashflow discussion to the suburb Priya actually selected.
- Keeps the financial assumptions explicit and editable.
- Helps Priya prepare better questions for a broker, accountant or financial adviser.

### Important boundary

Cashflow/Gearing is indicative only. Tax, borrowing, rent, expense and depreciation calculations are assumptions, not personal tax, credit or financial advice.

## Journey 7: "What Should I Do Next?"

### Priya's question

> I now have a shortlist and a preferred suburb. What is the responsible next action?

### App experience

The app leaves Priya with a decision brief containing:

- her stated assumptions;
- the strongest supporting factors;
- risks and unknowns to verify;
- evidence status and available detail;
- an indicative cashflow discussion;
- AI questions/challenges where evidence is sufficient.

### Responsible next actions outside the app

Priya should use the result to guide due diligence, not replace it. Typical next actions include:

- obtain lender or broker serviceability assessment;
- inspect actual listings and comparable recent sales;
- obtain strata, building, planning, flood, bushfire and other property-specific checks as relevant;
- verify rents, vacancy, outgoings and condition with local sources;
- obtain legal, tax and financial advice appropriate to her circumstances.

## What A Good Demonstration Looks Like

A presenter can show this complete story in under ten minutes:

1. Enter Priya's planning details in Price Ceiling and explain the indicative limit.
2. Move to Buy Finder and enter income, debt, serviceability and yield assumptions.
3. Run the deterministic shortlist and explain score, serviceability, supports, risks and Evidence label.
4. Select **View decision** for one suburb.
5. Confirm the Buyer Fit score and risks match the selected result.
6. Expand assumptions and Evidence details only when asked.
7. Open AI Committee and explain that it challenges the decision but does not rank suburbs.
8. Show an illustrative scenario and state clearly that it is not a forecast.
9. Open Cashflow/Gearing and identify its assumptions and advice boundary.
10. Close by naming the due diligence actions that remain outside the app.

## Product Promise

The product does not promise to predict the best property. It promises a clearer and more honest starting point:

> Tell us your assumptions, show us what fits, explain why, show what is uncertain, and help us ask better questions before making a real decision.
