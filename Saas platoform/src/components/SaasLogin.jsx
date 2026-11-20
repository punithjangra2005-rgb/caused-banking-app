import React, { useState } from 'react';
import { Lock, User, Shield, AlertCircle, CheckCircle2, ArrowRight, KeyRound, Building, Sparkles, Layers } from 'lucide-react';
import { loginSaasUser, registerSaasUser } from '../api';

const TENANT_OPTIONS = [
  { id: 'tenant_hdfc', name: 'HDFC Bank Corporate', env: 'production', badge: 'PROD • ap-south-1' },
  { id: 'tenant_icici', name: 'ICICI Bank Commercial', env: 'production', badge: 'PROD • ap-south-1' },
  { id: 'tenant_sbi', name: 'State Bank of India Global', env: 'production', badge: 'PROD • ap-south-2' },
  { id: 'tenant_axis', name: 'Axis Wealth Management', env: 'staging', badge: 'STAGING • ap-south-1' }
];

export default function SaasLogin({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    accountant_id: 'acc_charlotte_04',
    password: 'Caused@Bank2026!',
    tenant_id: 'tenant_hdfc'
  });

  // Register form state with tenant isolation
  const [regForm, setRegForm] = useState({
    tenant_id: 'tenant_hdfc',
    tenant_name: 'HDFC Bank Corporate',
    environment: 'production',
    accountant_id: '',
    full_name: '',
    department: 'Retail Banking',
    assigned_branch: 'Mumbai Central',
    password: ''
  });

  // Live Password Strength Check
  const pwd = regForm.password;
  const hasMinLen = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd);
  const isStrong = hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;

  const strengthScore = [hasMinLen, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginSaasUser(loginForm.accountant_id, loginForm.password, loginForm.tenant_id);
      if (onLoginSuccess) onLoginSuccess(res.user);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isStrong) {
      setErrorMsg("Password does not meet bank-grade security requirements. Check the checklist below.");
      return;
    }

    if (!regForm.accountant_id.trim()) {
      setErrorMsg("accountant_id cannot be blank.");
      return;
    }

    setLoading(true);
    try {
      const tenantMatch = TENANT_OPTIONS.find(t => t.id === regForm.tenant_id);
      const payload = {
        ...regForm,
        tenant_name: tenantMatch?.name || 'HDFC Bank Corporate',
        environment: tenantMatch?.env || 'production'
      };
      const res = await registerSaasUser(payload);
      setSuccessMsg(`Registration successful for ${res.accountant_id} under tenant [${res.tenant_id}]! You can now sign in.`);
      setLoginForm({
        accountant_id: regForm.accountant_id,
        password: regForm.password,
        tenant_id: regForm.tenant_id
      });
      setMode('login');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (id, pwd, tid) => {
    setLoginForm({ accountant_id: id, password: pwd, tenant_id: tid });
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Tier 1: SaaS Banking Portal</h2>
        <p className="text-xs text-slate-400 mt-1">
          Strict Multi-Tenant Separation & Zero-PII Privacy Enforced
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
        <button
          type="button"
          onClick={() => { setMode('login'); setErrorMsg(null); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Accountant Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setErrorMsg(null); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Create Profile
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* MODE 1: LOGIN */}
      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Customer Environment / Tenant <span className="text-blue-400">*</span>
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={loginForm.tenant_id}
                onChange={(e) => setLoginForm({ ...loginForm, tenant_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                {TENANT_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} [{t.badge}]
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              🔒 Strict isolation: You will only access records for this customer environment.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Accountant ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={loginForm.accountant_id}
                onChange={(e) => setLoginForm({ ...loginForm, accountant_id: e.target.value })}
                placeholder="e.g. acc_charlotte_04"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating & Partitioning...' : 'Sign In to SaaS Platform'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Demo Credentials Quick Picker */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block mb-2">
              Preset Demo Multi-Tenant Profiles:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleDemoFill('acc_charlotte_04', 'Caused@Bank2026!', 'tenant_hdfc')}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-slate-300 font-mono transition-all"
              >
                <div className="font-bold text-blue-400">acc_charlotte_04</div>
                <div className="text-[10px] text-slate-500">HDFC Bank (Treasury)</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('acc_aarav_09', 'Aarav@Bank2026!', 'tenant_icici')}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-slate-300 font-mono transition-all"
              >
                <div className="font-bold text-emerald-400">acc_aarav_09</div>
                <div className="text-[10px] text-slate-500">ICICI Bank (Retail)</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('acc_priya_12', 'Priya@Audit2026!', 'tenant_sbi')}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-slate-300 font-mono transition-all"
              >
                <div className="font-bold text-purple-400">acc_priya_12</div>
                <div className="text-[10px] text-slate-500">SBI (Compliance)</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('acc_rohan_15', 'Rohan@Axis2026!', 'tenant_axis')}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-slate-300 font-mono transition-all"
              >
                <div className="font-bold text-amber-400">acc_rohan_15</div>
                <div className="text-[10px] text-slate-500">Axis (Wealth Staging)</div>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* MODE 2: REGISTER WITH 1 ACCOUNT PER ACCOUNT_ID + STRONG PASSWORD POLICY + TENANT */
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Customer Environment / Tenant <span className="text-blue-400">*</span>
            </label>
            <select
              value={regForm.tenant_id}
              onChange={(e) => {
                const sel = TENANT_OPTIONS.find(t => t.id === e.target.value);
                setRegForm({
                  ...regForm,
                  tenant_id: e.target.value,
                  tenant_name: sel?.name || 'HDFC Bank Corporate',
                  environment: sel?.env || 'production'
                });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
            >
              {TENANT_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.badge})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Accountant ID <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] font-mono text-amber-400">Policy: Max 1 Per ID</span>
            </div>
            <input
              type="text"
              value={regForm.accountant_id}
              onChange={(e) => setRegForm({ ...regForm, accountant_id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="e.g. acc_rohan_15"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Full Legal Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={regForm.full_name}
              onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
              placeholder="e.g. Rohan Verma"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
              <select
                value={regForm.department}
                onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Retail Banking">Retail Banking</option>
                <option value="Treasury & Markets">Treasury & Markets</option>
                <option value="AML & Risk Management">AML & Risk</option>
                <option value="Corporate Credit">Corporate Credit</option>
                <option value="Private Wealth">Private Wealth</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Branch</label>
              <input
                type="text"
                value={regForm.assigned_branch}
                onChange={(e) => setRegForm({ ...regForm, assigned_branch: e.target.value })}
                placeholder="Mumbai Central"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* STRONG PASSWORD FIELD WITH LIVE AUDIT CHECKLIST */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Strong Password <span className="text-rose-400">*</span>
              </label>
              <span className={`text-[10px] font-mono font-bold ${
                isStrong ? 'text-emerald-400' : strengthScore >= 3 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {isStrong ? 'Strong ✓' : strengthScore >= 3 ? 'Moderate' : 'Weak'}
              </span>
            </div>
            <input
              type="password"
              value={regForm.password}
              onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              placeholder="e.g. Secure@Bank2026!"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />

            {/* Password meter progress bar */}
            <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden flex gap-0.5">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-full transition-all ${
                    strengthScore >= step
                      ? isStrong ? 'bg-emerald-500' : 'bg-amber-500'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[10px] text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className={hasMinLen ? 'text-emerald-400 font-semibold' : ''}>
                {hasMinLen ? '✓' : '•'} 8+ characters
              </span>
              <span className={hasUpper ? 'text-emerald-400 font-semibold' : ''}>
                {hasUpper ? '✓' : '•'} Uppercase (A-Z)
              </span>
              <span className={hasLower ? 'text-emerald-400 font-semibold' : ''}>
                {hasLower ? '✓' : '•'} Lowercase (a-z)
              </span>
              <span className={hasNumber ? 'text-emerald-400 font-semibold' : ''}>
                {hasNumber ? '✓' : '•'} Number (0-9)
              </span>
              <span className={`col-span-2 ${hasSpecial ? 'text-emerald-400 font-semibold' : ''}`}>
                {hasSpecial ? '✓' : '•'} Special char (!@#$%^&* etc.)
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isStrong}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <span>{loading ? 'Validating & Provisioning Node...' : 'Register Profile in Isolated Tenant'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-[10px] text-slate-500">
        Bank Security Policy: Exactly 1 profile permitted per accountant_id attribute • Strict Tenant Isolation Enforced.
      </div>
    </div>
  );
}
