import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SaasLogin from './components/SaasLogin';
import SupportLogin from './components/SupportLogin';
import SaaSPortal from './components/SaaSPortal';
import SupportConsole from './components/SupportConsole';
import { 
  checkCollectorHealth, 
  fetchScrubbedMetadata, 
  fetchLiveSupportMetrics, 
  fetchTelemetryLogs, 
  fetchRawVaultLogs, 
  fetchAiAlerts 
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('saas'); // 'saas' | 'support'
  const [collectorStatus, setCollectorStatus] = useState({ online: false, data: null });
  const [scrubbedRecords, setScrubbedRecords] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [aiAlerts, setAiAlerts] = useState([]);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [rawVaultLogs, setRawVaultLogs] = useState([]);

  // Theme Mode State ('light' | 'dark') - Defaults to Milk White Bank Theme
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('caused_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('dark');
    }
    try {
      localStorage.setItem('caused_theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Authentication State with localStorage persistence
  const [saasUser, setSaasUser] = useState(() => {
    try {
      const saved = localStorage.getItem('caused_saas_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [supportUser, setSupportUser] = useState(() => {
    try {
      const saved = localStorage.getItem('caused_support_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSaasLogin = (user) => {
    setSaasUser(user);
    try {
      localStorage.setItem('caused_saas_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSupportLogin = (user) => {
    setSupportUser(user);
    try {
      localStorage.setItem('caused_support_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = (tier) => {
    if (tier === 'saas') {
      setSaasUser(null);
      localStorage.removeItem('caused_saas_user');
    } else {
      setSupportUser(null);
      localStorage.removeItem('caused_support_user');
    }
  };

  const refreshAllData = async () => {
    try {
      const health = await checkCollectorHealth();
      setCollectorStatus({ online: true, data: health });
    } catch {
      setCollectorStatus({ online: false, data: null });
    }

    try {
      const tenantToQuery = saasUser?.tenant_id || null;
      const [meta, liveMetrics, alerts, telem, vault] = await Promise.all([
        fetchScrubbedMetadata(tenantToQuery).catch(() => []),
        fetchLiveSupportMetrics().catch(() => ({})),
        fetchAiAlerts().catch(() => []),
        fetchTelemetryLogs().catch(() => []),
        fetchRawVaultLogs().catch(() => [])
      ]);

      setScrubbedRecords(meta);
      setMetrics(liveMetrics);
      setAiAlerts(alerts);
      setTelemetryLogs(telem);
      setRawVaultLogs(vault);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  // Poll data periodically & when logged-in tenant changes
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 3000);
    return () => clearInterval(interval);
  }, [saasUser?.tenant_id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collectorStatus={collectorStatus}
        alertCount={aiAlerts.length}
        saasUser={saasUser}
        supportUser={supportUser}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!collectorStatus.online && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-sm flex items-center justify-between">
            <div>
              <strong>Collector Offline:</strong> Python FastAPI backend is not running on <code>http://127.0.0.1:8000</code>.
              Start it with <code>python main.py</code> in the <code>collector</code> directory.
            </div>
            <button 
              onClick={refreshAllData}
              className="px-3 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* TIER 1: SAAS BANKING PORTAL OR LOGIN */}
        {activeTab === 'saas' && (
          !saasUser ? (
            <SaasLogin onLoginSuccess={handleSaasLogin} />
          ) : (
            <SaaSPortal 
              currentUser={saasUser}
              scrubbedRecords={scrubbedRecords}
              onRecordAdded={refreshAllData}
              onNavigate={setActiveTab}
            />
          )
        )}

        {/* TIER 2: BACKEND SUPPORT CONSOLE OR LOGIN */}
        {activeTab === 'support' && (
          !supportUser ? (
            <SupportLogin onLoginSuccess={handleSupportLogin} />
          ) : (
            <SupportConsole 
              currentUser={supportUser}
              metrics={metrics}
              aiAlerts={aiAlerts}
              telemetryLogs={telemetryLogs}
              rawVaultLogs={rawVaultLogs}
              onRefresh={refreshAllData}
            />
          )
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-600">
        Caused Banking Telemetry • 2-Tier Architecture • Zero-PII TCL Data Policy • Distributed DFS Node Explorer
      </footer>
    </div>
  );
}
