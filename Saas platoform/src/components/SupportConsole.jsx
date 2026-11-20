import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Activity, 
  Wifi, 
  ShieldAlert, 
  Sparkles, 
  Terminal, 
  Flame, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Layers,
  Lock,
  Folder,
  FolderOpen,
  FileText,
  HardDrive,
  Network,
  KeyRound,
  UserCheck,
  CheckCircle2,
  Sliders,
  Server,
  Clock,
  Radio,
  FileCode,
  Shield
} from 'lucide-react';
import { 
  triggerAttackSimulation, 
  fetchSaasUsersDfs, 
  fetchTenantsSummary, 
  fetchLocalSignals,
  fetchRawVaultLogs,
  fetchTelemetryLogs,
  fetchAiAlerts
} from '../api';

export default function SupportConsole({ metrics, aiAlerts, telemetryLogs, rawVaultLogs, onRefresh }) {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'multi_tenant' | 'dfs_users'
  const [selectedTenant, setSelectedTenant] = useState('ALL'); // 'ALL' | 'tenant_hdfc' | 'tenant_icici' | 'tenant_sbi' | 'tenant_axis'
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Distributed File System (DFS) State
  const [dfsUsers, setDfsUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dfsLoading, setDfsLoading] = useState(false);
  const [dfsSearch, setDfsSearch] = useState('');

  // Multi-Tenant Environments & Local Signals State
  const [tenantsSummary, setTenantsSummary] = useState([]);
  const [localSignals, setLocalSignals] = useState([]);

  const loadData = async () => {
    setDfsLoading(true);
    try {
      const [users, tenants, signals] = await Promise.all([
        fetchSaasUsersDfs(selectedTenant).catch(() => []),
        fetchTenantsSummary().catch(() => []),
        fetchLocalSignals().catch(() => [])
      ]);
      setDfsUsers(users);
      setTenantsSummary(tenants);
      setLocalSignals(signals);
      if (users && users.length > 0 && !selectedUser) {
        setSelectedUser(users[0]);
      }
    } catch (err) {
      console.error('Support Console Load Error:', err);
    } finally {
      setDfsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTenant]);

  const handleSimulate = async (type) => {
    setSimulating(true);
    setSimResult(null);
    try {
      const targetTenant = selectedTenant === 'ALL' ? 'tenant_hdfc' : selectedTenant;
      const res = await triggerAttackSimulation(type, targetTenant);
      setSimResult(res.message);
      if (onRefresh) onRefresh();
      loadData();
    } catch (err) {
      setSimResult(`Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Filter raw logs by selected tenant
  const filteredRawLogs = rawVaultLogs.filter(r => selectedTenant === 'ALL' || r.tenant_id === selectedTenant);
  const filteredTelemLogs = telemetryLogs.filter(r => selectedTenant === 'ALL' || r.tenant_id === selectedTenant);
  const filteredAlerts = aiAlerts.filter(a => selectedTenant === 'ALL' || a.tenant_id === selectedTenant);
  const latestRaw = filteredRawLogs.length > 0 ? filteredRawLogs[0] : (rawVaultLogs.length > 0 ? rawVaultLogs[0] : null);

  // Group DFS users by Tenant, then Department
  const tenantGroups = {};
  dfsUsers.forEach(u => {
    const tId = u.tenant_id || 'tenant_hdfc';
    if (!tenantGroups[tId]) tenantGroups[tId] = {};
    const dept = u.department || 'General Banking';
    if (!tenantGroups[tId][dept]) tenantGroups[tId][dept] = [];
    tenantGroups[tId][dept].push(u);
  });

  const filteredDfsUsers = dfsUsers.filter(u => {
    if (!dfsSearch.trim()) return true;
    const q = dfsSearch.toLowerCase();
    return (
      (u.accountant_id || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q) ||
      (u.tenant_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-slate-900/60 border border-indigo-800/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Tier 2 • Backend Support & Telemetry Collector</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Multi-Tenant Isolation Enforced
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Local Signals Engine Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Collector Observability & Multi-Tenant Support Command</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Monitors host CPU, memory, disk, bandwidth, latency, and packet loss.
              Processes local signals to detect repeated authentication failures and correlates prioritized incidents with explainable recommendations.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Global Tenant Environment Filter */}
            <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-2 rounded-xl border border-indigo-700/60 text-xs">
              <Layers className="w-4 h-4 text-indigo-400" />
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-950 text-white">All Customer Environments (Global)</option>
                <option value="tenant_hdfc" className="bg-slate-950 text-white">HDFC Bank Corporate (tenant_hdfc)</option>
                <option value="tenant_icici" className="bg-slate-950 text-white">ICICI Bank Commercial (tenant_icici)</option>
                <option value="tenant_sbi" className="bg-slate-950 text-white">State Bank of India Global (tenant_sbi)</option>
                <option value="tenant_axis" className="bg-slate-950 text-white">Axis Wealth Management (tenant_axis)</option>
              </select>
            </div>

            <button
              onClick={() => { if (onRefresh) onRefresh(); loadData(); }}
              className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-200 transition-all shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Telemetry</span>
            </button>
          </div>
        </div>
      </div>

      {/* COLLECTOR STATUS, VERSION, LAST-SEEN & CONFIGURATION CARD */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base">Caused Telemetry Collector</span>
                <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ONLINE</span>
                </span>
                <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700">
                  {metrics.collector_version || 'v2.4.0-enterprise-multi-tenant'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized High-Security Banking Collector & Regulatory Anonymizer
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[10px]">LAST HEARTBEAT</span>
              <span className="text-emerald-400 font-semibold">{metrics.last_seen ? new Date(metrics.last_seen).toLocaleTimeString() : 'Active'}</span>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[10px]">PROCESS UPTIME</span>
              <span className="text-blue-400 font-semibold">{metrics.uptime_seconds || 120}s (Optimal)</span>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[10px]">ACTIVE PIDS</span>
              <span className="text-purple-400 font-semibold">{metrics.active_pids || 125} threads</span>
            </div>
          </div>
        </div>

        {/* Configuration Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-1">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">TCL Privacy Pipeline</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">ACTIVE (Zero-PII)</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Multi-Tenant Separation</span>
            <span className="text-xs font-bold text-indigo-400 font-mono">STRICT ENFORCED</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Local Signal Processor</span>
            <span className="text-xs font-bold text-teal-400 font-mono">ACTIVE (Ring-Buffer)</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Storage Vault</span>
            <span className="text-xs font-bold text-blue-400 font-mono">SQLITE WAL MODE</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">DFS Profile Nodes</span>
            <span className="text-xs font-bold text-purple-400 font-mono">{dfsUsers.length} Nodes Provisioned</span>
          </div>
        </div>
      </div>

      {/* Main Tier 2 Sub-Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'telemetry'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-300" />
          <span>Infra Telemetry & Incident Command</span>
        </button>

        <button
          onClick={() => setActiveTab('multi_tenant')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'multi_tenant'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-300" />
          <span>Customer Environments & Separation ({tenantsSummary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dfs_users')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative ${
            activeTab === 'dfs_users'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <HardDrive className="w-4 h-4 text-purple-300" />
          <span>SaaS Users Directory (DFS)</span>
          <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
            {dfsUsers.length} Nodes
          </span>
        </button>
      </div>

      {/* TAB 1: TELEMETRY & INCIDENT COMMAND */}
      {activeTab === 'telemetry' && (
        <div className="space-y-8">
          
          {/* COMPREHENSIVE RESOURCE MONITORING: 8 LIVE METRIC CARDS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Real-Time Host Resources & Connectivity Telemetry:
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Target: {selectedTenant === 'ALL' ? 'All Customer Partitions' : selectedTenant}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* 1. Host CPU */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">CPU</span>
                  <Cpu className={`w-3.5 h-3.5 ${metrics.cpu_pct > 80 ? 'text-rose-400 animate-pulse' : 'text-blue-400'}`} />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {metrics.cpu_pct !== undefined ? `${metrics.cpu_pct}%` : '--'}
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${metrics.cpu_pct > 80 ? 'bg-rose-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, metrics.cpu_pct || 0)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block">Active Cores</span>
              </div>

              {/* 2. Memory */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">RAM</span>
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {metrics.memory_pct !== undefined ? `${metrics.memory_pct}%` : '--'}
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.memory_pct || 0)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block font-mono">
                  {metrics.memory_used_gb || 0} / {metrics.memory_total_gb || 16} GB
                </span>
              </div>

              {/* 3. Disk Storage */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Disk</span>
                  <HardDrive className={`w-3.5 h-3.5 ${metrics.disk_pct > 90 ? 'text-amber-400' : 'text-purple-400'}`} />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {metrics.disk_pct !== undefined ? `${metrics.disk_pct}%` : '--'}
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.disk_pct || 0)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block font-mono truncate">
                  {metrics.disk_free_gb || 0} GB Free
                </span>
              </div>

              {/* 4. Service Availability */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Service</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {metrics.availability_pct ? `${metrics.availability_pct}%` : '99.98%'}
                </div>
                <span className="inline-block mt-2 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                  {metrics.service_availability || 'HEALTHY'}
                </span>
              </div>

              {/* 5. Ingress Bandwidth */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Ingress</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white truncate">
                  {metrics.bandwidth_ingress_kbps || 0} <span className="text-xs text-slate-400">KB/s</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block font-mono">
                  SaaS Request Flow
                </span>
              </div>

              {/* 6. Egress Bandwidth */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Egress</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white truncate">
                  {formatBytes(metrics.egress_bytes_sec)}/s
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block font-mono">
                  Telemetry & Scrubbed
                </span>
              </div>

              {/* 7. Roundtrip Latency */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Latency</span>
                  <Wifi className={`w-3.5 h-3.5 ${metrics.latency_ms > 400 ? 'text-amber-400' : 'text-teal-400'}`} />
                </div>
                <div className="text-xl font-bold font-mono text-white truncate">
                  {metrics.latency_ms || 35} <span className="text-xs text-slate-400">ms</span>
                </div>
                <span className={`inline-block mt-2 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                  metrics.latency_ms > 400 ? 'bg-amber-500/20 text-amber-300' : 'bg-teal-500/20 text-teal-300'
                }`}>
                  {metrics.latency_ms > 400 ? 'Degraded' : 'Optimal'}
                </span>
              </div>

              {/* 8. Packet Loss & Connectivity */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-medium uppercase font-mono">Loss / Ping</span>
                  <Radio className={`w-3.5 h-3.5 ${metrics.packet_loss_pct > 3 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {metrics.packet_loss_pct || 0}%
                </div>
                <span className={`inline-block mt-2 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                  metrics.packet_loss_pct > 3 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {metrics.connectivity || 'ONLINE'}
                </span>
              </div>
            </div>
          </div>

          {/* LOCALLY PROCESSED SIGNALS & REPEATED AUTH FAILURE TRACKER */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-lg text-white">Locally Processed Signals & Auth Failure Velocity</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                Engine: In-Memory Ring-Buffer Velocity Filter
              </span>
            </div>

            {localSignals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {localSignals.map((sig, idx) => (
                  <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-amber-800/40 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                        sig.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {sig.signal_type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Tenant: {sig.tenant_id}</span>
                    </div>
                    <p className="text-slate-200 mt-1">{sig.detail}</p>
                    <div className="mt-2 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Target: {Array.isArray(sig.target_id) ? sig.target_id.join(', ') : sig.target_id}</span>
                      <span>Source IP: {sig.client_ip}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-xs">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                <p>No repeated authentication failures or suspicious velocity surges flagged in the last 5 minutes.</p>
              </div>
            )}
          </div>

          {/* AI EVENT CORRELATION, PRIORITIZED INCIDENTS & EXPLAINABLE RECOMMENDATIONS */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-lg text-white">Correlated Incidents & Explainable Root Cause Recommendations</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                Prioritization: P1 (Critical) to P4 (Low)
              </span>
            </div>

            {filteredAlerts.length > 0 ? (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className="bg-slate-950 border border-slate-800 hover:border-purple-800/60 p-5 rounded-xl transition-all"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                          alert.severity === 'P1' ? 'bg-rose-500 text-white animate-pulse' :
                          alert.severity === 'P2' ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="font-semibold text-sm text-slate-100">{alert.incident_type}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          Tenant: {alert.tenant_id || 'tenant_hdfc'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-200 font-medium mb-3">{alert.summary}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-purple-400 font-semibold block mb-1.5 flex items-center space-x-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Explainable Root Cause Analysis:</span>
                        </span>
                        <p className="text-slate-300 leading-relaxed">{alert.root_cause}</p>
                      </div>
                      <div>
                        <span className="text-emerald-400 font-semibold block mb-1.5 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Actionable Support Recommendations:</span>
                        </span>
                        <p className="text-slate-300 whitespace-pre-line leading-relaxed">{alert.recommendations}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">No incidents flagged for this partition. Telemetry is within healthy limits.</p>
              </div>
            )}
          </div>

          {/* Attack / Anomaly Simulator */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-white flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-rose-400" />
                  <span>Bank Security & Attack Stress Simulator</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Target: <span className="text-indigo-400 font-mono font-bold">{selectedTenant === 'ALL' ? 'tenant_hdfc' : selectedTenant}</span> • Test signal correlation, brute force bursts, and egress exfiltration
                </p>
              </div>
              {simResult && (
                <span className="text-xs font-mono px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg">
                  {simResult}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                onClick={() => handleSimulate('brute_force')}
                disabled={simulating}
                className="p-3 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/60 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="text-xs font-bold text-rose-400 flex items-center justify-between">
                  <span>Brute Force</span>
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">7 failed logins in 5s (P1 Alert)</p>
              </button>

              <button
                onClick={() => handleSimulate('egress_exfiltration')}
                disabled={simulating}
                className="p-3 bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-700/60 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="text-xs font-bold text-purple-400 flex items-center justify-between">
                  <span>Exfiltration</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">14MB egress burst (P1 Alert)</p>
              </button>

              <button
                onClick={() => handleSimulate('latency_spike')}
                disabled={simulating}
                className="p-3 bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-700/60 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                  <span>Packet Loss</span>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">1150ms + 18% loss (P2)</p>
              </button>

              <button
                onClick={() => handleSimulate('cpu_exhaustion')}
                disabled={simulating}
                className="p-3 bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/60 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="text-xs font-bold text-red-400 flex items-center justify-between">
                  <span>CPU Spike</span>
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">96%+ CPU load (P2)</p>
              </button>

              <button
                onClick={() => handleSimulate('reset')}
                disabled={simulating}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>Reset State</span>
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Clear all stresses</p>
              </button>
            </div>
          </div>

          {/* TCL DATA PRIVACY PIPELINE */}
          <div className="bg-slate-900/80 border border-indigo-800/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                    <span>TCL Data Privacy & Multi-Tenant Pipeline</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                      Tier 2 Collector Engine
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Maintains regulatory zero-PII compliance and customer boundary isolation between Tier 2 and Tier 1
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-mono">Policy: Active (RBI/PCI-DSS/Multi-Tenant)</span>
              </div>
            </div>

            {/* Live Transformation Example from Vault */}
            {latestRaw && (
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-300">Live TCL Scrubbing Inspection (Audit Record #{latestRaw.id}):</span>
                  <span className="text-[11px] text-slate-500 font-mono">Tenant: {latestRaw.tenant_id} • Time: {new Date(latestRaw.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50">
                    <div className="flex items-center justify-between text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      <div className="flex items-center space-x-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Raw Ingress Data (Vaulted in Tier 2)</span>
                      </div>
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs space-y-1 font-mono text-slate-300">
                      <div><span className="text-slate-500">Tenant:</span> <span className="text-amber-400 font-bold">{latestRaw.tenant_id}</span> ({latestRaw.tenant_name})</div>
                      <div><span className="text-slate-500">Unmasked Acc:</span> {latestRaw.account_number}</div>
                      <div><span className="text-slate-500">Client Name:</span> {latestRaw.client_name}</div>
                      <div><span className="text-slate-500">Date of Birth:</span> {latestRaw.date_of_birth}</div>
                      <div><span className="text-slate-500">Value (INR):</span> ₹{parseFloat(latestRaw.amount || 0).toLocaleString('en-IN')}</div>
                      <div><span className="text-slate-500">Origin IP:</span> {latestRaw.client_ip}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/50">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      <div className="flex items-center space-x-1.5">
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>TCL Scrubbed Metadata (Emitted to Tier 1)</span>
                      </div>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs space-y-1 font-mono text-slate-300">
                      <div><span className="text-slate-500">Tenant Bound:</span> <span className="text-emerald-400 font-bold">{latestRaw.tenant_id}</span></div>
                      <div><span className="text-slate-500">Masked Acc:</span> <span className="text-emerald-400 font-bold">********{latestRaw.account_number ? latestRaw.account_number.slice(-4) : '9102'}</span></div>
                      <div><span className="text-slate-500">Client Token:</span> CLT_SECURE_{latestRaw.id}</div>
                      <div><span className="text-slate-500">Age Bracket:</span> [35-44] Anonymous</div>
                      <div><span className="text-slate-500">Risk Tier:</span> <span className="text-amber-300 font-semibold">{latestRaw.amount > 50000 ? 'HIGH' : 'LOW'}</span></div>
                      <div><span className="text-slate-500">Isolation:</span> 100% Zero PII & Zero Cross-Tenant Contamination</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dual Tables: Telemetry Logs & Raw Vault */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-white flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>Infra & Egress Telemetry</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">{filteredTelemLogs.length} events</span>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Tenant</th>
                      <th className="py-2 px-3">CPU</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Loss</th>
                      <th className="py-2 px-3">Egress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredTelemLogs.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-1.5 px-3 text-indigo-300">{log.tenant_id || 'tenant_hdfc'}</td>
                        <td className="py-1.5 px-3 text-blue-300">{log.cpu_pct}%</td>
                        <td className="py-1.5 px-3">{log.latency_ms}ms</td>
                        <td className="py-1.5 px-3 text-amber-300">{log.packet_loss_pct}%</td>
                        <td className="py-1.5 px-3 text-purple-300">{formatBytes(log.egress_bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-rose-400" />
                  <span>Unredacted Audit Vault (Backend Only)</span>
                </h4>
                <span className="text-[11px] text-rose-400/80 font-mono">Restricted SRE Access</span>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Tenant</th>
                      <th className="py-2 px-3">Acc No</th>
                      <th className="py-2 px-3">Client</th>
                      <th className="py-2 px-3">Amount (₹)</th>
                      <th className="py-2 px-3">Feature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredRawLogs.slice(0, 15).map((vault) => (
                      <tr key={vault.id} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-slate-500">#{vault.id}</td>
                        <td className="py-1.5 px-3 text-indigo-300">{vault.tenant_id}</td>
                        <td className="py-1.5 px-3 text-rose-300 font-bold">{vault.account_number}</td>
                        <td className="py-1.5 px-3 truncate max-w-[90px]">{vault.client_name}</td>
                        <td className="py-1.5 px-3 text-emerald-300">₹{parseFloat(vault.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-1.5 px-3 text-slate-400">{vault.feature_accessed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-TENANT CUSTOMER ENVIRONMENTS & SEPARATION ANALYTICS */}
      {activeTab === 'multi_tenant' && (
        <div className="space-y-6">
          {/* Multi-Tenant Segregation Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block">Customer Environments</span>
              <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">
                {tenantsSummary.length} Isolated Partitions
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">HDFC, ICICI, SBI, Axis</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block">Separation Status</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                STRICT ENFORCED
              </span>
              <span className="text-[11px] text-emerald-500/80 mt-1 block">100% Database Partitioning</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block">Cross-Contamination</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                0 Leaks
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">Zero Cross-Tenant Leakage</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block">Regulatory Compliance</span>
              <span className="text-2xl font-bold font-mono text-purple-400 mt-1 block">
                RBI / PCI-DSS
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">Zero-PII Tokenization</span>
            </div>
          </div>

          {/* Tenants Directory Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-lg text-white mb-2">Customer Environment Partitions & Isolation Matrix</h3>
            <p className="text-xs text-slate-400 mb-4">
              Each customer environment operates under dedicated schema constraints, DFS node hierarchies, and isolated audit pipelines.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tenant ID</th>
                    <th className="py-3 px-4">Organization Name</th>
                    <th className="py-3 px-4">Environment</th>
                    <th className="py-3 px-4">Cloud Region</th>
                    <th className="py-3 px-4">Accountants</th>
                    <th className="py-3 px-4">Transactions</th>
                    <th className="py-3 px-4">Total Volume (₹)</th>
                    <th className="py-3 px-4">Isolation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {tenantsSummary.map((t) => (
                    <tr key={t.tenant_id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-blue-400">{t.tenant_id}</td>
                      <td className="py-3 px-4 text-white font-sans font-semibold">{t.tenant_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.environment === 'production' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {t.environment.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{t.region}</td>
                      <td className="py-3 px-4 text-purple-300">{t.accountants_count} Users</td>
                      <td className="py-3 px-4 text-slate-300">{t.total_transactions} txns</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">₹{parseFloat(t.volume_inr || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          ✓ {t.isolation_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SAAS USERS DISTRIBUTED FILE SYSTEM (DFS) EXPLORER */}
      {activeTab === 'dfs_users' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-lg text-white">SaaS Users Distributed File System (DFS) Node Explorer</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-Tenant Hierarchical Object Tree: <code>/dfs/tenants/[tenant_id]/[department]/[accountant_id].profile</code>
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={dfsSearch}
                onChange={(e) => setDfsSearch(e.target.value)}
                placeholder="Search DFS inodes or IDs..."
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-60"
              />
              <span className="text-xs px-3 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                {filteredDfsUsers.length} Inode Profiles
              </span>
            </div>
          </div>

          {/* Master-Detail Split Screen */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Distributed Tree View */}
            <div className="lg:col-span-5 bg-slate-950 rounded-xl p-4 border border-slate-800 max-h-[500px] overflow-y-auto">
              <span className="text-[10px] font-mono uppercase text-slate-500 block mb-3">
                Cluster Mount: /dfs/tenants/
              </span>

              {Object.keys(tenantGroups).map((tId) => (
                <div key={tId} className="mb-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-400 font-mono mb-2">
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span>{tId}</span>
                  </div>

                  <div className="pl-4 space-y-2 border-l border-slate-800 ml-2">
                    {Object.keys(tenantGroups[tId]).map((dept) => (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400">
                          <Folder className="w-3.5 h-3.5 text-slate-500" />
                          <span>{dept}</span>
                        </div>

                        <div className="pl-4 space-y-1 border-l border-slate-850 ml-1.5">
                          {tenantGroups[tId][dept].map((u) => (
                            <button
                              key={u.accountant_id}
                              onClick={() => setSelectedUser(u)}
                              className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                                selectedUser?.accountant_id === u.accountant_id
                                  ? 'bg-indigo-600 text-white shadow-md'
                                  : 'hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <FileCode className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                <span className="truncate">{u.accountant_id}.profile</span>
                              </div>
                              <span className="text-[10px] opacity-75">{u.dfs_metadata?.inode}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Selected Node Inode Inspection */}
            <div className="lg:col-span-7 bg-slate-950 rounded-xl p-6 border border-slate-800">
              {selectedUser ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center space-x-2">
                        <span>{selectedUser.full_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                          {selectedUser.status}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedUser.role} • {selectedUser.department} • {selectedUser.assigned_branch}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-800/60">
                      Tenant: {selectedUser.tenant_id}
                    </span>
                  </div>

                  {/* DFS Inode Details */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">INODE ID</span>
                      <span className="text-indigo-400 font-bold">{selectedUser.dfs_metadata?.inode}</span>
                    </div>

                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">FILE PERMISSIONS</span>
                      <span className="text-emerald-400 font-bold">{selectedUser.dfs_metadata?.permissions}</span>
                    </div>

                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">REPLICATION FACTOR</span>
                      <span className="text-purple-400 font-bold">{selectedUser.dfs_metadata?.replica_count}x Nodes</span>
                    </div>

                    <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">RECORD BLOCK SIZE</span>
                      <span className="text-amber-400 font-bold">{selectedUser.dfs_metadata?.block_size_bytes} Bytes</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <span className="text-slate-500 block text-[10px] mb-1">DISTRIBUTED VIRTUAL MOUNT PATH</span>
                    <span className="text-slate-200 select-all">{selectedUser.dfs_metadata?.file_path}</span>
                  </div>

                  <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <span className="text-slate-500 block text-[10px] mb-1">SALTED SHA-256 INTEGRITY CHECKSUM</span>
                    <span className="text-slate-400 select-all">{selectedUser.dfs_metadata?.checksum_sha256}</span>
                  </div>

                  {/* Activity Stats */}
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Total Audited Transactions</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {selectedUser.dfs_metadata?.activity_stats?.total_transactions || 0} Records
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Audited Turnover</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        ₹{parseFloat(selectedUser.dfs_metadata?.activity_stats?.total_volume_inr || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500">
                  <HardDrive className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p>Select a user profile node on the left to inspect DFS inode attributes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
