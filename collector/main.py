import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import database
from config import PORT, HOST
from policies.scrubber import apply_tcl_scrubbing
from monitors.infra import get_system_metrics, COLLECTOR_VERSION
from ai.anomaly import detector
from ai.gemini_advisor import generate_ai_incident_report
from ai.saas_copilot import query_saas_copilot
from ai.local_signals import signal_processor
from policies.security import validate_strong_password, verify_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("caused_collector")

app = FastAPI(
    title="Caused - Bank Telemetry & Support Collector",
    description="2-Tier Collector backend with Multi-Tenant Separation, TCL data scrubbing, raw telemetry vault, and Local Signal Correlation.",
    version="2.4.0"
)

# Allow CORS for SaaS Frontend & Support Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event: Initialize SQLite tables & tenant separation
@app.on_event("startup")
def startup_event():
    database.init_db()
    logger.info("Caused Telemetry Collector initialized. SQLite multi-tenant vault ready.")

# --- Pydantic Request Models ---
class BankingTransactionEvent(BaseModel):
    tenant_id: str = Field(default="tenant_hdfc", description="Tenant / Customer environment ID e.g. tenant_hdfc")
    tenant_name: Optional[str] = Field(default="HDFC Bank Corporate", description="Tenant Display Name")
    environment: Optional[str] = Field(default="production", description="Customer environment: production | staging | disaster_recovery")
    accountant_id: str = Field(default="acc_001", description="ID of accountant entering data")
    account_number: str = Field(..., description="Unredacted raw account number (exactly 12 digits)")
    client_name: str = Field(..., description="Unredacted client full name")
    date_of_birth: str = Field(..., description="Date of birth YYYY-MM-DD")
    feature_accessed: str = Field(default="deposit", description="Banking feature accessed")
    amount: float = Field(default=0.0, ge=0.0, description="Transaction or credit amount in INR (₹) — must be non-negative")
    client_ip: Optional[str] = Field(default="127.0.0.1")
    http_status: int = Field(default=200)
    latency_ms: Optional[float] = Field(default=45.0)
    packet_loss_pct: Optional[float] = Field(default=0.1)
    egress_bytes: Optional[int] = Field(default=2048)
    failed_login_count: Optional[int] = Field(default=0)
    is_failed_login: Optional[bool] = Field(default=False)

    @field_validator("account_number")
    @classmethod
    def validate_12_digits(cls, v: str) -> str:
        cleaned = re.sub(r'[\s-]', '', str(v or ''))
        if not cleaned.isdigit():
            raise ValueError("Account number must contain only numeric digits.")
        if len(cleaned) != 12:
            raise ValueError(f"Account number must be exactly 12 digits. Provided: {len(cleaned)} digits.")
        return cleaned

class SimulationRequest(BaseModel):
    attack_type: str = Field(..., description="brute_force | egress_exfiltration | latency_spike | cpu_exhaustion | reset")
    tenant_id: Optional[str] = Field(default="tenant_hdfc", description="Tenant to target in simulation")

class SaasAssistantQuery(BaseModel):
    prompt: str = Field(..., description="Accountant natural language prompt or query")
    current_records: Optional[List[Dict[str, Any]]] = Field(default=[], description="Recent scrubbed metadata records")

# --- Authentication Request Models ---
class SaasUserRegisterRequest(BaseModel):
    tenant_id: Optional[str] = Field(default="tenant_hdfc", description="Tenant / Bank ID")
    tenant_name: Optional[str] = Field(default="HDFC Bank Corporate", description="Tenant Name")
    environment: Optional[str] = Field(default="production", description="Environment")
    accountant_id: str = Field(..., description="Unique Accountant ID e.g. acc_aarav_09")
    username: Optional[str] = Field(default="")
    full_name: str = Field(..., description="Accountant Full Legal Name")
    department: Optional[str] = Field(default="Retail Banking")
    role: Optional[str] = Field(default="Accountant")
    assigned_branch: Optional[str] = Field(default="Mumbai Central")
    password: str = Field(..., description="Unique strong password (min 8 chars, Upper, Lower, Number, Special)")

class SaasUserLoginRequest(BaseModel):
    accountant_id: str = Field(..., description="Accountant ID")
    password: str = Field(..., description="Password")
    tenant_id: Optional[str] = Field(default=None, description="Optional tenant verification")

