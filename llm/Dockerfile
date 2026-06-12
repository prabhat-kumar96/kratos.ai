FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    langchain \
    langchain-groq \
    langchain-community \
    langchain-experimental \
    langgraph \
    pandas \
    requests \
    beautifulsoup4 \
    python-dotenv \
    tabulate

# Copy source code
COPY . .

# Expose port
EXPOSE 8002

# Run command
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8002"]
