import React, { useState } from 'react';

export default function Invoices({ invoices, drafts, dbService, onTriggerReload }) {
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDateDays, setDueDateDays] = useState('14');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!clientName || !amount) {
      alert("Please enter client name and amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.addInvoice(clientName, parseFloat(amount), parseInt(dueDateDays, 10));
      setClientName('');
      setAmount('');
      setDueDateDays('14');
      onTriggerReload();
    } catch (err) {
      alert("Error creating invoice: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      await dbService.simulateInvoicePaid(invoiceId);
      onTriggerReload();
    } catch (err) {
      alert("Error paying invoice: " + err.message);
    }
  };

  const handleCopyEmail = (text) => {
    navigator.clipboard.writeText(text);
    alert("Draft email copied to clipboard!");
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (activeFilter === 'all') return true;
    return inv.status === activeFilter;
  });

  const formatCurrency = (val) =>
    (val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="px-8 pt-8 pb-12 animate-fadeIn space-y-6">
      
      {/* Page Title Header */}
      <div>
        <h2 className="text-2xl font-black text-black tracking-tight leading-none">Invoicing & AI collections</h2>
        <p className="text-xs text-slate-500 mt-1">
          Issue client invoices and monitor the AI Invoice Sentinel as it manages late payouts automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Column 1: Create Invoice Form */}
        <div className="bg-white p-6 rounded-3xl border border-[#ebebeb] shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-black uppercase tracking-wider">Create New Invoice</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Generate a pending invoice for client billing.</p>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Client Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Wayne Enterprises"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs px-4 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Billing Amount ($)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs font-semibold">$</span>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-7 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Payment Due In (Days)</label>
              <select
                value={dueDateDays}
                onChange={(e) => setDueDateDays(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs px-4 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days (Default)</option>
                <option value="30">30 Days</option>
                <option value="0">Due on Receipt (0 Days)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black hover:bg-neutral-800 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-sm hover:shadow"
            >
              {isSubmitting ? "Generating..." : "Issue & Send Invoice"}
            </button>
          </form>
        </div>

        {/* Column 2: Invoice Registry Ledger */}
        <div className="bg-white rounded-3xl border border-[#ebebeb] shadow-sm overflow-hidden xl:col-span-2">
          {/* Filtering Header Tab bar */}
          <div className="bg-[#fafafa] border-b border-[#ebebeb] px-6 py-3 flex flex-wrap gap-2 items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Invoice Ledger</span>
            
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'paid', label: 'Paid' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                    activeFilter === tab.id
                      ? 'bg-black text-white'
                      : 'bg-white text-slate-500 border border-[#e5e7eb] hover:text-black hover:border-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[#9ca3af] uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-bold">Client / Ref</th>
                  <th className="pb-3 font-bold">Amount</th>
                  <th className="pb-3 font-bold">Due Date</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6] text-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#9ca3af] italic text-xs">
                      No invoices found matching current filter status.
                    </td>
                  </tr>
                ) : filteredInvoices.map((inv) => (
                  <tr key={inv.id || inv.invoiceId} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-4 pr-4">
                      <span className="font-bold text-[#111] block">{inv.client}</span>
                      <span className="text-[9px] text-[#9ca3af] font-mono">ID: {inv.id || inv.invoiceId}</span>
                    </td>
                    <td className="py-4 font-extrabold text-[#111] text-sm pr-4">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="py-4 text-slate-600 pr-4">
                      {inv.due_date}
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                        inv.status === 'paid'
                          ? 'bg-[#e0fcd0] text-[#255c15] border-[#c2f0ad]'
                          : inv.status === 'overdue'
                          ? 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]'
                          : 'bg-[#fff5d0] text-[#7c5c00] border-[#ffe090]'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {inv.status !== 'paid' ? (
                        <button
                          onClick={() => handlePayInvoice(inv.id || inv.invoiceId)}
                          className="bg-[#111] hover:bg-neutral-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-full shadow-sm hover:shadow transition-all"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#9ca3af] italic font-semibold">Settled ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Side-by-Side Overdue Chaser drafts panel at the bottom */}
      <div className="bg-white p-6 rounded-3xl border border-[#ebebeb] shadow-sm">
        <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Invoice Sentinel: AI Collections Workspace
        </h3>
        <p className="text-xs text-slate-500 mb-6 max-w-3xl">
          The AI Invoice Sentinel scans all invoices daily. Payments overdue by 14+ days draft polite follow-ups, and escalate to urgent demands at 21+ days. Copy drafts and manage late accounts below.
        </p>

        {drafts.length === 0 ? (
          <div className="text-center py-10 text-[#9ca3af] italic text-xs bg-slate-50/50 rounded-2xl border border-[#ebebeb] border-dashed">
            Invoice Sentinel has no active collections drafts. (Overdue invoices by 14+ days will trigger drafts automatically. You can simulate time passing or overdue invoices in the Simulator).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {drafts.map((draft, idx) => (
              <div 
                key={idx} 
                className="bg-slate-50 p-5 rounded-2xl border border-[#ebebeb] flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-black text-sm block">{draft.client}</span>
                      <span className="text-[9px] text-[#9ca3af] font-mono">Invoice Ref: #{draft.invoiceId}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      draft.overdueDays >= 21 
                        ? 'bg-rose-100 text-rose-700 border-rose-200' 
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {draft.overdueDays} Days Late ({draft.overdueDays >= 21 ? 'Urgent' : 'Polite'})
                    </span>
                  </div>
                  <pre className="bg-white p-3 rounded-xl border border-[#ebebeb] text-slate-700 font-mono text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                    {draft.draftEmail}
                  </pre>
                </div>
                
                <div className="flex flex-col gap-2">
                  {draft.status === 'sent' && (
                    <div className="w-full bg-[#e0fcd0] text-[#255c15] border border-[#c2f0ad] text-center text-xs font-bold py-2 rounded-xl mb-1">
                      Dispatched ✓
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      disabled={draft.status === 'sent'}
                      onClick={() => handleCopyEmail(draft.draftEmail)}
                      className={`flex-1 text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                        draft.status === 'sent'
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-slate-50 text-black border border-[#ebebeb]'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Email
                    </button>
                    <button
                      disabled={draft.status === 'sent'}
                      onClick={() => handlePayInvoice(draft.invoiceId)}
                      className={`text-[10px] font-bold py-2 px-3 rounded-xl transition-colors ${
                        draft.status === 'sent'
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      Settle Paid
                    </button>
                  </div>
                  
                  {draft.status !== 'sent' && (
                    <button
                      onClick={async () => {
                        if (dbService && dbService.approveAndSendDraft) {
                          await dbService.approveAndSendDraft(draft.invoiceId);
                          if (onTriggerReload) onTriggerReload();
                        }
                      }}
                      className="w-full bg-black hover:bg-neutral-800 text-white text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Approve & Send
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
