# Singular: End-to-End (E2E) Test Suite Design Document

## 1. Executive Summary & Architecture

Singular is an AI-autonomous cash-flow and treasury engine for solo creators, freelancer engineers, and independent consultants. It smooths volatile invoice payouts into a predictable salary, automates tax reserves, audits expenses, and routes excess capital to tokenized yield-generating instruments (Ondo USDY).

To verify these autonomous capabilities reliably, we have designed a **4-tier opaque-box E2E testing infrastructure**. This infrastructure verifies all interface contracts, system transitions, edge cases, and real-world multi-step user scenarios.

```
                    +------------------------------------+
                    |       testRunner.js (Runner)       |
                    |  - Custom describe/test/expect     |
                    |  - Dynamic module loader / stubs   |
                    +-----------------+------------------+
                                      |
                                      v
                    +------------------------------------+
                    |        e2e.test.js (Suite)         |
                    |  - Registers Tier 1-4 Test Cases   |
                    |  - Orchestrates mock state / steps  |
                    +-----------------+------------------+
                                      |
                                      v
                    +------------------------------------+
                    |         geminiMock.js (AI)         |
                    |  - Returns deterministic mock data |
                    |  - Parses inputs for keywords      |
                    +-----------------+------------------+
```

---

## 2. Test Runner & Mock Design

### 2.1 Custom Test Runner (`tests/e2e/testRunner.js`)
The custom test runner is a lightweight, dependency-free JS execution framework providing:
1. **Assertion Library**: Supports `describe`, `test`, and `expect` with `.toBe`, `.toEqual`, `.toBeGreaterThan`, `.toBeLessThan`, `.toBeTruthy`, `.toBeFalsy`, `.toContain`, and `.toThrow` matchers.
2. **Dynamic Module Loader**: The `loadModule(path, fallback)` function attempts to load active implementation code from `src/`. If the file does not exist (e.g., during early development stages), it imports a functional fallback implementation to prevent execution crashes.
3. **Execution Reporting**: Reports test statuses, displays file line numbers for failures, counts passed/failed tests, and exits with status `0` (success) or `1` (failure).

### 2.2 Gemini API Mock Client (`tests/mocks/geminiMock.js`)
The Gemini Mock provides deterministic, rule-based AI processing matching the interface contracts in `PROJECT.md`. It parses inputs for keywords to decide categories, tax write-offs, bracket shifts, and email tones:
- **Accountant Agent**: Inspects receipt text. Keywords like `uber` classify as `Travel` (eligible write-off); `personal` classifies as ineligible.
- **Tax Advisor Agent**: Uses bracket thresholds ($50k, $100k, $250k) to determine brackets (10%, 22%, 24%, 32%) and computes retroactive adjustments on YTD income.
- **Treasury Agent**: Computes runway based on `(salary_buffer + yield_pool + reserve_floor) / monthly_burn` and handles yield recalls.
- **Invoice Sentinel**: Generates polite draft emails for invoices overdue by >=14 days, and escalated drafts for >=21 days.

---

## 3. Test Cases (4-Tier Design)

### Tier 1: Feature Coverage
Verifies that individual features perform their core functions under standard conditions (>=5 test cases per feature).

#### 1. OmniFlow Routing Engine
* **TEST-T1-OMNI-01: Standard Routing with Room in Salary Buffer**
  - **Goal**: Verify standard splitting of incoming invoice payout.
  - **Inputs**: Deposit = $10,000. Profile: tax rate = 22%, target paycheck = $3,000, reserve floor = $5,000 (fully shored). Current salary buffer = $10,000 (limit is $18,000).
  - **Expected Outcome**: Tax Pool gets $2,200. Salary Buffer gets $7,800 (remaining). Reserve Floor gets $0. Yield Pool gets $0.
  - **Verification**: Verify output allocation matches exactly.
* **TEST-T1-OMNI-02: Shore Up Empty Reserve Floor First**
  - **Goal**: Verify that Reserve Floor is shored up before salary buffer or yield pool get allocations.
  - **Inputs**: Deposit = $8,000. Profile: tax rate = 20%, target paycheck = $3,000, reserve floor = $5,000. Current reserve floor = $2,000. Salary buffer = $5,000.
  - **Expected Outcome**: Reserve Floor gets $3,000. Tax Pool gets $1,600 (20% of deposit). Salary Buffer gets $3,400. Yield Pool gets $0.
  - **Verification**: Assert splits sum to $8,000 and Reserve is shored to $5,000.
