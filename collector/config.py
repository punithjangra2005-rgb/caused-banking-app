import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

db_env = os.getenv("DB_PATH", "caused_vault.db")
DB_PATH = str(Path(db_env) if Path(db_env).is_absolute() else (BASE_DIR / db_env))
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")

# Gemini API configuration (Free tier from Google AI Studio: https://aistudio.google.com)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Frontend URL for CORS (set to deployed frontend URL in production)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# Telemetry Anomaly Thresholds
CPU_THRESHOLD = float(os.getenv("CPU_THRESHOLD", 85.0))
LATENCY_THRESHOLD_MS = float(os.getenv("LATENCY_THRESHOLD_MS", 450.0))
PACKET_LOSS_THRESHOLD_PCT = float(os.getenv("PACKET_LOSS_THRESHOLD_PCT", 4.0))
EGRESS_SPIKE_BYTES = int(os.getenv("EGRESS_SPIKE_BYTES", 2 * 1024 * 1024))  # 2MB
FAILED_LOGINS_THRESHOLD = int(os.getenv("FAILED_LOGINS_THRESHOLD", 5))
