import React, { useState } from 'react';
import { Lock, UserCheck, ShieldAlert, AlertCircle, ArrowRight, Server, KeyRound, Terminal } from 'lucide-react';
import { loginSupportUser } from '../api';

export default function SupportLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('support_admin');
  const [password, setPassword] = useState('Support@Caused2026!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginSupportUser(username, password);
      if (onLoginSuccess) onLoginSuccess(res.user);
    } catch (err) {
      setErrorMsg(err.message || 'Support login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-900/90 border border-indigo-900/50 rounded-2xl p-8 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Top Banner & Icon */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3">
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Tier 2: Backend Support Console</h2>
        <p className="text-xs text-indigo-300/80 mt-1">
          Observability, Distributed Node Explorer & AI Incident Command
        </p>
      </div>

      <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/40 mb-6 flex items-start space-x-2 text-xs text-indigo-300">
        <ShieldAlert className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Authorized SRE Access Only:</strong> This console has access to raw telemetry streams, encrypted database vaults, and the SaaS Distributed Profile Explorer.
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Support Admin Username
          </label>
          <div className="relative">
            <UserCheck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="support_admin"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Support Root Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span>{loading ? 'Authenticating SRE Session...' : 'Authenticate to Backend Support'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Demo Credentials Quick Click */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Demo SRE Admin:</span>
            <button
              type="button"
              onClick={() => {
                setUsername('support_admin');
                setPassword('Support@Caused2026!');
              }}
              className="text-indigo-400 hover:text-indigo-300 font-mono underline"
            >
              Fill Default Credentials
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
