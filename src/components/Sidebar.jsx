import React from 'react';

export default function Sidebar({ profile, activeTab, setActiveTab }) {
  return (
    /*
     * Outer shell: white background column so the page canvas shows around the sidebar.
     * This gives the "floating card on white plane" effect from the reference image.
     */
    <div className="w-[72px] shrink-0 bg-white flex items-stretch py-3 pl-3">
      {/* The actual black floating pill */}
      <aside className="flex-1 bg-[#0d0d0d] rounded-[28px] flex flex-col items-center py-5 shadow-[0_4px_32px_rgba(0,0,0,0.18)]">

        {/* Brand Logo — White circle with 'S' (matching Singular brand) */}
        <div className="mb-5 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md border border-gray-100 hover:scale-105 transition-transform cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0d0d0d]" fill="currentColor">
              <path d="M18.5 7.75c0-2.35-1.9-4.25-4.25-4.25h-4.5C7.4 3.5 5.5 5.4 5.5 7.75s1.9 4.25 4.25 4.25h1.5c1.24 0 2.25 1.01 2.25 2.25s-1.01 2.25-2.25 2.25h-4.5c-1.24 0-2.25-1.01-2.25-2.25v-.5a1 1 0 10-2 0v.5c0 2.35 1.9 4.25 4.25 4.25h4.5c2.35 0 4.25-1.9 4.25-4.25s-1.9-4.25-4.25-4.25h-1.5c-1.24 0-2.25-1.01-2.25-2.25s1.01-2.25 2.25-2.25h4.5c1.24 0 2.25 1.01 2.25 2.25v.5a1 1 0 102 0v-.5z" />
            </svg>
          </div>
        </div>

        {/* Quick Add Plus */}
        <div className="mb-6">
          <button
            onClick={() => setActiveTab('simulator')}
            className="w-8 h-8 rounded-full bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white flex items-center justify-center transition-colors"
            title="Simulate Event"
            id="sidebar-add-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* ── Primary Navigation ── */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">

          {/* Dashboard */}
          <button
            id="sidebar-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#0d0d0d] shadow-sm'
                : 'text-[#555] hover:text-white hover:bg-[#1e1e1e]'
            }`}
            title="Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </button>

          {/* People / Clients */}
          <button
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#444] hover:text-[#888] hover:bg-[#1a1a1a] transition-all cursor-not-allowed"
            title="Clients (Locked)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </button>

          {/* Folders */}
          <button
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#444] hover:text-[#888] hover:bg-[#1a1a1a] transition-all cursor-not-allowed"
            title="Folders (Locked)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>

          {/* Checklist / Tasks */}
          <button
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#444] hover:text-[#888] hover:bg-[#1a1a1a] transition-all cursor-not-allowed"
            title="Tasks (Locked)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>

          {/* Invoices / Document */}
          <button
            id="sidebar-invoices"
            onClick={() => setActiveTab('invoices')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'invoices'
                ? 'bg-white text-[#0d0d0d] shadow-sm'
                : 'text-[#444] hover:text-white hover:bg-[#1e1e1e]'
            }`}
            title="Invoices"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* AI Agent Chat */}
          <button
            id="sidebar-chat"
            onClick={() => setActiveTab('chat')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'chat'
                ? 'bg-white text-[#0d0d0d] shadow-sm'
                : 'text-[#444] hover:text-white hover:bg-[#1e1e1e]'
            }`}
            title="AI Agent Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          {/* 3D Cube / Products */}
          <button
            id="sidebar-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'simulator'
                ? 'bg-white text-[#0d0d0d] shadow-sm'
                : 'text-[#444] hover:text-white hover:bg-[#1e1e1e]'
            }`}
            title="Simulator / Events"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </button>

          {/* Bar chart / Analytics — active accent in reference */}
          <button
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#444] hover:text-[#888] hover:bg-[#1a1a1a] transition-all cursor-not-allowed"
            title="Analytics (Locked)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

        </nav>

        {/* ── Bottom Group ── */}
        <div className="flex flex-col items-center gap-3 mt-auto">

          {/* Settings */}
          <button
            id="sidebar-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-[#0d0d0d] shadow-sm'
                : 'text-[#444] hover:text-[#888] hover:bg-[#1a1a1a]'
            }`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Help */}
          <button
            className="text-[#444] hover:text-[#888] transition-colors cursor-not-allowed w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-[#1a1a1a]"
            title="Help / FAQ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* User Avatar */}
          <div className="relative cursor-pointer hover:scale-105 transition-transform mt-1">
            <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] overflow-hidden flex items-center justify-center bg-[#1a1a1a] shadow-md">
              {/* Circular avatar with initials — matches the profile image in reference */}
              <span className="text-white text-[11px] font-black">DU</span>
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10b981] border-2 border-[#0d0d0d]"></span>
          </div>

        </div>
      </aside>
    </div>
  );
}
