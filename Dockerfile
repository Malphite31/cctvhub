# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Streaming Engine
FROM python:3.11-slim
WORKDIR /app

# Install system runtime tools (FFmpeg, v4l-utils, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    v4l-utils \
    curl \
    ca-certificates \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Download go2rtc binary
RUN curl -L -s https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -o /usr/local/bin/go2rtc \
    && chmod +x /usr/local/bin/go2rtc

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend application
COPY backend/app ./app
COPY backend/streaming ./streaming
RUN mkdir -p /app/data /app/data/faces /app/data/recordings /app/data/snapshots

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /build/dist ./dist

EXPOSE 8000 1984 8555

# Run go2rtc & FastAPI server
CMD sh -c "go2rtc -config /app/streaming/go2rtc.yaml & uvicorn app.main:app --host 0.0.0.0 --port 8000"
