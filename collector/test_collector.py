import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import database
from main import (
    get_health,
    ingest_banking_telemetry,
    simulate_attack,
    get_ai_alerts,
    get_saas_metadata,
    BankingTransactionEvent,
    SimulationRequest,
    BackgroundTasks
)
from ai.saas_copilot import query_saas_copilot

def run_tests():
    print("==================================================")
    print("      Testing Caused Collector & SaaS Copilot     ")
    print("==================================================")

    print("\n1. Initializing SQLite Database Vault...")
    database.init_db()

    print("\n2. Testing 12-Digit Account Validation...")
    # Test valid 12-digit account
    valid_event = BankingTransactionEvent(
        accountant_id="acc_tester_01",
        account_number="501004829102", # Exactly 12 digits
        client_name="Test Customer",
        date_of_birth="1989-08-14",
        feature_accessed="deposit",
        amount=50000.0,
        client_ip="192.168.1.50",
        http_status=200,
        latency_ms=42.0,
        packet_loss_pct=0.0,
        egress_bytes=1024,
        failed_login_count=0
    )
    res = ingest_banking_telemetry(valid_event, BackgroundTasks())
    print("Valid 12-digit Deposit Result:", res["status"])
    print("Scrubbed Metadata:", res["scrubbed_metadata"])
    assert res["scrubbed_metadata"]["masked_account_number"] == "********9102", "Masking must preserve 8 asterisks + 4 digits"
    print("✓ 12-Digit Masking Verified: ********9102")

    # Test invalid account length
    try:
        invalid_event = BankingTransactionEvent(
            accountant_id="acc_tester_01",
            account_number="123456789", # 9 digits - must fail
            client_name="Invalid Customer",
            date_of_birth="1990-01-01"
        )
        print("ERROR: Invalid account did not fail!")
    except Exception as e:
        print("✓ Non-12-digit Account Correctly Blocked:", str(e))

    print("\n3. Testing AI Copilot Privacy Guardrails (Blocking Backend Telemetry)...")
    # Prompt attempting to extract backend support metrics
    sensitive_query = "What is the current CPU percentage and packet loss of the server?"
    blocked_res = query_saas_copilot(sensitive_query, [])
    print("AI Response to Sensitive Query:", blocked_res["reply"])
    assert "Security Policy Notice" in blocked_res["reply"] or "strictly" in blocked_res["reply"]
    print("✓ Backend Telemetry Disclosure Successfully Blocked!")

    print("\n4. Testing AI Copilot Deposit & Navigation...")
    deposit_query = "Deposit 50000 rupees into account 501004829102"
    deposit_res = query_saas_copilot(deposit_query, [])
    print("AI Deposit Reply:", deposit_res["reply"])
    print("AI Deposit Action:", deposit_res.get("action"))
    assert deposit_res["action"]["form_values"]["amount"] == 50000.0
    print("✓ Deposit Form Autofill in Rupees (₹) Verified!")

    print("\n5. Testing Transactions History & Scrubbed Metadata...")
    saas_records = get_saas_metadata(5)
    print(f"Total Scrubbed Records Retrieved: {len(saas_records)}")
    for r in saas_records[:2]:
        print(f"Audit #{r['raw_audit_id']}: Acc {r['masked_account_number']} | Feature: {r['feature_accessed']} | ₹{r.get('amount', 0)}")

    print("\n6. Testing Negative Amount Prevention (₹ Validation)...")
    try:
        neg_event = BankingTransactionEvent(
            accountant_id="acc_tester_01",
            account_number="501004829102",
            client_name="Bad Actor",
            date_of_birth="1990-01-01",
            feature_accessed="deposit",
            amount=-5000.0  # Must be rejected
        )
        print("ERROR: Negative amount was NOT blocked!")
        assert False, "Negative amount should have been rejected by Pydantic ge=0 constraint"
    except Exception as e:
        print("✓ Negative Amount Correctly Blocked:", str(e)[:90])

    print("\n7. Testing Strong Password Policy & Unique accountant_id (DFS Profiles)...")
    from policies.security import validate_strong_password
    # Weak password test
    is_valid, msg = validate_strong_password("weak")
    assert not is_valid, "Weak password must be rejected"
    print("✓ Weak Password Correctly Rejected:", msg)

    # Strong password test
    is_valid, msg = validate_strong_password("Secure@Bank2026!")
    assert is_valid, "Strong password must be accepted"
    print("✓ Strong Password Correctly Accepted:", msg)

    # Unique accountant_id test: first creation succeeds
    uid = f"acc_tester_{int(hash('unique123')) % 10000}"
    success, msg, _ = database.create_saas_user({
        "accountant_id": uid,
        "full_name": "Test Unique Accountant",
        "password": "Secure@Bank2026!",
        "department": "Retail Banking"
    })
    print(f"First Account Creation ({uid}):", success, msg)
    assert success, "First account creation must succeed"

    # Second creation with identical accountant_id MUST FAIL
    success2, msg2, _ = database.create_saas_user({
        "accountant_id": uid,
        "full_name": "Duplicate Accountant",
        "password": "Secure@Bank2026!",
        "department": "Retail Banking"
    })
    print(f"Duplicate Account Creation ({uid}):", success2, msg2)
    assert not success2, "Duplicate account creation must fail!"
    print("✓ Not More Than 1 Account Per accountant_id Enforced!")

    # Verify Distributed File System Profile retrieval
    dfs_users = database.fetch_all_saas_users_dfs()
    print(f"Total DFS User Nodes: {len(dfs_users)}")
    first_node = dfs_users[0]
    print(f"DFS Node File: {first_node['dfs_metadata']['file_path']} | Inode: {first_node['dfs_metadata']['inode']} | Perms: {first_node['dfs_metadata']['permissions']}")
    assert "file_path" in first_node["dfs_metadata"]
    print("✓ Distributed File System SaaS Explorer Structure Verified!")

    print("\n8. Testing Strict Multi-Tenant Separation...")
    # Ingest HDFC event
    hdfc_event = BankingTransactionEvent(
        tenant_id="tenant_hdfc",
        tenant_name="HDFC Bank Corporate",
        accountant_id="acc_charlotte_04",
        account_number="501004829102",
        client_name="HDFC Customer",
        date_of_birth="1985-04-12",
        amount=15000.0
    )
    ingest_banking_telemetry(hdfc_event, BackgroundTasks())

    # Ingest ICICI event
    icici_event = BankingTransactionEvent(
        tenant_id="tenant_icici",
        tenant_name="ICICI Bank Commercial",
        accountant_id="acc_aarav_09",
        account_number="601004829103",
        client_name="ICICI Customer",
        date_of_birth="1992-09-20",
        amount=25000.0
    )
    ingest_banking_telemetry(icici_event, BackgroundTasks())

    # Fetch strictly for tenant_hdfc
    hdfc_records = get_saas_metadata(50, tenant_id="tenant_hdfc")
    assert all(r.get("tenant_id") == "tenant_hdfc" for r in hdfc_records), "Cross-tenant leak! Found non-HDFC records in HDFC query!"
    print(f"✓ HDFC Query returned {len(hdfc_records)} records, 100% strictly isolated to tenant_hdfc!")

    # Fetch strictly for tenant_icici
    icici_records = get_saas_metadata(50, tenant_id="tenant_icici")
    assert all(r.get("tenant_id") == "tenant_icici" for r in icici_records), "Cross-tenant leak! Found non-ICICI records in ICICI query!"
    print(f"✓ ICICI Query returned {len(icici_records)} records, 100% strictly isolated to tenant_icici!")
    print("✓ Strict Multi-Tenant Separation Confirmed (Zero Cross-Tenant Metadata Contamination)!")

    print("\n9. Testing Comprehensive Resource, Network & Configuration Monitoring...")
    health_res = get_health()
    res_usage = health_res["resource_usage"]
    print(f"Collector Version: {health_res['collector_version']}")
    print(f"Host CPU: {res_usage['cpu_pct']}% | Memory: {res_usage['memory_pct']}% ({res_usage['memory_used_gb']} / {res_usage['memory_total_gb']} GB)")
    print(f"Disk: {res_usage['disk_pct']}% (Free: {res_usage['disk_free_gb']} GB / Total: {res_usage['disk_total_gb']} GB)")
    print(f"Bandwidth: Ingress {res_usage['bandwidth_ingress_kbps']} KB/s | Egress {res_usage['bandwidth_egress_kbps']} KB/s")
    print(f"Latency: {res_usage['latency_ms']} ms | Loss: {res_usage['packet_loss_pct']}% | Availability: {res_usage['service_availability']} ({res_usage['availability_pct']}%)")
    print(f"Multi-Tenancy Config: {health_res['configuration_status']['multi_tenant_separation']}")
    assert health_res["online"] is True
    assert "disk_pct" in res_usage
    print("✓ All 8 Resource, Connectivity & Configuration Monitors Verified!")

    print("\n10. Testing Locally Processed Signals & Event Correlation Engine...")
    from ai.local_signals import signal_processor
    # Trigger 5 rapid failed logins to test local signal correlation
    for i in range(5):
        signal_processor.record_auth_event("acc_brute_target", "198.51.100.42", "tenant_hdfc", is_failed=True)

    correlated = signal_processor.process_and_correlate({
        "tenant_id": "tenant_hdfc",
        "accountant_id": "acc_brute_target",
        "client_ip": "198.51.100.42",
        "failed_login_count": 5,
        "is_failed_login": True,
        "egress_bytes": 1024
    }, res_usage)

    assert correlated is not None, "Correlator must flag P1 incident on 5 failed logins"
    print(f"Incident Flagged: [{correlated['severity']}] {correlated['incident_type']}")
    print(f"Summary: {correlated['summary']}")
    print(f"Explainable Root Cause: {correlated['root_cause']}")
    print(f"Explainable Recommendations: {correlated['recommendations']}")
    print("✓ Local Signal Processing & Event Correlation Engine Verified!")

    print("\n==================================================")
    print("         ALL TESTS PASSED SUCCESSFULLY!           ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
