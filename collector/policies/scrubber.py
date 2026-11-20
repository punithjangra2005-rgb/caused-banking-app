import re
import hashlib
from datetime import datetime, date, timezone
from typing import Dict, Any, Tuple

def clean_account_number(acc_no: str) -> str:
    """Strips spaces, dashes, and non-numeric chars."""
    return re.sub(r'[\s-]', '', str(acc_no or ''))

def validate_12_digit_account(acc_no: str) -> Tuple[bool, str]:
    """Validates that the account number contains exactly 12 numeric digits."""
    cleaned = clean_account_number(acc_no)
    if not cleaned.isdigit():
        return False, "Account number must contain only numeric digits."
    if len(cleaned) != 12:
        return False, f"Account number must be exactly 12 digits (currently {len(cleaned)} digits)."
    return True, cleaned

def mask_account_number(acc_no: str) -> str:
    """
    Masks 12-digit account numbers: preserves only the last 4 digits.
    e.g. '501004829102' -> '********9102' (exactly 8 asterisks + 4 digits)
    """
    cleaned = clean_account_number(acc_no)
    if len(cleaned) == 12:
        return f"********{cleaned[-4:]}"
    if len(cleaned) <= 4:
        return "****"
    return f"{'*' * (len(cleaned) - 4)}{cleaned[-4:]}"

def compute_age_bracket(dob_str: str) -> str:
    """
    Converts sensitive Date of Birth into an anonymous age bracket.
    """
    if not dob_str:
        return "UNKNOWN"
    try:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%m-%d-%Y"):
            try:
                birth_date = datetime.strptime(dob_str.strip(), fmt).date()
                break
            except ValueError:
                continue
        else:
            return "UNKNOWN"

        today = date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        if age < 18:
            return "MINOR (<18)"
        elif 18 <= age <= 24:
            return "18-24"
        elif 25 <= age <= 34:
            return "25-34"
        elif 35 <= age <= 44:
            return "35-44"
        elif 45 <= age <= 54:
            return "45-54"
        elif 55 <= age <= 64:
            return "55-64"
        else:
            return "65+"
    except Exception:
        return "UNKNOWN"

def generate_client_token(client_name: str, acc_no: str) -> str:
    """
    Deterministic pseudonymization token for client metadata.
    """
    seed = f"{client_name.strip().lower()}:{clean_account_number(acc_no)}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8].upper()
    return f"CLT_{digest}"

def categorize_feature_type(feature: str) -> str:
    f = feature.lower()
    if "deposit" in f:
        return "DEPOSIT"
    elif "wire" in f or "transfer" in f or "neft" in f or "rtgs" in f:
        return "TRANSFER"
    elif "withdraw" in f:
        return "WITHDRAWAL"
    elif "loan" in f or "credit" in f:
        return "CREDIT"
    elif "freeze" in f:
        return "COMPLIANCE"
    return "OPERATION"

def evaluate_risk_level(feature: str, amount: float, failed_logins: int, egress_bytes: int) -> str:
    """
    Assesses operational and financial risk rating in Rupees (₹).
    """
    high_risk_features = {"international_wire", "credit_limit_override", "bulk_export_pii", "root_admin_access", "account_freeze"}
    
    if failed_logins >= 5 or egress_bytes > 5 * 1024 * 1024:
        return "CRITICAL"
    # Over 5 Lakhs (₹5,00,000) or high risk feature
    if feature in high_risk_features or amount >= 500000 or egress_bytes > 1024 * 1024:
        return "HIGH"
    if amount >= 100000 or feature in {"domestic_wire", "password_reset", "beneficiary_add"}:
        return "MEDIUM"
    return "LOW"

def evaluate_latency_status(latency_ms: float) -> str:
    if latency_ms < 150:
        return "OPTIMAL"
    elif latency_ms <= 350:
        return "ACCEPTABLE"
    return "DEGRADED"

def apply_tcl_scrubbing(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main TCL Data Policy Scrubbing Function.
    Transforms raw sensitive banking event into privacy-compliant metadata for the SaaS tier.
    """
    acc_no = str(raw_event.get("account_number", ""))
    dob = str(raw_event.get("date_of_birth", ""))
    client_name = str(raw_event.get("client_name", ""))
    feature = str(raw_event.get("feature_accessed", "deposit"))
    amount = float(raw_event.get("amount", 0.0))
    failed_logins = int(raw_event.get("failed_login_count", 0))
    egress_bytes = int(raw_event.get("egress_bytes", 0))
    latency_ms = float(raw_event.get("latency_ms", 50.0))

    masked_acc = mask_account_number(acc_no)
    age_bracket = compute_age_bracket(dob)
    client_token = generate_client_token(client_name, acc_no)
    risk_level = evaluate_risk_level(feature, amount, failed_logins, egress_bytes)
    latency_status = evaluate_latency_status(latency_ms)
    trans_type = categorize_feature_type(feature)

    return {
        "tenant_id": raw_event.get("tenant_id", "tenant_hdfc"),
        "tenant_name": raw_event.get("tenant_name", "HDFC Bank Corporate"),
        "environment": raw_event.get("environment", "production"),
        "masked_account_number": masked_acc,
        "client_token": client_token,
        "age_bracket": age_bracket,
        "feature_accessed": feature,
        "transaction_type": trans_type,
        "amount": amount,
        "risk_level": risk_level,
        "latency_status": latency_status,
        "timestamp": raw_event.get("timestamp", datetime.now(timezone.utc).isoformat())
    }
