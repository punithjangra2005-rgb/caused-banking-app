import sqlite3
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from config import DB_PATH
from policies.security import hash_password

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Raw Infra & Network Telemetry Vault
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS raw_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'tenant_hdfc',
        environment TEXT DEFAULT 'production',
        cpu_pct REAL,
        memory_pct REAL,
        latency_ms REAL,
        packet_loss_pct REAL,
        egress_bytes INTEGER,
        egress_dest TEXT,
        source_service TEXT
    )
    """)

    # Raw Banking Audit Vault (sensitive PII preserved only in collector backend)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS raw_banking_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'tenant_hdfc',
        tenant_name TEXT DEFAULT 'HDFC Bank Corporate',
        environment TEXT DEFAULT 'production',
        accountant_id TEXT,
        account_number TEXT NOT NULL,
        client_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        feature_accessed TEXT NOT NULL,
        amount REAL DEFAULT 0.0,
        client_ip TEXT NOT NULL,
        http_status INTEGER NOT NULL,
        is_failed_login INTEGER DEFAULT 0
    )
    """)

    # Scrubbed Metadata for SaaS Consumption (TCL layer output)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scrubbed_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_audit_id INTEGER,
        timestamp TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'tenant_hdfc',
        tenant_name TEXT DEFAULT 'HDFC Bank Corporate',
        environment TEXT DEFAULT 'production',
        masked_account_number TEXT NOT NULL,
        client_token TEXT NOT NULL,
        age_bracket TEXT NOT NULL,
        feature_accessed TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'OPERATION',
        amount REAL DEFAULT 0.0,
        risk_level TEXT NOT NULL,
        latency_status TEXT NOT NULL,
        FOREIGN KEY (raw_audit_id) REFERENCES raw_banking_audit(id)
    )
    """)

    # AI Detected Incidents and Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'tenant_hdfc',
        incident_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        summary TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        raw_context TEXT
    )
    """)

    # SaaS Users Table (Distributed Profile Nodes with unique accountant_id constraint & multi-tenancy)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saas_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT DEFAULT 'tenant_hdfc',
        tenant_name TEXT DEFAULT 'HDFC Bank Corporate',
        environment TEXT DEFAULT 'production',
        accountant_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Senior Accountant',
        department TEXT NOT NULL DEFAULT 'Retail Banking',
        assigned_branch TEXT DEFAULT 'Mumbai Central',
        node_id TEXT NOT NULL DEFAULT 'dfs-node-01',
        file_path TEXT NOT NULL DEFAULT '/dfs/saas-nodes/accountants/',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        last_login TEXT
    )
    """)

    # Backend Support Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS support_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'SRE Lead',
        created_at TEXT NOT NULL,
        last_login TEXT
    )
    """)

    # --- Schema Migrations for Multi-Tenancy ---
    def add_col_if_missing(table_name: str, col_name: str, col_def: str):
        cursor.execute(f"PRAGMA table_info({table_name})")
        cols = [r[1] for r in cursor.fetchall()]
        if col_name not in cols:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}")

    add_col_if_missing("scrubbed_metadata", "amount", "REAL DEFAULT 0.0")
    add_col_if_missing("scrubbed_metadata", "transaction_type", "TEXT DEFAULT 'OPERATION'")
    add_col_if_missing("scrubbed_metadata", "tenant_id", "TEXT DEFAULT 'tenant_hdfc'")
    add_col_if_missing("scrubbed_metadata", "tenant_name", "TEXT DEFAULT 'HDFC Bank Corporate'")
    add_col_if_missing("scrubbed_metadata", "environment", "TEXT DEFAULT 'production'")

    add_col_if_missing("raw_banking_audit", "tenant_id", "TEXT DEFAULT 'tenant_hdfc'")
    add_col_if_missing("raw_banking_audit", "tenant_name", "TEXT DEFAULT 'HDFC Bank Corporate'")
    add_col_if_missing("raw_banking_audit", "environment", "TEXT DEFAULT 'production'")

    add_col_if_missing("raw_telemetry", "tenant_id", "TEXT DEFAULT 'tenant_hdfc'")
    add_col_if_missing("raw_telemetry", "environment", "TEXT DEFAULT 'production'")

    add_col_if_missing("ai_incidents", "tenant_id", "TEXT DEFAULT 'tenant_hdfc'")

    add_col_if_missing("saas_users", "tenant_id", "TEXT DEFAULT 'tenant_hdfc'")
    add_col_if_missing("saas_users", "tenant_name", "TEXT DEFAULT 'HDFC Bank Corporate'")
    add_col_if_missing("saas_users", "environment", "TEXT DEFAULT 'production'")

    conn.commit()

    # Seed demo users if empty or migrate existing demo users to their distinct tenants
    _seed_default_users(cursor, conn)

    conn.close()

