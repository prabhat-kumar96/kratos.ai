FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies using the CPU-specific index as primary to keep the image small
# and the standard PyPI as secondary for other packages.
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple

COPY . .

# Run FastAPI with uvicorn
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8001"]
