try:
    import sounddevice as sd
except Exception:
    sd = None

import numpy as np
import threading
import time
import asyncio
import logging
import platform
import re
import subprocess
from pathlib import Path
from typing import Set, Optional, List, Dict, Any, Union

logger = logging.getLogger("audio_worker")


def scan_linux_alsa_devices() -> List[Dict[str, Any]]:
    """Scans /proc/asound/cards, /proc/asound/pcm, and arecord to discover all USB webcams and hardware audio capture devices."""
    alsa_devices: List[Dict[str, Any]] = []
    cards_file = Path("/proc/asound/cards")
    pcm_file = Path("/proc/asound/pcm")

    card_names: Dict[int, Dict[str, str]] = {}
    if cards_file.exists():
        try:
            content = cards_file.read_text(encoding="utf-8", errors="ignore")
            # Format: 1 [Camera         ]: USB-Audio - USB 2.0 Camera
            for match in re.finditer(r"^\s*(\d+)\s+\[([^\]]+)\]:\s*([^\n-]+)\s*-\s*([^\n]+)", content, re.MULTILINE):
                c_idx = int(match.group(1))
                c_id = match.group(2).strip()
                driver = match.group(3).strip()
                desc = match.group(4).strip()
                card_names[c_idx] = {
                    "id": c_id,
                    "driver": driver,
                    "desc": desc
                }
        except Exception as e:
            logger.debug(f"Error reading /proc/asound/cards: {e}")

    # Check /proc/asound/pcm for capture-capable subdevices
    if pcm_file.exists():
        try:
            pcm_content = pcm_file.read_text(encoding="utf-8", errors="ignore")
            # Format: 01-00: USB Audio : USB Audio : capture 1
            for line in pcm_content.splitlines():
                if "capture" in line.lower():
                    parts = line.split(":")
                    if len(parts) >= 2:
                        card_dev = parts[0].strip()
                        card_parts = card_dev.split("-")
                        if len(card_parts) == 2:
                            c_idx = int(card_parts[0])
                            d_idx = int(card_parts[1])
                            info = card_names.get(c_idx, {})
                            card_desc = info.get("desc", f"Audio Device {c_idx}")
                            card_id = info.get("id", str(c_idx))

                            clean_name = card_desc
                            lower_desc = card_desc.lower()
                            if any(k in lower_desc for k in ["usb", "camera", "webcam", "smartcam", "emeet", "c60e", "c920", "c270"]):
                                clean_name = f"{card_desc} (Webcam Mic)"

                            alsa_devices.append({
                                "index": f"plughw:{c_idx},{d_idx}",
                                "card_index": c_idx,
                                "device_subindex": d_idx,
                                "card_id": card_id,
                                "alsa_name": f"plughw:{c_idx},{d_idx}",
                                "hw_name": f"hw:{c_idx},{d_idx}",
                                "name": clean_name,
                                "raw_name": f"{card_desc} [hw:{c_idx},{d_idx}]",
                                "channels": 1,
                                "default_samplerate": 44100
                            })
        except Exception as e:
            logger.debug(f"Error reading /proc/asound/pcm: {e}")

    # Fallback to `arecord -l` if needed
    if not alsa_devices and Path("/usr/bin/arecord").exists():
        try:
            out = subprocess.check_output(["arecord", "-l"], text=True, stderr=subprocess.DEVNULL, timeout=2)
            for line in out.splitlines():
                if line.strip().startswith("card"):
                    # card 1: C60E [EMEET SmartCam C60E], device 0: USB Audio [USB Audio]
                    m = re.search(r"card\s+(\d+):\s*([^,]+),\s*device\s+(\d+):\s*([^\[]+)\[(.*?)\]", line)
                    if m:
                        c_idx = int(m.group(1))
                        c_name = m.group(2).strip()
                        d_idx = int(m.group(3))
                        d_name = m.group(5).strip()
                        alsa_devices.append({
                            "index": f"plughw:{c_idx},{d_idx}",
                            "card_index": c_idx,
                            "device_subindex": d_idx,
                            "alsa_name": f"plughw:{c_idx},{d_idx}",
                            "hw_name": f"hw:{c_idx},{d_idx}",
                            "name": f"{c_name} - {d_name} (Webcam Mic)",
                            "raw_name": f"{c_name} [{d_name}]",
                            "channels": 1,
                            "default_samplerate": 44100
                        })
        except Exception:
            pass

    return alsa_devices


