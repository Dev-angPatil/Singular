# Original User Request

## Initial Request — 2026-06-21T17:16:14+05:30

Singular is an AI-autonomous treasury and cash-flow engine for freelancers and creators, translating volatile invoice payouts into a steady bi-weekly salary while automating tax reserves, expense auditing, and yield generation.

Working directory: `/home/deu/Coding Repos/Singular`
Integrity mode: development

---

## Agent Team Roles & Workflow Rules
We will spin up 4 specialized agents to build Singular:
1. **Agent 1: UI/UX Engineer**: Builds the responsive light-theme interface, custom navigation bar, monthly card deck, charts, and animations.
2. **Agent 2: Database & Operations Engineer**: Integrates Supabase connection, implements SQL schemas, Row Level Security, and transaction routing math.
3. **Agent 3: AI Integration Engineer**: Links the Gemini API, processes receipt text/files, and manages simulation triggers.
4. **Agent 4: QA/Reviewer Agent**: Audits all code for quality, monitors Gemini API outputs, coordinates milestones, and manages the git process (creates pull requests for features/milestones, reviews them, and merges them to main).

### Git & Branching Strategy
- Milestone tasks and features must be developed on separate git branches.
- Once a feature is complete, a Pull Request/Merge Request must be created.
- The QA/Reviewer Agent must review the code, verify correctness, and merge the branch to `main` upon approval.

---

## Requirements

### R1. Light-Theme Dashboard UI (Vite + React)
- Build a responsive light-theme dashboard modeled on the provided layout image.
- Sidebar Navigation: Custom icons for **Dashboard**, **Allocations**, **Expense Auditor**, **Invoicing & Chaser**, **Yield Ledger**, and **Agent Console**.
- Top Metric Row: Show **Safe to Spend Balance**, **Total Net Worth**, **Tax Reserve (with current bracket rate)**, **Active Yield (USDY)**, **Runway Months**, and **AI-Generated Savings**.
- Main Panel: Chronological monthly cards (April, May, June) featuring:
  - Sparkline charts of revenue vs. expenses.
  - Client initials avatar bubbles representing who paid.
  - An AI Action Badge counting the background agent actions completed that month.

### R2. Supabase Integration
- Initialize connection to Supabase and structure the PostgreSQL schema:
  - `profiles`: user setup (target paycheck, reserve floor, tax bracket, allocation splits).
  - `balances`: current liquid cash, salary buffer, tax reserve, and yield balances.
  - `transactions`: all incoming/outgoing transactions.
  - `invoices`: customer invoices, overdue metrics, and AI chase history.
  - `receipts`: uploaded receipts and AI audit results.
  - `agent_logs`: plain-English logs and step-by-step reasoning steps.
- Enable Row Level Security (RLS) on all tables.

### R3. AI Agent Core (Gemini API)
- Connect to Gemini API using the provided API key: `MOCK_GEMINI_API_KEY`.
- Create a multi-agent logic layer:
  - **Accountant Agent**: Audits receipts, checks eligibility for business write-offs, and extracts categories/amounts.
  - **Tax Advisor Agent**: Tracks YTD income. Recalculates tax bracket changes dynamically and retroactively adjusts tax reserves for unpaid liabilities.
  - **Treasury Agent**: Evaluates cash runway. Automatically triggers smart contract yield recalls (from Ondo USDY) if a dry spell threatens the upcoming paycheck.
  - **Invoice Sentinel**: Monitors unpaid invoices. Generates custom, tone-appropriate follow-up email drafts.

### R4. Demo Simulator & System Console
- Create a floating/collapsible sidebar for judges to trigger mock events:
  - `[Simulate Invoice Paid ($10k)]`
  - `[Simulate Large Milestone ($25k)]`
  - `[Simulate Receipt ($1,500)]`
  - `[Simulate Client Cancellation]` (triggers dry spell and auto-recall)
  - `[Fast-Forward 14 Days]` (triggers bi-weekly paycheck and overdue invoice chase)
  - `[Reset Demo State]` (resets the database)
- Stream real-time agent reasoning steps (from the Gemini API) to the System Console drawer in plain English.

---

## Acceptance Criteria

### UI & Aesthetics
- [ ] Clean, minimal light-mode aesthetic matching the card-based layout structure.
- [ ] Smooth transition animations for panels, chart updates, and simulator alerts.
- [ ] Custom sidebar icons representing Singular's custom workflow.

### Functional Flow
- [ ] Clicking simulator buttons triggers the appropriate database mutations and updates balances instantly.
- [ ] Gemini API key is successfully integrated to dynamically audit receipts, write invoice emails, and log step-by-step agent thoughts.
- [ ] Dry spell triggers calculate upcoming paycheck deficits and recall only the deficit amount from Ondo USDY.
- [ ] Receipts audit releases tax reserve back to yield/cash and logs the tax-saving ledger entries.
