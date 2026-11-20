import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Send, 
  AlertOctagon, 
  CheckCircle2, 
  Sparkles, 
  Bot, 
  Search, 
  ArrowRight, 
  IndianRupee, 
  Compass, 
  CornerDownLeft,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Grid,
  FileText,
  BadgeAlert,
  SlidersHorizontal,
  Check,
  AlertCircle
} from 'lucide-react';
import { ingestBankingEvent, querySaasAiAssistant } from '../api';

export default function SaaSPortal({ currentUser, scrubbedRecords, onRecordAdded, onNavigate }) {
  // Navigation sub-tabs within SaaS block
  const [activeSubTab, setActiveSubTab] = useState('operation'); // 'operation' | 'history' | 'catalog'

  const [formData, setFormData] = useState({
    accountant_id: currentUser?.accountant_id || 'acc_charlotte_04',
    account_number: '501004829102', // Exactly 12 digits
    client_name: 'Aarav Sharma',
    date_of_birth: '1988-06-15',
    feature_accessed: 'deposit',
    amount: 50000
  });

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'DEPOSIT' | 'TRANSFER' | 'CRITICAL' | 'HIGH'

  // AI Assistant State (SaaS Block Copilot)
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Namaste! I am your AI Banking Assistant. I can help you process Deposits, prepare NEFT/Wires in Rupees (₹), and search customer histories with strictly enforced 12-digit account standards.',
      suggestions: [
        'Deposit ₹50,000 into 12-digit account',
        'Prepare International Wire for ₹75,000',
        'Show recent transactions history',
        'Find high risk transactions'
      ]
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // 12-Digit Account Number Validator
  const cleanAcc = (formData.account_number || '').replace(/[\s-]/g, '');
  const isAcc12Digits = cleanAcc.length === 12 && /^\d+$/.test(cleanAcc);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);

    if (!isAcc12Digits) {
      setNotification({
        type: 'error',
        text: `Validation Failed: Account number must be exactly 12 numeric digits (currently ${cleanAcc.length} digits).`
      });
      return;
    }

    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setNotification({
        type: 'error',
        text: `Invalid Amount: Transaction amount cannot be negative or empty. Please enter a valid positive value in Rupees (₹).`
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        tenant_id: currentUser?.tenant_id || 'tenant_hdfc',
        tenant_name: currentUser?.tenant_name || 'HDFC Bank Corporate',
        environment: currentUser?.environment || 'production',
        accountant_id: formData.accountant_id,
        account_number: cleanAcc,
        client_name: formData.client_name,
        date_of_birth: formData.date_of_birth,
        feature_accessed: formData.feature_accessed,
        amount: parseFloat(formData.amount) || 0,
        client_ip: '192.168.10.45',
        http_status: 200,
        latency_ms: Math.floor(Math.random() * 60) + 30,
        packet_loss_pct: parseFloat((Math.random() * 0.3).toFixed(2)),
        egress_bytes: Math.floor(Math.random() * 25000) + 1024,
        failed_login_count: 0,
        is_failed_login: false
      };

      const result = await ingestBankingEvent(payload);

      setNotification({
        type: 'success',
        text: `Success! ${formData.feature_accessed.toUpperCase()} of ₹${payload.amount.toLocaleString('en-IN')} executed for account ${result.scrubbed_metadata.masked_account_number}. Audit Ref #${result.audit_id}.`
      });

      if (onRecordAdded) onRecordAdded();
    } catch (err) {
      setNotification({
        type: 'error',
        text: `TCL transmission rejected: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFailedLogin = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const payload = {
        tenant_id: currentUser?.tenant_id || 'tenant_hdfc',
        tenant_name: currentUser?.tenant_name || 'HDFC Bank Corporate',
        environment: currentUser?.environment || 'production',
        accountant_id: formData.accountant_id,
        account_number: '998877665544', // Exactly 12 digits
        client_name: 'Suspicious Auth Attempt',
        date_of_birth: '1995-01-01',
        feature_accessed: 'accountant_auth_login',
        amount: 0,
        client_ip: '198.51.100.99',
        http_status: 401,
        latency_ms: 65,
        packet_loss_pct: 0.1,
        egress_bytes: 450,
        failed_login_count: 5,
        is_failed_login: true
      };

      const result = await ingestBankingEvent(payload);

      setNotification({
        type: 'warning',
        text: `Security Alert: 5 failed logins recorded for 12-digit account ${result.scrubbed_metadata.masked_account_number}. Tier 2 Support AI will triage this.`
      });

      if (onRecordAdded) onRecordAdded();
    } catch (err) {
      setNotification({
        type: 'error',
        text: `Telemetry error: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle AI Chat & Action Execution
  const handleSendAiPrompt = async (promptText) => {
    const textToSend = promptText || aiInput;
    if (!textToSend.trim()) return;

    const userMsg = { sender: 'user', text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await querySaasAiAssistant(textToSend, scrubbedRecords);
      
      const aiReply = {
        sender: 'ai',
        text: res.reply,
        action: res.action,
        suggestions: res.suggestions || [],
        source: res.ai_source
      };

      setChatMessages((prev) => [...prev, aiReply]);

      // Execute AI actions
      if (res.action) {
        if (res.action.type === 'FILL_FORM' && res.action.form_values) {
          setFormData((prev) => ({
            ...prev,
            ...res.action.form_values
          }));
          setActiveSubTab('operation');
        } else if (res.action.type === 'FILTER' && res.action.target) {
          setActiveFilter(res.action.target);
          setActiveSubTab('history');
        } else if (res.action.type === 'VIEW_TAB' && res.action.target === 'history') {
          setActiveSubTab('history');
        } else if (res.action.type === 'NAVIGATE' && res.action.target === 'support' && onNavigate) {
          setTimeout(() => onNavigate('support'), 1200);
        }
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Error communicating with AI Copilot: ${err.message}`,
          suggestions: ['Deposit ₹50,000', 'Prepare International Wire for ₹75,000']
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter transactions history
  const filteredRecords = scrubbedRecords.filter((rec) => {
    const matchesFilter = 
      activeFilter === 'ALL' ||
      (activeFilter === 'DEPOSIT' && (rec.feature_accessed || '').toLowerCase().includes('deposit')) ||
      (activeFilter === 'TRANSFER' && ((rec.feature_accessed || '').toLowerCase().includes('wire') || (rec.feature_accessed || '').toLowerCase().includes('transfer'))) ||
      rec.risk_level === activeFilter;

    if (!matchesFilter) return false;

    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      (rec.masked_account_number || '').toLowerCase().includes(q) ||
      (rec.client_token || '').toLowerCase().includes(q) ||
      (rec.feature_accessed || '').toLowerCase().includes(q)
    );
  });

  // Calculate high level dashboard totals in ₹
  const totalDepositAmount = scrubbedRecords
    .filter(r => (r.feature_accessed || '').toLowerCase().includes('deposit'))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const totalTransferAmount = scrubbedRecords
    .filter(r => (r.feature_accessed || '').toLowerCase().includes('wire'))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950/50 via-indigo-950/30 to-slate-900/60 border border-blue-800/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Tier 1 • Core SaaS Banking Engine</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                12-Digit Account Standard Enforced
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span>Tenant: {currentUser?.tenant_name || 'HDFC Bank Corporate'} [{currentUser?.tenant_id || 'tenant_hdfc'}]</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Bank Operations, Deposits & Customer Ledger</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Process customer deposits, international wires, and clearing transactions in Indian Rupees (₹).
              Strict multi-tenant partitioning ensures zero cross-customer data leakage.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {/* Profile Welcome Card */}
            {currentUser && (
              <div className="bg-slate-900/90 border border-blue-700/40 px-4 py-3 rounded-xl shadow-lg min-w-[220px]">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-600/30 text-blue-300 flex items-center justify-center font-bold text-base flex-shrink-0">
                    {currentUser.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <span className="text-white font-semibold text-sm block truncate">
                      Welcome, {currentUser.full_name}
                    </span>
                    <span className="text-slate-400 text-[11px] block truncate">
                      {currentUser.role} • {currentUser.department}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] block truncate">
                      {currentUser.accountant_id} @ {currentUser.assigned_branch}
                    </span>
                    <span className="text-blue-400 font-mono text-[10px] block truncate mt-0.5 font-semibold">
                      🔒 {currentUser.tenant_name || 'HDFC Bank'} ({currentUser.tenant_id || 'tenant_hdfc'})
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* TCL Policy Badge */}
            <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/60 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">TCL Zero-PII Policy Active</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">Total Deposits (₹)</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
              ₹{totalDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">Wires & Transfers (₹)</span>
            <span className="text-lg font-bold font-mono text-blue-400 mt-0.5 block">
              ₹{totalTransferAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">Total Ledger Entries</span>
            <span className="text-lg font-bold font-mono text-white mt-0.5 block">
              {scrubbedRecords.length} Records
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">Account Standard</span>
            <span className="text-lg font-bold font-mono text-purple-400 mt-0.5 block">
              Exactly 12 Digits
            </span>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm border ${
          notification.type === 'success' 
            ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800/50' 
            : notification.type === 'warning'
            ? 'bg-amber-950/60 text-amber-200 border-amber-800/50'
            : 'bg-rose-950/60 text-rose-200 border-rose-800/50'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertOctagon className="w-5 h-5 flex-shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('operation')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === 'operation'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
          <span>New Operation & Deposit</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === 'history'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-purple-300" />
          <span>Transactions History ({scrubbedRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('catalog')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === 'catalog'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Grid className="w-4 h-4 text-blue-300" />
          <span>Banking Features</span>
        </button>
      </div>

      {/* TAB 1: NEW OPERATION & DEPOSIT + AI COPILOT */}
      {activeSubTab === 'operation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Accountant Input Form with 12-Digit Validator */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="font-semibold text-lg text-white">Accountant Operation & Deposit Form</h2>
                  <p className="text-xs text-slate-400">Execute transactions in Indian Rupees (₹) with 12-digit account validation</p>
                </div>
                <Lock className="w-5 h-5 text-slate-500" />
              </div>

              {/* Quick Feature Shortcut Pills */}
              <div className="flex flex-wrap gap-2 mt-4 pb-2">
                {[
                  { key: 'deposit', label: 'Cash / Direct Deposit', color: 'emerald' },
                  { key: 'domestic_wire', label: 'Domestic NEFT / RTGS', color: 'blue' },
                  { key: 'international_wire', label: 'International Wire (SWIFT)', color: 'indigo' },
                  { key: 'credit_limit_override', label: 'Loan / Credit Revision', color: 'purple' }
                ].map((feat) => (
                  <button
                    key={feat.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, feature_accessed: feat.key })}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      formData.feature_accessed === feat.key
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-semibold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {feat.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Accountant ID</label>
                  <input
                    type="text"
                    value={formData.accountant_id}
                    onChange={(e) => setFormData({ ...formData, accountant_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                {/* 12-DIGIT ACCOUNT NUMBER INPUT WITH LIVE INDICATOR */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Customer Account Number <span className="text-rose-400">* (Exactly 12 Digits)</span>
                    </label>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded flex items-center space-x-1 ${
                      isAcc12Digits 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {isAcc12Digits ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      <span>{cleanAcc.length} / 12 digits {isAcc12Digits ? 'Valid' : 'Required'}</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => {
                      // Only allow digits, spaces, and hyphens, max 12 digits
                      const val = e.target.value.replace(/[^\d\s-]/g, '');
                      setFormData({ ...formData, account_number: val });
                    }}
                    placeholder="501004829102"
                    maxLength={14}
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono tracking-wider ${
                      isAcc12Digits ? 'border-emerald-600 focus:border-emerald-500' : 'border-slate-700 focus:border-blue-500'
                    }`}
                    required
                  />
                  {!isAcc12Digits && cleanAcc.length > 0 && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      ⚠️ Account number must contain exactly 12 digits before executing and transmitting.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Client Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="Aarav Sharma"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Date of Birth <span className="text-rose-400">* (PII)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Banking Feature</label>
                  <select
                    value={formData.feature_accessed}
                    onChange={(e) => setFormData({ ...formData, feature_accessed: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="deposit">Deposit Funds (Cash / Cheque / Online UPI) in ₹</option>
                    <option value="domestic_wire">Domestic Clearing / NEFT / RTGS (₹)</option>
                    <option value="international_wire">International Wire Transfer (SWIFT Inward / Outward ₹)</option>
                    <option value="credit_limit_override">Credit Limit Revision / Loan Approval (₹)</option>
                    <option value="foreign_exchange">Foreign Exchange Spot Deal (INR Hedging)</option>
                    <option value="account_freeze">Compliance Account Freeze</option>
                    <option value="view_balance">General Balance Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Transaction Value (Indian Rupees ₹) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      ₹
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className={`w-full bg-slate-950 border rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none font-mono ${
                        parseFloat(formData.amount) < 0
                          ? 'border-rose-600 focus:border-rose-500'
                          : 'border-slate-700 focus:border-blue-500'
                      }`}
                      placeholder="50000"
                    />
                  </div>
                  {parseFloat(formData.amount) < 0 && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 inline" />
                      <span>⚠️ Amount cannot be negative. Enter a valid rupee value (₹ ≥ 0).</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={loading || !isAcc12Digits}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'Transmitting to Collector...' : 'Execute & Transmit (₹)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateFailedLogin}
                    disabled={loading}
                    className="bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border border-rose-700/50 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1 transition-all disabled:opacity-50"
                    title="Simulates 5 failed logins with 12-digit account"
                  >
                    <span>Simulate Failed Auth</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="text-[11px] text-slate-500 pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span>Standard: Exactly 12 Digits (e.g. 501004829102)</span>
              <span>TCL Data Scrubbing enforced in Tier 2</span>
            </div>
          </div>

          {/* Right: AI-Assisted LLM Assistant (With Zero-Backend Disclosure Guardrail) */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg text-white flex items-center space-x-1.5">
                      <span>Caused AI Copilot</span>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    </h2>
                    <p className="text-xs text-slate-400">Accountant Assistant with strict privacy guardrail</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                  SaaS Copilot
                </span>
              </div>

              {/* Privacy Notice Badge */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 my-3 flex items-center space-x-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>Privacy Shield:</strong> Host telemetry & raw backend vault metrics are strictly blocked from this assistant.
                </span>
              </div>

              {/* Chat Message History */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-3 rounded-xl text-xs max-w-[92%] leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none'
                      }`}
                    >
                      <p>{msg.text}</p>
                      {msg.source && (
                        <span className="block mt-1 text-[9px] text-purple-400 font-mono">
                          via {msg.source}
                        </span>
                      )}
                    </div>

                    {/* Suggestion Chips */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendAiPrompt(sug)}
                            className="text-[10px] bg-slate-800/80 hover:bg-slate-700 text-purple-300 border border-slate-700 px-2 py-1 rounded-lg transition-all"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="text-xs text-purple-400 flex items-center space-x-2 py-1">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing banking records in Rupees (₹)...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAiPrompt()}
                  placeholder="Ask AI: 'Deposit ₹50,000' or 'Show high risk wires'..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => handleSendAiPrompt()}
                  disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-xl transition-all disabled:opacity-50"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                💡 Try: "Deposit ₹1,00,000" or "Show transaction history"
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: DEDICATED TRANSACTIONS HISTORY & LEDGER */}
      {activeSubTab === 'history' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          {/* Multi-Tenant Isolation Verification Banner */}
          <div className="bg-slate-950 p-3 rounded-xl border border-blue-900/40 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Multi-Tenant Data Partitioning Active:</strong> Showing ledger records exclusively isolated to tenant{' '}
                <span className="text-blue-300 font-bold font-mono">"{currentUser?.tenant_name || 'HDFC Bank Corporate'}"</span> ({currentUser?.tenant_id || 'tenant_hdfc'}). Cross-customer metadata access is strictly forbidden by policy.
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
              0 Leaks • Enforced
            </span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-lg text-white flex items-center space-x-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>Transactions History & Customer Ledger</span>
              </h3>
              <p className="text-xs text-slate-400">
                Audited transaction trails in Indian Rupees (₹) with 12-digit masked accounts (********XXXX)
              </p>
            </div>

            {/* Search Box */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by masked acc or token..."
                  className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-60"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {['ALL', 'DEPOSIT', 'TRANSFER', 'CRITICAL', 'HIGH'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setActiveFilter(tier)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all ${
                      activeFilter === tier
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Audit Ref</th>
                  <th className="px-4 py-3">Account (12-Digit Masked)</th>
                  <th className="px-4 py-3">Operation Type</th>
                  <th className="px-4 py-3">Feature Name</th>
                  <th className="px-4 py-3">Value (₹ INR)</th>
                  <th className="px-4 py-3">Age Bracket</th>
                  <th className="px-4 py-3">Risk Rating</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((row) => {
                    const isDeposit = (row.feature_accessed || '').toLowerCase().includes('deposit');
                    return (
                      <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-blue-400 font-semibold">#{row.raw_audit_id || row.id}</td>
                        <td className="px-4 py-3 text-slate-200 tracking-wider">
                          {row.masked_account_number}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDeposit 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {isDeposit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            <span>{isDeposit ? 'DEPOSIT' : 'TRANSFER'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 capitalize">
                          {(row.feature_accessed || 'operation').replace(/_/g, ' ')}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${isDeposit ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {isDeposit ? '+' : '-'} ₹{parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{row.age_bracket}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.risk_level === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                            row.risk_level === 'HIGH' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {row.risk_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(row.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-10 text-center text-slate-500">
                      No records found matching your search. Execute a deposit or wire transfer to populate the ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BANKING FEATURES CATALOG */}
      {activeSubTab === 'catalog' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="font-semibold text-lg text-white">Bank Features & Regulatory Controls</h3>
            <p className="text-xs text-slate-400">Select any banking capability to autofill into the accountant operations engine</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'deposit',
                title: 'Cash / Direct Deposit',
                desc: 'Credit funds directly into verified 12-digit customer account in Indian Rupees (₹).',
                risk: 'LOW RISK',
                actionAmount: 50000,
                color: 'emerald'
              },
              {
                id: 'domestic_wire',
                title: 'Domestic NEFT / RTGS',
                desc: 'Inter-bank fund settlement compliant with RBI clearing windows.',
                risk: 'MEDIUM RISK',
                actionAmount: 25000,
                color: 'blue'
              },
              {
                id: 'international_wire',
                title: 'International Wire Transfer',
                desc: 'Cross-border foreign exchange transfer with mandatory TCL audit trail.',
                risk: 'HIGH RISK',
                actionAmount: 75000,
                color: 'indigo'
              },
              {
                id: 'credit_limit_override',
                title: 'Loan & Credit Limit Revision',
                desc: 'Modify client loan eligibility and overdraft thresholds in Rupees (₹).',
                risk: 'HIGH RISK',
                actionAmount: 150000,
                color: 'purple'
              },
              {
                id: 'foreign_exchange',
                title: 'Forex Spot Deal (INR Hedging)',
                desc: 'Execute currency conversion against Indian Rupee benchmark rates.',
                risk: 'MEDIUM RISK',
                actionAmount: 80000,
                color: 'teal'
              },
              {
                id: 'account_freeze',
                title: 'Compliance Account Freeze',
                desc: 'Emergency freeze on account in response to anti-money laundering compliance flags.',
                risk: 'CRITICAL',
                actionAmount: 0,
                color: 'rose'
              }
            ].map((feat) => (
              <div
                key={feat.id}
                className="bg-slate-950 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {feat.risk}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">12-Digit Acc</span>
                  </div>
                  <h4 className="font-semibold text-sm text-white mb-1">{feat.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>

                <button
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      feature_accessed: feat.id,
                      amount: feat.actionAmount
                    }));
                    setActiveSubTab('operation');
                  }}
                  className="mt-4 w-full py-2 bg-slate-900 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1 border border-slate-800 hover:border-blue-500"
                >
                  <span>Select & Open Form</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
