import React, { useState, useEffect } from 'react';
import { StreamStats } from '../types';
import { RefreshCw } from 'lucide-react';

interface VideoPlayer60FPSProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  stats: StreamStats;
  isRecording: boolean;
  onReconnect: () => void;
}

export const VideoPlayer60FPS: React.FC<VideoPlayer60FPSProps> = ({
  videoRef,
  stats,
  isRecording,
  onReconnect,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [useFallbackStream, setUseFallbackStream] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stats.connectionState === 'failed') {
      setUseFallbackStream(true);
    }
  }, [stats.connectionState]);

  return (
    <div className="relative w-full aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-sm group flex items-center justify-center">
      {/* HTML5 Video or Live Fallback Stream */}
      {!useFallbackStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain bg-zinc-950"
        />
      ) : (
        <img
          src="/api/stream/live"
          alt="Live Stream"
          className="w-full h-full object-contain bg-zinc-950"
          onError={() => setUseFallbackStream(false)}
        />
      )}

      {/* Clean Header Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-zinc-950/80 px-2.5 py-1 border border-zinc-800/80 backdrop-blur text-zinc-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-xs">Camera 1</span>
          </div>

          <div className="hidden sm:flex items-center rounded-md bg-zinc-950/80 px-2.5 py-1 border border-zinc-800/80 backdrop-blur text-zinc-400 text-xs">
            {stats.resolution}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 rounded-md bg-rose-950/90 px-2.5 py-1 border border-rose-800 backdrop-blur text-rose-300 font-medium text-xs animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Recording</span>
            </div>
          )}
          <div className="rounded-md bg-zinc-950/80 px-2.5 py-1 border border-zinc-800/80 backdrop-blur text-zinc-300 font-mono text-xs">
            {currentTime}
          </div>
        </div>
      </div>

      {/* Connecting Loading State */}
      {stats.connectionState === 'connecting' && (
        <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20">
          <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
          <p className="text-xs text-zinc-400 font-medium">Connecting to stream...</p>
        </div>
      )}

      {/* Stream Engine Switcher (Hover action) */}
      <div className="absolute bottom-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            setUseFallbackStream(!useFallbackStream);
            if (useFallbackStream) onReconnect();
          }}
          className="flex items-center gap-1.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-700 backdrop-blur transition-colors shadow-sm"
        >
          <RefreshCw className="h-3 w-3 text-blue-400" />
          <span>{useFallbackStream ? 'WebRTC Mode' : 'Direct Stream'}</span>
        </button>
      </div>
    </div>
  );
};