* **TEST-T1-OMNI-03: Route to Yield Pool when Salary Buffer is Full**
  - **Goal**: Verify excess cash goes to yield pool.
  - **Inputs**: Deposit = $10,000. Profile: tax rate = 20%, target paycheck = $3,000, reserve floor = $5,000. Current reserve floor = $5,000. Salary buffer = $18,000 (max capacity).
  - **Expected Outcome**: Tax Pool gets $2,000. Salary Buffer gets $0. Reserve Floor gets $0. Yield Pool gets $8,000.
  - **Verification**: Assert $8,000 routed to yield pool.
* **TEST-T1-OMNI-04: Partially Shored Reserve Floor**
  - **Goal**: Verify routing when deposit is only enough to cover part of the reserve deficit and tax.
  - **Inputs**: Deposit = $2,000. Profile: tax rate = 20%, target paycheck = $3,000, reserve floor = $5,000. Current reserve floor = $1,000.
  - **Expected Outcome**: Reserve Floor gets $1,600. Tax Pool gets $400 (20% of deposit). Salary Buffer gets $0. Yield Pool gets $0.
  - **Verification**: Verify Reserve Floor gets max possible up to deficit, tax reservation is maintained.
* **TEST-T1-OMNI-05: Routing with Custom Splits**
  - **Goal**: Verify routing splits are obeyed if custom allocation parameters are specified.
  - **Inputs**: Deposit = $5,000. Profile with custom splits and tax rate 15%.
  - **Expected Outcome**: Splits allocated matching custom profile tax rate.
  - **Verification**: Check allocation proportions.

#### 2. AI Accountant Agent
* **TEST-T1-ACCT-01: Travel Write-Off Classification**
  - **Goal**: Verify a travel receipt is classified as write-off and tax savings calculated.
  - **Inputs**: Raw text: "Uber Ride to Client Office, Amount: $150.00", tax rate = 20%.
  - **Expected Outcome**: `{ amount: 150.00, category: 'Travel', isEligibleWriteoff: true }`.
  - **Verification**: Expect response to be eligible and category to be 'Travel'.
* **TEST-T1-ACCT-02: Meal Write-Off Classification**
  - **Goal**: Verify a business lunch receipt is classified correctly.
  - **Inputs**: Raw text: "Business lunch at Starbucks, $45.00".
  - **Expected Outcome**: `{ amount: 45.00, category: 'Meals & Entertainment', isEligibleWriteoff: true }`.
  - **Verification**: Expect category 'Meals & Entertainment' and eligible write-off.
* **TEST-T1-ACCT-03: Ineligible Expense Classification**
  - **Goal**: Verify personal expenses are rejected.
  - **Inputs**: Raw text: "Personal movie ticket, $15.00".
  - **Expected Outcome**: `{ isEligibleWriteoff: false }`.
  - **Verification**: Assert `isEligibleWriteoff` is false.
* **TEST-T1-ACCT-04: Software write-off (AWS invoice)**
  - **Goal**: Verify SaaS write-off.
  - **Inputs**: Raw text: "AWS hosting bill, $300.00".
  - **Expected Outcome**: `{ category: 'Software & Subscriptions', isEligibleWriteoff: true }`.
  - **Verification**: Assert SaaS category.
* **TEST-T1-ACCT-05: Office supplies write-off**
  - **Goal**: Verify office supply write-off.
  - **Inputs**: Raw text: "Staples printer paper, $50.00".
  - **Expected Outcome**: `{ category: 'Office Supplies', isEligibleWriteoff: true }`.
  - **Verification**: Assert Office Supplies category.

#### 3. AI Tax Advisor Agent
* **TEST-T1-TAX-01: Baseline Income Evaluation**
  - **Goal**: Verify no bracket change or adjustment when income remains low.
  - **Inputs**: YTD Income = $30,000. Profile: tax rate = 10%.
  - **Expected Outcome**: Bracket = 10%, retroactiveAdjustment = $0.
  - **Verification**: Assert bracket stays 10% and adjustment is 0.
* **TEST-T1-TAX-02: Transition from 10% to 22% Bracket**
  - **Goal**: Verify bracket escalation and retroactive tax pool shoring calculations.
  - **Inputs**: YTD Income = $60,000 (crossed $50k). Profile: current tax rate = 10%.
  - **Expected Outcome**: Bracket = 22%, retroactiveAdjustment = $60,000 * (0.22 - 0.10) = $7,200.
  - **Verification**: Assert new bracket is 22% and retroactive amount is $7,200.
