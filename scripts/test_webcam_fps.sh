#!/bin/bash
# ==============================================================================
# Diagnostics script to test webcam 60 FPS capability inside LXC
# ==============================================================================

DEVICE="${1:-/dev/video0}"

echo "========================================================="
echo "   CCTV 60 FPS Webcam Diagnostics & Capability Test     "
echo "========================================================="

if [ ! -e "$DEVICE" ]; then
    echo "[!] Error: Device $DEVICE not found in container."
    echo "[!] Check if passthrough in /etc/pve/lxc/<id>.conf is configured correctly."
    exit 1
fi

echo "[+] Device Found: $DEVICE"

if command -v v4l2-ctl >/dev/null 2>&1; then
    echo ""
    echo "--- Formats & Frame Rates Supported by $DEVICE ---"
    v4l2-ctl -d "$DEVICE" --list-formats-ext | grep -E "Size: Discrete|Interval: Discrete|Pixel Format" | head -n 30
else
    echo "[!] v4l2-ctl not found. Installing v4l-utils is recommended (apt install v4l-utils)."
fi

echo ""
echo "[+] Testing 5-second 60 FPS Capture Test with FFmpeg..."
if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -f v4l2 -input_format mjpeg -video_size 1280x720 -framerate 60 -i "$DEVICE" -t 5 -f null - 2>&1 | grep -E "fps=|frame="
    echo "[+] 60 FPS capture test completed."
else
    echo "[!] ffmpeg not found. Install ffmpeg via: apt install ffmpeg"
fi
