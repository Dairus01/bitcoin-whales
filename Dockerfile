# Production Dockerfile for WhaleWatch (Flask + SSE)

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for gevent and building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

ENV PORT=5000

CMD ["gunicorn", "-k", "gevent", "--worker-connections", "1000", "--threads", "1", "--timeout", "120", "--bind", "0.0.0.0:5000", "app:app"]


