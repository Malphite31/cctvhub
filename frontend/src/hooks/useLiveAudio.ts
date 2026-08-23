import { useEffect, useRef, useState, useCallback } from 'react';

interface UseLiveAudioOptions {
  sampleRate?: number;
}

export function useLiveAudio({ sampleRate = 44100 }: UseLiveAudioOptions = {}) {
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(100); // 0 - 100%
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100 for VU meter
  const [isConnected, setIsConnected] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const isMutedRef = useRef(true);
  const volumeRef = useRef(100);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    volumeRef.current = volume;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = (volume / 100.0) * 1.5;
    }
  }, [volume]);

  // Periodic level polling to ensure VU meter stays live even before user unmutes
  useEffect(() => {
    const pollLevel = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/stream/audio/level');
        if (res.ok) {
          const data = await res.json();
          if (data.volume_rms !== undefined) {
            setAudioLevel((prev) => Math.max(prev, Math.min(100, Math.round(data.volume_rms * 2.5))));
          }
        }
      } catch {}
    };

    const interval = setInterval(pollLevel, 1000);
    return () => clearInterval(interval);
  }, []);

  const initAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate });
      const gainNode = ctx.createGain();
      gainNode.gain.value = (volumeRef.current / 100.0) * 1.5;
      gainNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      nextPlayTimeRef.current = ctx.currentTime;
    }
    return audioCtxRef.current;
  }, [sampleRate]);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/stream/audio/ws`;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;

      const int16Array = new Int16Array(event.data);
      if (int16Array.length === 0) return;

      // Calculate instant VU audio level
      let sum = 0;
      for (let i = 0; i < int16Array.length; i++) {
        sum += int16Array[i] * int16Array[i];
      }
      const rms = Math.sqrt(sum / int16Array.length);
      const level = Math.min(100, Math.round((rms / 32767) * 400));
      setAudioLevel(level);

      // Play audio if unmuted
      if (!isMutedRef.current) {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.copyToChannel(float32Array, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        if (gainNodeRef.current) {
          source.connect(gainNodeRef.current);
        } else {
          source.connect(ctx.destination);
        }

        const currentTime = ctx.currentTime;
        if (nextPlayTimeRef.current < currentTime || nextPlayTimeRef.current > currentTime + 0.4) {
          nextPlayTimeRef.current = currentTime + 0.02;
        }

        source.start(nextPlayTimeRef.current);
        nextPlayTimeRef.current += audioBuffer.duration;
      }
    };
  }, [initAudioContext, sampleRate]);

  const toggleMute = useCallback(async () => {
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isMuted) {
      nextPlayTimeRef.current = ctx.currentTime + 0.02;
      setIsMuted(false);
      isMutedRef.current = false;
    } else {
      setIsMuted(true);
      isMutedRef.current = true;
    }
  }, [initAudioContext, isMuted]);

  const changeVolume = (newVol: number) => {
    setVolume(newVol);
    volumeRef.current = newVol;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = (newVol / 100.0) * 1.5;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [connect]);

  return {
    isMuted,
    volume,
    audioLevel,
    isConnected,
    toggleMute,
    changeVolume,
  };
}
