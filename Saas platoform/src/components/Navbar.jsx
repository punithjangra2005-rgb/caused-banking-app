import React from 'react';
import { Shield, Activity, Database, Server, AlertTriangle, Layers, LogOut, User, Terminal, Sun, Moon } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, collectorStatus, alertCount, saasUser, supportUser, onLogout, theme, toggleTheme }) {
  const currentUser = activeTab === 'saas' ? saasUser : supportUser;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-white">Caused</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Tier-1 Bank Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Institutional Banking Telemetry & Multi-Tenant Core</p>
          </div>
        </div>

        {/* 2-Tier Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('saas')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'saas'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Tier 1: SaaS Banking</span>
          </button>
          
          <button
            onClick={() => setActiveTab('support')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
              activeTab === 'support'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Tier 2: Backend Support</span>
            {alertCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">
                {alertCount}
              </span>
            )}
          </button>
        </div>

        {/* User Session & Status */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold font-mono">
                {activeTab === 'saas' ? 'A' : 'S'}
              </div>
              <div className="hidden sm:block text-left">
                <span className="font-semibold text-white block leading-tight truncate max-w-[120px]">
                  {currentUser.full_name || currentUser.username}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentUser.accountant_id || currentUser.role || 'Active'}
                </span>
              </div>
              <button
                onClick={() => onLogout(activeTab)}
                title="Log out"
                className="ml-1 p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-2 text-xs text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-800/40">
              <User className="w-3.5 h-3.5" />
              <span>Authentication Required</span>
            </div>
          )}

          {/* Bank Dark / Milk White Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Milk White Bank' : 'Dark Banking Vault'} Theme`}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              theme === 'dark'
                ? 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-slate-800 hover:border-amber-500/50'
                : 'bg-white hover:bg-slate-50 text-blue-800 border-slate-300 hover:border-blue-500'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Milk White Bank</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-800" />
                <span className="hidden sm:inline">Dark Vault</span>
              </>
            )}
          </button>

          {/* Collector Status Badge */}
          <div className="hidden lg:flex items-center space-x-2 text-xs bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            {collectorStatus.online ? (
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-400 font-semibold">COLLECTOR ONLINE</span>
                <span className="text-slate-500 text-[10px]">
                  {collectorStatus.data?.collector_version || 'v2.4.0'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span className="text-rose-400 font-semibold">COLLECTOR OFFLINE</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