* **TEST-T1-TAX-03: Transition from 22% to 24% Bracket**
  - **Goal**: Verify bracket escalation at $100k.
  - **Inputs**: YTD Income = $120,000. Profile: current tax rate = 22%.
  - **Expected Outcome**: Bracket = 24%, retroactiveAdjustment = $120,000 * (0.24 - 0.22) = $2,400.
  - **Verification**: Assert new bracket 24% and retroactive amount $2,400.
* **TEST-T1-TAX-04: Transition from 24% to 32% Bracket**
  - **Goal**: Verify bracket escalation at $250k.
  - **Inputs**: YTD Income = $300,000. Profile: current tax rate = 24%.
  - **Expected Outcome**: Bracket = 32%, retroactiveAdjustment = $300,000 * (0.32 - 0.24) = $24,000.
  - **Verification**: Assert new bracket is 32% and adjustment is $24,000.
* **TEST-T1-TAX-05: Consecutive Deposits in Same Bracket**
  - **Goal**: Verify no retroactive adjustment once new bracket is already established.
  - **Inputs**: YTD Income = $70,000 (already at 22%). Profile: current tax rate = 22%.
  - **Expected Outcome**: Bracket = 22%, retroactiveAdjustment = $0.
  - **Verification**: Assert bracket remains 22% and adjustment is $0.

#### 4. AI Treasury Agent
* **TEST-T1-TRES-01: Healthy Runway Assessment**
  - **Goal**: Verify runway calculation when buffers are full.
  - **Inputs**: Balances: salary_buffer = $18,000, yield_pool = $10,000, reserve_floor = $5,000. Paycheck = $3,000.
  - **Expected Outcome**: Runway = (18000 + 10000 + 5000) / 6000 = 5.5 months. Recall = $0, actionTaken = false.
  - **Verification**: Assert runway is 5.5 and actionTaken is false.
* **TEST-T1-TRES-02: Yield Recall Trigger on Buffer Deficit**
  - **Goal**: Verify that yield is recalled if salary buffer drops below 1 paycheck.
  - **Inputs**: Balances: salary_buffer = $1,000, yield_pool = $5,000. Paycheck = $3,000.
  - **Expected Outcome**: Deficit is $2,000. recallAmount = $2,000, actionTaken = true.
  - **Verification**: Assert recall amount is exactly the deficit ($2,000) and actionTaken is true.
* **TEST-T1-TRES-03: Yield Recall with Partial Funds**
  - **Goal**: Verify recall behavior when yield pool cannot fully cover deficit.
  - **Inputs**: Balances: salary_buffer = $1,000, yield_pool = $1,000. Paycheck = $3,000.
  - **Expected Outcome**: Deficit = $2,000. recallAmount = $1,000 (all available yield), actionTaken = true.
  - **Verification**: Assert recall amount matches total yield pool balance ($1,000).
* **TEST-T1-TRES-04: Yield Recall with Empty Yield Pool**
  - **Goal**: Verify no recall is triggered if yield pool is empty.
  - **Inputs**: Balances: salary_buffer = $1,000, yield_pool = $0. Paycheck = $3,000.
  - **Expected Outcome**: recallAmount = 0, actionTaken = false.
  - **Verification**: Assert actionTaken is false.
* **TEST-T1-TRES-05: Runway Calculation with Zero Balance**
  - **Goal**: Verify runway is 0 when all accounts are empty.
  - **Inputs**: Balances: salary_buffer = $0, yield_pool = $0, reserve_floor = $0. Paycheck = $3,000.
  - **Expected Outcome**: Runway = 0 months.
  - **Verification**: Assert runway is 0.

#### 5. AI Invoice Sentinel
* **TEST-T1-SENT-01: Paid or On-Time Invoice**
  - **Goal**: Verify no action is taken for paid or fresh invoices.
  - **Inputs**: Invoice status = 'paid' or 'unpaid' with overdueDays = 5.
  - **Expected Outcome**: No reminders generated.
  - **Verification**: Assert return array is empty.
* **TEST-T1-SENT-02: Polite Follow-Up at 14 Days**
  - **Goal**: Verify polite draft reminder at 14 days overdue.
  - **Inputs**: Invoice status = 'unpaid', overdueDays = 14, client = "Acme Corp".
  - **Expected Outcome**: Returns draft reminder with polite tone.
  - **Verification**: Assert draft contains polite greeting and client name.
* **TEST-T1-SENT-03: Polite Follow-Up at 17 Days**
  - **Goal**: Verify draft reminder between 14 and 20 days.
  - **Inputs**: Invoice status = 'unpaid', overdueDays = 17.
  - **Expected Outcome**: Polite draft generated.
  - **Verification**: Assert draft generated.