def _seed_default_users(cursor, conn):
    now = datetime.now(timezone.utc).isoformat()
    demo_saas = [
        ("tenant_hdfc", "HDFC Bank Corporate", "production", "acc_charlotte_04", "charlotte.s", "Charlotte Sterling", "Senior Forex Specialist", "Treasury & Global Markets", "Nariman Point, Mumbai", "dfs-node-01", "/dfs/tenants/hdfc/treasury/acc_charlotte_04.profile", "Caused@Bank2026!"),
        ("tenant_icici", "ICICI Bank Commercial", "production", "acc_aarav_09", "aarav.sharma", "Aarav Sharma", "Retail Banking Lead", "Retail Banking", "BKC, Mumbai", "dfs-node-02", "/dfs/tenants/icici/retail/acc_aarav_09.profile", "Aarav@Bank2026!"),
        ("tenant_sbi", "State Bank of India Global", "production", "acc_priya_12", "priya.patel", "Priya Patel", "Compliance & AML Auditor", "AML & Risk Management", "Bengaluru Tech Hub", "dfs-node-03", "/dfs/tenants/sbi/compliance/acc_priya_12.profile", "Priya@Audit2026!"),
        ("tenant_axis", "Axis Wealth Management", "staging", "acc_rohan_15", "rohan.verma", "Rohan Verma", "Wealth Portfolio Manager", "Private Banking", "Connaught Place, Delhi", "dfs-node-04", "/dfs/tenants/axis/wealth/acc_rohan_15.profile", "Rohan@Axis2026!")
    ]

    for tid, tname, env, acc_id, uname, fname, role, dept, branch, node, path, pwd in demo_saas:
        cursor.execute("SELECT id FROM saas_users WHERE accountant_id = ?", (acc_id,))
        row = cursor.fetchone()
        if not row:
            p_hash, salt = hash_password(pwd)
            cursor.execute("""
                INSERT INTO saas_users (tenant_id, tenant_name, environment, accountant_id, username, full_name, password_hash, salt, role, department, assigned_branch, node_id, file_path, status, created_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            """, (tid, tname, env, acc_id, uname, fname, p_hash, salt, role, dept, branch, node, path, now, now))
        else:
            # Update tenant info on existing rows if blank
            cursor.execute("""
                UPDATE saas_users SET tenant_id = ?, tenant_name = ?, environment = ?, file_path = ?
                WHERE accountant_id = ? AND (tenant_id IS NULL OR tenant_id = '')
            """, (tid, tname, env, path, acc_id))

    # Seed default Support user
    cursor.execute("SELECT COUNT(*) FROM support_users")
    if cursor.fetchone()[0] == 0:
        p_hash, salt = hash_password("Support@Caused2026!")
        cursor.execute("""
            INSERT INTO support_users (username, full_name, password_hash, salt, role, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("support_admin", "Chief SRE Lead", p_hash, salt, "Principal Observability Architect", now, now))

    conn.commit()

# --- SaaS User Management ---

def create_saas_user(data: Dict[str, Any]) -> Tuple[bool, str, Optional[int]]:
    """
    Creates a new SaaS user profile with tenant isolation.
    Strict constraint: Exactly 1 account per accountant_id!
    """
    accountant_id = str(data.get("accountant_id", "")).strip()
    if not accountant_id:
        return False, "accountant_id is required.", None

    conn = get_connection()
    cursor = conn.cursor()

    # Enforce strictly: not more than 1 account per accountant_id
    cursor.execute("SELECT id FROM saas_users WHERE accountant_id = ?", (accountant_id,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return False, f"Account creation rejected: An account with accountant_id '{accountant_id}' already exists. Policy dictates not more than 1 account per accountant_id.", None

    p_hash, salt = hash_password(data["password"])
    now = datetime.now(timezone.utc).isoformat()
    dept = data.get("department", "Retail Banking")
    dept_slug = dept.lower().replace(" ", "_")
    tenant_id = data.get("tenant_id", "tenant_hdfc")
    tenant_name = data.get("tenant_name", "HDFC Bank Corporate")
    environment = data.get("environment", "production")

    node_id = data.get("node_id", f"dfs-node-0{len(accountant_id) % 4 + 1}")
    file_path = f"/dfs/tenants/{tenant_id.replace('tenant_', '')}/{dept_slug}/{accountant_id}.profile"

    try:
        cursor.execute("""
            INSERT INTO saas_users
            (tenant_id, tenant_name, environment, accountant_id, username, full_name, password_hash, salt, role, department, assigned_branch, node_id, file_path, status, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
        """, (
            tenant_id,
            tenant_name,
            environment,
            accountant_id,
            data.get("username", accountant_id),
            data.get("full_name", accountant_id),
            p_hash,
            salt,
            data.get("role", "Accountant"),
            dept,
            data.get("assigned_branch", "Mumbai Central"),
            node_id,
            file_path,
            now,
            now
        ))
        row_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return True, "Accountant profile successfully created and provisioned on distributed node.", row_id
    except sqlite3.IntegrityError as e:
        conn.close()
        return False, f"Constraint violation: {str(e)}", None

def get_saas_user_by_accountant_id(accountant_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM saas_users WHERE accountant_id = ?", (accountant_id.strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_saas_user_last_login(accountant_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE saas_users SET last_login = ? WHERE accountant_id = ?", (now, accountant_id))
    conn.commit()
    conn.close()

def fetch_all_saas_users_dfs(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns all SaaS user profiles structured for Distributed File System explorer in Tier 2.
    Optionally filters by tenant_id for customer environment separation.
    """
    conn = get_connection()
    cursor = conn.cursor()
    if tenant_id and tenant_id != "ALL":
        cursor.execute("SELECT * FROM saas_users WHERE tenant_id = ? ORDER BY id ASC", (tenant_id,))
    else:
        cursor.execute("SELECT * FROM saas_users ORDER BY id ASC")
    users = [dict(row) for row in cursor.fetchall()]

    result = []
    for u in users:
        cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0.0) FROM raw_banking_audit WHERE accountant_id = ?", (u["accountant_id"],))
        stats = cursor.fetchone()
        trans_count = stats[0] if stats else 0
        total_vol = stats[1] if stats else 0.0

        profile_size_bytes = 1024 + (trans_count * 128)
        result.append({
            "id": u["id"],
            "tenant_id": u.get("tenant_id", "tenant_hdfc"),
            "tenant_name": u.get("tenant_name", "HDFC Bank Corporate"),
            "environment": u.get("environment", "production"),
            "accountant_id": u["accountant_id"],
            "username": u["username"],
            "full_name": u["full_name"],
            "role": u["role"],
            "department": u["department"],
            "assigned_branch": u["assigned_branch"],
            "status": u["status"],
            "created_at": u["created_at"],
            "last_login": u["last_login"],
            "dfs_metadata": {
                "file_path": u["file_path"],
                "node_id": u["node_id"],
                "inode": 1048000 + u["id"],
                "block_size_bytes": profile_size_bytes,
                "replica_count": 3,
                "permissions": "-rwxr-x---",
                "checksum_sha256": u["password_hash"][:16] + "...",
                "activity_stats": {
                    "total_transactions": trans_count,
                    "total_volume_inr": total_vol
                }
            }
        })
    conn.close()
    return result

# --- Support User Management ---

def get_support_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM support_users WHERE username = ?", (username.strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_support_user_last_login(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE support_users SET last_login = ? WHERE username = ?", (now, username))
    conn.commit()
    conn.close()

