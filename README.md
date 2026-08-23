# CCTV 60 FPS Surveillance Hub for Proxmox LXC

An ultra-lightweight, zero-AI, 60 FPS live CCTV streaming web application with **Live Audio**, **S3 Cloud Backup**, and **Samba (SMB/NAS) Replication**, designed for Proxmox LXC containers and remote access via **Cloudflare Tunnel (`cloudflared`)**.

---

## Key Highlights

* **True 60 FPS Low-Latency WebRTC + Live Audio Streaming**: Real-time video + AAC live audio with sub-second latency (<150ms).
* **Zero-AI & Ultra-Lightweight**: Consumes only **~5-8% CPU** on an Intel Core i7 3rd Gen and **<150MB RAM** inside the LXC container.
* **S3 Cloud Storage Offloading**: Automatically or manually upload MP4 clips & snapshots to AWS S3, Cloudflare R2, MinIO, Wasabi, or Backblaze B2.
* **Samba / NAS Replication**: Direct replication to TrueNAS, Synology, Unraid, or Windows network shares (`\\NAS\share` or `/mnt/samba`).
* **Tactical Monochrome + Blue Accent Dashboard**: Industrial, responsive HUD with live FPS, round-trip latency, CPU/RAM telemetry, snapshot/record tools, and media archive.

---

## Storage & Audio Features

### 1. Live Audio Streaming & MP4 Audio Recording
* Synchronized AAC / Opus live audio over WebRTC and MSE.
* MP4 recordings include synchronized audio tracks.

### 2. S3 Cloud Storage Integration
* Configure in the **Storage & Config** modal:
  * **Endpoint URL** (supports Cloudflare R2: `https://<accountid>.r2.cloudflarestorage.com`, MinIO: `https://minio.local:9000`, or default AWS).
  * **Bucket Name & Region**.
  * **Access Key & Secret Key**.
  * **Auto-Offload**: Automatically uploads newly recorded video clips and snapshots to your S3 bucket in the background.

### 3. Samba / SMB (NAS) Share Integration
* Supports both direct CIFS mount paths (`/mnt/samba/cctv` or `\\NAS\cctv`) and direct SMB network authentication (`Host`, `Share`, `Username`, `Password`).
* **Auto-Sync**: Automatically copies new recordings to your NAS.

---

## Quick Testing on Windows

Double-click [`start.bat`](start.bat) or run:
```powershell
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 18860
```
Open **`http://localhost:18860`** in your browser.

---

## Proxmox LXC Setup

1. **On Proxmox Host**:
   ```bash
   chmod +x scripts/setup_proxmox_lxc.sh
   ./scripts/setup_proxmox_lxc.sh <LXC_CONTAINER_ID>
   ```
2. **Inside LXC**:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
3. **Cloudflare Tunnel Remote Access**:
   ```bash
   cloudflared tunnel --config cloudflare/config.yml run
   ```
