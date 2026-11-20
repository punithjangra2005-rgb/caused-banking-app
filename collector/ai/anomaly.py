import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger("anomaly_detector")

class LocalAnomalyDetector:
    def __init__(self):
        # Feature columns: [cpu_pct, memory_pct, latency_ms, packet_loss_pct, egress_mb, failed_logins]
        self.model = IsolationForest(
            n_estimators=50,
            contamination=0.08,
            random_state=42
        )
        self.is_fitted = False
        self._initialize_baseline()

    def _initialize_baseline(self):
        """
        Synthesizes a standard healthy baseline for a banking cloud infrastructure
        to allow instant zero-config anomaly detection without cold-start delay.
        """
        np.random.seed(42)
        n_samples = 400
        # Normal distributions
        normal_cpu = np.random.normal(loc=30.0, scale=12.0, size=n_samples).clip(5, 75)
        normal_mem = np.random.normal(loc=45.0, scale=8.0, size=n_samples).clip(20, 75)
        normal_lat = np.random.normal(loc=35.0, scale=15.0, size=n_samples).clip(10, 180)
        normal_loss = np.random.exponential(scale=0.1, size=n_samples).clip(0, 0.8)
        normal_egress = np.random.exponential(scale=0.2, size=n_samples).clip(0.01, 1.2) # MB
        normal_fails = np.random.poisson(lam=0.2, size=n_samples).clip(0, 2)

        X_baseline = np.column_stack([
            normal_cpu,
            normal_mem,
            normal_lat,
            normal_loss,
            normal_egress,
            normal_fails
        ])

        self.model.fit(X_baseline)
        self.is_fitted = True
        logger.info("Local Anomaly Detector calibrated on healthy baseline.")

    def evaluate_sample(self, metrics: Dict[str, Any]) -> Tuple[bool, float, str]:
        """
        Evaluates a metrics payload.
        Returns:
            is_anomaly (bool)
            anomaly_score (float, negative means more anomalous in IsolationForest)
            reason (str)
        """
        cpu = float(metrics.get("cpu_pct", 25.0))
        mem = float(metrics.get("memory_pct", 40.0))
        lat = float(metrics.get("latency_ms", 30.0))
        loss = float(metrics.get("packet_loss_pct", 0.1))
        egress_mb = float(metrics.get("egress_bytes", 0)) / (1024 * 1024)
        fails = int(metrics.get("failed_logins", 0))

        # 1. Deterministic threshold checks (Zero false-negative guardrails for banking)
        critical_reasons = []
        if fails >= 5:
            critical_reasons.append(f"Brute force attempt ({fails} failed logins)")
        if egress_mb >= 5.0:
            critical_reasons.append(f"Abnormal egress burst ({egress_mb:.1f} MB exfiltration risk)")
        if loss >= 5.0:
            critical_reasons.append(f"High network degradation (Packet loss {loss:.1f}%)")
        if lat >= 500.0:
            critical_reasons.append(f"Severe latency surge ({lat:.1f} ms)")
        if cpu >= 90.0:
            critical_reasons.append(f"CPU exhaustion ({cpu:.1f}%)")

        if critical_reasons:
            return True, -0.85, " & ".join(critical_reasons)

        # 2. Statistical Isolation Forest evaluation
        X = np.array([[cpu, mem, lat, loss, egress_mb, fails]])
        prediction = self.model.predict(X)[0] # -1 = anomaly, 1 = normal
        score = float(self.model.decision_function(X)[0])

        if prediction == -1:
            reasons = []
            if cpu > 70: reasons.append(f"Elevated CPU {cpu:.1f}%")
            if lat > 250: reasons.append(f"Unusual latency {lat:.1f}ms")
            if loss > 1.5: reasons.append(f"Elevated packet loss {loss:.1f}%")
            if egress_mb > 1.5: reasons.append(f"Unusual egress volume {egress_mb:.2f}MB")
            if fails > 2: reasons.append(f"Multiple failed logins ({fails})")
            reason_str = ", ".join(reasons) if reasons else "Multi-metric multivariate anomaly"
            return True, score, reason_str

        return False, score, "Normal operation"

# Singleton instance
detector = LocalAnomalyDetector()
