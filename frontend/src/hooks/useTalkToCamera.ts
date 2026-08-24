import { useState, useRef, useEffect, useCallback } from 'react';

interface UseTalkToCameraOptions {
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export function useTalkToCamera({ onShowToast }: UseTalkToCameraOptions = {}) {
  const [isTalking, setIsTalking] = useState(false);
  const [talkVolume, setTalkVolume] = useState(0); // 0-100 VU level
  const [speakerDevices, setSpeakerDevices] = useState<any[]>([]);
  const [activeSpeakerDevice, setActiveSpeakerDevice] = useState<string | number | null>('default');
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isTalkingRef = useRef(false);
  const pcmQueueRef = useRef<ArrayBuffer[]>([]);

  // Fetch available speaker output devices from backend
  const fetchSpeakerDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/stream/audio/output-devices');
      if (res.ok) {
        const data = await res.json();
        setSpeakerDevices(data.devices || []);
        if (data.active_device !== undefined) {
          setActiveSpeakerDevice(data.active_device);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSpeakerDevices();
  }, [fetchSpeakerDevices]);

  // Connect to Talk WebSocket and drain queued PCM chunks
  const connectWs = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return wsRef.current;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/stream/talk/ws`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setIsConnected(true);
      // Drain queued audio frames
      while (pcmQueueRef.current.length > 0) {
        const chunk = pcmQueueRef.current.shift();
        if (chunk && ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          if (data.rms !== undefined && isTalkingRef.current) {
            setTalkVolume(Math.min(100, Math.round(data.rms * 2.5)));
          }
        }
      } catch {}
    };

    wsRef.current = ws;
    return ws;
  }, []);

  const sendPcmChunk = useCallback((pcm16: Int16Array) => {
    if (!isTalkingRef.current) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pcm16.buffer);
    } else {
      // Queue up to 15 chunks (~500ms) while connecting
      if (pcmQueueRef.current.length < 15) {
        pcmQueueRef.current.push(pcm16.buffer.slice(0) as ArrayBuffer);
      }
    }
  }, []);

  // Process and downsample raw Float32 samples to 16kHz Int16 PCM
  const processFloatSamples = useCallback((inputBuffer: Float32Array, inputSampleRate: number) => {
    if (!inputBuffer || inputBuffer.length === 0 || !isTalkingRef.current) return;

    // Calculate instantaneous RMS volume
    let sum = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      sum += inputBuffer[i] * inputBuffer[i];
    }
    const rms = Math.sqrt(sum / inputBuffer.length);
    const level = Math.min(100, Math.round(rms * 320));
    setTalkVolume(level);

    const targetSampleRate = 16000;
    let resampled: Float32Array;
    if (inputSampleRate === targetSampleRate) {
      resampled = inputBuffer;
    } else {
      const ratio = inputSampleRate / targetSampleRate;
      const newLength = Math.round(inputBuffer.length / ratio);
      resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const originIndex = Math.min(Math.round(i * ratio), inputBuffer.length - 1);
        resampled[i] = inputBuffer[originIndex];
      }
    }

    const pcm16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    sendPcmChunk(pcm16);
  }, [sendPcmChunk]);

  // Stop broadcasting voice
  const stopTalking = useCallback(() => {
    isTalkingRef.current = false;
    setIsTalking(false);
    setTalkVolume(0);
    pcmQueueRef.current = [];

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }

    if (scriptNodeRef.current) {
      try {
        scriptNodeRef.current.disconnect();
      } catch {}
      scriptNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {}
      gainNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.suspend().catch(() => {});
        }
      } catch {}
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'flush' }));
      } catch {}
    }
  }, []);

  // Start broadcasting voice with multi-tier browser compatibility
  const startTalking = useCallback(async () => {
    if (isTalkingRef.current) return;

    try {
      setErrorMsg(null);

      // 1. Synchronously create/unlock AudioContext in user gesture token
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API not supported on this browser');
      }

      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioCtxClass();
        audioCtxRef.current = ctx;
      }

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // 2. Connect WebSocket
      connectWs();

      // 3. Request microphone access with progressive fallback
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        // Fallback for strict mobile browsers
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const inputSampleRate = ctx.sampleRate || 44100;

      // 4. Try AudioWorklet first (Modern iOS Safari 14.5+, Chrome, Firefox, Edge)
      let workletSuccess = false;
      if (ctx.audioWorklet && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
        try {
          const workletCode = `
            class TalkProcessor extends AudioWorkletProcessor {
              constructor() {
                super();
                this.buffer = new Float32Array(2048);
                this.index = 0;
              }
              process(inputs) {
                const input = inputs[0];
                if (!input || !input[0]) return true;
                const channel = input[0];
                for (let i = 0; i < channel.length; i++) {
                  this.buffer[this.index++] = channel[i];
                  if (this.index >= 2048) {
                    this.port.postMessage(this.buffer.slice(0, 2048));
                    this.index = 0;
                  }
                }
                return true;
              }
            }
            registerProcessor('talk-processor', TalkProcessor);
          `;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await ctx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          const workletNode = new AudioWorkletNode(ctx, 'talk-processor');
          workletNode.port.onmessage = (e) => {
            if (isTalkingRef.current && e.data) {
              processFloatSamples(e.data, inputSampleRate);
            }
          };

          source.connect(workletNode);
          workletNodeRef.current = workletNode;
          workletSuccess = true;
        } catch (workletErr) {
          console.debug('AudioWorklet fallback to ScriptProcessor:', workletErr);
        }
      }

      // 5. Fallback to ScriptProcessorNode if AudioWorklet unavailable
      if (!workletSuccess) {
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        scriptNodeRef.current = processor;

        // Use micro-gain (0.00001) connected to destination to prevent iOS power-saving throttle
        const microGain = ctx.createGain();
        microGain.gain.setValueAtTime(0.00001, ctx.currentTime);
        gainNodeRef.current = microGain;

        processor.onaudioprocess = (e) => {
          if (!isTalkingRef.current) return;
          const channel = e.inputBuffer.getChannelData(0);
          if (channel && channel.length > 0) {
            processFloatSamples(channel, inputSampleRate);
          }
        };

        source.connect(processor);
        processor.connect(microGain);
        microGain.connect(ctx.destination);
      }

      isTalkingRef.current = true;
      setIsTalking(true);

      if (onShowToast) {
        onShowToast('Talk Active • Broadcasting voice to host speaker');
      }

      // Haptic vibration feedback on supported mobile devices
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
    } catch (err: any) {
      console.error('Error starting talk session:', err);
      let errMsg = 'Failed to access microphone';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        errMsg = 'Microphone permission denied. Please allow microphone access in browser settings.';
      } else if (err?.name === 'NotFoundError') {
        errMsg = 'No microphone device found on this device.';
      } else if (err?.message) {
        errMsg = err.message;
      }
      setErrorMsg(errMsg);
      if (onShowToast) {
        onShowToast(errMsg, true);
      }
      stopTalking();
    }
  }, [connectWs, onShowToast, processFloatSamples, stopTalking]);

  const toggleTalking = useCallback(() => {
    if (isTalkingRef.current || isTalking) {
      stopTalking();
    } else {
      startTalking();
    }
  }, [isTalking, startTalking, stopTalking]);

  const setSpeakerDevice = async (device: string | number) => {
    setActiveSpeakerDevice(device);
    try {
      await fetch(`/api/stream/audio/output-device?device=${encodeURIComponent(device)}`, {
        method: 'POST',
      });
      if (onShowToast) {
        onShowToast(`Host speaker output updated`);
      }
      fetchSpeakerDevices();
    } catch {
      if (onShowToast) onShowToast('Failed to switch speaker device', true);
    }
  };

  const testSpeaker = async () => {
    try {
      const res = await fetch('/api/stream/audio/test-speaker', { method: 'POST' });
      if (res.ok) {
        if (onShowToast) onShowToast('Playing test chime on host speaker...');
      } else {
        if (onShowToast) onShowToast('Could not play test chime', true);
      }
    } catch {
      if (onShowToast) onShowToast('Failed to connect to speaker service', true);
    }
  };

  useEffect(() => {
    return () => {
      stopTalking();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [stopTalking]);

  return {
    isTalking,
    talkVolume,
    isConnected,
    errorMsg,
    speakerDevices,
    activeSpeakerDevice,
    startTalking,
    stopTalking,
    toggleTalking,
    setSpeakerDevice,
    testSpeaker,
    refreshSpeakerDevices: fetchSpeakerDevices,
  };
}


