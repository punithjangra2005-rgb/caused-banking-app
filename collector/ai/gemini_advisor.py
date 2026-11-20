import json
import logging
import requests
from typing import Dict, Any, Optional
from config import GEMINI_API_KEY

logger = logging.getLogger("gemini_advisor")

def generate_ai_incident_report(
    incident_trigger: str,
    metrics: Dict[str, Any],
    audit_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Leverages Google Gemini 2.5/1.5 Flash Free Tier to conduct root-cause analysis
    and generate triage recommendations for backend support.
    Falls back gracefully to a heuristic triage generator if GEMINI_API_KEY is not set.
    """
    if GEMINI_API_KEY and GEMINI_API_KEY.strip():
        try:
            return _call_gemini_api(incident_trigger, metrics, audit_context)
        except Exception as e:
            logger.warning(f"Gemini API call failed ({e}), falling back to heuristic engine.")

    return _generate_heuristic_triage(incident_trigger, metrics, audit_context)

def _call_gemini_api(
    incident_trigger: str,
    metrics: Dict[str, Any],
    audit_context: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Direct REST invocation to Google Gemini Flash free tier.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""
You are an expert Bank Cybersecurity and Infrastructure Reliability Engineer for 'Caused' Banking Telemetry Platform.
An anomaly has been flagged in real-time. Analyze the telemetry stats and audit context below and produce an incident report.

Trigger Reason: {incident_trigger}
Telemetry Metrics:
{json.dumps(metrics, indent=2)}

SaaS Banking Audit Context:
{json.dumps(audit_context or {}, indent=2)}

You MUST respond strictly in valid JSON matching this schema:
{{
  "incident_type": "SECURITY_BREACH | INFRA_DEGRADATION | DATA_EXFILTRATION | HIGH_LATENCY",
  "severity": "P1 | P2 | P3 | P4",
  "summary": "Concise 1-2 sentence description of what occurred",
  "root_cause": "Technical explanation of the underlying failure or attack pattern",
  "recommendations": "Bulleted list of immediate remediation actions for support engineers"
}}
Do not include markdown code fence formatting outside the JSON if possible, return raw parseable JSON.
"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    resp = requests.post(url, json=payload, timeout=12)
    resp.raise_for_status()
    data = resp.json()
    
    text_content = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(text_content)
    parsed["ai_source"] = "Google Gemini 2.5 Flash (Free Tier)"
    return parsed

def _generate_heuristic_triage(
    incident_trigger: str,
    metrics: Dict[str, Any],
    audit_context: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Smart deterministic heuristic engine for zero-config offline usage.
    """
    fails = int(metrics.get("failed_logins", 0))
    loss = float(metrics.get("packet_loss_pct", 0.0))
    lat = float(metrics.get("latency_ms", 0.0))
    egress_mb = float(metrics.get("egress_bytes", 0)) / (1024 * 1024)
    cpu = float(metrics.get("cpu_pct", 0.0))

    if fails >= 5 or "Brute force" in incident_trigger:
        return {
            "incident_type": "SECURITY_BREACH",
            "severity": "P1",
            "summary": f"Credential brute-force surge detected: {fails} failed authentication attempts within tight time window.",
            "root_cause": "Automated dictionary or credential stuffing attack targeting the SaaS accountant auth endpoint.",
            "recommendations": "1. Temporarily ban the originating IP in firewall. 2. Enforce MFA step-up. 3. Lock targeted accountant ID.",
            "ai_source": "Local AI Rule-Based Advisor (Set GEMINI_API_KEY for full LLM analysis)"
        }
    elif egress_mb >= 3.0 or "exfiltration" in incident_trigger:
        return {
            "incident_type": "DATA_EXFILTRATION",
            "severity": "P1",
            "summary": f"Abnormal outbound data volume detected ({egress_mb:.1f} MB egress in short burst).",
            "root_cause": "High volume of banking records or bulk exports transferred outside normal operational baselines.",
            "recommendations": "1. Inspect egress destination IP. 2. Verify accountant authorization for bulk export. 3. Terminate suspect TCP session.",
            "ai_source": "Local AI Rule-Based Advisor (Set GEMINI_API_KEY for full LLM analysis)"
        }
    elif loss >= 4.0 or lat >= 400.0:
        return {
            "incident_type": "INFRA_DEGRADATION",
            "severity": "P2",
            "summary": f"Significant network degradation: {loss:.1f}% packet loss and {lat:.1f}ms latency.",
            "root_cause": "Network gateway congestion or edge route flapping impacting inter-service telemetry transmission.",
            "recommendations": "1. Failover to secondary peering connection. 2. Verify upstream ISP health. 3. Scale ingress buffers.",
            "ai_source": "Local AI Rule-Based Advisor (Set GEMINI_API_KEY for full LLM analysis)"
        }
    elif cpu >= 85.0:
        return {
            "incident_type": "INFRA_EXHAUSTION",
            "severity": "P2",
            "summary": f"Host compute saturation: CPU utilization sustained at {cpu:.1f}%.",
            "root_cause": "Unoptimized cryptographic batch hashing or database lock contention under heavy banking transaction volume.",
            "recommendations": "1. Scale worker processes. 2. Inspect slow queries on SQLite vault. 3. Restart stuck worker threads.",
            "ai_source": "Local AI Rule-Based Advisor (Set GEMINI_API_KEY for full LLM analysis)"
        }
    else:
        return {
            "incident_type": "ANOMALY_MONITOR",
            "severity": "P3",
            "summary": f"Telemetry deviation flagged by IsolationForest: {incident_trigger}.",
            "root_cause": "Multivariate drift across system telemetry and banking audit frequency.",
            "recommendations": "1. Monitor trend over next 5 minutes. 2. Review recent SaaS deployment changelog.",
            "ai_source": "Local AI Rule-Based Advisor (Set GEMINI_API_KEY for full LLM analysis)"
        }