* **TEST-T1-SENT-04: Escalated Follow-Up at 21 Days**
  - **Goal**: Verify escalated draft reminder at 21 days overdue.
  - **Inputs**: Invoice status = 'unpaid', overdueDays = 21, client = "Acme Corp".
  - **Expected Outcome**: Returns draft reminder with urgent/escalated tone.
  - **Verification**: Assert draft contains URGENT subject line.
* **TEST-T1-SENT-05: Escalated Follow-Up at 30 Days**
  - **Goal**: Verify escalated reminder at 30 days overdue.
  - **Inputs**: Invoice status = 'unpaid', overdueDays = 30.
  - **Expected Outcome**: Escalated draft generated.
  - **Verification**: Assert draft is escalated.

#### 6. Demo Simulator
* **TEST-T1-SIM-01: Simulate Invoice Paid ($10k)**
  - **Goal**: Verify event dispatcher routes money and logs event.
  - **Inputs**: Trigger "Invoice Paid ($10k)" event.
  - **Expected Outcome**: State updated (balances updated and routing logs created in `agent_logs`).
  - **Verification**: Check mock database state for updated balances and logs.
* **TEST-T1-SIM-02: Simulate Large Milestone ($25k)**
  - **Goal**: Verify milestone simulation.
  - **Inputs**: Trigger "Large Milestone ($25k)".
  - **Expected Outcome**: State updated with $25k routed.
  - **Verification**: Check balance state increments.
* **TEST-T1-SIM-03: Simulate Receipt Upload ($150)**
  - **Goal**: Verify receipt upload simulation.
  - **Inputs**: Trigger "Receipt ($150)" with text "Uber taxi".
  - **Expected Outcome**: Accountant audits and releases tax reserve.
  - **Verification**: Verify tax pool decreases and salary buffer increases by write-off saving.
* **TEST-T1-SIM-04: Simulate Client Cancellation**
  - **Goal**: Verify dry spell simulation.
  - **Inputs**: Trigger "Client Cancellation".
  - **Expected Outcome**: Future forecasts updated, runway decreases, triggers yield recall if necessary.
  - **Verification**: Verify system logs warning about cancellation.
* **TEST-T1-SIM-05: Simulate Fast-Forward 14 Days**
  - **Goal**: Verify time fast-forward simulation.
  - **Inputs**: Trigger "Fast-Forward 14 Days".
  - **Expected Outcome**: Triggers bi-weekly paycheck dispatch, increases invoice overdue days, triggers Invoice Sentinel check.
  - **Verification**: Assert salary buffer reduced by paycheck amount, overdue invoices checked.

---

### Tier 2: Boundary & Corner Cases
Verifies system behavior at mathematical boundaries, empty datasets, and invalid input conditions (>=5 test cases per feature).

#### 1. OmniFlow Routing Engine
* **TEST-T2-OMNI-01: Zero Dollar Deposit**
  - **Goal**: Verify routing engine handles $0 deposits without errors.
  - **Inputs**: Deposit = $0, Profile.
  - **Expected Outcome**: All splits get $0 allocation.
  - **Verification**: Assert allocations are all 0.
* **TEST-T2-OMNI-02: Negative Deposit Value**
  - **Goal**: Verify negative deposits are rejected or throw errors.
  - **Inputs**: Deposit = -$1,000.
  - **Expected Outcome**: Throws validation error.
  - **Verification**: Assert exception is thrown.
* **TEST-T2-OMNI-03: Massive Deposit Exceeding All Buffers**
  - **Goal**: Verify massive deposits spill mostly into yield pool.
  - **Inputs**: Deposit = $500,000, profile paycheck = $3k, current buffer = $0.
  - **Expected Outcome**: Reserve floor gets $5k, Tax pool gets $100k (20%), Salary buffer gets $18k, Yield pool gets remaining $377k.
  - **Verification**: Verify sum of allocations matches $500,000.
* **TEST-T2-OMNI-04: Deposit with 0% Tax Rate**
  - **Goal**: Verify allocation splits when tax rate is 0%.
  - **Inputs**: Deposit = $5,000, profile tax rate = 0%.
  - **Expected Outcome**: Tax Pool gets $0.
  - **Verification**: Assert tax allocation is 0.
* **TEST-T2-OMNI-05: Deposit with Target Paycheck of $0**
  - **Goal**: Verify behavior when user has zero target paycheck.
  - **Inputs**: Deposit = $1,000, target paycheck = $0.
  - **Expected Outcome**: Salary buffer max capacity is $0, so salary buffer gets $0 allocation.
  - **Verification**: Assert salary buffer allocation is 0.

