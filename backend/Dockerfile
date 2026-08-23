FROM python:3.11-slim

# Install system dependencies (ffmpeg, v4l-utils, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    v4l-utils \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download go2rtc binary
RUN curl -L -s https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -o /usr/local/bin/go2rtc \
    && chmod +x /usr/local/bin/go2rtc

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app & streaming config
COPY app ./app
COPY streaming ./streaming

EXPOSE 8000 1984 8555

# Run go2rtc and FastAPI concurrently
CMD sh -c "go2rtc -config /app/streaming/go2rtc.yaml & uvicorn app.main:app --host 0.0.0.0 --port 8000"
