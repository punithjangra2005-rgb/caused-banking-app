import time
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

class LocalSignalProcessor:
    """
    Locally processed signal analysis and event correlation engine.
    Processes telemetry and authentication events in-memory using statistical
    velocity checks, threshold windows, and temporal correlation rules without
    transmitting telemetry outside the local security boundary.
    """

    def __init__(self, window_seconds: int = 300):
        self.window_seconds = window_seconds
        # Ring buffers for local event tracking
        self.auth_events = deque(maxlen=200)      # Failed/successful auth attempts
        self.telemetry_events = deque(maxlen=200) # Ingress/Egress/Latency/Loss
        self.recent_signals = deque(maxlen=100)   # Extracted signals

    def _purge_old(self, current_time: float):
        cutoff = current_time - self.window_seconds
        while self.auth_events and self.auth_events[0]["time"] < cutoff:
            self.auth_events.popleft()
        while self.telemetry_events and self.telemetry_events[0]["time"] < cutoff:
            self.telemetry_events.popleft()

    def record_auth_event(
        self,
        accountant_id: str,
        client_ip: str,
        tenant_id: str,
        is_failed: bool,
        http_status: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Processes an authentication signal locally.
        Detects repeated failures, brute force bursts, and credential stuffing.
        """
        now_ts = time.time()
        self._purge_old(now_ts)

        event = {
            "time": now_ts,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "accountant_id": accountant_id,
            "client_ip": client_ip,
            "tenant_id": tenant_id,
            "is_failed": is_failed,
            "http_status": http_status
        }
        self.auth_events.append(event)

        detected_signals = []
        if is_failed:
            # 1. Check repeated failures on the SAME accountant_id in last 60s
            recent_acc_fails = [
                e for e in self.auth_events
                if e["is_failed"] and e["accountant_id"] == accountant_id and (now_ts - e["time"]) <= 60
            ]
            fail_count = len(recent_acc_fails)

            if fail_count >= 5:
                detected_signals.append({
                    "signal_type": "BRUTE_FORCE_VELOCITY_HIGH",
                    "severity": "CRITICAL",
                    "tenant_id": tenant_id,
                    "target_id": accountant_id,
                    "client_ip": client_ip,
                    "detail": f"{fail_count} failed auth attempts in <60s on accountant '{accountant_id}' from IP {client_ip}."
                })
            elif fail_count >= 3:
                detected_signals.append({
                    "signal_type": "REPEATED_AUTH_FAILURES_WARN",
                    "severity": "WARNING",
                    "tenant_id": tenant_id,
                    "target_id": accountant_id,
                    "client_ip": client_ip,
                    "detail": f"{fail_count} failed login attempts recorded within 60s on account '{accountant_id}'."
                })

            # 2. Check credential stuffing signature: same IP failing on multiple distinct accounts
            recent_ip_targets = {
                e["accountant_id"] for e in self.auth_events
                if e["is_failed"] and e["client_ip"] == client_ip and (now_ts - e["time"]) <= 120
            }
            if len(recent_ip_targets) >= 3:
                detected_signals.append({
                    "signal_type": "CREDENTIAL_STUFFING_SIGNATURE",
                    "severity": "CRITICAL",
                    "tenant_id": tenant_id,
                    "target_id": list(recent_ip_targets),
                    "client_ip": client_ip,
                    "detail": f"IP {client_ip} targeted {len(recent_ip_targets)} distinct accountant IDs in <120s."
                })

        for s in detected_signals:
            self.recent_signals.append(s)

        return detected_signals

    def process_and_correlate(
        self,
        event_data: Dict[str, Any],
        live_infra: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Correlates telemetry signals with recent auth signals to produce
        explainable, prioritized incidents (P1 - Critical to P4 - Low).
        """
        now_ts = time.time()
        self._purge_old(now_ts)

        tenant_id = event_data.get("tenant_id", "tenant_hdfc")
        accountant_id = event_data.get("accountant_id", "acc_unknown")
        client_ip = event_data.get("client_ip", "127.0.0.1")
        egress_bytes = int(event_data.get("egress_bytes", 0))
        latency_ms = float(event_data.get("latency_ms", 35.0))
        packet_loss = float(event_data.get("packet_loss_pct", 0.0))
        amount = float(event_data.get("amount", 0.0))
        feature = str(event_data.get("feature_accessed", "deposit"))
        failed_count = int(event_data.get("failed_login_count", 0))
        is_failed_login = bool(event_data.get("is_failed_login", False))

        # Record event in telemetry ring buffer
        self.telemetry_events.append({
            "time": now_ts,
            "tenant_id": tenant_id,
            "egress_bytes": egress_bytes,
            "latency_ms": latency_ms,
            "packet_loss": packet_loss
        })

        # Check for auth signals
        auth_signals = []
        if is_failed_login or failed_count > 0:
            auth_signals = self.record_auth_event(accountant_id, client_ip, tenant_id, is_failed=True)

        # Correlate across recent signals within 60s
        recent_fails = [
            e for e in self.auth_events
            if e["is_failed"] and (now_ts - e["time"]) <= 60
        ]
        total_recent_fails = len(recent_fails)
        egress_mb = egress_bytes / (1024 * 1024)
        cpu_pct = live_infra.get("cpu_pct", 25.0)

        # ----------------------------------------------------
        # CORRELATION RULE 1: Coordinated Account Takeover & Exfiltration
        # Pattern: Repeated failed auths + anomalous high egress burst
        # ----------------------------------------------------
        if (total_recent_fails >= 3 or failed_count >= 3) and egress_mb >= 3.0:
            return {
                "incident_type": "SECURITY_EXFILTRATION_CORRELATED",
                "severity": "P1",
                "summary": f"P1 Critical: Coordinated brute-force attempt correlated with {egress_mb:.1f}MB egress surge from IP {client_ip}.",
                "root_cause": (
                    f"Temporal correlation between repeated authentication failures ({max(total_recent_fails, failed_count)} attempts in 60s) "
                    f"and an immediate {egress_mb:.1f}MB data burst on tenant '{tenant_id}'. Indicates active account takeover followed by exfiltration."
                ),
                "recommendations": (
                    f"1. Immediately block IP {client_ip} on perimeter edge firewall.\n"
                    f"2. Invalidate active session tokens for accountant '{accountant_id}'.\n"
                    f"3. Restrict egress gateway bandwidth for tenant '{tenant_id}'.\n"
                    f"4. Force MFA step-up authentication across all tenant accountants."
                ),
                "priority_rank": 1,
                "correlated_signals": ["BRUTE_FORCE_BURST", "ABNORMAL_EGRESS_SPIKE"],
                "tenant_id": tenant_id
            }

        # ----------------------------------------------------
        # CORRELATION RULE 2: Credential Stuffing / Auth Storm
        # Pattern: >= 5 failed logins within 60s
        # ----------------------------------------------------
        if total_recent_fails >= 5 or failed_count >= 5:
            return {
                "incident_type": "CREDENTIAL_BRUTE_FORCE",
                "severity": "P1",
                "summary": f"P1 Critical: High-velocity authentication attack detected ({max(total_recent_fails, failed_count)} failed logins in <60s).",
                "root_cause": (
                    f"Rapid-fire credential submission from origin {client_ip} targeting accountant ID '{accountant_id}' "
                    f"within tenant partition '{tenant_id}'. Exceeds bank security velocity threshold (5/min)."
                ),
                "recommendations": (
                    f"1. Rate-limit auth endpoint to 3 attempts/min per IP.\n"
                    f"2. Temporarily lock accountant profile '{accountant_id}' for 15 minutes.\n"
                    f"3. Inspect audit trail for credential reuse across other tenants."
                ),
                "priority_rank": 1,
                "correlated_signals": ["VELOCITY_EXCEEDED", "AUTH_FAILURE_CLUSTER"],
                "tenant_id": tenant_id
            }

        # ----------------------------------------------------
        # CORRELATION RULE 3: Network Pipe Degradation
        # Pattern: High packet loss (>= 5%) correlated with high latency (>= 500ms)
        # ----------------------------------------------------
        if packet_loss >= 4.0 or latency_ms >= 500.0:
            sev = "P2" if packet_loss >= 8.0 or latency_ms >= 800.0 else "P3"
            return {
                "incident_type": "INFRA_NETWORK_DEGRADATION",
                "severity": sev,
                "summary": f"{sev} Incident: Network degradation flagged ({latency_ms:.1f}ms latency, {packet_loss:.1f}% packet loss).",
                "root_cause": (
                    f"Correlated packet drop ({packet_loss:.1f}%) and latency surge ({latency_ms:.1f}ms) "
                    f"affecting banking API gateway for tenant '{tenant_id}'. Host CPU at {cpu_pct}%."
                ),
                "recommendations": (
                    "1. Failover upstream carrier circuit to secondary redundant MPLS link.\n"
                    "2. Verify BGP routing convergence and check router buffer drops.\n"
                    "3. Defer non-critical batch ledger syncs to restore interactive responsiveness."
                ),
                "priority_rank": 2 if sev == "P2" else 3,
                "correlated_signals": ["LATENCY_SPIKE", "PACKET_LOSS_CLUSTER"],
                "tenant_id": tenant_id
            }

        # ----------------------------------------------------
        # CORRELATION RULE 4: Host Resource Exhaustion
        # Pattern: CPU >= 88%
        # ----------------------------------------------------
        if cpu_pct >= 88.0:
            return {
                "incident_type": "HOST_COMPUTE_EXHAUSTION",
                "severity": "P2",
                "summary": f"P2 High: Host CPU exhaustion ({cpu_pct}%) threatening telemetry ingestion pipeline.",
                "root_cause": f"Host compute capacity saturated at {cpu_pct}%. Process backlog may lead to delayed TCL scrubbing.",
                "recommendations": (
                    "1. Scale up collector container instances.\n"
                    "2. Enable asynchronous ingestion queue via SQLite WAL / background threadpool.\n"
                    "3. Review active PIDs for runaway background tasks."
                ),
                "priority_rank": 2,
                "correlated_signals": ["CPU_SATURATION"],
                "tenant_id": tenant_id
            }

        # ----------------------------------------------------
        # CORRELATION RULE 5: High-Value Anomaly
        # Pattern: Transaction value >= ₹5,00,000 in international wire or override
        # ----------------------------------------------------
        if amount >= 500000.0 and feature in ("international_wire", "credit_limit_override"):
            return {
                "incident_type": "FINANCIAL_RISK_SURGE",
                "severity": "P2",
                "summary": f"P2 High: Large value financial transaction of ₹{amount:,.2f} flagged under feature '{feature}'.",
                "root_cause": (
                    f"Transaction value exceeds standard single-operator threshold (₹5,00,000) "
                    f"for accountant '{accountant_id}' in tenant '{tenant_id}'."
                ),
                "recommendations": (
                    "1. Require dual-authorization (maker-checker validation) before settlement.\n"
                    "2. Verify beneficiary account authenticity against AML sanctions watchlists.\n"
                    "3. Request customer confirmation through out-of-band channel."
                ),
                "priority_rank": 2,
                "correlated_signals": ["HIGH_TRANSACTION_VALUE", "ELEVATED_FEATURE_RISK"],
                "tenant_id": tenant_id
            }

        return None

    def get_active_signals(self) -> List[Dict[str, Any]]:
        return list(self.recent_signals)

# Global singleton processor
signal_processor = LocalSignalProcessor()
