import React, { useState } from 'react';

export default function Dashboard({ profile, balances, transactions, invoices, receipts, dbService, onTriggerReload }) {
  const [activeTab, setActiveTab] = useState('transactions');
  const [displayLimit, setDisplayLimit] = useState('10');

  // Helper for slicing table data
  const getSlicedItems = (items) => {
    if (displayLimit === 'minimized') return [];
    if (displayLimit === 'all') return items;
    return items.slice(0, parseInt(displayLimit, 10));
  };

  const renderTableFooter = (totalCount, currentCount) => {
    if (displayLimit === 'minimized') return null;
    if (totalCount > currentCount) {
      return (
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-3.5 border-t border-[#f3f4f6] mt-4">
          <span>Showing {currentCount} of {totalCount} items</span>
          <button 
            onClick={() => setDisplayLimit('all')}
            className="text-[#111] hover:underline"
          >
            Show All
          </button>
        </div>
      );
    }
    return null;
  };

  const targetPaycheck = profile.targetPaycheck || 3500;
  const salaryCap = targetPaycheck * 6;
  const salaryPercentage = Math.min(100, Math.round((balances.salary_buffer / salaryCap) * 100)) || 0;
  const reserveFloorCap = profile.reserveFloor || 5000;
  const reservePercentage = Math.min(100, Math.round((balances.reserve_floor / reserveFloorCap) * 100)) || 0;

  // Metric calculations
  const revenue = balances.salary_buffer || 0;
  const taxReserve = balances.tax_pool || 0;
  const taxRate = profile.taxBracket || 0.24;
  const totalNetWorth = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
  const monthlyBurn = targetPaycheck * 2;
  const totalAvailable = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
  const runwayMonths = monthlyBurn > 0 ? parseFloat((totalAvailable / monthlyBurn).toFixed(1)) : 0.0;
  const activeYield = balances.yield_pool || 0;
  const aiSavings = receipts
    .filter(r => r.is_eligible_writeoff)
    .reduce((sum, r) => sum + (r.amount * taxRate), 0);

  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const totalInvoicesCount = invoices.length;

  const formatCurrency = (val) =>
    (val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getTxTypeStyle = (type) => {
    switch (type) {
      case 'deposit':
        return 'bg-[#e0fcd0] text-[#255c15] border border-[#c2f0ad]';
      case 'paycheck_payout':
        return 'bg-[#d0ebfc] text-[#153c5c] border border-[#b2e0fc]';
      case 'tax_allocation':
        return 'bg-[#fff5d0] text-[#7c5c00] border border-[#ffe090]';
      case 'writeoff_release':
        return 'bg-[#fcd0f0] text-[#5c154f] border border-[#fcb2eb]';
      case 'yield_route':
        return 'bg-slate-100 text-slate-800 border border-slate-200';
      case 'yield_recall':
        return 'bg-[#fcd0d0] text-[#5c1515] border border-[#fcb2b2]';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const formatTxType = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').toUpperCase();
  };

  // The 6 metric cards from the reference image
  const metrics = [
    {
      id: 'revenue-card',
      label: 'Revenue',
      value: formatCurrency(revenue),
      sub1: `Net ${formatCurrency(revenue)}`,
      sub2: 'VAT $0',
      valueClass: 'text-[#111]',
    },
    {
      id: 'expenses-card',
      label: 'Expenses',
      value: formatCurrency(taxReserve),
      sub1: `${transactions.filter(t => t.type !== 'deposit').length} expenses`,
      sub2: null,
      valueClass: 'text-[#111]',
    },
    {
      id: 'profit-card',
      label: 'Profit',
      value: formatCurrency(totalNetWorth),
      sub1: `${totalNetWorth > 0 ? Math.round((totalNetWorth / Math.max(revenue, 1)) * 100) : 0}% margin`,
      sub2: null,
      valueClass: 'text-[#111]',
    },
    {
      id: 'invoices-card',
      label: 'Invoices',
      value: String(totalInvoicesCount),
      sub1: 'Created this year',
      sub2: null,
      valueClass: 'text-[#111]',
      isNumber: true,
    },
    {
      id: 'quotes-card',
      label: 'Quotes',
      value: '0',
      sub1: null,
      sub2: null,
      valueClass: 'text-[#111]',
      isNumber: true,
      dots: [
        { label: 'Accepted', count: paidInvoices, color: '#10b981' },
        { label: 'Rejected', count: 0, color: '#ef4444' },
      ],
    },
    {
      id: 'proposals-card',
      label: 'Proposals',
      value: '0',
      sub1: null,
      sub2: null,
      valueClass: 'text-[#111]',
      isNumber: true,
      dots: [
        { label: 'Accepted', count: 0, color: '#10b981' },
        { label: 'Rejected', count: 0, color: '#ef4444' },
      ],
    },
  ];

  return (
    <div className="space-y-6 px-8 pb-4">

      {/* ── 6-Metric Cards Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <div
            key={m.id}
            id={m.id}
            className="bg-white px-5 py-4 rounded-2xl border border-[#ebebeb] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
          >
            <div>
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider block">{m.label}</span>
              <h2 className={`text-[22px] font-black tracking-tight mt-0.5 leading-none ${m.valueClass}`}>{m.value}</h2>
            </div>
            <div className="mt-3">
              {m.dots ? (
                <div className="flex flex-col gap-0.5">
                  {m.dots.map((d, i) => (
                    <span key={i} className="text-[9px] text-[#9ca3af] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: d.color }}></span>
                      {d.label} <strong className="text-[#111] ml-0.5">{d.count}</strong>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[9px] text-[#9ca3af] border-t border-[#f3f4f6] pt-1.5 flex flex-wrap gap-x-2">
                  {m.sub1 && <span>{m.sub1}</span>}
                  {m.sub2 && <strong className="text-[#111]">{m.sub2}</strong>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Allocation Progress Bars ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div id="salary-buffer-card" className="bg-white p-5 rounded-2xl border border-[#ebebeb] shadow-sm">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="font-bold text-slate-800">Salary Buffer Capacity</span>
            <span className="font-bold text-black">{salaryPercentage}% Full</span>
          </div>
          <div className="w-full bg-[#f3f4f6] rounded-full h-1.5">
            <div
              className="bg-[#111] h-full rounded-full transition-all duration-500"
              style={{ width: `${salaryPercentage}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-[#9ca3af] mt-2">
            Capacity: {formatCurrency(salaryCap)} · Excess routes to yield pool.
          </p>
        </div>

        <div id="reserve-floor-card" className="bg-white p-5 rounded-2xl border border-[#ebebeb] shadow-sm">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="font-bold text-slate-800">Reserve Floor Safety</span>
            <span className="font-bold text-black">{reservePercentage}% Full</span>
          </div>
          <div className="w-full bg-[#f3f4f6] rounded-full h-1.5">
            <div
              className="bg-neutral-800 h-full rounded-full transition-all duration-500"
              style={{ width: `${reservePercentage}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-[#9ca3af] mt-2">
            Floor: {formatCurrency(reserveFloorCap)} · Shore-up logic runs first on deposits.
          </p>
        </div>
      </div>

      {/* ── Tabbed Ledger Table ── */}
      <div id="ledger-table" className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden shadow-sm">
        {/* Tabs & Controls */}
        <div className="bg-[#fafafa] border-b border-[#ebebeb] flex flex-col sm:flex-row justify-between items-center px-4 py-2 sm:py-0 gap-3 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
          <div className="flex w-full sm:w-auto overflow-x-auto">
            {[
              { key: 'transactions', label: 'Transaction Ledger' },
              { key: 'invoices', label: 'Active Invoices' },
              { key: 'receipts', label: 'Receipt Auditor' },
            ].map(tab => (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-4 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#111] text-[#111] bg-white'
                    : 'border-transparent hover:text-[#111]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 pb-2 sm:pb-0 w-full sm:w-auto justify-end">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Limit:</span>
            <select
              value={displayLimit}
              onChange={(e) => setDisplayLimit(e.target.value)}
              className="bg-white border border-[#ebebeb] text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer hover:bg-slate-50 transition-colors shadow-sm normal-case tracking-normal"
            >
              <option value="5">Show 5</option>
              <option value="10">Show 10</option>
              <option value="25">Show 25</option>
              <option value="all">Show All</option>
              <option value="minimized">Minimize</option>
            </select>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {displayLimit === 'minimized' ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">List Minimized</span>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Select a row limit from the dropdown to expand.</p>
              <button 
                onClick={() => setDisplayLimit('10')}
                className="mt-4 px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
              >
                Expand List
              </button>
            </div>
          ) : (
            <>
              {/* Transactions */}
              {activeTab === 'transactions' && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#f3f4f6] text-[#9ca3af] uppercase tracking-wider text-[10px]">
                          <th className="pb-3 font-bold">Type</th>
                          <th className="pb-3 font-bold">Amount</th>
                          <th className="pb-3 font-bold">Description</th>
                          <th className="pb-3 font-bold">Processed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6] text-slate-800">
                        {transactions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[#9ca3af] italic text-xs">
                              No transactions yet — run a simulation to generate ledger entries.
                            </td>
                          </tr>
                        ) : getSlicedItems(transactions).map((tx, idx) => (
                          <tr key={idx} className="hover:bg-[#fafafa] transition-colors">
                            <td className="py-3.5 pr-4">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider border ${getTxTypeStyle(tx.type)}`}>
                                {formatTxType(tx.type)}
                              </span>
                            </td>
                            <td className="py-3.5 font-extrabold pr-4 text-[#111] text-sm">
                              {tx.type === 'paycheck_payout' || tx.type === 'yield_recall' || tx.type === 'writeoff_release' ? '-' : '+'}
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="py-3.5 text-slate-600 pr-4">{tx.description}</td>
                            <td className="py-3.5 text-[#9ca3af] font-medium">
                              {new Date(tx.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderTableFooter(transactions.length, getSlicedItems(transactions).length)}
                </div>
              )}

              {/* Invoices */}
              {activeTab === 'invoices' && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#f3f4f6] text-[#9ca3af] uppercase tracking-wider text-[10px]">
                          <th className="pb-3 font-bold">Client</th>
                          <th className="pb-3 font-bold">Amount</th>
                          <th className="pb-3 font-bold">Due Date</th>
                          <th className="pb-3 font-bold">Status</th>
                          <th className="pb-3 font-bold">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6] text-slate-800">
                        {invoices.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-[#9ca3af] italic text-xs">
                              No invoices yet.
                            </td>
                          </tr>
                        ) : getSlicedItems(invoices).map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#fafafa] transition-colors">
                            <td className="py-3.5 font-bold text-[#111] pr-4">{inv.client}</td>
                            <td className="py-3.5 font-extrabold pr-4 text-[#111] text-sm">{formatCurrency(inv.amount)}</td>
                            <td className="py-3.5 text-slate-600 pr-4">{inv.due_date}</td>
                            <td className="py-3.5 pr-4">
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
                            <td className="py-3.5 text-[#9ca3af] font-medium">
                              {inv.status === 'overdue' 
                                ? `${inv.overdueDays} days past due`
                                : inv.status === 'paid' 
                                ? 'Settled' 
                                : 'Pending payment'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderTableFooter(invoices.length, getSlicedItems(invoices).length)}
                </div>
              )}

              {/* Receipts */}
              {activeTab === 'receipts' && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#f3f4f6] text-[#9ca3af] uppercase tracking-wider text-[10px]">
                          <th className="pb-3 font-bold">Amount</th>
                          <th className="pb-3 font-bold">Category</th>
                          <th className="pb-3 font-bold">Deductibility</th>
                          <th className="pb-3 font-bold">Confidence</th>
                          <th className="pb-3 font-bold">Explanation</th>
                          <th className="pb-3 font-bold">Processed</th>
                          <th className="pb-3 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6] text-slate-800">
                        {receipts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#9ca3af] italic text-xs">
                              No receipts audited yet.
                            </td>
                          </tr>
                        ) : getSlicedItems(receipts).map((rec) => {
                          const isLowConfidence = rec.confidence_score !== undefined && rec.confidence_score < 0.80;
                          return (
                            <tr key={rec.id} className="hover:bg-[#fafafa] transition-colors">
                              <td className="py-3.5 font-extrabold pr-4 text-[#111] text-sm">{formatCurrency(rec.amount)}</td>
                              <td className="py-3.5 text-[#111] font-bold pr-4">{rec.category}</td>
                              <td className="py-3.5 pr-4">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                                  rec.is_eligible_writeoff
                                    ? 'bg-[#e0fcd0] text-[#255c15] border-[#c2f0ad]'
                                    : 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]'
                                }`}>
                                  {rec.is_eligible_writeoff ? 'WRITE-OFF ✓' : 'PERSONAL ✗'}
                                </span>
                              </td>
                              <td className="py-3.5 pr-4">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                                  isLowConfidence
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                  {rec.confidence_score !== undefined ? `${Math.round(rec.confidence_score * 100)}%` : '100%'}
                                </span>
                              </td>
                              <td className="py-3.5 text-slate-600 pr-4 max-w-xs truncate">{rec.explanation}</td>
                              <td className="py-3.5 text-[#9ca3af] font-medium pr-4">
                                {new Date(rec.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                              </td>
                              <td className="py-3.5 text-right">
                                {isLowConfidence ? (
                                  <button
                                    onClick={async () => {
                                      if (dbService && dbService.verifyReceipt) {
                                        await dbService.verifyReceipt(rec.id);
                                        if (onTriggerReload) onTriggerReload();
                                      }
                                    }}
                                    className="bg-black hover:bg-neutral-800 text-white text-[10px] font-bold py-1 px-2.5 rounded-full transition-colors shadow-sm"
                                  >
                                    Verify
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-semibold italic">Verified ✓</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {renderTableFooter(receipts.length, getSlicedItems(receipts).length)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
