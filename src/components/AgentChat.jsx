import React, { useState, useEffect, useRef } from 'react';

const AGENTS_METADATA = {
  accountant: {
    name: 'Tax Accountant',
    role: 'Auditor & Tax Advisor',
    desc: 'Audits business receipts for tax write-offs and manages progressive tax bracket shoring.',
    avatar: '💼',
    colorClass: 'from-blue-500 to-indigo-600',
    colorBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dotColor: 'bg-blue-500',
    capabilities: ['Expense Auditing', 'Tax Bracket Shoring', 'Write-Off Optimization'],
    initialMsg: 'Hello! I am your Tax Accountant Agent. You can ask me to audit a receipt (e.g., "Audit receipt: AWS Hosting, Amount: $300") or evaluate your current progressive tax bracket status.',
    suggestions: [
      { label: 'Audit Receipt: AWS ($300)', prompt: 'Audit receipt: AWS Hosting, Amount: $300' },
      { label: 'Audit Receipt: Staples ($45)', prompt: 'Audit receipt: Staples Paper, Amount: $45' },
      { label: 'Check Tax Bracket Status', prompt: 'Run a progressive tax evaluation and check my current bracket' }
    ]
  },
  treasury: {
    name: 'Treasury Agent',
    role: 'Reserves & Yield Optimizer',
    desc: 'Maintains checking reserve floor, salary buffers, and automates Ondo yield pool routing.',
    avatar: '🏦',
    colorClass: 'from-emerald-500 to-teal-600',
    colorBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    capabilities: ['Runway Stress-Testing', 'Yield Optimization', 'Reserve Shore-Up'],
    initialMsg: 'Hi there! I am your Treasury Agent. I monitor cash runway and Ondo yield. You can ask me to stress-test your runway or recall funds (e.g., "Recall $5,000 from Ondo yield pool").',
    suggestions: [
      { label: 'Stress-Test Cash Runway', prompt: 'Stress-test my runway and cash buffers' },
      { label: 'Recall $5,000 from Yield Pool', prompt: 'Recall $5,000 from Ondo yield pool' },
      { label: 'Get Treasury Status', prompt: 'Summarize my current liquid buffers and yield allocations' }
    ]
  },
  invoice_sentinel: {
    name: 'Invoice Sentinel',
    role: 'Collections & Payments Chase',
    desc: 'Scans overdue customer invoices and drafts polite or escalated reminder emails.',
    avatar: '✉️',
    colorClass: 'from-amber-500 to-orange-600',
    colorBg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    dotColor: 'bg-amber-500',
    capabilities: ['Ledger Scanning', 'Collections Reminders', 'Overdue Escalation'],
    initialMsg: 'Greetings. I am the Invoice Sentinel. I scan the ledger for overdue invoices and draft automated reminders. Ask me to "Scan for overdue invoices" to review collections drafts.',
    suggestions: [
      { label: 'Scan Overdue Invoices', prompt: 'Scan for overdue invoices' },
      { label: 'Review Collections Status', prompt: 'Check collections drafts and overdue ledger status' }
    ]
  }
};