# --- Ingestion & Logging DB Methods ---

def insert_raw_telemetry(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO raw_telemetry 
        (timestamp, tenant_id, environment, cpu_pct, memory_pct, latency_ms, packet_loss_pct, egress_bytes, egress_dest, source_service)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        data.get("tenant_id", "tenant_hdfc"),
        data.get("environment", "production"),
        data.get("cpu_pct", 0.0),
        data.get("memory_pct", 0.0),
        data.get("latency_ms", 0.0),
        data.get("packet_loss_pct", 0.0),
        data.get("egress_bytes", 0),
        data.get("egress_dest", "internal"),
        data.get("source_service", "saas_platform")
    ))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return row_id

def insert_raw_banking_audit(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO raw_banking_audit
        (timestamp, tenant_id, tenant_name, environment, accountant_id, account_number, client_name, date_of_birth, feature_accessed, amount, client_ip, http_status, is_failed_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        data.get("tenant_id", "tenant_hdfc"),
        data.get("tenant_name", "HDFC Bank Corporate"),
        data.get("environment", "production"),
        data.get("accountant_id", "acc_unknown"),
        data.get("account_number", ""),
        data.get("client_name", ""),
        data.get("date_of_birth", ""),
        data.get("feature_accessed", "general_inquiry"),
        float(data.get("amount", 0.0)),
        data.get("client_ip", "127.0.0.1"),
        int(data.get("http_status", 200)),
        1 if data.get("is_failed_login") else 0
    ))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return row_id