#### 2. AI Accountant Agent
* **TEST-T2-ACCT-01: Empty Receipt Text & Image**
  - **Goal**: Verify error handling for empty submissions.
  - **Inputs**: empty image and rawText = "".
  - **Expected Outcome**: Throws validation error or returns ineligible.
  - **Verification**: Assert error or ineligible status.
* **TEST-T2-ACCT-02: Receipt with Zero Amount**
  - **Goal**: Verify expense with $0 amount.
  - **Inputs**: rawText = "Starbucks receipt for free coffee, Amount: $0.00".
  - **Expected Outcome**: Returns eligible = true, amount = 0, tax saving = 0.
  - **Verification**: Check amount and write-off status.
* **TEST-T2-ACCT-03: Massive Expense Amount**
  - **Goal**: Verify write-off of extremely large values.
  - **Inputs**: rawText = "Purchase of server cluster, Amount: $100,000.00".
  - **Expected Outcome**: Classified as Software/Hardware, eligible = true.
  - **Verification**: Check category and eligibility.
* **TEST-T2-ACCT-04: Receipt audit with $0 Tax Pool**
  - **Goal**: Verify release logic when Tax Pool is empty.
  - **Inputs**: Eligible write-off of $1,000, tax saving = $200. Tax Pool balance = $0.
  - **Expected Outcome**: Cannot release more than tax pool balance, so releases $0 (or records deficit).
  - **Verification**: Assert tax pool doesn't go negative.
* **TEST-T2-ACCT-05: Malformed expense amount**
  - **Goal**: Verify handling of garbled amounts.
  - **Inputs**: rawText = "Staples receipt, Amount: $XX.YY".
  - **Expected Outcome**: Defaults to fallback amount (e.g. $100) or throws validation warning.
  - **Verification**: Check fallback application.

#### 3. AI Tax Advisor Agent
* **TEST-T2-TAX-01: Income Exactly at Bracket Threshold Boundary**
  - **Goal**: Verify threshold boundary condition.
  - **Inputs**: YTD Income = $50,000 exactly (threshold for 22%).
  - **Expected Outcome**: Remains in 10% (or transitions cleanly based on strict comparison).
  - **Verification**: Assert bracket value matches boundary design.
* **TEST-T2-TAX-02: Negative YTD Income Adjustments**
  - **Goal**: Verify correction of YTD income down.
  - **Inputs**: YTD Income drops from $60,000 to $40,000 (due to invoice cancellation).
  - **Expected Outcome**: Bracket reverts to 10%, retroactive tax saving computed.
  - **Verification**: Assert bracket is 10%.
* **TEST-T2-TAX-03: Manual profile tax rate update**
  - **Goal**: Verify retroactive calculation when user updates rate manually.
  - **Inputs**: YTD income = $100,000, user updates tax rate from 20% to 25%.
  - **Expected Outcome**: Retroactive adjustment = $100,000 * 0.05 = $5,000.
  - **Verification**: Assert adjustment is $5,000.
* **TEST-T2-TAX-04: Retroactive Adjustment Exceeds Yield Pool Balance**
  - **Goal**: Verify shoring when yield pool is insufficient.
  - **Inputs**: Retroactive tax adjust = $10,000. Yield Pool balance = $4,000.
  - **Expected Outcome**: Pulls $4,000 from yield pool, remaining $6,000 queued from next deposit.
  - **Verification**: Assert Yield Pool goes to $0, Tax Pool increased by $4,000.
* **TEST-T2-TAX-05: Micro-deposits crossing multiple brackets**
  - **Goal**: Verify sequential tax adjustments do not double count.
  - **Inputs**: Series of five $20,000 deposits starting from YTD $40,000.
  - **Expected Outcome**: Clean incremental bracket transitions and shoring.
  - **Verification**: Verify final cumulative tax pool balance.

#### 4. AI Treasury Agent
* **TEST-T2-TRES-01: Salary Buffer Exactly Equal to Paycheck**
  - **Goal**: Verify boundary condition where buffer matches target paycheck.
  - **Inputs**: salary_buffer = $3,000, paycheck = $3,000.
  - **Expected Outcome**: Deficit = 0. recallAmount = 0, actionTaken = false.
  - **Verification**: Assert no recall triggered.
* **TEST-T2-TRES-02: Extremely Small Recall Deficit**
  - **Goal**: Verify recall triggers for fractional values.
  - **Inputs**: salary_buffer = $2,999.99, paycheck = $3,000.00.
  - **Expected Outcome**: recallAmount = $0.01, actionTaken = true.
  - **Verification**: Assert recall amount.
