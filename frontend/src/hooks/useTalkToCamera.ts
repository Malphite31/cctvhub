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
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isTalkingRef = useRef(false);

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

  // Connect to Talk WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/stream/talk/ws`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setIsConnected(true);
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

  // Stop broadcasting voice
  const stopTalking = useCallback(() => {
    isTalkingRef.current = false;
    setIsTalking(false);
    setTalkVolume(0);

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch {}
      audioCtxRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'flush' }));
      } catch {}
    }
  }, []);

  // Start broadcasting voice to camera speaker
  const startTalking = useCallback(async () => {
    if (isTalkingRef.current) return;

    try {
      setErrorMsg(null);
      connectWs();

      // Request browser microphone with noise suppression & echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      // Process chunks of 1024 samples
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      const targetSampleRate = 16000;
      const inputSampleRate = ctx.sampleRate;

      processor.onaudioprocess = (e) => {
        if (!isTalkingRef.current) return;

        const inputBuffer = e.inputBuffer.getChannelData(0);
        if (!inputBuffer || inputBuffer.length === 0) return;

        // Calculate instant input RMS volume
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        const level = Math.min(100, Math.round(rms * 300));
        setTalkVolume(level);

        // Downsample / resample from inputSampleRate to 16000Hz
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

        // Convert Float32 (-1.0 to 1.0) to Int16 PCM bytes
        const pcm16 = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      isTalkingRef.current = true;
      setIsTalking(true);

      if (onShowToast) {
        onShowToast('Talk Active • Broadcasting voice to camera speaker');
      }

      // Haptic vibration feedback on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch (err: any) {
      console.error('Error starting talk session:', err);
      const errMsg = err?.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Failed to access microphone';
      setErrorMsg(errMsg);
      if (onShowToast) {
        onShowToast(errMsg, true);
      }
      stopTalking();
    }
  }, [connectWs, onShowToast, stopTalking]);

  const toggleTalking = useCallback(() => {
    if (isTalking) {
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
        onShowToast(`Speaker output device updated`);
      }
      fetchSpeakerDevices();
    } catch {
      if (onShowToast) onShowToast('Failed to switch speaker device', true);
    }
  };

  useEffect(() => {
    return () => {
      stopTalking();
      if (wsRef.current) {
        wsRef.current.close();
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
    refreshSpeakerDevices: fetchSpeakerDevices,
  };
}
