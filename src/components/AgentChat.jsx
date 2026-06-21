import React, { useState, useEffect, useRef } from 'react';

const AGENTS_METADATA = {
  accountant: {
    name: 'Tax Accountant',
    role: 'Auditor & Tax Advisor',
    desc: 'Audits business receipts for tax write-offs and manages progressive tax bracket shoring.',
    avatar: '💼',
    initialMsg: 'Hello! I am your Tax Accountant Agent. You can ask me to audit a receipt (e.g., "Audit receipt: AWS Hosting, Amount: $300") or evaluate your current progressive tax bracket status.',
    color: 'border-blue-500/20 text-blue-500 bg-blue-500/5'
  },
  treasury: {
    name: 'Treasury Agent',
    role: 'Reserves & Yield Optimizer',
    desc: 'Maintains checking reserve floor, salary buffers, and automates Ondo yield pool routing.',
    avatar: '🏦',
    initialMsg: 'Hi there! I am your Treasury Agent. I monitor cash runway and Ondo yield. You can ask me to stress-test your runway or recall funds (e.g., "Recall $5,000 from Ondo yield pool").',
    color: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
  },
  invoice_sentinel: {
    name: 'Invoice Sentinel',
    role: 'Collections & Payments Chase',
    desc: 'Scans overdue customer invoices and drafts polite or escalated reminder emails.',
    avatar: '✉️',
    initialMsg: 'Greetings. I am the Invoice Sentinel. I scan the ledger for overdue invoices and draft automated reminders. Ask me to "Scan for overdue invoices" to review collections drafts.',
    color: 'border-amber-500/20 text-amber-500 bg-amber-500/5'
  }
};