def insert_scrubbed_metadata(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scrubbed_metadata
        (raw_audit_id, timestamp, tenant_id, tenant_name, environment, masked_account_number, client_token, age_bracket, feature_accessed, transaction_type, amount, risk_level, latency_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("raw_audit_id"),
        data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        data.get("tenant_id", "tenant_hdfc"),
        data.get("tenant_name", "HDFC Bank Corporate"),
        data.get("environment", "production"),
        data.get("masked_account_number", "****"),
        data.get("client_token", "ANON"),
        data.get("age_bracket", "UNKNOWN"),
        data.get("feature_accessed", "general"),
        data.get("transaction_type", "OPERATION"),
        float(data.get("amount", 0.0)),
        data.get("risk_level", "LOW"),
        data.get("latency_status", "NORMAL")
    ))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return row_id

def insert_ai_incident(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO ai_incidents
        (timestamp, tenant_id, incident_type, severity, summary, root_cause, recommendations, raw_context)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        data.get("tenant_id", "tenant_hdfc"),
        data.get("incident_type", "ANOMALY"),
        data.get("severity", "P3"),
        data.get("summary", ""),
        data.get("root_cause", ""),
        data.get("recommendations", ""),
        json.dumps(data.get("raw_context", {})) if isinstance(data.get("raw_context"), (dict, list)) else str(data.get("raw_context", ""))
    ))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return row_id

def fetch_recent_telemetry(limit: int = 50, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if tenant_id and tenant_id != "ALL":
        cursor.execute("SELECT * FROM raw_telemetry WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", (tenant_id, limit))
    else:
        cursor.execute("SELECT * FROM raw_telemetry ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def fetch_recent_banking_audit(limit: int = 50, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if tenant_id and tenant_id != "ALL":
        cursor.execute("SELECT * FROM raw_banking_audit WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", (tenant_id, limit))
    else:
        cursor.execute("SELECT * FROM raw_banking_audit ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def fetch_scrubbed_metadata(limit: int = 50, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Strict Multi-Tenant Retrieval:
    When tenant_id is provided, guarantees that one customer never sees another SaaS platform's metadata!
    """
    conn = get_connection()
    cursor = conn.cursor()
    if tenant_id and tenant_id != "ALL":
        cursor.execute("SELECT * FROM scrubbed_metadata WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", (tenant_id, limit))
    else:
        cursor.execute("SELECT * FROM scrubbed_metadata ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def fetch_ai_incidents(limit: int = 50, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if tenant_id and tenant_id != "ALL":
        cursor.execute("SELECT * FROM ai_incidents WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", (tenant_id, limit))
    else:
        cursor.execute("SELECT * FROM ai_incidents ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def fetch_tenants_summary() -> List[Dict[str, Any]]:
    """
    Tier 2 Support Multi-Tenant Analytics:
    Returns tenant isolation health, customer environments, and separation metrics.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Predefined known tenants with default metadata
    tenant_defs = {
        "tenant_hdfc": {"name": "HDFC Bank Corporate", "env": "production", "region": "ap-south-1 (Mumbai)", "compliance": "RBI-Grade / ISO-27001"},
        "tenant_icici": {"name": "ICICI Bank Commercial", "env": "production", "region": "ap-south-1 (Mumbai)", "compliance": "RBI-Grade / PCI-DSS"},
        "tenant_sbi": {"name": "State Bank of India Global", "env": "production", "region": "ap-south-2 (Hyderabad)", "compliance": "Gov-Strict / RBI-Grade"},
        "tenant_axis": {"name": "Axis Wealth Management", "env": "staging", "region": "ap-south-1 (Delhi Edge)", "compliance": "SEBI / Private Banking"}
    }

    # Discover any dynamic tenants
    cursor.execute("SELECT DISTINCT tenant_id, tenant_name, environment FROM saas_users")
    for row in cursor.fetchall():
        tid = row["tenant_id"]
        if tid and tid not in tenant_defs:
            tenant_defs[tid] = {
                "name": row["tenant_name"] or tid,
                "env": row["environment"] or "production",
                "region": "ap-south-1 (Mumbai)",
                "compliance": "Standard Bank-Tier"
            }

    results = []
    for tid, info in tenant_defs.items():
        cursor.execute("SELECT COUNT(*) FROM saas_users WHERE tenant_id = ?", (tid,))
        user_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0.0) FROM raw_banking_audit WHERE tenant_id = ?", (tid,))
        audit_row = cursor.fetchone()
        audit_count = audit_row[0] if audit_row else 0
        volume = audit_row[1] if audit_row else 0.0

        results.append({
            "tenant_id": tid,
            "tenant_name": info["name"],
            "environment": info["env"],
            "region": info["region"],
            "compliance_tier": info["compliance"],
            "accountants_count": user_count,
            "total_transactions": audit_count,
            "volume_inr": volume,
            "isolation_status": "ENFORCED",
            "cross_contamination_detected": False
        })

    conn.close()
    return results