* **TEST-T2-TRES-03: Lock/Latency on Yield Pool Recall**
  - **Goal**: Verify system handles yield pool recall latency or error.
  - **Inputs**: Deficit = $2,000, yield pool has funds but smart contract call fails.
  - **Expected Outcome**: System logs failure, reports cash deficiency warning.
  - **Verification**: Check `agent_logs` for warnings.
* **TEST-T2-TRES-04: Paycheck Trigger with Zero Runway**
  - **Goal**: Verify behavior when paycheck is dispatched but all buffers are 0.
  - **Inputs**: salary_buffer = 0, yield = 0, reserve = 0.
  - **Expected Outcome**: Paycheck fails to dispatch, error/critical alarm logged.
  - **Verification**: Check error logs.
* **TEST-T2-TRES-05: Target Paycheck Change Mid-Cycle**
  - **Goal**: Verify instant runway recalculation when target paycheck changes.
  - **Inputs**: balances: salary_buffer = $6k, target paycheck changed from $3k to $1k.
  - **Expected Outcome**: Runway instantly goes from 1.0 month to 3.0 months.
  - **Verification**: Assert runway months output.

#### 5. AI Invoice Sentinel
* **TEST-T2-SENT-01: Invoice Overdue by 13 Days 23 Hours**
  - **Goal**: Verify boundary just before 14-day threshold.
  - **Inputs**: overdueDays = 13.99.
  - **Expected Outcome**: No reminders drafted.
  - **Verification**: Assert output empty.
* **TEST-T2-SENT-02: Invoice Overdue by 20 Days 23 Hours**
  - **Goal**: Verify boundary just before 21-day escalation threshold.
  - **Inputs**: overdueDays = 20.99.
  - **Expected Outcome**: Polite reminder drafted.
  - **Verification**: Assert reminder is NOT escalated.
* **TEST-T2-SENT-03: Missing client contact information**
  - **Goal**: Verify graceful handling of incomplete records.
  - **Inputs**: invoice client name = null, overdue = 15 days.
  - **Expected Outcome**: Generates draft with placeholder client name, doesn't crash.
  - **Verification**: Assert draft has "Dear Client" or similar.
* **TEST-T2-SENT-04: Rate limiting on bulk overdue invoices**
  - **Goal**: Verify handling of 100+ overdue invoices.
  - **Inputs**: Array of 100 overdue invoices.
  - **Expected Outcome**: Processed successfully without timeout/memory crash.
  - **Verification**: Assert all drafts generated.
* **TEST-T2-SENT-05: Overdue invoice with zero amount**
  - **Goal**: Verify invoice of $0 does not trigger reminder email.
  - **Inputs**: overdue = 15 days, amount = $0.
  - **Expected Outcome**: Skip invoice, no draft.
  - **Verification**: Assert no draft generated.

#### 6. Demo Simulator
* **TEST-T2-SIM-01: Reset Demo State Verification**
  - **Goal**: Verify state reset function.
  - **Inputs**: Trigger "Reset Demo State" on a dirty database.
  - **Expected Outcome**: Database tables cleared and seeds re-imported, balances set to starting values.
  - **Verification**: Check default starting balances in db.
* **TEST-T2-SIM-02: Rapid simultaneous event clicks**
  - **Goal**: Verify concurrency stability.
  - **Inputs**: Multiple events fired in rapid succession.
  - **Expected Outcome**: Events processed sequentially, no deadlock.
  - **Verification**: Assert all transactions logged in history.
* **TEST-T2-SIM-03: Multi-month fast-forward simulation**
  - **Goal**: Verify state over long simulator time jumps.
  - **Inputs**: Fast-forward 14 days triggered 6 consecutive times (84 days total).
  - **Expected Outcome**: Six paycheck dispatches processed, invoices aged, multiple yield recalls triggered.
  - **Verification**: Verify ledger shows six paycheck debits.
* **TEST-T2-SIM-04: Simulating event with invalid string payloads**
  - **Goal**: Verify simulator handles bad manual entry.
  - **Inputs**: Trigger Invoice Paid with amount "abc".
  - **Expected Outcome**: Reject, do not modify balances.
  - **Verification**: Verify balances unchanged.
* **TEST-T2-SIM-05: Fast-forward with no active clients**
  - **Goal**: Verify fast forward when user has no invoices or active income.
  - **Inputs**: Fast forward 14 days when client list is empty.
  - **Expected Outcome**: Salary buffer depleted by paycheck, no invoice checks run.
  - **Verification**: Check paycheck dispatch ledger entry.

