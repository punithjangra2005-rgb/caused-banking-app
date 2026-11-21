FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for scikit-learn and psutil
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 10000

# Render sets $PORT at runtime; default to 10000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --log-level info --timeout-keep-alive 120
