const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function checkCollectorHealth() {
  const res = await fetch(`${API_BASE_URL}/api/v1/health`);
  if (!res.ok) throw new Error('Collector unreachable');
  return res.json();
}

export async function loginSaasUser(accountant_id, password, tenant_id = null) {
  const payload = { accountant_id, password };
  if (tenant_id) payload.tenant_id = tenant_id;
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/saas/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Authentication failed');
  }
  return res.json();
}

export async function registerSaasUser(userData) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  return res.json();
}

export async function loginSupportUser(username, password) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/support/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Support authentication failed' }));
    throw new Error(err.detail || 'Support authentication failed');
  }
  return res.json();
}

export async function fetchSaasUsersDfs(tenant_id = null) {
  const url = tenant_id && tenant_id !== 'ALL'
    ? `${API_BASE_URL}/api/v1/support/saas-users?tenant_id=${encodeURIComponent(tenant_id)}`
    : `${API_BASE_URL}/api/v1/support/saas-users`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to retrieve SaaS users distributed file system directory');
  return res.json();
}

export async function ingestBankingEvent(eventData) {
  const startTime = performance.now();
  const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  });
  const latency = Math.round(performance.now() - startTime);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ingestion failed' }));
    throw new Error(err.detail || 'Ingestion failed');
  }
  const data = await res.json();
  data.clientMeasuredLatency = latency;
  return data;
}

export async function fetchScrubbedMetadata(tenant_id = null) {
  const url = tenant_id && tenant_id !== 'ALL'
    ? `${API_BASE_URL}/api/v1/saas/metadata?limit=50&tenant_id=${encodeURIComponent(tenant_id)}`
    : `${API_BASE_URL}/api/v1/saas/metadata?limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch scrubbed metadata');
  return res.json();
}

export async function fetchLiveSupportMetrics() {
  const res = await fetch(`${API_BASE_URL}/api/v1/support/metrics`);
  if (!res.ok) throw new Error('Failed to fetch support metrics');
  return res.json();
}

export async function fetchTenantsSummary() {
  const res = await fetch(`${API_BASE_URL}/api/v1/support/tenants`);
  if (!res.ok) throw new Error('Failed to fetch tenant environments');
  return res.json();
}

export async function fetchLocalSignals() {
  const res = await fetch(`${API_BASE_URL}/api/v1/support/local-signals`);
  if (!res.ok) throw new Error('Failed to fetch local signals');
  return res.json();
}

export async function fetchTelemetryLogs(tenant_id = null) {
  const url = tenant_id && tenant_id !== 'ALL'
    ? `${API_BASE_URL}/api/v1/support/telemetry-logs?limit=50&tenant_id=${encodeURIComponent(tenant_id)}`
    : `${API_BASE_URL}/api/v1/support/telemetry-logs?limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch telemetry logs');
  return res.json();
}

export async function fetchRawVaultLogs(tenant_id = null) {
  const url = tenant_id && tenant_id !== 'ALL'
    ? `${API_BASE_URL}/api/v1/support/raw-vault?limit=50&tenant_id=${encodeURIComponent(tenant_id)}`
    : `${API_BASE_URL}/api/v1/support/raw-vault?limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch raw vault logs');
  return res.json();
}

export async function fetchAiAlerts(tenant_id = null) {
  const url = tenant_id && tenant_id !== 'ALL'
    ? `${API_BASE_URL}/api/v1/support/ai-alerts?limit=30&tenant_id=${encodeURIComponent(tenant_id)}`
    : `${API_BASE_URL}/api/v1/support/ai-alerts?limit=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch AI alerts');
  return res.json();
}

export async function triggerAttackSimulation(attackType, tenant_id = 'tenant_hdfc') {
  const res = await fetch(`${API_BASE_URL}/api/v1/simulate/attack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attack_type: attackType, tenant_id })
  });
  if (!res.ok) throw new Error('Simulation trigger failed');
  return res.json();
}

export async function querySaasAiAssistant(prompt, currentRecords = []) {
  const res = await fetch(`${API_BASE_URL}/api/v1/saas/ai-assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, current_records: currentRecords })
  });
  if (!res.ok) throw new Error('AI Assistant request failed');
  return res.json();
}
