FROM python:3.10-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install lightweight production dependencies (no PyTorch/Transformers)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (market_data.csv and narratives.json are included)
COPY . .

# Default env: lightweight mode enabled, auto-retrain and broadcast disabled
ENV LIGHTWEIGHT_MODE=true
ENV ENABLE_AUTO_RETRAIN=false
ENV ENABLE_BROADCAST=false

EXPOSE 8001

# Run FastAPI with uvicorn
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8001"]
