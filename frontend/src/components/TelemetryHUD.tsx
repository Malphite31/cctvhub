import React from 'react';
import { Cpu, HardDrive, Zap, Radio, Signal, Activity } from 'lucide-react';
import { SystemTelemetry, StreamStats } from '../types';

interface TelemetryHUDProps {
  telemetry: SystemTelemetry | null;
  streamStats: StreamStats;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry, streamStats }) => {
  const isOnline = streamStats.connectionState === 'connected';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-300 backdrop-blur">
      {/* Stream Status & Framerate */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-[11px] font-medium text-zinc-200">
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>{isOnline ? 'Live' : 'Connecting'}</span>
        </div>

        <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
          <Zap className="h-3 w-3 text-blue-500" />
          <span className="font-semibold text-blue-400">{streamStats.fps}</span>
          <span className="text-zinc-500">FPS</span>
        </div>

        <div className="hidden sm:inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-400">
          <span>{streamStats.resolution}</span>
        </div>
      </div>

      {/* Network Stats */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1">
          <Signal className="h-3 w-3 text-zinc-400" />
          <span>Latency:</span>
          <span className="font-medium text-zinc-200">{streamStats.latencyMs}ms</span>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <Radio className="h-3 w-3 text-zinc-400" />
          <span>Bitrate:</span>
          <span className="font-medium text-zinc-200">{streamStats.bitrateKbps} kbps</span>
        </div>
      </div>

      {/* Hardware Telemetry */}
      {telemetry && (
        <div className="flex items-center gap-3 text-[11px] text-zinc-400 border-t sm:border-t-0 border-zinc-800 pt-1.5 sm:pt-0 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3 text-zinc-500" />
            <span>CPU:</span>
            <span className={`font-medium ${telemetry.cpu_percent > 80 ? 'text-rose-400' : 'text-zinc-200'}`}>
              {telemetry.cpu_percent}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-zinc-500" />
            <span>RAM:</span>
            <span className="font-medium text-zinc-200">{telemetry.ram_used_mb} MB</span>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            <HardDrive className="h-3 w-3 text-zinc-500" />
            <span>Disk:</span>
            <span className="font-medium text-zinc-200">{telemetry.disk_free_gb} GB free</span>
          </div>
        </div>
      )}
    </div>
  );
};