---

### Tier 3: Cross-Feature Combinations
Verifies pairwise interactions and integration logic between features (>=6 cases).

* **TEST-T3-COMB-01: OmniFlow Routing & AI Tax Advisor Interaction**
  - **Goal**: Verify that an incoming deposit causing a tax bracket shift immediately modifies the routing split of that *same* deposit.
  - **Scenario**: User YTD income is $45,000 (tax rate 10%). A new invoice of $10,000 is paid.
  - **Expected Outcome**: The first $5,000 is taxed at 10% ($500), and the remaining $5,000 of the deposit is taxed at the new 22% rate ($1,100). The Tax Advisor computes the retroactive adjustment of $4,500 on the previous YTD income.
  - **Verification**: Assert Tax Pool allocation from deposit is exactly $1,600, and retroactive shoring of $5,400 is triggered.
* **TEST-T3-COMB-02: AI Accountant & AI Treasury Interaction**
  - **Goal**: Verify that write-off releases increase runway and cancel pending yield recalls.
  - **Scenario**: Salary buffer has $1,000 (deficit is $2,000). A receipt write-off of $10,000 is uploaded and audited. Tax rate is 20%.
  - **Expected Outcome**: The Accountant releases $2,000 from the Tax Pool to the Salary Buffer. Salary Buffer becomes $3,000. Treasury evaluates runway, finds salary buffer is sufficient, and skips the yield recall.
  - **Verification**: Check that no yield recall is dispatched, and salary buffer balance is $3,000.
* **TEST-T3-COMB-03: AI Treasury & Demo Simulator Interaction**
  - **Goal**: Verify simulator fast-forward triggers paycheck, depleting buffer, prompting yield recall.
  - **Scenario**: Salary buffer is $2,000, yield pool is $5,000, paycheck is $3,000. Simulator triggers "Fast-Forward 14 Days".
  - **Expected Outcome**: Paycheck dispatcher attempts to pull $3,000. Deficiency triggers Treasury recall of $1,000 from yield pool. Paycheck is successfully paid.
  - **Verification**: Assert yield pool drops to $4,000, and salary buffer ends at $0 (or $3k from yield, minus $3k paycheck).
* **TEST-T3-COMB-04: AI Invoice Sentinel & OmniFlow Routing Interaction**
  - **Goal**: Verify that a chased overdue invoice, when paid, is routed accurately according to active rules.
  - **Scenario**: Invoice Sentinel logs draft email for Acme Corp's overdue $15,000 invoice. User simulates payment of that invoice.
  - **Expected Outcome**: $15,000 payout is ingested, routed to tax pool, shored to reserve, salary buffer, and remainder to yield pool. Invoice status set to paid.
  - **Verification**: Assert invoice status is 'paid', allocations reflect $15,000 split.
* **TEST-T3-COMB-05: AI Tax Advisor & AI Treasury Interaction**
  - **Goal**: Verify that retroactive tax adjustments pull from the yield pool when cash is low.
  - **Scenario**: YTD income crosses $100k, triggering a $2,000 retroactive adjustment. Salary buffer is $500, Yield Pool is $5,000.
  - **Expected Outcome**: Tax advisor transfers $2,000 shortfall to the tax pool by pulling it directly from the Yield Pool.
  - **Verification**: Assert Yield Pool drops to $3,000, and Tax Pool increases by $2,000.
* **TEST-T3-COMB-06: AI Accountant & AI Tax Advisor Interaction**
  - **Goal**: Verify that write-offs registered during bracket transitions use the updated tax rate.
  - **Scenario**: YTD income transitions to 24%. A receipt of $1,000 is audited.
  - **Expected Outcome**: Tax reserve released is calculated using the new 24% rate ($240), not the old 22% rate ($220).
  - **Verification**: Assert amount released to salary buffer is exactly $240.

---

### Tier 4: Real-World Application Scenarios
Verifies complete end-to-end user workflows reflecting typical creator/freelancer lifecycles (>=5 scenarios).