class AudioWorker:
    """Captures microphone audio using sounddevice and streams PCM chunks to WebSocket queues."""
    def __init__(self, sample_rate: int = 44100, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.stream: Optional[Any] = None
        self.is_running = False
        self.active_queues: Set[asyncio.Queue] = set()
        self.lock = threading.Lock()
        self.current_volume_rms = 0.0
        self.device_index: Optional[Union[int, str]] = None
        self.recorded_audio_chunks: List[np.ndarray] = []
        self.is_recording = False
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None
        self.latest_raw_chunk: Optional[bytes] = None
        self._subprocess_capture: Optional[subprocess.Popen] = None
        self._subprocess_thread: Optional[threading.Thread] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    def list_devices(self) -> List[Dict[str, Any]]:
        """Returns deduplicated, clean list of real microphone input devices including USB webcam mics."""
        devices = []
        seen_keys = set()

        # 1. Default system microphone entry
        devices.append({
            "index": "default",
            "name": "Default System Microphone",
            "raw_name": "Default System Microphone",
            "channels": 1,
            "default_samplerate": 44100
        })
        seen_keys.add("default")

        # 2. Query sounddevice / PortAudio devices
        if sd is not None:
            try:
                all_devs = sd.query_devices()
                host_apis = {idx: api['name'] for idx, api in enumerate(sd.query_hostapis())}

                for dev_idx, dev in enumerate(all_devs):
                    if dev.get('max_input_channels', 0) <= 0:
                        continue

                    raw_name = dev.get('name', f'Microphone {dev_idx}')
                    api_name = host_apis.get(dev.get('hostapi', -1), '')

                    # Filter out raw internal Windows driver paths
                    if '@System32' in raw_name or 'WDM-KS' in api_name:
                        continue
                    if 'sound mapper' in raw_name.lower() or 'primary sound capture' in raw_name.lower():
                        continue

                    clean_name = raw_name
                    for prefix in ['Microphone (', 'Input (', 'Headset (', 'Mic (']:
                        if clean_name.startswith(prefix) and clean_name.endswith(')'):
                            clean_name = clean_name[len(prefix):-1]

                    # Friendly hardware naming
                    norm_key = clean_name.strip().lower()
                    if 'emeet' in norm_key:
                        clean_name = 'EMEET SmartCam C60E (Webcam Mic)'
                    elif 'usbaudio2.0' in norm_key or 'usb audio 2.0' in norm_key or 'usb audio' in norm_key:
                        clean_name = f'{clean_name} (USB Mic)'
                    elif 'iriun' in norm_key:
                        clean_name = 'Iriun Webcam Microphone'
                    elif 'realtek' in norm_key:
                        clean_name = 'Realtek High Definition Audio'

                    device_key = f"pa_{dev_idx}_{clean_name.lower()}"
                    if device_key in seen_keys:
                        continue
                    seen_keys.add(device_key)

                    devices.append({
                        "index": dev_idx,
                        "name": clean_name,
                        "raw_name": raw_name,
                        "channels": dev.get('max_input_channels', 1),
                        "default_samplerate": int(dev.get('default_samplerate') or 44100)
                    })
            except Exception as e:
                logger.error(f"Error querying PortAudio sound devices: {e}")

        # 3. Direct Linux ALSA scan (/proc/asound/cards & /proc/asound/pcm)
        if platform.system() == "Linux":
            alsa_devs = scan_linux_alsa_devices()
            for adev in alsa_devs:
                # Check if this card was already picked up by PortAudio
                card_idx = adev.get("card_index")
                alsa_tag = f"hw:{card_idx}"
                already_present = any(
                    alsa_tag in str(d.get("raw_name", "")).lower() or
                    alsa_tag in str(d.get("name", "")).lower() or
                    adev["name"].lower() in str(d.get("name", "")).lower()
                    for d in devices
                )

                if not already_present:
                    devices.append({
                        "index": adev["index"],
                        "name": adev["name"],
                        "raw_name": adev["raw_name"],
                        "channels": adev.get("channels", 1),
                        "default_samplerate": adev.get("default_samplerate", 44100)
                    })

        return devices

    def start(self, device_index: Optional[Union[int, str]] = None):
        if self.is_running:
            return

        self.device_index = device_index
        target_dev = device_index
        if target_dev == "default" or target_dev is None or target_dev == "":
            target_dev = None
        elif isinstance(target_dev, str) and target_dev.isdigit():
            target_dev = int(target_dev)

        # Attempt 1: sounddevice capture
        if sd is not None:
            # Try multiple standard sample rates and channel counts for webcam hardware compatibility
            rates_to_try = [44100, 48000, 16000, 32000, 8000]
            channels_to_try = [1, 2]

            for sr in rates_to_try:
                for ch in channels_to_try:
                    try:
                        self.stream = sd.InputStream(
                            samplerate=sr,
                            channels=ch,
                            dtype='int16',
                            device=target_dev,
                            blocksize=1024,
                            callback=self._audio_callback
                        )
                        self.stream.start()
                        self.sample_rate = sr
                        self.channels = ch
                        self.is_running = True
                        logger.info(f"Audio capture started via sounddevice on device {target_dev} ({sr}Hz, {ch}ch)")
                        return
                    except Exception as e:
                        if self.stream is not None:
                            try:
                                self.stream.close()
                            except Exception:
                                pass
                            self.stream = None
                        logger.debug(f"Audio stream attempt failed ({sr}Hz, {ch}ch, dev={target_dev}): {e}")

        # Attempt 2: Linux ALSA / arecord subprocess fallback
        if platform.system() == "Linux":
            alsa_target = str(target_dev or "default")
            if alsa_target.isdigit():
                alsa_target = f"plughw:{alsa_target},0"

            try:
                cmd = ["arecord", "-D", alsa_target, "-r", "44100", "-c", "1", "-f", "S16_LE", "-t", "raw"]
                self._subprocess_capture = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL
                )
                self.sample_rate = 44100
                self.channels = 1
                self.is_running = True

                def _reader():
                    chunk_size = 1024 * 2 # 1024 samples * 2 bytes/sample
                    while self.is_running and self._subprocess_capture and self._subprocess_capture.stdout:
                        try:
                            raw_data = self._subprocess_capture.stdout.read(chunk_size)
                            if not raw_data:
                                break
                            indata = np.frombuffer(raw_data, dtype=np.int16).reshape(-1, 1)
                            self._audio_callback(indata, len(indata), None, None)
                        except Exception:
                            break

                self._subprocess_thread = threading.Thread(target=_reader, daemon=True)
                self._subprocess_thread.start()
                logger.info(f"Audio capture started via arecord subprocess fallback on {alsa_target}")
                return
            except Exception as e:
                logger.error(f"arecord subprocess fallback failed: {e}")

        logger.warning(f"Could not start audio stream on device {target_dev}")
        self.is_running = False

    def switch_device(self, device_index: Optional[Union[int, str]]) -> Dict[str, Any]:
        """Switches the active microphone input device on the fly."""
        logger.info(f"Switching audio device to {device_index}")
        self.stop()
        time.sleep(0.15)
        self.start(device_index)
        return {
            "status": "success",
            "active_device": self.device_index,
            "sample_rate": self.sample_rate,
            "is_running": self.is_running
        }

    def _audio_callback(self, indata, frames, time_info, status):
        # Calculate volume level RMS for visualizer
        int_data = indata[:, 0] if self.channels == 1 else indata.mean(axis=1)
        rms = np.sqrt(np.mean(int_data.astype(float)**2))
        self.current_volume_rms = min(100.0, (rms / 32767.0) * 400.0)

        # Buffer for active manual recording
        if self.is_recording:
            self.recorded_audio_chunks.append(indata.copy())

        # If stereo, mix to mono int16 for lightweight browser streaming
        if self.channels > 1:
            mono_int16 = (indata.mean(axis=1)).astype(np.int16)
            raw_bytes = mono_int16.tobytes()
        else:
            raw_bytes = indata.tobytes()

        self.latest_raw_chunk = raw_bytes

        # Broadcast PCM bytes to active browser websocket queues
        if not self.main_loop or self.main_loop.is_closed():
            return

        with self.lock:
            for q in list(self.active_queues):
                try:
                    if q.full():
                        try:
                            q.get_nowait()
                        except Exception:
                            pass
                    self.main_loop.call_soon_threadsafe(q.put_nowait, raw_bytes)
                except Exception:
                    pass

    def register_queue(self, queue: asyncio.Queue):
        with self.lock:
            self.active_queues.add(queue)
        if not self.is_running:
            self.start(self.device_index)

    def unregister_queue(self, queue: asyncio.Queue):
        with self.lock:
            self.active_queues.discard(queue)

    def start_recording(self):
        self.recorded_audio_chunks = []
        self.is_recording = True

    def stop_recording(self) -> Optional[np.ndarray]:
        self.is_recording = False
        if self.recorded_audio_chunks:
            combined = np.concatenate(self.recorded_audio_chunks, axis=0)
            self.recorded_audio_chunks = []
            return combined
        return None

    def stop(self):
        self.is_running = False
        if self.stream:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None

        if self._subprocess_capture:
            try:
                self._subprocess_capture.terminate()
                self._subprocess_capture.wait(timeout=1.0)
            except Exception:
                pass
            self._subprocess_capture = None

