import React, { useState } from 'react';

export default function Simulator({ dbService, onTriggerReload, invoices, drafts }) {
  const [customInvoiceAmount, setCustomInvoiceAmount] = useState('');
  const [customMilestoneAmount, setCustomMilestoneAmount] = useState('');
  const [customReceiptText, setCustomReceiptText] = useState('');
  const [customReceiptAmount, setCustomReceiptAmount] = useState('');
  const [fastForwardDays, setFastForwardDays] = useState('14');
  const [recallAmount, setRecallAmount] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const triggerFeedback = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleInvoicePaid = async (amount) => {
    await dbService.simulateInvoicePaid(Number(amount));
    triggerFeedback(`Simulated invoice payment of $${amount} received!`);
    onTriggerReload();
  };

  const handleMilestonePaid = async (amount) => {
    await dbService.simulateMilestonePaid(Number(amount));
    triggerFeedback(`Simulated milestone payout of $${amount} received!`);
    onTriggerReload();
  };

  const handlePayInvoice = async (invoiceId) => {
    await dbService.simulateInvoicePaid(invoiceId);
    triggerFeedback(`Overdue Invoice paid successfully!`);
    onTriggerReload();
  };

  const handleReceiptUpload = async (text, amount) => {
    const amt = amount ? Number(amount) : null;
    await dbService.simulateReceiptUpload(text, amt);
    triggerFeedback(`Audited receipt upload: "${text.substring(0, 30)}..."`);
    setCustomReceiptText('');
    setCustomReceiptAmount('');
    onTriggerReload();
  };

  const handleClientCancellation = async () => {
    await dbService.simulateClientCancellation();
    triggerFeedback("Simulated client cancellation dry spell!");
    onTriggerReload();
  };

  const handleFastForward = async (days) => {
    await dbService.fastForward(Number(days));
    triggerFeedback(`Time fast-forwarded by ${days} days!`);
    onTriggerReload();
  };

  const handleRecallYield = async (amount) => {
    await dbService.manualRecallYield(Number(amount));
    triggerFeedback(`Recalled $${amount} from Ondo yield pool to liquid buffer!`);
    setRecallAmount('');
    onTriggerReload();
  };

  const handleReset = async () => {
    if (window.confirm("Reset all sandbox database states to defaults?")) {
      await dbService.reset();
      triggerFeedback("Database reset to onboarding state.");
      onTriggerReload();
    }
  };

  const handleCopyEmail = (text) => {
    navigator.clipboard.writeText(text);
    alert("Draft email copied to clipboard!");
  };

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="fixed top-4 right-4 bg-accent text-white px-4 py-3 rounded-lg shadow-xl font-medium border border-accentHover z-50 animate-bounce">
          {feedbackMsg}
        </div>
      )}

      {/* Grid of Simulation Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Inflow Deposits & Milestones */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Inflow & Deposit Simulator
          </h3>
          <p className="text-xs text-muted mb-4">
            Simulate money landing into the primary business checking account. OmniFlow routes allocations automatically.
          </p>

          <div className="space-y-4">
            {/* Quick Invoice Trigger */}
            <div className="flex gap-2">
              <button 
                onClick={() => handleInvoicePaid(10000)}
                className="flex-1 bg-cardLight hover:bg-cardLight/80 text-white text-xs font-semibold py-2 px-3 rounded border border-border/80 transition-colors"
              >
                + $10,000 Invoice Paid
              </button>
              <button 
                onClick={() => handleMilestonePaid(25000)}
                className="flex-1 bg-cardLight hover:bg-cardLight/80 text-white text-xs font-semibold py-2 px-3 rounded border border-border/80 transition-colors"
              >
                + $25,000 Milestone Paid
              </button>
            </div>

            {/* Custom Invoice Amount */}
            <div className="pt-2 border-t border-border/30">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Custom Invoice Paid</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Enter amount (e.g. 5000)"
                  value={customInvoiceAmount}
                  onChange={(e) => setCustomInvoiceAmount(e.target.value)}
                  className="flex-1 bg-background text-white text-xs px-3 py-2 rounded border border-border focus:outline-none focus:border-accent"
                />
                <button
                  disabled={!customInvoiceAmount}
                  onClick={() => {
                    handleInvoicePaid(customInvoiceAmount);
                    setCustomInvoiceAmount('');
                  }}
                  className="bg-accent hover:bg-accentHover disabled:bg-accent/40 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                >
                  Pay Invoice
                </button>
              </div>
            </div>

            {/* Custom Milestone Amount */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Custom Milestone Payout</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Enter amount (e.g. 15000)"
                  value={customMilestoneAmount}
                  onChange={(e) => setCustomMilestoneAmount(e.target.value)}
                  className="flex-1 bg-background text-white text-xs px-3 py-2 rounded border border-border focus:outline-none focus:border-accent"
                />
                <button
                  disabled={!customMilestoneAmount}
                  onClick={() => {
                    handleMilestonePaid(customMilestoneAmount);
                    setCustomMilestoneAmount('');
                  }}
                  className="bg-accent hover:bg-accentHover disabled:bg-accent/40 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                >
                  Pay Milestone
                </button>
              </div>
            </div>

            {/* Simulate specific pending invoices */}
            {unpaidInvoices.length > 0 && (
              <div className="pt-3 border-t border-border/30">
                <label className="text-[10px] uppercase font-bold text-muted block mb-2">Simulate Client Paying Active Invoices</label>
                <div className="space-y-2">
                  {unpaidInvoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center bg-background/50 p-2 rounded border border-border text-xs">
                      <div>
                        <span className="font-semibold text-white">{inv.client}</span>
                        <span className="text-muted block text-[10px]">Due Date: {inv.due_date} ({inv.status})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-success">${inv.amount.toLocaleString()}</span>
                        <button
                          onClick={() => handlePayInvoice(inv.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Card 2: Receipt Expense Audits */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
            </svg>
            Expense Write-Off Simulator
          </h3>
          <p className="text-xs text-muted mb-4">
            Upload receipt documents. The AI Accountant audits expense tax-deductibility and auto-releases tax pools.
          </p>

          <div className="space-y-4">
            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted block">Quick Receipt Presets</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleReceiptUpload("AWS cloud infrastructure billing invoice, Amount: $300.00", 300)}
                  className="bg-cardLight hover:bg-cardLight/80 text-left text-xs p-2 rounded border border-border/80 text-gray-200"
                >
                  <span className="font-semibold block text-accent">AWS Hosting ($300)</span>
                  <span className="text-[10px] text-muted">Software write-off (24% savings)</span>
                </button>
                <button
                  onClick={() => handleReceiptUpload("Uber taxi ride to client consulting meeting, Amount: $150.00", 150)}
                  className="bg-cardLight hover:bg-cardLight/80 text-left text-xs p-2 rounded border border-border/80 text-gray-200"
                >
                  <span className="font-semibold block text-accent">Uber Taxi ride ($150)</span>
                  <span className="text-[10px] text-muted">Travel write-off (24% savings)</span>
                </button>
                <button
                  onClick={() => handleReceiptUpload("Restaurant lunch with client at Starbucks, Amount: $45.00", 45)}
                  className="bg-cardLight hover:bg-cardLight/80 text-left text-xs p-2 rounded border border-border/80 text-gray-200"
                >
                  <span className="font-semibold block text-accent">Client Lunch ($45)</span>
                  <span className="text-[10px] text-muted">Meal write-off (24% savings)</span>
                </button>
                <button
                  onClick={() => handleReceiptUpload("Personal movie tickets, Netflix, groceries, Amount: $60.00", 60)}
                  className="bg-cardLight hover:bg-cardLight/80 text-left text-xs p-2 rounded border border-border/80 text-gray-200"
                >
                  <span className="font-semibold block text-danger">Personal Expense ($60)</span>
                  <span className="text-[10px] text-muted">Non-eligible (0% savings)</span>
                </button>
              </div>
            </div>

            {/* Custom receipt */}
            <div className="pt-2 border-t border-border/30">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Custom Receipt Upload</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Receipt description (e.g. AWS bill, Staples printer paper)"
                  value={customReceiptText}
                  onChange={(e) => setCustomReceiptText(e.target.value)}
                  className="w-full bg-background text-white text-xs px-3 py-2 rounded border border-border focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount ($)"
                    value={customReceiptAmount}
                    onChange={(e) => setCustomReceiptAmount(e.target.value)}
                    className="flex-1 bg-background text-white text-xs px-3 py-2 rounded border border-border focus:outline-none focus:border-accent"
                  />
                  <button
                    disabled={!customReceiptText || !customReceiptAmount}
                    onClick={() => handleReceiptUpload(customReceiptText, customReceiptAmount)}
                    className="bg-accent hover:bg-accentHover disabled:bg-accent/40 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                  >
                    Audit Receipt
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Card 3: Dry Spells & Time Travel */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Time Travel & Scenario Simulator
          </h3>
          <p className="text-xs text-muted mb-4">
            Simulate the passage of time to age invoices and trigger automated bi-weekly payroll checks and yield recalls.
          </p>

          <div className="space-y-4">
            {/* Fast forward options */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted block mb-1.5">Fast-Forward Time</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFastForward(1)}
                  className="bg-cardLight hover:bg-cardLight/80 text-white text-xs font-semibold py-2 px-3 rounded border border-border transition-colors"
                >
                  +1 Day
                </button>
                <button
                  onClick={() => handleFastForward(14)}
                  className="bg-cardLight hover:bg-cardLight/80 text-white text-xs font-semibold py-2 px-3 rounded border border-border transition-colors"
                >
                  +14 Days (Paycheck Cycle)
                </button>
                <div className="flex-1 flex gap-1">
                  <input
                    type="number"
                    placeholder="Days"
                    value={fastForwardDays}
                    onChange={(e) => setFastForwardDays(e.target.value)}
                    className="w-16 bg-background text-white text-xs px-2 py-1.5 rounded border border-border focus:outline-none focus:border-accent"
                  />
                  <button
                    disabled={!fastForwardDays}
                    onClick={() => {
                      handleFastForward(fastForwardDays);
                      setFastForwardDays('');
                    }}
                    className="bg-warning hover:bg-warning/80 disabled:bg-warning/40 text-black text-xs font-bold px-3 py-1.5 rounded transition-colors"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>

            {/* Dry Spell Trigger */}
            <div className="pt-3 border-t border-border/30">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Simulate Client Cancellation (Dry Spell)</label>
              <div className="flex justify-between items-center bg-background/30 p-3 rounded border border-border/60">
                <span className="text-xs text-gray-300">Triggers a runway warning and prepares treasury checks.</span>
                <button
                  onClick={handleClientCancellation}
                  className="bg-danger hover:bg-danger/80 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                >
                  Trigger Dry Spell
                </button>
              </div>
            </div>

            {/* Manual Ondo Recall */}
            <div className="pt-3 border-t border-border/30">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Manual Yield Recall (Ondo USDY)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Recall amount ($)"
                  value={recallAmount}
                  onChange={(e) => setRecallAmount(e.target.value)}
                  className="flex-1 bg-background text-white text-xs px-3 py-2 rounded border border-border focus:outline-none focus:border-accent"
                />
                <button
                  disabled={!recallAmount}
                  onClick={() => handleRecallYield(recallAmount)}
                  className="bg-accent hover:bg-accentHover disabled:bg-accent/40 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                >
                  Recall Funds
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Card 4: Database Actions */}
        <div className="bg-card p-6 rounded-xl border border-border flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 2 2 2 2h12s2 0 2-2V7M4 7c0-2 2-2 2-2h12s2 0 2 2M4 7l8-4 8 4M4 12l8-4 8 4m-16 5l8-4 8 4" />
              </svg>
              Database Ledger Controls
            </h3>
            <p className="text-xs text-muted mb-4">
              Manage the sandbox persistence. You can reset database states back to the original seed data (April - June 2026 logs and balances).
            </p>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-border/30">
            <button
              onClick={handleReset}
              className="w-full bg-red-950/40 hover:bg-red-900/60 text-danger border border-danger/30 text-xs font-bold py-2.5 px-4 rounded transition-all"
            >
              Reset Sandbox Database to Seed State
            </button>
            <p className="text-[10px] text-muted text-center italic">
              Warning: This clears all custom simulations and restores original 72-case Seed history.
            </p>
          </div>
        </div>

      </div>

      {/* Invoice Sentinel Overdue Drafts Section */}
      <div className="bg-card p-6 rounded-xl border border-border mt-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Invoice Sentinel: Automated Overdue Reminders
        </h3>
        <p className="text-xs text-muted mb-4">
          Overdue invoices by 14+ days trigger the AI Invoice Sentinel to generate polite reminders. At 21+ days overdue, it escalates to urgent emails. Copy these drafts directly to your clipboard.
        </p>

        {drafts.length === 0 ? (
          <div className="text-center py-6 text-muted italic text-xs bg-background/25 rounded border border-border border-dashed">
            No active overdue invoice follow-up drafts generated. (Fast-forward to age pending invoices to 14+ days)
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts.map((draft, idx) => (
              <div key={idx} className="bg-background/80 p-4 rounded-lg border border-border text-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-white">{draft.client}</span>
                      <span className="text-[10px] text-muted block">Invoice ID: {draft.invoiceId}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      draft.overdueDays >= 21 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {draft.overdueDays} Days Overdue ({draft.overdueDays >= 21 ? 'Urgent' : 'Polite'})
                    </span>
                  </div>
                  <pre className="bg-card p-3 rounded border border-border text-gray-300 font-mono text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {draft.draftEmail}
                  </pre>
                </div>
                <button
                  onClick={() => handleCopyEmail(draft.draftEmail)}
                  className="w-full bg-accent hover:bg-accentHover text-white text-xs font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Email Draft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
