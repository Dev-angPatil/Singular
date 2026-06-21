import React, { useState } from 'react';

const cards = [
  {
    month: 'April',
    year: '2026',
    profit: -1658.00,
    revenue: 0.00,
    expenses: 1658.00,
    actionsCount: 4,
    clients: [
      { initials: 'AC', bg: '#fcdcce', text: '#5c2d15' }
    ],
    details: { invoices: '0', quotes: '0', proposals: '0' },
    revenuePath: 'M0 70 L20 70 L40 70 L60 70 L80 70 L100 70',
    expensePath: 'M0 70 L20 70 L40 25 L60 70 L80 15 L100 70',
    isSelected: false,
  },
  {
    month: 'May',
    year: '2026',
    profit: 15108.00,
    revenue: 15300.00,
    expenses: 192.00,
    actionsCount: 5,
    clients: [
      { initials: 'CR', bg: '#fcdcce', text: '#5c2d15' },
      { initials: 'H', bg: '#d0ebfc', text: '#153c5c' }
    ],
    details: { invoices: '2 · 2 paid', quotes: '0', proposals: '0' },
    revenuePath: 'M0 70 L10 10 L25 15 L40 70 L60 20 L80 70 L100 70',
    expensePath: 'M0 70 L30 70 L50 62 L70 70 L100 70',
    isSelected: true,
  },
  {
    month: 'June',
    year: '2026',
    profit: 11520.00,
    revenue: 30000.00,
    expenses: 18480.00,
    actionsCount: 6,
    clients: [
      { initials: 'CR', bg: '#fcdcce', text: '#5c2d15' },
      { initials: 'SI', bg: '#e0fcd0', text: '#255c15' }
    ],
    details: { invoices: '1 · 1 paid', quotes: '0', proposals: '0' },
    revenuePath: 'M0 70 L20 15 L45 70 L70 10 L100 70',
    expensePath: 'M0 70 L35 70 L55 25 L75 70 L100 70',
    isSelected: false,
  }
];

export default function MonthlyCardDeck() {
  const [selectedIdx, setSelectedIdx] = useState(1); // May selected by default

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cards.map((card, idx) => {
        const isActive = selectedIdx === idx;
        const isNegative = card.profit < 0;
        const profitString =
          (isNegative ? '−' : '') + '$' + Math.abs(card.profit).toLocaleString('en-US', { minimumFractionDigits: 0 });

        return (
          <div
            key={idx}
            id={`month-card-${card.month.toLowerCase()}`}
            onClick={() => setSelectedIdx(idx)}
            className={`
              relative bg-white rounded-[28px] border-2 flex flex-col justify-between
              transition-all duration-300 cursor-pointer
              ${isActive
                ? 'border-[#111] shadow-[0_8px_40px_rgba(0,0,0,0.14)] translate-y-[-3px]'
                : 'border-[#e9eaec] hover:border-gray-300 hover:shadow-md hover:translate-y-[-1px]'
              }
            `}
            style={{ padding: '1.5rem' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-[26px] font-black text-[#111] tracking-tight leading-none">
                {card.month}
              </h3>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-sm ${
                  isActive ? 'bg-[#111] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'
                }`}
                title={`${card.actionsCount} AI Agent operations`}
              >
                {card.actionsCount}
              </div>
            </div>

            {/* Client Avatar Bubbles */}
            <div className="flex items-center -space-x-2.5 mb-5">
              {card.clients.map((c, cIdx) => (
                <div
                  key={cIdx}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black shadow-sm"
                  style={{ backgroundColor: c.bg, color: c.text }}
                >
                  {c.initials}
                </div>
              ))}
            </div>

            {/* Profit */}
            <div className="mb-3">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block">Profit</span>
              <h2
                className={`text-[36px] font-black tracking-tight mt-0.5 leading-none ${
                  isNegative ? 'text-[#ef4444]' : 'text-[#111]'
                }`}
              >
                {profitString}
              </h2>
            </div>

            {/* Sparkline */}
            <div className="w-full h-20 mb-2 relative">
              <svg viewBox="0 0 100 80" className="w-full h-full" fill="none" preserveAspectRatio="none">
                <path
                  d={card.revenuePath}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={card.expensePath}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-[10px] font-bold uppercase text-[#9ca3af] mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block shrink-0"></span>
                <span>Revenue <strong className="text-[#111] font-black">${card.revenue.toLocaleString('en-US')}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block shrink-0"></span>
                <span>Expenses <strong className="text-[#111] font-black">${card.expenses.toLocaleString('en-US')}</strong></span>
              </div>
            </div>

            {/* Bottom Details */}
            <div className="pt-3 border-t border-[#f3f4f6] text-[12px] text-[#9ca3af] space-y-1.5">
              <div className="flex justify-between">
                <span>Invoices</span>
                <span className="text-[#111] font-semibold">{card.details.invoices}</span>
              </div>
              <div className="flex justify-between">
                <span>Quotes</span>
                <span className="text-[#111] font-semibold">{card.details.quotes}</span>
              </div>
              <div className="flex justify-between">
                <span>Proposals</span>
                <span className="text-[#111] font-semibold">{card.details.proposals}</span>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