export default function AgentChat({ dbService, onTriggerReload, logs }) {
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');
    
    // Add user message to history
    setChatHistory(prev => ({
      ...prev,
      [selectedAgent]: [...prev[selectedAgent], { sender: 'user', text: userText, timestamp: new Date() }]
    }));

    setIsThinking(true);

    try {
      let finalResponse = '';

      if (selectedAgent === 'accountant') {
        const lowerText = userText.toLowerCase();
        if (lowerText.includes('audit') || lowerText.includes('receipt') || lowerText.includes('upload')) {
          // Trigger receipt audit simulation
          let amount = null;
          const amtMatch = userText.match(/\$?([0-9]+(?:\.[0-9]{2})?)/);
          if (amtMatch) amount = parseFloat(amtMatch[1]);
          
          const receiptText = userText.replace(/audit|receipt|upload/gi, '').trim();
          const rec = await dbService.simulateReceiptUpload(receiptText || 'Generic business expense', amount);
          
          if (rec) {
            finalResponse = `[Accountant Audit Result]\n\n• Amount: $${rec.amount.toFixed(2)}\n• Category: ${rec.category}\n• Write-off Eligible: ${rec.is_eligible_writeoff ? 'Yes (Released tax savings)' : 'No (Personal expense)'}\n• Analysis: ${rec.explanation}`;
          } else {
            finalResponse = 'Receipt audit processed. Check the transaction ledger for tax pool changes.';
          }
        } else {
          // General progressive tax evaluation
          const profile = await dbService.getProfile();
          const balances = await dbService.getBalances();
          
          // Trigger progressive evaluation
          const registry = dbService.createToolsRegistry('accountant');
          const res = await dbService.simulateInvoicePaid(0); // Trigger empty deposit to invoke brackets
          
          const updatedProfile = await dbService.getProfile();
          finalResponse = `I have run a progressive tax evaluation.\n\n• Current marginal tax bracket: ${(updatedProfile.taxBracket * 100).toFixed(0)}%\n• Year-To-Date Income: $${updatedProfile.ytdIncome.toLocaleString()}\n\nAll progressive tax reserves are fully shored up in the Tax Pool account.`;
        }

      } else if (selectedAgent === 'treasury') {
        const lowerText = userText.toLowerCase();
        if (lowerText.includes('recall') || lowerText.includes('withdraw') || lowerText.includes('transfer')) {
          // Parse recall amount
          let amount = 1000;
          const amtMatch = userText.match(/\$?([0-9,]+(?:\.[0-9]{2})?)/);
          if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

          await dbService.manualRecallYield(amount);
          finalResponse = `Yield recall complete! Recalled $${amount.toLocaleString()} from Ondo USDY yield pool back to your liquid Salary Buffer.`;

        } else if (lowerText.includes('stress') || lowerText.includes('cancellation') || lowerText.includes('runway')) {
          // Trigger client cancellation runway check
          await dbService.simulateClientCancellation();
          const balances = await dbService.getBalances();
          const profile = await dbService.getProfile();
          const monthlyBurn = profile.targetPaycheck * 2;
          const totalAvailable = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
          const runway = monthlyBurn > 0 ? (totalAvailable / monthlyBurn).toFixed(1) : '99.0';
          
          finalResponse = `Treasury Runway Stress-Test complete:\n\n• Liquid Salary Buffer: $${balances.salary_buffer.toLocaleString()}\n• Reserve Floor Cushion: $${balances.reserve_floor.toLocaleString()}\n• Ondo USDY Yield Pool: $${balances.yield_pool.toLocaleString()}\n• Active Cash Runway: ${runway} months (burn rate of $${monthlyBurn.toLocaleString()}/mo).\n\nIf runway drops below paycheck requirements, I will automatically trigger yield recalls.`;
        } else {
          // General runway calculation
          const balances = await dbService.getBalances();
          const profile = await dbService.getProfile();
          const monthlyBurn = profile.targetPaycheck * 2;
          const totalAvailable = (balances.salary_buffer || 0) + (balances.yield_pool || 0) + (balances.reserve_floor || 0);
          const runway = monthlyBurn > 0 ? (totalAvailable / monthlyBurn).toFixed(1) : '99';

          finalResponse = `Current Treasury Status:\n\n• Liquid Buffer: $${balances.salary_buffer.toLocaleString()}\n• Yield Pool: $${balances.yield_pool.toLocaleString()}\n• Cash Runway: ${runway} months.\n\nAll funds exceeding the salary cap have been routed to yield pools.`;
        }

      } else if (selectedAgent === 'invoice_sentinel') {
        // Scans and updates overdue drafts
        await dbService.fastForward(0); // Trigger check
        const drafts = await dbService.getDrafts();
        
        if (drafts.length === 0) {
          finalResponse = 'I scanned the client invoices ledger. Currently, there are no unpaid client invoices that are 14+ days overdue. All collections are in good standing!';
        } else {
          finalResponse = `Sentinel Scan complete! Found ${drafts.length} overdue invoices. I have generated follow-up drafts:\n\n${drafts.map((d, i) => `${i+1}. **${d.client}** (${d.overdueDays} days past due) - Tone: ${d.overdueDays >= 21 ? 'Urgent' : 'Friendly'}`).join('\n')}\n\nYou can review and copy these drafts on the Invoices or Simulator page.`;
        }
      }

      // Add agent response message
      setChatHistory(prev => ({
        ...prev,
        [selectedAgent]: [...prev[selectedAgent], { sender: 'agent', text: finalResponse, timestamp: new Date() }]
      }));

      // Reload database changes to update header/other tabs
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

  const currentMeta = AGENTS_METADATA[selectedAgent];
  const messages = chatHistory[selectedAgent];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[#f4f4f6] p-8 gap-6 animate-fadeIn overflow-hidden">
      
      {/* Left panel: Agent Selector card */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div className="bg-white p-6 rounded-[28px] border border-[#ebebeb] shadow-sm flex flex-col justify-between h-full">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-black tracking-tight">AI Agent Co-Workers</h2>
              <p className="text-xs text-slate-500 mt-1">Converse directly with your autonomous agents to query balances, audit expenses, and manage collections.</p>
            </div>
            
            {/* Agent Select Pills */}
            <div className="space-y-3">
              {Object.entries(AGENTS_METADATA).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setSelectedAgent(key)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                    selectedAgent === key
                      ? 'bg-black border-black text-white shadow-md scale-[1.02]'
                      : 'bg-slate-50 border-[#ebebeb] text-slate-800 hover:bg-slate-100/60'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{meta.avatar}</span>
                  <div>
                    <h4 className="text-xs font-black tracking-wide uppercase">{meta.name}</h4>
                    <span className={`text-[10px] font-semibold opacity-70 block mb-1 ${selectedAgent === key ? 'text-white' : 'text-slate-500'}`}>
                      {meta.role}
                    </span>
                    <p className={`text-[10px] leading-relaxed ${selectedAgent === key ? 'text-slate-300' : 'text-slate-500'}`}>
                      {meta.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick tips box */}
          <div className="bg-[#f8f9fa] border border-[#eef0f2] p-4 rounded-xl text-[10px] text-slate-500 leading-normal space-y-1">
            <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">💡 Demo Tips</span>
            <p><strong>Accountant:</strong> Type "Audit receipt: Staples paper, $45" to trigger tax release.</p>
            <p><strong>Treasury:</strong> Type "Stress-test runway" to evaluate cash burn and yield recall status.</p>
            <p><strong>Sentinel:</strong> Type "Scan overdue" to generate collections reminder draft emails.</p>
          </div>
        </div>
      </div>

      {/* Right panel: Chat Box */}
      <div className="flex-1 bg-white rounded-[28px] border border-[#ebebeb] shadow-sm flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[#f1f3f5] bg-white flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xl shadow-sm ${currentMeta.color}`}>
            {currentMeta.avatar}
          </div>
          <div>
            <h3 className="font-black text-[#111] leading-none uppercase text-xs tracking-wider">{currentMeta.name}</h3>
            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{currentMeta.role} · Active Stateful Agent</span>
          </div>
          <span className="ml-auto relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-black text-white rounded-br-none shadow-sm'
                    : 'bg-white text-slate-800 border border-[#e9ecef] rounded-bl-none shadow-sm whitespace-pre-line'
                }`}
              >
                {msg.text}
                <span className={`text-[8px] font-bold block mt-1.5 ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {isThinking && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white text-slate-500 border border-[#e9ecef] p-4 rounded-2xl rounded-bl-none text-xs flex items-center gap-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Agent is executing tool calls on the sandbox ledger...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input form */}
        <form onSubmit={handleSend} className="p-4 border-t border-[#f1f3f5] bg-white flex gap-3 shrink-0">
          <input
            type="text"
            placeholder={`Ask the ${currentMeta.name} a question (e.g., see demo tips on left)...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isThinking}
            className="flex-1 bg-slate-50 text-slate-900 text-xs px-4 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="bg-black hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
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
