import json
import logging
import requests
import re
from typing import Dict, Any, List, Optional
from config import GEMINI_API_KEY

logger = logging.getLogger("saas_copilot")

# Sensitive backend terms that SaaS Copilot must NEVER disclose
SENSITIVE_BACKEND_KEYWORDS = [
    "cpu", "memory", "ram", "packet loss", "egress burst", "raw vault", 
    "unredacted", "server ip", "infrastructure telemetry", "brute force attack", 
    "p1 alert", "incident report", "underlying database", "system metrics"
]

def check_sensitive_backend_query(prompt: str) -> bool:
    p = prompt.lower()
    return any(keyword in p for keyword in SENSITIVE_BACKEND_KEYWORDS)

def query_saas_copilot(prompt: str, current_records: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    AI Assisted LLM for the Tier 1 SaaS Banking Block.
    Features:
    1. STRICT SECURITY GUARDRAIL: Never reveals backend support sensitive metrics (CPU, RAM, packet loss, raw PII).
    2. Helps accountants fetch/search scrubbed transactions and deposit records in Rupees (₹).
    3. Handles 12-digit account deposits, transfers, and feature navigation.
    """
    records = current_records or []
    
    # Enforce strict privacy guardrail: refuse backend support sensitive telemetry
    if check_sensitive_backend_query(prompt):
        return {
            "reply": "🛡️ Security Policy Notice: As the SaaS Banking Copilot, I am strictly isolated by the TCL Layer from accessing Tier 2 Backend Support telemetry, host infrastructure health (CPU/RAM/Packet Loss), or unredacted audit vaults. Please consult the Tier 2 Backend Support console for infrastructure diagnostics.",
            "action": {
                "type": "NAVIGATE",
                "target": "support",
                "form_values": None
            },
            "suggestions": [
                "Navigate to Backend Support Console",
                "Deposit ₹50,000 into account",
                "Show recent deposit history in ₹"
            ],
            "ai_source": "Caused Privacy Guardrail Engine"
        }

    if GEMINI_API_KEY and GEMINI_API_KEY.strip():
        try:
            return _call_gemini_copilot(prompt, records)
        except Exception as e:
            logger.warning(f"Gemini Copilot API call failed ({e}), falling back to local copilot engine.")

    return _generate_local_copilot_response(prompt, records)

def _call_gemini_copilot(prompt: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    # Strip any potential sensitive context before feeding to LLM
    sanitized_records = []
    for r in records[:15]:
        sanitized_records.append({
            "id": r.get("id"),
            "masked_account": r.get("masked_account_number"),
            "client_token": r.get("client_token"),
            "age_bracket": r.get("age_bracket"),
            "feature": r.get("feature_accessed"),
            "amount_inr": r.get("amount", 0.0),
            "risk": r.get("risk_level")
        })

    system_instruction = f"""
You are the AI Banking Copilot for 'Caused', a 2-Tier Banking SaaS Platform.
You assist accountants with bank operations in Indian Rupees (₹).
Account numbers in this bank MUST ALWAYS BE EXACTLY 12 DIGITS (e.g., 501004829102).

STRICT SECURITY GUARDRAIL:
You must NEVER display or discuss backend support sensitive details such as host CPU %, memory %, server IPs, packet loss %, or unredacted database internals. If asked about server or backend metrics, decline politely and remind the user that you are strictly a SaaS-tier assistant.

Available Features:
- deposit: Cash / Cheque / Direct Deposit into 12-digit account (₹)
- domestic_wire: Domestic Clearing / NEFT / RTGS (₹)
- international_wire: International Wire Transfer (₹)
- credit_limit_override: Loan & Credit Limit Revision (₹)
- foreign_exchange: Foreign Exchange INR Spot Deal
- account_freeze: Compliance Account Freeze

Current Scrubbed Records in Vault:
{json.dumps(sanitized_records, indent=2)}

User Prompt: "{prompt}"

Return STRICT JSON matching this schema:
{{
  "reply": "Helpful, conversational explanation in 2-3 sentences. Always use ₹ for amounts. Never mention backend server metrics.",
  "action": {{
    "type": "NONE" | "FILL_FORM" | "FILTER" | "NAVIGATE",
    "target": "string or null",
    "form_values": {{
      "account_number": "EXACTLY 12 DIGIT string (e.g. 501004829102) or null",
      "client_name": "suggested name or null",
      "date_of_birth": "YYYY-MM-DD or null",
      "feature_accessed": "feature_key or null",
      "amount": number or null
    }}
  }},
  "suggestions": ["Follow-up prompt 1", "Follow-up prompt 2"]
}}
"""

    payload = {
        "contents": [{
            "parts": [{"text": system_instruction}]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json"
        }
    }

    resp = requests.post(url, json=payload, timeout=12)
    resp.raise_for_status()
    data = resp.json()
    text_content = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(text_content)
    parsed["ai_source"] = "Google Gemini 2.5 Flash"
    return parsed

def _generate_local_copilot_response(prompt: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    p = prompt.lower()

    # 1. Deposit Assistant
    if "deposit" in p or "credit" in p or "add money" in p or "fund" in p:
        match = re.search(r'(\d+[\d,]*)', prompt)
        amount = 50000.0
        if match:
            clean_num = match.group(1).replace(',', '')
            if clean_num.isdigit():
                amount = float(clean_num)

        return {
            "reply": f"I have prepared a Deposit transaction for ₹{amount:,.2f} into 12-digit account 501004829102. Please review and execute the deposit.",
            "action": {
                "type": "FILL_FORM",
                "target": "accountant_form",
                "form_values": {
                    "account_number": "501004829102",
                    "client_name": "Aarav Sharma",
                    "date_of_birth": "1988-06-15",
                    "feature_accessed": "deposit",
                    "amount": amount
                }
            },
            "suggestions": [
                "Execute deposit in ₹",
                "Show deposit transaction history",
                "Prepare Domestic NEFT for ₹25,000"
            ],
            "ai_source": "Caused Local Banking Assistant"
        }

    # 2. Search / Fetch High Risk or Critical Records
    if "risk" in p or "critical" in p or "flag" in p or "suspicious" in p:
        critical_count = sum(1 for r in records if r.get("risk_level") in ["CRITICAL", "HIGH"])
        return {
            "reply": f"Found {critical_count} transaction(s) flagged as HIGH or CRITICAL in the scrubbed audit ledger. Reviewing high-value wires is recommended before approval.",
            "action": {
                "type": "FILTER",
                "target": "CRITICAL",
                "form_values": None
            },
            "suggestions": [
                "Deposit ₹50,000 into account",
                "Draft an International Wire in ₹",
                "Show records for age bracket 35-44"
            ],
            "ai_source": "Caused Local Banking Assistant"
        }

    # 3. Wire Transfer / NEFT Form Filling
    if "wire" in p or "transfer" in p or "neft" in p or "send" in p or "rtgs" in p:
        match = re.search(r'(\d+[\d,]*)', prompt)
        amount = 75000.0
        if match:
            clean_num = match.group(1).replace(',', '')
            if clean_num.isdigit():
                amount = float(clean_num)

        is_international = "international" in p or "foreign" in p or "swift" in p
        feature = "international_wire" if is_international else "domestic_wire"
        
        return {
            "reply": f"I have prepared the form for a {'International Wire' if is_international else 'Domestic NEFT'} of ₹{amount:,.2f} with verified 12-digit account format.",
            "action": {
                "type": "FILL_FORM",
                "target": "accountant_form",
                "form_values": {
                    "account_number": "501004829102",
                    "client_name": "Priya Patel",
                    "date_of_birth": "1992-03-22",
                    "feature_accessed": feature,
                    "amount": amount
                }
            },
            "suggestions": [
                "Execute wire with TCL Scrubbing",
                "Prepare Deposit of ₹50,000",
                "Filter transactions history"
            ],
            "ai_source": "Caused Local Banking Assistant"
        }

    # 4. Transactions History Query
    if "history" in p or "ledger" in p or "recent" in p or "past" in p:
        return {
            "reply": f"You can view the full scrubbed ledger under the 'Transactions History' tab. All {len(records)} transactions are displayed with masked 12-digit accounts (********1234) and amounts in ₹.",
            "action": {
                "type": "VIEW_TAB",
                "target": "history",
                "form_values": None
            },
            "suggestions": [
                "Deposit ₹1,00,000",
                "Filter CRITICAL risk transactions",
                "Prepare Domestic NEFT"
            ],
            "ai_source": "Caused Local Banking Assistant"
        }

    # 5. Default Banking Guidance
    return {
        "reply": f"Hello Accountant! I am your AI Banking Assistant. I can help you process Deposits, prepare NEFT/Wires in Rupees (₹), and search customer histories while keeping all backend infrastructure metrics strictly private.",
        "action": {
            "type": "NONE",
            "target": None,
            "form_values": None
        },
        "suggestions": [
            "Deposit ₹50,000 into 12-digit account",
            "Prepare International Wire for ₹75,000",
            "Show recent transactions history",
            "Find high risk transactions"
        ],
        "ai_source": "Caused Local Banking Assistant"
    }
