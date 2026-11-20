# Caused: 2-Tier Banking Telemetry & Privacy-Preserving SaaS Platform

**Caused** is a 2-tier bank telemetry and SaaS monitoring platform designed with privacy-preserving Transport & Control Layer (TCL) data scrubbing, Indian Rupees (₹) transactions, hybrid free AI anomaly detection, distributed profile management, and role-based authentication.

---

## 🏛️ Architecture Breakdown

### **Tier 1: SaaS Banking Web Platform (Port 3000)**
- **Accountant Authentication**:
  - Independent secure login & profile registration page.
  - **Security Rule**: Enforces strong passwords (8+ chars, Uppercase, Lowercase, Number, Special symbol).
  - **Identity Constraint**: **Not more than 1 account per `accountant_id`** attribute.
- **Accountant Operations Portal**:
  - Enter customer banking transactions in Indian Rupees (`₹ INR`) with fields for `Account Number` (**exactly 12 digits enforced**), `Date of Birth`, `Client Name`, `Feature Entitlement`, and `Transaction Value`.
  - **Deposit Support**: Dedicated cash/direct deposit mode with ledger history tracking.
- **AI Assisted LLM Copilot (SaaS Block)**:
  - **Strict Security Guardrail**: Strictly blocked by TCL policy from accessing or disclosing Tier 2 backend server metrics, host CPU/RAM, or unredacted database records.
  - **Accountant Guidance**: Assists with 12-digit deposit autofill, NEFT/wire transfers in ₹, and transaction history queries.

### **Tier 2: Collector Web Application / Backend Support (Port 8000)**
- **Backend Support Authentication**:
  - Independent SRE secure login page (`support_admin`).
- **SaaS Users Distributed File System (DFS) Explorer**:
  - Centralized directory explorer viewing all registered SaaS accountant profiles structured as distributed filesystem nodes (`/dfs/saas-nodes/<dept>/<accountant_id>.profile`).
  - Displays distributed attributes: Inode number, Block Size (Bytes), Replication Factor (3x), Storage Permissions (`-rwxr-x---`), PBKDF2 Checksums, and live Rupee volume processed.
- **TCL Data Privacy & Privacy Pipeline**:
  - Central security custodian intercepting raw ingress from SaaS and enforcing:
    - `Account Number`: Masked with tail-4 preservation (`501004829102` $\to$ `********9102`).
    - `Date of Birth`: Computed into anonymous age brackets (`[35-44]`).
    - `Client Name`: Pseudonymized with SHA-256 HMAC token (`CLT_...`).
    - `Risk & Latency`: Evaluated for degradation tiers (`OPTIMAL`, `ACCEPTABLE`, `DEGRADED`, `CRITICAL`).
- **Raw Telemetry & Audit Vault**: SQLite database storing unredacted banking audit trails in Rupees (₹), host CPU %, RAM %, network latency, packet loss %, and egress payload logs.
- **Hybrid Free AI Incident Engine**:
  - **Level 1 (Fast Local Detection)**: `Scikit-Learn` **IsolationForest** checks latency spikes, packet loss surges, egress bursts, and brute-force failed login counts in under 5ms ($0 compute cost).
  - **Level 2 (Semantic Triage & Diagnosis)**: **Google Gemini 2.5/1.5 Flash Free Tier** (via Google AI Studio) triages anomalies into structured incident tickets with severity (`P1`-`P4`), root-cause analysis, and actionable remediation steps.

---

## 🔑 Default Demo Credentials

| Architecture Tier | Role | Username / Identifier | Password |
|---|---|---|---|
| **Tier 1: SaaS Platform** | Senior Forex Specialist | `acc_charlotte_04` | `Caused@Bank2026!` |
| **Tier 1: SaaS Platform** | Retail Banking Lead | `acc_aarav_09` | `Aarav@Bank2026!` |
| **Tier 1: SaaS Platform** | Compliance Auditor | `acc_priya_12` | `Priya@Audit2026!` |
| **Tier 2: Backend Support** | SRE Lead Admin | `support_admin` | `Support@Caused2026!` |

---

## 🚀 Quick Start Guide

### 1. Start the Collector Backend (Tier 2)
In PowerShell:
```powershell
cd c:\monitoriz\collector
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*The Collector API will be live at `http://127.0.0.1:8000` (Swagger docs at `http://127.0.0.1:8000/docs`).*

### 2. Start the SaaS Platform Web App (Tier 1)
In a second PowerShell window:
```powershell
cd "c:\monitoriz\Saas platoform"
npm run dev
```
*The Web UI will be live at `http://localhost:3000`.*

---

## 🧪 Testing Features & Login Verification

1. **Test SaaS Login & Profile Creation**:
   - Navigate to `http://localhost:3000`.
   - Sign in using `acc_charlotte_04` / `Caused@Bank2026!`, or click **"Create Profile"** to register a new accountant.
   - Try a weak password (e.g. `password`) $\to$ notice the live checklist preventing registration.
   - Try registering an existing ID like `acc_charlotte_04` $\to$ the backend rejects it with: *"Not more than 1 account allowed per accountant_id."*
2. **Test Backend Support DFS Profile Explorer**:
   - Click **"Tier 2: Backend Support"** in the top navigation.
   - Sign in using `support_admin` / `Support@Caused2026!`.
   - Click the **"SaaS Users Directory (Distributed File System)"** tab.
   - Inspect the file tree (`/dfs/saas-nodes/...`), inode numbers, replication factor, permissions (`-rwxr-x---`), and live audit activity.
