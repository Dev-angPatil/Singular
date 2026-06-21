import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import MonthlyCardDeck from './components/MonthlyCardDeck.jsx';
import SystemConsole from './components/SystemConsole.jsx';
import Simulator from './components/Simulator.jsx';
import Invoices from './components/Invoices.jsx';
import UploadModal from './components/UploadModal.jsx';
import AgentChat from './components/AgentChat.jsx';
import { dbService } from './utils/dbService.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState({});
  const [balances, setBalances] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);

  // Settings form states
  const [paycheckInput, setPaycheckInput] = useState('');
  const [reserveInput, setReserveInput] = useState('');
  const [progressiveTaxInput, setProgressiveTaxInput] = useState(false);

  const reloadData = async () => {
    const prof = await dbService.getProfile();
    const bal = await dbService.getBalances();
    const inv = await dbService.getInvoices();
    const rec = await dbService.getReceipts();
    const tx = await dbService.getTransactions();
    const lg = await dbService.getLogs();
    const dr = await dbService.getDrafts();
    const day = parseInt(localStorage.getItem('singular_current_day') || '0', 10);

    setProfile(prof || {});
    setBalances(bal || {});
    setInvoices(inv || []);
    setReceipts(rec || []);
    setTransactions(tx || []);
    setLogs(lg || []);
    setDrafts(dr || []);
    setCurrentDay(day);

    if (prof) {
      setPaycheckInput(prof.targetPaycheck?.toString() || '');
      setReserveInput(prof.reserveFloor?.toString() || '');
      setProgressiveTaxInput(prof.useProgressiveTax || false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    await dbService.updateProfile({
      targetPaycheck: parseFloat(paycheckInput) || 0,
      reserveFloor: parseFloat(reserveInput) || 0,
      useProgressiveTax: progressiveTaxInput
    });
    alert("Settings saved successfully!");
    reloadData();
  };

  const getSimulatedCalendarDate = () => {
    const start = new Date('2026-04-01T00:00:00Z');
    start.setUTCDate(start.getUTCDate() + currentDay);
    return start.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const handleNextDay = async () => {
    await dbService.fastForward(1);
    reloadData();
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        profile={profile} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#f4f4f6]">
        
        {/* Top Header Bar */}
        <header className="h-14 bg-white flex items-center justify-between px-6 shrink-0 border-b border-[#ebebeb]">
          {/* Center: Pill-shaped toggle menu */}
          <div className="flex-1 flex justify-center">
            <div className="bg-[#f1f3f5] p-1 rounded-full flex items-center border border-[#e5e7eb] shadow-sm gap-0.5">
              <button
                className="p-2 rounded-full bg-white text-black shadow-sm"
                title="Grid/Cards View"
                id="view-grid-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </button>
              <button
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title="Calendar View"
                id="view-calendar-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: Actions and User */}
          <div className="flex items-center gap-3">
            {/* Upload Bill Button */}
            <button
              id="upload-bill-btn"
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-black hover:bg-neutral-800 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm hover:shadow transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Bill
            </button>

            {/* Search icon */}
            <button id="search-btn" className="p-2 text-slate-500 hover:text-black hover:bg-slate-100 rounded-full transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Notification Bell with red badge count */}
            <div className="relative" id="notification-area">
              <button id="notification-btn" className="p-2 text-slate-500 hover:text-black hover:bg-slate-100 rounded-full transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              {notificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center border border-white">
                  {notificationsCount}
                </span>
              )}
            </div>

            {/* User Avatar Bubble */}
            <div
              id="user-avatar"
              className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 transition-transform overflow-hidden"
            >
              <span className="text-white text-[10px] font-black">DU</span>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main 
          className={`flex-1 flex flex-col ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto pb-48'}`}
          style={activeTab === 'chat' ? { paddingBottom: isConsoleOpen ? '288px' : '48px' } : undefined}
        >
          
          {/* TAB 1: DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="animate-fadeIn">
              {/* Year + Nav Row */}
              <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <h1 className="text-[28px] font-black text-[#111] tracking-tight leading-none">2026</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert("Time travel backward is disabled to preserve blockchain ledger consistency.")}
                    className="w-8 h-8 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center text-slate-500 hover:text-black hover:border-slate-300 transition-all shadow-sm"
                    id="prev-month-btn"
                    title="Previous Month"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNextDay}
                    className="w-8 h-8 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center text-slate-500 hover:text-black hover:border-slate-300 transition-all shadow-sm"
                    id="next-month-btn"
                    title="Next Day"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Top Stats Row — 6 metric cards */}
              <Dashboard 
                profile={profile} 
                balances={balances} 
                transactions={transactions} 
                invoices={invoices} 
                receipts={receipts} 
                dbService={dbService}
                onTriggerReload={reloadData}
              />

              {/* Monthly Card Deck — main content */}
              <div className="px-8 pb-8">
                <MonthlyCardDeck />
              </div>
            </div>
          )}

          {/* TAB 2: SIMULATOR VIEW */}
          {activeTab === 'simulator' && (
            <div className="px-8 pt-8 pb-8 space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-extrabold text-black tracking-tight leading-none">Event Simulation Dashboard</h2>
                <p className="text-xs text-slate-500 mt-1">Induce real-world cash flow scenarios to verify autonomous agent operations.</p>
              </div>
              {/* Sandbox day control */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#ebebeb] shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block animate-pulse"></span>
                  <span className="text-xs font-semibold text-slate-700">Simulated Date:</span>
                  <span className="text-xs font-bold text-black">{getSimulatedCalendarDate()} <span className="text-slate-400 font-normal">(Day {currentDay})</span></span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={handleNextDay}
                    id="next-day-btn"
                    className="bg-black hover:bg-neutral-800 text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                  >
                    Next Day →
                  </button>
                  <button
                    id="reset-db-btn"
                    onClick={async () => {
                      if (window.confirm("Reset sandbox database states to defaults?")) {
                        await dbService.reset();
                        reloadData();
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100/80 text-red-600 border border-rose-200/60 text-xs font-bold py-1.5 px-4 rounded-full transition-all"
                  >
                    Reset Database
                  </button>
                </div>
              </div>
              <Simulator 
                dbService={dbService} 
                onTriggerReload={reloadData} 
                invoices={invoices}
                drafts={drafts}
              />
            </div>
          )}

          {/* TAB 3: SYSTEM SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <div className="px-8 pt-8">
              <div className="max-w-2xl bg-white p-8 rounded-[32px] border border-[#ebebeb] space-y-6 shadow-sm animate-fadeIn">
                <div>
                  <h2 className="text-xl font-extrabold text-black tracking-tight">Treasury & Tax Allocation Settings</h2>
                  <p className="text-xs text-slate-500">Configure the primary parameters governing paycheck dispatches and tax rules.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Target Paycheck (Bi-Weekly Payout)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-semibold">$</span>
                      <input
                        type="number"
                        required
                        id="paycheck-input"
                        value={paycheckInput}
                        onChange={(e) => setPaycheckInput(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 text-sm px-8 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      The salary buffer capacity will be scaled to 6x this paycheck size (${(parseFloat(paycheckInput) * 6 || 0).toLocaleString()}).
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Reserve Floor Threshold Cushion</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-semibold">$</span>
                      <input
                        type="number"
                        required
                        id="reserve-input"
                        value={reserveInput}
                        onChange={(e) => setReserveInput(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 text-sm px-8 py-2.5 rounded-xl border border-[#ebebeb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Cash floor maintained in checking account. Shore up logic runs first before any salary buffering.
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-[#ebebeb]">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">Progressive Tax Bracket Allocation</label>
                      <span className="text-[10px] text-slate-500 block">
                        Check this to calculate tax pool allocations progressively using US self-employment marginal rates.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="progressive-tax-checkbox"
                      checked={progressiveTaxInput}
                      onChange={(e) => setProgressiveTaxInput(e.target.checked)}
                      className="w-4 h-4 text-black border-slate-300 rounded focus:ring-black bg-white cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    id="save-settings-btn"
                    className="w-full bg-black hover:bg-neutral-800 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md"
                  >
                    Save Configuration Settings
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: INVOICES VIEW */}
          {activeTab === 'invoices' && (
            <Invoices
              invoices={invoices}
              drafts={drafts}
              dbService={dbService}
              onTriggerReload={reloadData}
            />
          )}

          {/* TAB 5: AI AGENT CHAT VIEW */}
          {activeTab === 'chat' && (
            <AgentChat
              dbService={dbService}
              onTriggerReload={reloadData}
              logs={logs}
              setActiveTab={setActiveTab}
            />
          )}

        </main>

        {/* Live Ledger Agent Console pinned at bottom of main content panel */}
        <SystemConsole logs={logs} isOpen={isConsoleOpen} setIsOpen={setIsConsoleOpen} />

        {/* Upload Bill / Receipt Floating Modal */}
        {isUploadModalOpen && (
          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            dbService={dbService}
            onTriggerReload={reloadData}
          />
        )}

      </div>
    </div>
  );
}
