# Project: Singular

## Architecture
Singular is organized as a client-side React single-page application (built with Vite) that communicates directly with a Supabase PostgreSQL backend and a Gemini API logic layer.

### Directory Layout
```
/home/deu/Coding Repos/Singular/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx        # Main Dashboard UI
│   │   ├── Sidebar.jsx          # Sidebar Navigation
│   │   ├── MonthlyCardDeck.jsx  # Card deck for April, May, June
│   │   ├── SystemConsole.jsx    # Real-time agent logs drawer
│   │   └── Simulator.jsx        # Mock events control panel
│   ├── ai/
│   │   ├── accountant.js        # Accountant Agent logic (Gemini)
│   │   ├── taxAdvisor.js        # Tax Advisor Agent logic (Gemini)
│   │   ├── treasury.js          # Treasury Agent logic (Gemini)
│   │   └── invoiceSentinel.js   # Invoice Sentinel Agent logic (Gemini)
│   ├── utils/
│   │   ├── routingEngine.js     # OmniFlow Routing logic & calculations
│   │   └── supabaseClient.js    # Supabase Client instantiation
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   ├── migrations/
│   │   └── 20260621000000_schema.sql  # Database Schema, RLS, and seeds
│   └── config.toml
├── tests/
│   ├── e2e/
│   │   ├── e2e.test.js          # E2E Test Suite
│   │   └── testRunner.js        # Custom Test Runner
│   └── mocks/
│       └── geminiMock.js        # Mock data for Gemini when offline/testing
├── package.json
└── vite.config.js
```

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| M1 | E2E Test Suite | Build test infrastructure and define Tiers 1-4 tests | None | DONE | c968244a-0d1b-49f9-8586-d0811732a571 |
| M2 | Supabase Schema | Implement database schema, RLS, seeds, and client setup | None | DONE | f6e28ce0-2127-4410-8b35-ceee730eb53d |
| M3 | AI Agent Core | Implement Accountant, Tax Advisor, Treasury, and Invoice Sentinel | M2 | DONE | ec73bdff-d31c-4aad-9d39-16fd1bd9b58f |
| M4 | Frontend UI & Console | Build React dashboard, monthly cards, simulator, and console | M2 | DONE | b43a0ef1-9a82-4884-a182-8db3a480e1af |
| M5 | System Integration | Connect UI, Supabase, AI agent core, and simulator events | M3, M4 | DONE | 3bb3a30c-dfd1-4971-871c-a7bdadd2ef31 |
| M6 | E2E Verification & Audit | Run all E2E tests, run forensic audit, and adversarial hardening | M1, M5 | DONE | df395d2e-a088-4391-8f7b-90f0d4fd28ea, c051b249-2ee0-4760-ac7f-b7e5b3ec3fe7 |

## Interface Contracts

### 1. OmniFlow Routing Engine
- `routeDeposit(amount, profile)`:
  - Input: `amount` (numeric), `profile` (object with target paycheck, reserve floor, tax bracket, splits)
  - Output: allocation splits for `tax_pool`, `salary_buffer`, `reserve_floor`, `yield_pool`.
  - Behavior:
    - Shore up reserve floor first if below threshold.
    - Calculate tax reservation (bracket rate * amount) -> route to tax pool.
    - Allocate to salary buffer up to its limit (3 months of target paycheck = 6 * paycheck).
    - Route remaining cash to yield pool.

### 2. AI Accountant Agent
- `auditReceipt(receiptImageFileOrUrl, rawText)`:
  - Input: `receiptImageFileOrUrl` (string/object), `rawText` (string)
  - Output: `{ amount: numeric, category: string, isEligibleWriteoff: boolean, explanation: string }`
  - Behavior: Call Gemini to classify receipt. If eligible write-off, release tax reserve equal to (tax_bracket_rate * amount) back to salary buffer.

### 3. AI Tax Advisor Agent
- `evaluateTaxBracket(ytdIncome, profile)`:
  - Input: `ytdIncome` (numeric), `profile` (object)
  - Output: `{ currentBracket: numeric, retroactiveAdjustment: numeric }`
  - Behavior: Recalculates tax bracket. If bracket changes, compute retroactive adjustment for YTD income and transfer shortfall to tax pool (from yield pool or next deposit).

### 4. AI Treasury Agent
- `evaluateRunwayAndRecall(balances, targetPaycheck)`:
  - Input: `balances` (object), `targetPaycheck` (numeric)
  - Output: `{ runwayMonths: numeric, recallAmount: numeric, actionTaken: boolean }`
  - Behavior: Evaluates cash runway. If next paycheck cannot be met by liquid salary buffer, trigger yield recall for exact deficit from Ondo USDY yield pool.

### 5. AI Invoice Sentinel
- `checkOverdueInvoices(invoices)`:
  - Input: `invoices` (array of invoice objects)
  - Output: array of `{ invoiceId: UUID, client: string, status: string, overdueDays: int, draftEmail: string }`
  - Behavior: Generate email reminders for invoices overdue by >=14 days (escalated at >=21 days).
