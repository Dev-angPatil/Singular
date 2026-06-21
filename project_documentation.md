# Singular: AI-Autonomous Treasury for the Company of One

Singular is an autonomous cash-flow and treasury engine engineered specifically for solo creators, freelance engineers, and independent consultants. It abstracts away the financial volatility of running a solo business by converting unpredictable invoice payouts into a steady, predictable bi-weekly salary, while automatically handling tax reserves, expense auditing, and yield generation.

---

## 💡 What We Are Building
Most business banking platforms are designed for corporations with accounting departments and treasury teams. Singular brings enterprise-grade financial infrastructure to the individual through an autonomous AI-driven platform. 

At the center of Singular is the **OmniFlow Routing Engine**, which automatically ingests deposits and splits them across four intelligent pools:

```
                  [ Incoming Deposit (Invoice / Plaid Webhook) ]
                                       │
                                       ▼
                       [ AI Agent Core (Gemini API) ]
                                       │
            ┌──────────────────┬───────┴──────────┬──────────────────┐
            ▼                  ▼                  ▼                  ▼
      [ 1. Tax Pool ]   [ 2. Salary Buffer ] [ 3. Reserve ]   [ 4. Yield Pool ]
      Dynamic bracket   Bi-weekly payout     1-month floor    Ondo USDY (T-Bills)
      adjustments       vault                (Cash)           on Base L2
```

---

## 🎯 How It Helps (The Value Proposition)
* **Smooths Out "Feast and Famine" Cycles**: Translates erratic payments (e.g., $15k one month, $2k the next) into a consistent paycheck.
* **Autonomous Tax Provisioning**: Dynamically computes self-employment taxes. If an income spike pushes you into a higher tax bracket, the AI automatically recalculates and shores up tax reserves for all unpaid tax liabilities YTD.
* **Passive Yield on Excess Cash**: Moves capital that exceeds your safety buffer into tokenized U.S. Treasury bills (Ondo USDY on Base), earning ~4.5–5% APY with rapid auto-recall latency.
* **No Manual Tracking**: The AI manages the complex operations, letting you look at just one simple metric: **"Safe to Spend"**.

---

## 🛠️ How It Works (The User Experience)

### 1. Onboarding & Configuration
The user connects their bank account (via Plaid) and configures three simple settings:
1. **Target Paycheck**: How much they want to receive bi-weekly (e.g., `$3,500`).
2. **Reserve Floor**: The cash cushion they want to maintain in the account (e.g., `$5,000`).
3. **Tax Bracket Defaults**: Initial tax bracket estimates based on their business structure (Sole Proprietorship, S-Corp, etc.).

---

### 2. The Four Money Pools Mechanics
Every dollar that enters Singular is routed simultaneously into one of four sub-accounts (Stripe Treasury virtual accounts):

#### Pool 1: The Tax Bucket (Dynamic & Self-Adjusting)
* **How it works**: The AI monitors your YTD income. When a payment lands, the AI checks your current tax bracket.
* **The Recalculation Loop**: If a large payment pushes you from the 22% bracket to the 24% bracket, the AI instantly recalculates your tax obligations for all *unpaid* tax quarters of the current fiscal year. It automatically pulls the difference from the next incoming deposit (or recalls it from the yield pool) to ensure you are fully covered for quarterly IRS filings.

#### Pool 2: The Salary Buffer (The Income Smoother)
* **How it works**: This pool holds liquid cash to feed your bi-weekly paycheck. It has a target capacity of **3 months** of paychecks (e.g., if paycheck is `$3,500` bi-weekly, the target capacity is `$22,750`).
* **Paycheck Dispatch**: Every two weeks, the system fires an automatic transfer from this buffer to the user's linked personal spending account.

#### Pool 3: The Reserve Floor (The Emergency Cushion)
* **How it works**: A static cushion of highly liquid cash (e.g., `$5,000`). It sits untouched in the primary cash account, acting as the absolute last line of defense before yielding instruments.

#### Pool 4: The Yield Pool (Ondo USDY on Base)
* **How it works**: Any money that exceeds the **Tax Bucket requirement**, the **3-month Salary Buffer capacity**, and the **Reserve Floor** is routed into tokenized U.S. Treasury bills (Ondo USDY) on the Base L2 blockchain to earn ~4.5% APY.

---

### 3. The Autonomous AI Core (Gemini-Powered)
When a deposit lands or an invoice is paid, the Gemini AI co-pilot handles the cognitive load:
1. **Classification**: Analyzes the payment metadata (Project fee, retainer, royalty, or interest) to apply the correct tax rules.
2. **Runway Forecast**: Re-runs a 60-day cashflow forecast. If a dry spell is predicted (e.g., a key client contract is ending and no replacement is forecasted):
   * **Auto-Recall Trigger**: The AI calculates the upcoming salary deficit and triggers a smart contract call to recall the exact amount needed from the Ondo USDY Yield Pool back to the liquid Salary Buffer.
3. **Receipt & Expense Audit**: When the user drops a receipt image, the AI reads it, determines if it is a valid business write-off, logs it, and recalculates the dynamic tax bucket (releasing excess tax reserves back into the salary buffer).

---

### 4. Background Monitors (The Silent System)
The system runs background checks to protect the solo business owner:
* **The Invoice Sentinel**: Scans active invoices daily. If an invoice is unpaid for **14 days**, the AI drafts a polite follow-up email. At **21 days**, it drafts an escalated reminder for the user to review and send.
* **The Daily Forecast Poller**: Re-evaluates forecast probabilities every 24 hours.

---

### 5. What the User Sees (The "One-Screen" Dashboard)
To eliminate cognitive fatigue, Singular compresses the complexity into a single intuitive dashboard:

1. **"Safe to Spend" Balance**: The primary focal point. It shows your Salary Buffer balance minus any upcoming scheduled payments.
2. **The Live AI Ledger**: A running feed of plain-English logs explaining what the AI is doing, for example:
   > *"Your $8,000 invoice payout landed. AI classified it as a retainer. Tax Agent allocated $1,760 (22%) to Taxes. Salary Buffer was full, so Treasury Agent routed the remaining $6,240 to Ondo USDY on Base (Yielding 4.5%)."*
3. **Interactive Control Panel (For Hackathon Demo)**:
   A sidebar allowing judges to instantly simulate events—depositing funds, uploading receipts, triggering tax bracket shifts, or inducing dry spells—and watch the allocation ring and AI logs react in real-time.