audio_worker = AudioWorker()


class AudioSpeakerWorker:
    """Receives live voice PCM streams from browser and plays them through camera/host speaker."""
    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        try:
            from ..core.database import get_system_setting
            saved_dev = get_system_setting("speaker_output_device", "default")
            self.output_device: Optional[Union[int, str]] = saved_dev if saved_dev and saved_dev != "default" else None
        except Exception:
            self.output_device = None
        self.stream: Optional[Any] = None
        self.is_active = False
        self.is_talking = False
        self.current_volume_rms = 0.0
        self.lock = threading.Lock()
        self.last_audio_time = 0.0
        self._subprocess_playback: Optional[subprocess.Popen] = None
        self._output_queue: asyncio.Queue = None

    def list_output_devices(self) -> List[Dict[str, Any]]:
        """Returns clean list of real speaker / audio output devices."""
        devices = []
        seen_keys = set()
        devices.append({
            "index": "default",
            "name": "Default System Speaker",
            "raw_name": "Default System Speaker",
            "channels": 2,
            "default_samplerate": 44100
        })
        seen_keys.add("default")

        if sd is not None:
            try:
                all_devs = sd.query_devices()
                host_apis = {idx: api['name'] for idx, api in enumerate(sd.query_hostapis())}
                for dev_idx, dev in enumerate(all_devs):
                    if dev.get('max_output_channels', 0) <= 0:
                        continue
                    raw_name = dev.get('name', f'Speaker {dev_idx}')
                    api_name = host_apis.get(dev.get('hostapi', -1), '')
                    if '@System32' in raw_name or 'WDM-KS' in api_name:
                        continue
                    if 'sound mapper' in raw_name.lower() or 'primary sound driver' in raw_name.lower():
                        continue
                    clean_name = raw_name
                    for prefix in ['Speakers (', 'Output (', 'Headphones (', 'Speaker (']:
                        if clean_name.startswith(prefix) and clean_name.endswith(')'):
                            clean_name = clean_name[len(prefix):-1]
                    norm_key = clean_name.strip().lower()
                    if 'emeet' in norm_key:
                        clean_name = 'EMEET SmartCam C60E (Camera Speaker)'
                    elif 'usb audio' in norm_key or 'usbaudio' in norm_key:
                        clean_name = f'{clean_name} (USB Speaker)'
                    elif 'realtek' in norm_key:
                        clean_name = 'Realtek Audio Output'

                    device_key = f"out_{dev_idx}_{clean_name.lower()}"
                    if device_key in seen_keys:
                        continue
                    seen_keys.add(device_key)
                    devices.append({
                        "index": dev_idx,
                        "name": clean_name,
                        "raw_name": raw_name,
                        "channels": dev.get('max_output_channels', 2),
                        "default_samplerate": int(dev.get('default_samplerate') or 44100)
                    })
            except Exception as e:
                logger.error(f"Error querying output sound devices: {e}")

        # Linux ALSA output scan
        if platform.system() == "Linux":
            try:
                out = subprocess.check_output(["aplay", "-l"], text=True, stderr=subprocess.DEVNULL, timeout=2)
                for line in out.splitlines():
                    if line.strip().startswith("card"):
                        m = re.search(r"card\s+(\d+):\s*([^,]+),\s*device\s+(\d+):\s*([^\[]+)\[(.*?)\]", line)
                        if m:
                            c_idx = int(m.group(1))
                            c_name = m.group(2).strip()
                            d_idx = int(m.group(3))
                            d_name = m.group(5).strip()
                            clean_alsa_name = d_name
                            if "emeet" in clean_alsa_name.lower():
                                clean_alsa_name = "EMEET Camera Speaker"
                            elif "usb" in clean_alsa_name.lower():
                                clean_alsa_name = f"{clean_alsa_name} (USB Audio)"
                            devices.append({
                                "index": f"plughw:{c_idx},{d_idx}",
                                "name": f"{clean_alsa_name} [ALSA Card {c_idx}]",
                                "raw_name": f"card {c_idx}: {c_name}, device {d_idx}: {d_name}",
                                "channels": 2,
                                "default_samplerate": 44100
                            })
            except Exception:
                pass
        return devices

    def set_output_device(self, device_index: Optional[Union[int, str]]):
        self.output_device = device_index
        try:
            from ..core.database import set_system_setting
            set_system_setting("speaker_output_device", str(device_index or "default"))
        except Exception:
            pass
        self.stop()

    def test_sound(self):
        """Plays a gentle test chime through the currently selected speaker."""
        try:
            sample_rate = 16000
            duration = 0.35
            t = np.linspace(0, duration, int(sample_rate * duration), False)
            tone = 0.3 * np.sin(2 * np.pi * 587.33 * t)
            fade_len = int(sample_rate * 0.03)
            tone[:fade_len] *= np.linspace(0, 1, fade_len)
            tone[-fade_len:] *= np.linspace(1, 0, fade_len)
            pcm = (tone * 32767).astype(np.int16).tobytes()
            self.play_chunk(pcm, sample_rate)
            return True
        except Exception as e:
            logger.error(f"Failed to play test sound: {e}")
            return False

    def start(self, sample_rate: int = 16000):
        if self.is_active and self.sample_rate == sample_rate:
            return

        self.stop()
        self.sample_rate = sample_rate
        target_dev = self.output_device
        if target_dev == "default" or target_dev is None or target_dev == "":
            target_dev = None
        elif isinstance(target_dev, str) and target_dev.isdigit():
            target_dev = int(target_dev)

        if sd is not None:
            try:
                self.stream = sd.RawOutputStream(
                    samplerate=sample_rate,
                    channels=1,
                    dtype='int16',
                    device=target_dev,
                    latency='low'
                )
                self.stream.start()
                self.is_active = True
                logger.info(f"Speaker output stream started on {target_dev} @ {sample_rate}Hz")
                return
            except Exception as e:
                logger.debug(f"sounddevice RawOutputStream start notice ({sample_rate}Hz, dev={target_dev}): {e}")

        # Linux aplay fallback
        if platform.system() == "Linux":
            alsa_target = str(target_dev or "default")
            if alsa_target.isdigit():
                alsa_target = f"plughw:{alsa_target},0"
            try:
                cmd = ["aplay", "-D", alsa_target, "-r", str(sample_rate), "-c", "1", "-f", "S16_LE", "-t", "raw", "--buffer-size=1024"]
                self._subprocess_playback = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                self.is_active = True
                logger.info(f"Speaker playback started via aplay on {alsa_target} @ {sample_rate}Hz")
                return
            except Exception as e:
                logger.error(f"aplay subprocess fallback failed: {e}")

        self.is_active = True

    def play_chunk(self, raw_bytes: bytes, client_sample_rate: int = 16000):
        if not raw_bytes:
            return

        self.last_audio_time = time.time()
        self.is_talking = True

        # Calculate volume RMS of speech for visualizer
        try:
            arr = np.frombuffer(raw_bytes, dtype=np.int16)
            if len(arr) > 0:
                rms = np.sqrt(np.mean(arr.astype(float)**2))
                self.current_volume_rms = min(100.0, (rms / 32767.0) * 400.0)
        except Exception:
            pass

        if not self.is_active or self.sample_rate != client_sample_rate:
            self.start(client_sample_rate)

        # Output to sounddevice stream
        if self.stream and self.is_active:
            try:
                self.stream.write(raw_bytes)
                return
            except Exception as e:
                logger.debug(f"Speaker stream write error: {e}")

        # Output to Linux aplay
        if self._subprocess_playback and self._subprocess_playback.stdin:
            try:
                self._subprocess_playback.stdin.write(raw_bytes)
                self._subprocess_playback.stdin.flush()
            except Exception as e:
                logger.debug(f"aplay stdin write error: {e}")

    def flush(self):
        self.is_talking = False
        self.current_volume_rms = 0.0

    def stop(self):
        self.is_active = False
        self.is_talking = False
        self.current_volume_rms = 0.0
        if self.stream:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None

        if self._subprocess_playback:
            try:
                if self._subprocess_playback.stdin:
                    self._subprocess_playback.stdin.close()
                self._subprocess_playback.terminate()
                self._subprocess_playback.wait(timeout=0.5)
            except Exception:
                pass
            self._subprocess_playback = None


audio_speaker = AudioSpeakerWorker()