* **TEST-T4-SCEN-01: The "Dry Spell & Recovery" Cycle**
  - **Goal**: Verify treasury and routing survival through contract loss and new acquisition.
  - **Workflow**:
    1. User starts with $5,000 reserve, $18,000 salary buffer (full), and $10,000 in Ondo USDY yield.
    2. Simulator triggers "Client Cancellation" (dry spell).
    3. Fast-forward 14 days twice (2 paychecks, total $6,000). Salary buffer falls to $12,000.
    4. Fast-forward 14 days three more times (3 paychecks, total $9,000). Salary buffer falls to $3,000.
    5. Fast-forward 14 days again. Paycheck dispatch needs $3,000. Salary buffer has $3,000. Buffer becomes $0.
    6. Fast-forward 14 days again. Paycheck dispatch needs $3,000. Buffer is $0. Treasury agent auto-recalls $3,000 from yield. Paycheck paid.
    7. User lands new contract and receives $20,000 payout.
  - **Expected Outcome**: Payout is routed to shore up salary buffer to max, and remaining cash goes back to yield pool.
  - **Verification**: Verify cash runway calculation recovers, and balances end up correct.
* **TEST-T4-SCEN-02: Tax Bracket Escalation & Write-Off Offset**
  - **Goal**: Verify tax provisioning under sudden income spikes offset by expenses.
  - **Workflow**:
    1. YTD Income = $40,000 (tax rate 10%). Tax Pool = $4,000.
    2. Simulate large milestone payout of $30,000.
    3. Income becomes $70,000, crossing the $50k threshold (new tax rate 22%).
    4. Tax Advisor retroactively adjusts YTD tax reserve: $70,000 * 22% = $15,400. Retroactive adjust = $15,400 - (old tax $4,000 + current deposit tax $6,600) = $4,800 shored.
    5. User uploads business equipment receipt of $4,000.
    6. Accountant audits receipt, classifies as eligible write-off (Office Equipment), and releases $4,000 * 22% = $880 from Tax Pool to Salary Buffer.
  - **Expected Outcome**: Tax Pool shored by retroactive amount, then decreased by write-off saving. Salary buffer increased by $880.
  - **Verification**: Check final Tax Pool balance = $14,520 ($15,400 - $880) and Salary Buffer has gained $880.
* **TEST-T4-SCEN-03: The Late Payment Chase-to-Deposit Flow**
  - **Goal**: Verify invoice age tracking, email drafting, escalation, and final routing.
  - **Workflow**:
    1. Create unpaid invoice of $8,000 for client "Globex".
    2. Fast-forward 14 days. Invoice Sentinel drafts polite email.
    3. Fast-forward 7 days (total 21 days). Invoice Sentinel drafts urgent email.
    4. Simulate payment of the $8,000 invoice.
    5. OmniFlow routes the payment.
  - **Expected Outcome**: Status updates to 'paid', reminder drafts are saved, balances increment.
  - **Verification**: Check database logs for both drafts, verify invoice status is 'paid'.
* **TEST-T4-SCEN-04: Bootstrap to Yield Generation**
  - **Goal**: Verify a user starting from zero reaches yield generation threshold.
  - **Workflow**:
    1. Profile: target paycheck = $3k, reserve floor = $5k, tax rate = 20%. Balances are all $0.
    2. Invoice of $15,000 paid.
       - Tax Pool gets $3,000.
       - Reserve Floor gets $5,000.
       - Salary Buffer gets remaining $7,000 (limit is $18k).
    3. Second invoice of $15,000 paid.
       - Tax Pool gets $3,000.
       - Reserve Floor gets $0 (already shored).
       - Salary Buffer gets $11,000 (reaches max capacity of $18k).
       - Remaining $1,000 routed to Yield Pool.
  - **Expected Outcome**: Yield pool balance ends at $1,000.
  - **Verification**: Assert final balances: tax_pool = $6k, reserve_floor = $5k, salary_buffer = $18k, yield_pool = $1k.
* **TEST-T4-SCEN-05: Emergency Liquidation and Recovery**
  - **Goal**: Verify complete cash depletion warning and subsequent recovery.
  - **Workflow**:
    1. Balances: salary_buffer = $1k, yield_pool = $1k, reserve_floor = $0, paycheck = $3k.
    2. Run paycheck. Deficiency triggers recall of all $1k yield. Salary buffer becomes $2k. Still short by $1k.
    3. Paycheck is dispatched with available $2k (partial payment). All balances except tax are now $0. Runway is 0. System logs CRITICAL warning.
    4. Deposit of $10,000 lands.
  - **Expected Outcome**: Payout first shores up reserve floor (if profile has one, e.g. $5k), then salary buffer.
  - **Verification**: Check logs for deficit warnings, verify post-recovery routing.

---

## 5. Verification & Running Tests

To run the E2E test suite, use the custom test runner:

```bash
node tests/e2e/testRunner.js
```

This will automatically load `tests/e2e/e2e.test.js`, execute all Tier 1, 2, 3, and 4 test cases, print the results, and exit.