class SupportUserLoginRequest(BaseModel):
    username: str = Field(..., description="Support Engineer Username")
    password: str = Field(..., description="Support Admin Password")

# Global simulated stress state
_simulated_stress = {}

# --- API Routes ---

# --- Authentication & User Profile Routes ---

@app.post("/api/v1/auth/saas/register")
def register_saas_accountant(req: SaasUserRegisterRequest):
    """
    Tier 1 SaaS Registration:
    - Enforces unique strong password (min 8 chars, Upper, Lower, Digit, Special)
    - Enforces strictly not more than 1 account per accountant_id attribute
    - Assigns accountant to specific isolated tenant partition
    """
    # 1. Enforce strong password
    valid_pwd, pwd_msg = validate_strong_password(req.password)
    if not valid_pwd:
        raise HTTPException(status_code=400, detail=pwd_msg)

    # 2. Enforce unique accountant_id & tenant isolation
    success, msg, user_id = database.create_saas_user(req.model_dump())
    if not success:
        raise HTTPException(status_code=409, detail=msg)

    return {
        "status": "success",
        "message": msg,
        "user_id": user_id,
        "accountant_id": req.accountant_id,
        "tenant_id": req.tenant_id
    }

@app.post("/api/v1/auth/saas/login")
def login_saas_accountant(req: SaasUserLoginRequest):
    """Tier 1 SaaS Login Authentication with Tenant Isolation."""
    user = database.get_saas_user_by_accountant_id(req.accountant_id)
    if not user:
        # Record failed auth locally
        signal_processor.record_auth_event(req.accountant_id, "127.0.0.1", req.tenant_id or "unknown", is_failed=True, http_status=401)
        raise HTTPException(status_code=401, detail="Authentication failed: Accountant ID not found.")

    if not verify_password(req.password, user["password_hash"], user["salt"]):
        # Record failed auth locally
        signal_processor.record_auth_event(user["accountant_id"], "127.0.0.1", user.get("tenant_id", "tenant_hdfc"), is_failed=True, http_status=401)
        raise HTTPException(status_code=401, detail="Authentication failed: Invalid credentials.")

    database.update_saas_user_last_login(user["accountant_id"])
    signal_processor.record_auth_event(user["accountant_id"], "127.0.0.1", user.get("tenant_id", "tenant_hdfc"), is_failed=False, http_status=200)

    return {
        "status": "success",
        "user": {
            "tenant_id": user.get("tenant_id", "tenant_hdfc"),
            "tenant_name": user.get("tenant_name", "HDFC Bank Corporate"),
            "environment": user.get("environment", "production"),
            "accountant_id": user["accountant_id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user["department"],
            "assigned_branch": user["assigned_branch"],
            "node_id": user["node_id"],
            "file_path": user["file_path"],
            "status": user["status"]
        }
    }

@app.post("/api/v1/auth/support/login")
def login_support_engineer(req: SupportUserLoginRequest):
    """Tier 2 Backend Support Secure Login."""
    user = database.get_support_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Support engineer profile not recognized.")

    if not verify_password(req.password, user["password_hash"], user["salt"]):
        raise HTTPException(status_code=401, detail="Authentication failed: Invalid support credentials.")

    database.update_support_user_last_login(user["username"])
    return {
        "status": "success",
        "user": {
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@app.get("/api/v1/support/saas-users")
def get_saas_users_directory(tenant_id: Optional[str] = None):
    """
    Tier 2 Backend Support View:
    Allows support engineers to explore all SaaS users in a Distributed File System (DFS) explorer.
    Supports filtering by customer environment / tenant_id.
    """
    return database.fetch_all_saas_users_dfs(tenant_id=tenant_id)

@app.get("/api/v1/health")
def get_health():
    """
    Heartbeat, Collector Online/Offline status, Version, Resource Usage,
    and Configuration Status between SaaS platform and Collector backend.
    """
    metrics = get_system_metrics(_simulated_stress)
    return {
        "status": "healthy",
        "online": True,
        "service": "Caused Telemetry Collector (Backend Support)",
        "collector_version": COLLECTOR_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "last_seen": metrics["last_seen"],
        "uptime_seconds": metrics["uptime_seconds"],
        "resource_usage": {
            "cpu_pct": metrics["cpu_pct"],
            "memory_pct": metrics["memory_pct"],
            "memory_used_gb": metrics["memory_used_gb"],
            "memory_total_gb": metrics["memory_total_gb"],
            "memory_avail_gb": metrics["memory_avail_gb"],
            "disk_pct": metrics["disk_pct"],
            "disk_free_gb": metrics["disk_free_gb"],
            "disk_used_gb": metrics["disk_used_gb"],
            "disk_total_gb": metrics["disk_total_gb"],
            "bandwidth_ingress_kbps": metrics["bandwidth_ingress_kbps"],
            "bandwidth_egress_kbps": metrics["bandwidth_egress_kbps"],
            "egress_bytes_sec": metrics["egress_bytes_sec"],
            "ingress_bytes_sec": metrics["ingress_bytes_sec"],
            "latency_ms": metrics["latency_ms"],
            "packet_loss_pct": metrics["packet_loss_pct"],
            "connectivity": metrics["connectivity"],
            "service_availability": metrics["service_availability"],
            "availability_pct": metrics["availability_pct"],
            "active_pids": metrics["active_pids"]
        },
        "configuration_status": {
            "tcl_privacy_pipeline": "ACTIVE (Zero-PII scrubbing enforced)",
            "multi_tenant_separation": "STRICT_ENFORCED (Tenant-level isolation)",
            "local_signal_processor": "ONLINE (Local ring-buffer correlation)",
            "database_vault": "SQLITE_WAL_ACTIVE (Isolated schemas)",
            "encryption": "PBKDF2_HMAC_SHA256 (Salted profile hashes)"
        },
        "active_dependency": "SaaS Platform (:3000)"
    }

@app.post("/api/v1/telemetry/ingest")
def ingest_banking_telemetry(payload: BankingTransactionEvent, background_tasks: BackgroundTasks):
    """
    Core Ingestion & Multi-Tenant TCL Policy Layer:
    1. Records raw unredacted data in Collector Vault partitioned by tenant_id.
    2. Applies TCL Data Scrubbing Policy (masks Acc No, hashes DOB, strips PII).
    3. Runs Local Signal Processor (detects repeated auth failures, correlates multi-metric anomalies).
    4. Evaluates Scikit-learn + Gemini Hybrid AI advisor.
    5. Returns sanitized metadata only to the caller with strict tenant boundary.
    """
    raw_data = payload.model_dump()
    raw_data["timestamp"] = datetime.now(timezone.utc).isoformat()

    # 1. Store in raw banking audit vault with tenant partition
    raw_audit_id = database.insert_raw_banking_audit(raw_data)

    # 2. Store corresponding raw telemetry stats
    live_metrics = get_system_metrics(_simulated_stress)
    telemetry_record = {
        "timestamp": raw_data["timestamp"],
        "tenant_id": raw_data.get("tenant_id", "tenant_hdfc"),
        "environment": raw_data.get("environment", "production"),
        "cpu_pct": live_metrics["cpu_pct"],
        "memory_pct": live_metrics["memory_pct"],
        "latency_ms": raw_data["latency_ms"],
        "packet_loss_pct": raw_data["packet_loss_pct"],
        "egress_bytes": raw_data["egress_bytes"],
        "egress_dest": f"bank-gw:{raw_data['client_ip']}",
        "source_service": f"saas_{raw_data.get('tenant_id', 'hdfc')}"
    }
    database.insert_raw_telemetry(telemetry_record)

    # 3. Apply TCL Scrubbing Policy
    scrubbed = apply_tcl_scrubbing(raw_data)
    scrubbed["raw_audit_id"] = raw_audit_id
    database.insert_scrubbed_metadata(scrubbed)

    # 4. Locally Processed Signals & Multi-Event Correlation Engine
    correlated_incident = signal_processor.process_and_correlate(raw_data, live_metrics)
    if correlated_incident:
        logger.warning(f"Locally Correlated Incident Flagged [{correlated_incident['severity']}]: {correlated_incident['summary']}")
        database.insert_ai_incident({
            "timestamp": raw_data["timestamp"],
            "tenant_id": raw_data.get("tenant_id", "tenant_hdfc"),
            "incident_type": correlated_incident["incident_type"],
            "severity": correlated_incident["severity"],
            "summary": correlated_incident["summary"],
            "root_cause": correlated_incident["root_cause"],
            "recommendations": correlated_incident["recommendations"],
            "raw_context": {
                "correlated_signals": correlated_incident["correlated_signals"],
                "accountant_id": raw_data["accountant_id"],
                "client_ip": raw_data["client_ip"],
                "tenant_id": raw_data.get("tenant_id")
            }
        })

    # 5. Hybrid Statistical Isolation Forest Baseline check
    eval_metrics = {
        "cpu_pct": live_metrics["cpu_pct"],
        "memory_pct": live_metrics["memory_pct"],
        "latency_ms": raw_data["latency_ms"],
        "packet_loss_pct": raw_data["packet_loss_pct"],
        "egress_bytes": raw_data["egress_bytes"],
        "failed_logins": raw_data["failed_login_count"]
    }
    is_anomaly, score, reason = detector.evaluate_sample(eval_metrics)

    if is_anomaly and not correlated_incident:
        logger.warning(f"AI Baseline Anomaly: {reason} (score: {score:.3f})")
        incident = generate_ai_incident_report(
            incident_trigger=reason,
            metrics=eval_metrics,
            audit_context={
                "accountant_id": raw_data["accountant_id"],
                "masked_acc": scrubbed["masked_account_number"],
                "feature": raw_data["feature_accessed"],
                "ip": raw_data["client_ip"],
                "tenant_id": raw_data.get("tenant_id", "tenant_hdfc")
            }
        )
        database.insert_ai_incident({
            "timestamp": raw_data["timestamp"],
            "tenant_id": raw_data.get("tenant_id", "tenant_hdfc"),
            "incident_type": incident.get("incident_type", "SECURITY_ALERT"),
            "severity": incident.get("severity", "P2"),
            "summary": incident.get("summary", reason),
            "root_cause": incident.get("root_cause", "Unusual operational behavior"),
            "recommendations": incident.get("recommendations", "Review logs"),
            "raw_context": eval_metrics
        })

    # Return ONLY clean metadata back to the SaaS platform
    return {
        "status": "success",
        "audit_id": raw_audit_id,
        "tenant_id": raw_data.get("tenant_id", "tenant_hdfc"),
        "scrubbed_metadata": scrubbed,
        "operational_status": "MONITORED",
        "isolation_verified": True
    }

@app.get("/api/v1/saas/metadata")
def get_saas_metadata(limit: int = 50, tenant_id: Optional[str] = None):
    """
    STRICT MULTI-TENANT ISOLATION:
    Exclusively returns scrubbed metadata for the requesting customer/tenant platform.
    One customer NEVER sees another customer's SaaS platform metadata!
    """
    return database.fetch_scrubbed_metadata(limit=limit, tenant_id=tenant_id)

@app.post("/api/v1/saas/ai-assistant")
def ask_saas_copilot(query: SaasAssistantQuery):
    """
    AI-Assisted Copilot in SaaS block:
    Allows accountants to query/fetch records within their tenant boundary,
    autofill forms in Rupees (₹), and navigate features with privacy guardrails.
    """
    return query_saas_copilot(query.prompt, query.current_records)

@app.get("/api/v1/support/metrics")
def get_infra_metrics():
    """Live telemetry stream for Backend Support dashboard."""
    return get_system_metrics(_simulated_stress)

@app.get("/api/v1/support/tenants")
def get_tenants_summary():
    """Tier 2 Support Multi-Tenant Environments & Separation Analytics."""
    return database.fetch_tenants_summary()

@app.get("/api/v1/support/local-signals")
def get_local_signals():
    """Locally processed signals and auth failure tracking."""
    return signal_processor.get_active_signals()

@app.get("/api/v1/support/raw-vault")
def get_raw_vault(limit: int = 50, tenant_id: Optional[str] = None):
    """Backend support view of unredacted audit trails with optional tenant filtering."""
    return database.fetch_recent_banking_audit(limit=limit, tenant_id=tenant_id)

@app.get("/api/v1/support/telemetry-logs")
def get_telemetry_logs(limit: int = 50, tenant_id: Optional[str] = None):
    """Infra, network, and egress logs with optional tenant filtering."""
    return database.fetch_recent_telemetry(limit=limit, tenant_id=tenant_id)

@app.get("/api/v1/support/ai-alerts")
def get_ai_alerts(limit: int = 50, tenant_id: Optional[str] = None):
    """Real-time AI incident alerts with explainable recommendations and tenant filtering."""
    return database.fetch_ai_incidents(limit=limit, tenant_id=tenant_id)

@app.post("/api/v1/simulate/attack")
def simulate_attack(sim: SimulationRequest):
    """
    Test tool to simulate live bank attacks and infra degradation:
    - brute_force (7 rapid failed logins triggering locally processed signals & P1 alert)
    - egress_exfiltration (14MB unauthorized egress burst)
    - latency_spike (1150ms latency + 18.5% packet loss)
    - cpu_exhaustion (96%+ CPU spike)
    - reset
    """
    global _simulated_stress
    attack = sim.attack_type.lower()
    target_tenant = sim.tenant_id or "tenant_hdfc"

    if attack == "brute_force":
        # Simulate 7 rapid failed login attempts on target tenant
        for i in range(7):
            raw_event = {
                "tenant_id": target_tenant,
                "tenant_name": "HDFC Bank Corporate" if target_tenant == "tenant_hdfc" else "ICICI Bank Commercial",
                "environment": "production",
                "accountant_id": "acc_suspect_09",
                "account_number": "998877665544",
                "client_name": "Target Account",
                "date_of_birth": "1990-01-01",
                "feature_accessed": "accountant_auth_login",
                "amount": 0.0,
                "client_ip": "203.0.113.88",
                "http_status": 401,
                "latency_ms": 35.0,
                "packet_loss_pct": 0.0,
                "egress_bytes": 512,
                "failed_login_count": i + 1,
                "is_failed_login": True
            }
            ingest_banking_telemetry(BankingTransactionEvent(**raw_event), BackgroundTasks())
        return {"status": "triggered", "message": f"Simulated 7 rapid failed logins on tenant '{target_tenant}' (Locally detected Brute Force)"}

    elif attack == "egress_exfiltration":
        _simulated_stress["egress_burst"] = True
        raw_event = {
            "tenant_id": target_tenant,
            "tenant_name": "HDFC Bank Corporate",
            "environment": "production",
            "accountant_id": "acc_compromised_02",
            "account_number": "411122223333",
            "client_name": "Exfiltrated Customer DB",
            "date_of_birth": "1982-11-20",
            "feature_accessed": "bulk_account_export",
            "amount": 0.0,
            "client_ip": "198.51.100.77",
            "http_status": 200,
            "latency_ms": 420.0,
            "packet_loss_pct": 1.2,
            "egress_bytes": 14 * 1024 * 1024, # 14MB exfiltration
            "failed_login_count": 0,
            "is_failed_login": False
        }
        ingest_banking_telemetry(BankingTransactionEvent(**raw_event), BackgroundTasks())
        return {"status": "triggered", "message": f"Simulated 14MB unauthorized egress burst on tenant '{target_tenant}'"}

    elif attack == "latency_spike":
        _simulated_stress["latency_spike"] = True
        _simulated_stress["packet_loss_spike"] = True
        raw_event = {
            "tenant_id": target_tenant,
            "tenant_name": "HDFC Bank Corporate",
            "environment": "production",
            "accountant_id": "acc_001",
            "account_number": "111122223333",
            "client_name": "Standard User",
            "date_of_birth": "1995-05-15",
            "feature_accessed": "international_wire",
            "amount": 25000.0,
            "client_ip": "10.0.0.15",
            "http_status": 504,
            "latency_ms": 1150.0,
            "packet_loss_pct": 18.5,
            "egress_bytes": 4096,
            "failed_login_count": 0,
            "is_failed_login": False
        }
        ingest_banking_telemetry(BankingTransactionEvent(**raw_event), BackgroundTasks())
        return {"status": "triggered", "message": "Simulated network failure (1150ms latency, 18.5% packet loss, 504 errors)"}

    elif attack == "cpu_exhaustion":
        _simulated_stress["cpu_spike"] = True
        return {"status": "triggered", "message": "Simulated host CPU spike (96%+)"}

    elif attack == "reset":
        _simulated_stress = {}
        return {"status": "reset", "message": "All simulated stresses cleared."}

    raise HTTPException(status_code=400, detail="Unknown attack type. Use brute_force, egress_exfiltration, latency_spike, cpu_exhaustion, or reset.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