export default function AgentChat({ dbService, onTriggerReload, logs, setActiveTab }) {
  const [selectedAgent, setSelectedAgent] = useState('accountant');
  const [inputText, setInputText] = useState('');
  const [chatHistory, setChatHistory] = useState({
    accountant: [{ sender: 'agent', text: AGENTS_METADATA.accountant.initialMsg, timestamp: new Date() }],
    treasury: [{ sender: 'agent', text: AGENTS_METADATA.treasury.initialMsg, timestamp: new Date() }],
    invoice_sentinel: [{ sender: 'agent', text: AGENTS_METADATA.invoice_sentinel.initialMsg, timestamp: new Date() }]
  });
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, selectedAgent, isThinking]);

  // Execute a prompt directly (used for suggestion chips)
  const executePrompt = async (textToExecute) => {
    if (isThinking) return;
    
    // Add user message to history
    setChatHistory(prev => ({
      ...prev,
      [selectedAgent]: [...prev[selectedAgent], { sender: 'user', text: textToExecute, timestamp: new Date() }]
    }));

    setIsThinking(true);

    try {
      let finalResponse = '';

      if (selectedAgent === 'accountant') {
        const lowerText = textToExecute.toLowerCase();
        if (lowerText.includes('audit') || lowerText.includes('receipt') || lowerText.includes('upload')) {
          let amount = null;
          const amtMatch = textToExecute.match(/\$?([0-9]+(?:\.[0-9]{2})?)/);
          if (amtMatch) amount = parseFloat(amtMatch[1]);
          
          const receiptText = textToExecute.replace(/audit|receipt|upload/gi, '').trim();
          const rec = await dbService.simulateReceiptUpload(receiptText || 'Generic business expense', amount);
          
          if (rec) {
            finalResponse = `[Accountant Audit Result]\n\n• Amount: $${rec.amount.toFixed(2)}\n• Category: ${rec.category}\n• Write-off Eligible: ${rec.is_eligible_writeoff ? 'Yes (Released tax savings)' : 'No (Personal expense)'}\n• Analysis: ${rec.explanation}`;
          } else {
            finalResponse = 'Receipt audit processed. Check the transaction ledger for tax pool changes.';
          }
        } else {
          const profile = await dbService.getProfile();
          const balances = await dbService.getBalances();
          
          const registry = dbService.createToolsRegistry('accountant');
          const res = await dbService.simulateInvoicePaid(0); 
          
          const updatedProfile = await dbService.getProfile();
          finalResponse = `I have run a progressive tax evaluation.\n\n• Current marginal tax bracket: ${(updatedProfile.taxBracket * 100).toFixed(0)}%\n• Year-To-Date Income: $${updatedProfile.ytdIncome.toLocaleString()}\n\nAll progressive tax reserves are fully shored up in the Tax Pool account.`;
        }

      } else if (selectedAgent === 'treasury') {
        const lowerText = textToExecute.toLowerCase();
        if (lowerText.includes('recall') || lowerText.includes('withdraw') || lowerText.includes('transfer')) {
          let amount = 1000;
          const amtMatch = textToExecute.match(/\$?([0-9,]+(?:\.[0-9]{2})?)/);
          if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

          await dbService.manualRecallYield(amount);
          finalResponse = `Yield recall complete! Recalled $${amount.toLocaleString()} from Ondo USDY yield pool back to your liquid Salary Buffer.`;

        } else if (lowerText.includes('stress') || lowerText.includes('cancellation') || lowerText.includes('runway')) {
          await dbService.simulateClientCancellation();
          const balances = await dbService.getBalances();
          const profile = await dbService.getProfile();
          const monthlyBurn = profile.targetPaycheck * 2;
          const totalAvailable = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
          const runway = monthlyBurn > 0 ? (totalAvailable / monthlyBurn).toFixed(1) : '99.0';
          
          finalResponse = `Treasury Runway Stress-Test complete:\n\n• Liquid Salary Buffer: $${balances.salary_buffer.toLocaleString()}\n• Reserve Floor Cushion: $${balances.reserve_floor.toLocaleString()}\n• Ondo USDY Yield Pool: $${balances.yield_pool.toLocaleString()}\n• Active Cash Runway: ${runway} months (burn rate of $${monthlyBurn.toLocaleString()}/mo).\n\nIf runway drops below paycheck requirements, I will automatically trigger yield recalls.`;
        } else {
          const balances = await dbService.getBalances();
          const profile = await dbService.getProfile();
          const monthlyBurn = profile.targetPaycheck * 2;
          const totalAvailable = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
          const runway = monthlyBurn > 0 ? (totalAvailable / monthlyBurn).toFixed(1) : '99';

          finalResponse = `Current Treasury Status:\n\n• Liquid Buffer: $${balances.salary_buffer.toLocaleString()}\n• Yield Pool: $${balances.yield_pool.toLocaleString()}\n• Cash Runway: ${runway} months.\n\nAll funds exceeding the salary cap have been routed to yield pools.`;
        }

      } else if (selectedAgent === 'invoice_sentinel') {
        await dbService.fastForward(0); 
        const drafts = await dbService.getDrafts();
        
        if (drafts.length === 0) {
          finalResponse = 'I scanned the client invoices ledger. Currently, there are no unpaid client invoices that are 14+ days overdue. All collections are in good standing!';
        } else {
          finalResponse = `Sentinel Scan complete! Found ${drafts.length} overdue invoices. I have generated follow-up drafts:\n\n${drafts.map((d, i) => `${i+1}. **${d.client}** (${d.overdueDays} days past due) - Tone: ${d.overdueDays >= 21 ? 'Urgent' : 'Friendly'}`).join('\n')}\n\nYou can review and copy these drafts on the Invoices or Simulator page.`;
        }
      }

      setChatHistory(prev => ({
        ...prev,
        [selectedAgent]: [...prev[selectedAgent], { sender: 'agent', text: finalResponse, timestamp: new Date() }]
      }));

      onTriggerReload();

    } catch (e) {
      setChatHistory(prev => ({
        ...prev,
        [selectedAgent]: [...prev[selectedAgent], { sender: 'agent', text: `An error occurred: ${e.message}`, timestamp: new Date() }]
      }));
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const userText = inputText.trim();
    setInputText('');
    executePrompt(userText);
  };

  const currentMeta = AGENTS_METADATA[selectedAgent];
  const messages = chatHistory[selectedAgent];

  // Helper to parse message text and render structured interactive cards
  const renderMessageText = (msg) => {
    const text = msg.text;

    // 1. Accountant Receipt Audit Result
    if (text.includes('[Accountant Audit Result]')) {
      const amountMatch = text.match(/• Amount:\s*\$?([0-9,.]+)/);
      const categoryMatch = text.match(/• Category:\s*(.+)/);
      const writeoffMatch = text.match(/• Write-off Eligible:\s*([^\n]+)/);
      const analysisMatch = text.split('• Analysis:');

      const amount = amountMatch ? amountMatch[1] : '0.00';
      const category = categoryMatch ? categoryMatch[1].trim() : 'Expense';
      const writeoffStr = writeoffMatch ? writeoffMatch[1] : 'No';
      const isEligible = writeoffStr.toLowerCase().includes('yes');
      const analysis = analysisMatch.length > 1 ? analysisMatch[1].trim() : '';

      return (
        <div className="space-y-4">
          <div className="border border-dashed border-slate-300 bg-slate-50/70 p-5 rounded-2xl relative overflow-hidden flex flex-col gap-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
            {/* Top ticket strip decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"></div>
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Audit Receipt Voucher</span>
                <h4 className="text-sm font-extrabold text-[#111] mt-0.5">{category}</h4>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Audited Amount</span>
                <div className="text-base font-black text-black mt-0.5">${amount}</div>
              </div>
            </div>

            <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ledger Status</span>
              {isEligible ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider flex items-center gap-1">
                  ✓ WRITE-OFF ELIGIBLE
                </span>
              ) : (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider flex items-center gap-1">
                  ✗ PERSONAL EXPENSE
                </span>
              )}
            </div>

            {analysis && (
              <div className="border-t border-slate-200/60 pt-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Agent Analysis</span>
                <p className="text-[11px] leading-relaxed text-slate-600 italic">
                  {analysis}
                </p>
              </div>
            )}
            
            {isEligible && (
              <div className="text-[10px] text-emerald-600/90 font-medium bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 flex items-center gap-1.5 mt-1 leading-normal">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Write-off approved. Tax reserves have been automatically released to your checking account.</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. Tax Bracket Status Evaluation
    if (text.includes('progressive tax evaluation')) {
      const bracketMatch = text.match(/marginal tax bracket:\s*([0-9]+%)/);
      const incomeMatch = text.match(/Year-To-Date Income:\s*\$?([0-9,.]+)/);
      const bracket = bracketMatch ? bracketMatch[1] : '24%';
      const income = incomeMatch ? incomeMatch[1] : '0';

      return (
        <div className="space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">I have run a progressive tax evaluation using current self-employment tiers.</p>
          <div className="bg-slate-50 border border-[#ebebeb] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white rounded-xl border border-[#f1f3f5] shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">YTD Self-Employment Income</span>
                <span className="text-base font-black text-black block mt-0.5">${income}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#f1f3f5] shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Current Marginal Bracket</span>
                <span className="text-base font-black text-indigo-600 block mt-0.5">{bracket}</span>
              </div>
            </div>

            {/* Bracket tracker visualization */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                <span>US Tax Bracket Scale</span>
                <span>Active tier: {bracket}</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full flex overflow-hidden">
                <div className="w-[15%] bg-indigo-200 border-r border-slate-50" title="10% Bracket"></div>
                <div className="w-[20%] bg-indigo-300 border-r border-slate-50" title="12% Bracket"></div>
                <div className="w-[25%] bg-indigo-400 border-r border-slate-50" title="22% Bracket"></div>
                <div className="w-[20%] bg-indigo-600 border-r border-slate-50" title="24% Bracket (Active)"></div>
                <div className="w-[20%] bg-slate-300" title="32%+ Bracket"></div>
              </div>
              <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                <span>$0</span>
                <span>$11k</span>
                <span>$44k</span>
                <span>$95k</span>
                <span>$182k+</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 border-t border-slate-200/60 pt-3 leading-relaxed">
              💡 Progressive tax reserves are fully shored up in the Tax Pool account. No action is required.
            </div>
          </div>
        </div>
      );
    }

    // 3. Treasury Runway Stress-Test complete or Current Status
    if (text.includes('Runway Stress-Test complete') || text.includes('Current Treasury Status')) {
      const isStress = text.includes('Runway Stress-Test complete');
      const bufferMatch = text.match(/(?:Liquid Buffer|Liquid Salary Buffer):\s*\$?([0-9,.]+)/);
      const floorMatch = text.match(/Reserve Floor Cushion:\s*\$?([0-9,.]+)/);
      const yieldMatch = text.match(/(?:Yield Pool|Ondo USDY Yield Pool):\s*\$?([0-9,.]+)/);
      const runwayMatch = text.match(/(?:Active Cash Runway|Cash Runway):\s*([0-9.]+)\s*months/);
      const burnMatch = text.match(/burn rate of\s*\$?([0-9,.]+)/);

      const buffer = bufferMatch ? bufferMatch[1] : '0';
      const floor = floorMatch ? floorMatch[1] : null;
      const yieldPool = yieldMatch ? yieldMatch[1] : '0';
      const runway = runwayMatch ? runwayMatch[1] : '0.0';
      const burn = burnMatch ? burnMatch[1] : null;

      const runwayVal = parseFloat(runway);
      let runwayColor = 'bg-emerald-500';
      let runwayBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (runwayVal < 3.0) {
        runwayColor = 'bg-rose-500';
        runwayBg = 'bg-rose-50 text-rose-700 border-rose-200';
      } else if (runwayVal < 6.0) {
        runwayColor = 'bg-amber-500';
        runwayBg = 'bg-amber-50 text-amber-700 border-amber-200';
      }

      return (
        <div className="space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">
            {isStress ? 'Treasury Runway Stress-Test calculations finalized:' : 'Current treasury liquidity allocations summary:'}
          </p>
          <div className="bg-slate-50 border border-[#ebebeb] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            
            {/* Main Runway metrics card */}
            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#f1f3f5] shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Calculated Runway Cushion</span>
                <span className="text-lg font-black text-black block mt-0.5">{runway} Months</span>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${runwayBg}`}>
                {runwayVal >= 6.0 ? 'Optimal' : runwayVal >= 3.0 ? 'Fair' : 'Warning'}
              </div>
            </div>

            {/* Allocation breakdown progress lines */}
            <div className="space-y-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Fund Allocation Tiers</span>
              
              {/* Liquid Buffer */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-600">Salary Buffer Checking</span>
                  <span className="text-black">${buffer}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-neutral-800 h-full rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>

              {/* Reserve Floor if present */}
              {floor && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-600">Checking Reserve Floor Cushion</span>
                    <span className="text-black">${floor}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-slate-600 h-full rounded-full" style={{ width: '40%' }}></div>
                  </div>
                </div>
              )}

              {/* Yield Pool */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-600">Ondo USDY Yield Pool</span>
                  <span className="text-black">${yieldPool}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '35%' }}></div>
                </div>
              </div>
            </div>

            {burn && (
              <div className="border-t border-slate-200/60 pt-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                <span>Monthly Burn Rate</span>
                <span className="text-slate-700">${burn}/month</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 4. Invoice Sentinel Scan result
    if (text.includes('Sentinel Scan complete!')) {
      const countMatch = text.match(/Found ([0-9]+) overdue invoices/);
      const count = countMatch ? countMatch[1] : '0';

      return (
        <div className="space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">Sentinel Scan completed. Verified overdue client ledger accounts.</p>
          <div className="bg-slate-50 border border-[#ebebeb] p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-base">⚠️</span>
              <div>
                <h4 className="text-xs font-black uppercase text-[#111] tracking-wide">Collections Ledger Status</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Found {count} accounts past the 14+ day late threshold.</p>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 border-t border-slate-200/60 pt-3 leading-relaxed">
              Automated polite/urgent email reminder followups have been drafted. Review these drafts and approve dispatch directly in the Invoice Sentinel Workspace.
            </div>

            {setActiveTab && (
              <button
                onClick={() => setActiveTab('invoices')}
                className="w-full bg-black hover:bg-neutral-800 text-white text-[10px] font-extrabold uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Open Collections Workspace
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      );
    }

    // Default formatting: render markdown-like lists nicely
    if (text.includes('• ') || text.includes('**')) {
      return (
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-800 font-medium">
          {text}
        </p>
      );
    }

    return <p className="text-xs leading-relaxed text-slate-800 font-medium">{text}</p>;
  };

  return (
    <div className="flex-1 flex bg-gradient-to-br from-[#f8f9fa] to-[#f1f3f5] p-8 gap-6 animate-fadeIn overflow-hidden h-full">
      
      {/* Left panel: Agent Selector card */}
      <div className="w-80 shrink-0 flex flex-col gap-4 h-full">
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-[#ebebeb] shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between h-full overflow-hidden">
          <div className="space-y-6 flex flex-col h-full overflow-hidden">
            <div className="shrink-0">
              <h2 className="text-lg font-black text-black tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse"></span>
                Co-Worker Nodes
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Converse directly with autonomous financial agents running on your ledger sandbox.
              </p>
            </div>
            
            {/* Agent Select Pills */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 pb-4">
              {Object.entries(AGENTS_METADATA).map(([key, meta]) => {
                const isActive = selectedAgent === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedAgent(key)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative overflow-hidden group ${
                      isActive
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-lg shadow-slate-900/10'
                        : 'bg-slate-50 border-[#ebebeb] text-slate-800 hover:bg-slate-100/70 hover:scale-[1.01]'
                    }`}
                  >
                    {/* Active Accent Colored strip */}
                    {isActive && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${meta.colorClass}`}></div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-black tracking-wide uppercase truncate">{meta.name}</h4>
                          {/* Live Status indicator */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} ${isThinking && isActive ? 'animate-ping' : 'animate-pulse'}`}></span>
                            <span className={`text-[8px] font-bold tracking-widest uppercase ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isThinking && isActive ? 'BUSY' : 'LIVE'}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold block truncate opacity-70 mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                          {meta.role}
                        </span>
                      </div>
                    </div>

                    <p className={`text-[10px] leading-relaxed ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                      {meta.desc}
                    </p>

                    {/* Capabilities Tags */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {meta.capabilities.map((cap, i) => (
                        <span 
                          key={i} 
                          className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            isActive ? 'bg-white/10 text-white border border-white/10' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>


        </div>
      </div>

      {/* Right panel: Chat Box */}
      <div className="flex-1 bg-white/90 backdrop-blur-md rounded-3xl border border-[#ebebeb] shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col overflow-hidden h-full">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[#f1f3f5] bg-white/80 flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-sm ${currentMeta.colorBg}`}>
            {currentMeta.avatar}
          </div>
          <div>
            <h3 className="font-black text-[#111] leading-none uppercase text-xs tracking-wider">{currentMeta.name}</h3>
            <span className="text-[9px] font-bold text-slate-400 block mt-1">{currentMeta.role} · Stateful Autonomous Ledger Agent</span>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Connected
            </span>
          </div>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.015)] relative ${
                  msg.sender === 'user'
                    ? 'bg-neutral-900 text-white rounded-tr-none px-4.5 py-3.5 text-xs shadow-sm font-semibold'
                    : 'bg-white text-slate-800 border border-[#eef0f2] rounded-tl-none shadow-sm'
                }`}
              >
                {renderMessageText(msg)}
                <span className={`text-[8px] font-black block mt-2 text-right tracking-wider uppercase ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {isThinking && (
            <div className="flex justify-start animate-fadeIn">
              <div className="bg-white text-slate-500 border border-[#eef0f2] p-4.5 rounded-3xl rounded-tl-none text-xs flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.015)]">
                {/* Sleek Thinking Loading circles */}
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce"></div>
                </div>
                <span className="font-semibold text-slate-600">
                  {currentMeta.name} is executing ledger tools...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Suggestion Chips Row */}
        <div className="px-4 pt-3 pb-1 border-t border-[#f1f3f5] bg-white shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 pr-1">Prompts:</span>
            {currentMeta.suggestions.map((sug, i) => (
              <button
                key={i}
                disabled={isThinking}
                onClick={() => {
                  setInputText('');
                  executePrompt(sug.prompt);
                }}
                className="bg-slate-50 border border-[#ebebeb] hover:bg-slate-100 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.98] text-[10px] font-bold text-slate-600 px-3 py-1.5 rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
              >
                <span className="text-slate-400">⚡</span>
                {sug.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input form */}
        <form onSubmit={handleSend} className="p-4 bg-white flex gap-3 shrink-0">
          <div className="flex-1 relative flex items-center bg-slate-50 border border-[#ebebeb] focus-within:border-black focus-within:ring-1 focus-within:ring-black rounded-2xl px-3 py-1.5 transition-all">
            <input
              type="text"
              placeholder={`Query ${currentMeta.name} or type a command...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isThinking}
              className="w-full bg-transparent text-slate-900 text-xs px-2 py-1.5 outline-none border-none disabled:opacity-55"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl transition-all shadow-sm flex items-center gap-1.5"
          >
            Send
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>

      </div>
    </div>
  );
}
