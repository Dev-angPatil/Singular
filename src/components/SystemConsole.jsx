import React, { useState } from 'react';

export default function SystemConsole({ logs, isOpen, setIsOpen }) {
  const [localIsOpen, setLocalIsOpen] = useState(true);
  const open = isOpen !== undefined ? isOpen : localIsOpen;
  const toggleOpen = () => {
    if (setIsOpen) setIsOpen(!open);
    else setLocalIsOpen(!open);
  };
  const [activeFilter, setActiveFilter] = useState('all');

  const agents = [
    { id: 'all', label: 'All Agents' },
    { id: 'accountant', label: 'Tax Accountant' },
    { id: 'treasury', label: 'Treasury' },
    { id: 'invoice_sentinel', label: 'Invoice Sentinel' }
  ];

  const filteredLogs = activeFilter === 'all'
    ? logs
    : logs.filter(log => log.agent === activeFilter);

  const getLogStyle = (level) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-500/10 text-red-400 border-red-500/20',
          dot: 'bg-red-500',
          text: 'text-red-300'
        };
      case 'WARNING':
        return {
          bg: 'bg-warning/10 text-warning border-warning/20',
          dot: 'bg-warning',
          text: 'text-amber-200/90'
        };
      default:
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/10',
          dot: 'bg-accent',
          text: 'text-gray-300'
        };
    }
  };

  const formatAgentName = (agent) => {
    if (agent === 'accountant') return 'TAX ACCOUNTANT';
    return agent ? agent.replace('_', ' ').toUpperCase() : 'SYSTEM';
  };

  return (
    <div className={`fixed bottom-0 right-0 left-[72px] bg-white border-t border-[#ebebeb] shadow-2xl transition-all duration-300 z-40 ${
      open ? 'h-72' : 'h-12'
    } flex flex-col`}>
      
      {/* Header / Click area */}
      <div 
        onClick={toggleOpen}
        className="px-6 h-12 border-b border-[#ebebeb] flex items-center justify-between cursor-pointer hover:bg-[#fafafa] select-none"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#10b981] rounded-full animate-ping absolute"></span>
            <span className="w-2 h-2 bg-[#10b981] rounded-full"></span>
          </div>
          <span className="font-bold text-sm tracking-wide text-[#111] uppercase">Live AI Agent Ledger Console</span>
          <span className="text-xs text-[#9ca3af]">({filteredLogs.length} entries)</span>
        </div>
        
        <div className="flex items-center gap-2">
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
            </svg>
          )}
        </div>
      </div>

      {open && (
        <>
          {/* Controls Bar */}
          <div className="px-6 py-2 border-b border-[#f3f4f6] bg-[#fafafa] flex gap-2 flex-wrap items-center">
            <span className="text-xs text-[#9ca3af] mr-2 font-medium">Filter:</span>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setActiveFilter(agent.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  activeFilter === agent.id
                    ? 'bg-[#111] text-white border-[#111]'
                    : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:text-[#111] hover:border-[#9ca3af]'
                }`}
              >
                {agent.label}
              </button>
            ))}
          </div>

          {/* Log Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 bg-white scroll-smooth">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-[#9ca3af] py-6 italic">
                No logs yet — run a simulation to see live agent logs.
              </div>
            ) : (
              filteredLogs.map((log, idx) => {
                const style = getLogStyle(log.level);
                return (
                  <div key={idx} className="flex items-start gap-3 py-1.5 px-3 rounded-lg bg-[#f9fafb] border border-[#f3f4f6] hover:bg-[#f3f4f6] transition-colors">
                    {/* Timestamp */}
                    <span className="text-[#9ca3af] shrink-0 text-[10px] self-center tabular-nums">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString() : new Date(log.timestamp).toLocaleTimeString()}
                    </span>

                    {/* Agent Label Tag */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 uppercase tracking-wider ${style.bg}`}>
                      {formatAgentName(log.agent || log.level)}
                    </span>

                    {/* Log Message */}
                    <p className={`flex-1 leading-relaxed text-[#374151]`}>
                      {log.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
