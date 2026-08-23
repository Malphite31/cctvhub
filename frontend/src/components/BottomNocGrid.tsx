import React from 'react';
import {
  Activity,
  ScanFace,
  Eye,
  Car,
  Cpu,
  HardDrive,
  Radio,
  Clock,
  Scan,
  Server,
  ArrowRight,
  ShieldCheck,
  Crosshair,
  FolderOpen
} from 'lucide-react';
import { SystemTelemetry, StorageLocationInfo } from '../types';

interface BottomNocGridProps {
  telemetry: SystemTelemetry | null;
  storageLocation: StorageLocationInfo | null;
  onOpenStorage: () => void;
}

export const BottomNocGrid: React.FC<BottomNocGridProps> = ({
  telemetry,
  storageLocation,
  onOpenStorage,
}) => {
  const diskUsed = storageLocation ? storageLocation.used_gb : (telemetry ? (telemetry.disk_total_gb - telemetry.disk_free_gb) : 816.3);
  const diskTotal = storageLocation ? storageLocation.total_gb : (telemetry ? telemetry.disk_total_gb : 894.3);
  const diskFree = storageLocation ? storageLocation.free_gb : (telemetry ? telemetry.disk_free_gb : 78.0);
  const diskPercent = storageLocation ? storageLocation.disk_percent : (telemetry ? telemetry.disk_percent : 91.3);

  const cpuVal = telemetry ? telemetry.cpu_percent : 42;
  const ramVal = telemetry ? telemetry.ram_percent : 58;
  const netSent = telemetry?.network_sent_mbps ?? 1.4;
  const netRecv = telemetry?.network_recv_mbps ?? 8.2;

  // Media size calculation with smart formatting
  const recMB = storageLocation?.recordings_mb ?? 0;
  const snapMB = storageLocation?.snapshots_mb ?? 0;

  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    if (mb > 0) return `${mb.toFixed(0)} MB`;
    return '0 MB';
  };

  const recFormatted = formatSize(recMB);
  const snapFormatted = formatSize(snapMB);
  const freeFormatted = diskFree >= 1 ? `${diskFree.toFixed(0)} GB` : `${(diskFree * 1024).toFixed(0)} MB`;

  // Segment widths (Drive Volume Breakdown)
  const cctvMediaGB = (recMB + snapMB) / 1024;
  const systemOtherGB = Math.max(0, diskUsed - cctvMediaGB);

  const cctvPct = diskTotal > 0 ? (cctvMediaGB / diskTotal) * 100 : 0;
  const systemPct = diskTotal > 0 ? (systemOtherGB / diskTotal) * 100 : diskPercent;
  const freePct = diskTotal > 0 ? (diskFree / diskTotal) * 100 : (100 - diskPercent);

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/storage/open-folder', { method: 'POST' });
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 select-none text-xs">
      {/* 1. OVERHAULED ULTRA-MODERN STORAGE POOL CARD */}
      <div
        onClick={onOpenStorage}
        className="group relative rounded-xl border border-[#222222] bg-[#111111] p-3.5 flex flex-col justify-between cursor-pointer hover:border-[#3B82F6]/60 hover:bg-[#141414] transition-all duration-200 shadow-xl overflow-hidden"
      >
        {/* Subtle Ambient Card Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#3B82F6]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#3B82F6]/15 transition-colors" />

        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#181818] border border-[#262626] text-[#3B82F6] shadow-sm">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white font-sans tracking-tight">
                Storage Pool
              </h4>
              <span className="text-[9px] text-zinc-400 font-mono block leading-tight">
                Primary NVMe / SSD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-mono text-emerald-400 font-medium shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>

        {/* Hero Metric Capacity Display */}
        <div className="py-2.5 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white font-mono tracking-tight leading-none">
                {diskUsed.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-zinc-400 font-mono">GB</span>
              <span className="text-xs text-zinc-500 font-mono">/ {diskTotal.toFixed(1)} GB</span>
            </div>

            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shadow-xs ${
                diskPercent > 90
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                  : 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30'
              }`}
            >
              {diskPercent.toFixed(1)}% USED
            </div>
          </div>

          {/* Fully Proportional Segmented Storage Bar */}
          <div className="w-full bg-[#18181b] h-2.5 rounded-md overflow-hidden flex p-0.5 border border-[#26262a] gap-0.5">
            {/* CCTV Media Segment (Blue) */}
            {cctvPct > 0.5 && (
              <div
                className="bg-[#3B82F6] h-full rounded-xs transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                style={{ width: `${Math.max(2, cctvPct)}%` }}
                title={`CCTV Media: ${cctvMediaGB.toFixed(1)} GB`}
              />
            )}
            {/* Host System / Other Data (Dark Steel Blue) */}
            <div
              className="bg-zinc-600/70 h-full rounded-xs transition-all duration-500"
              style={{ width: `${Math.max(2, systemPct)}%` }}
              title={`System & Other Data: ${systemOtherGB.toFixed(1)} GB`}
            />
            {/* Free Headroom (Emerald) */}
            <div
              className="bg-emerald-500 h-full rounded-xs transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              style={{ width: `${Math.max(2, freePct)}%` }}
              title={`Free Space: ${diskFree.toFixed(1)} GB`}
            />
          </div>

          {/* Segment Key Pills */}
          <div className="grid grid-cols-3 gap-1 pt-0.5 text-[9px] font-mono">
            <div className="bg-[#161618] border border-[#222225] rounded px-1.5 py-1 flex items-center gap-1 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] shrink-0" />
              <span className="truncate">Clips: <strong className="text-white font-semibold">{recFormatted}</strong></span>
            </div>
            <div className="bg-[#161618] border border-[#222225] rounded px-1.5 py-1 flex items-center gap-1 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
              <span className="truncate">Snaps: <strong className="text-white font-semibold">{snapFormatted}</strong></span>
            </div>
            <div className="bg-[#161618] border border-[#222225] rounded px-1.5 py-1 flex items-center gap-1 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Free: <strong className="text-emerald-400 font-semibold">{freeFormatted}</strong></span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex justify-between items-center pt-2.5 border-t border-[#1f1f1f] text-[10px] text-zinc-400 font-mono">
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
            title="Open DVR folder on local computer"
          >
            <FolderOpen className="h-3 w-3 text-zinc-500" />
            <span>Open Folder</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-zinc-500 hidden sm:flex">
              <Clock className="h-2.5 w-2.5" />
              <span>30D Purge</span>
            </div>
            <span className="text-[#3B82F6] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Manage <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </div>

      {/* 2. DETECTION STATUS CARD */}
      <div className="rounded-xl border border-[#222222] bg-[#111111] p-3.5 flex flex-col justify-between shadow-xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#181818] border border-[#262626] text-emerald-400 shadow-sm">
              <ScanFace className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white font-sans tracking-tight">
                Detection Status
              </h4>
              <span className="text-[9px] text-zinc-400 font-mono block leading-tight">
                Real-Time AI Sensors
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-mono text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>4 ACTIVE</span>
          </div>
        </div>

        <div className="space-y-1.5 py-2 text-[11px]">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Activity className="h-3.5 w-3.5 text-[#3B82F6]" />
              Motion Detection
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
              Custom Object Tracking
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Eye className="h-3.5 w-3.5 text-purple-400" />
              Face Recognition
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Car className="h-3.5 w-3.5 text-amber-400" />
              Vehicle Detection
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2.5 border-t border-[#1f1f1f] text-[10px] text-zinc-500 font-mono">
          <span>Latency: <strong className="text-zinc-300">~14ms</strong></span>
          <span>Buffer: <strong className="text-zinc-300">1 Frame</strong></span>
        </div>
      </div>

      {/* 3. SYSTEM PERFORMANCE CARD */}
      <div className="rounded-xl border border-[#222222] bg-[#111111] p-3.5 flex flex-col justify-between shadow-xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#181818] border border-[#262626] text-purple-400 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white font-sans tracking-tight">
                System Telemetry
              </h4>
              <span className="text-[9px] text-zinc-400 font-mono block leading-tight">
                Hardware Load
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-2.5 py-0.5 rounded-full border border-[#3B82F6]/20">
            60.0 FPS
          </span>
        </div>

        <div className="space-y-2 py-2 text-[11px] font-mono">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3 text-zinc-500" /> CPU Load</span>
              <span className="text-white font-semibold">{cpuVal}%</span>
            </div>
            <div className="w-full bg-[#1c1c1f] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${cpuVal > 80 ? 'bg-rose-500' : cpuVal > 50 ? 'bg-amber-400' : 'bg-[#3B82F6]'}`}
                style={{ width: `${Math.min(100, cpuVal)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5"><Server className="h-3 w-3 text-zinc-500" /> RAM Load</span>
              <span className="text-white font-semibold">{ramVal}%</span>
            </div>
            <div className="w-full bg-[#1c1c1f] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${ramVal > 80 ? 'bg-rose-500' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, ramVal)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-zinc-400 pt-0.5">
            <span className="flex items-center gap-1.5"><Radio className="h-3 w-3 text-zinc-500" /> Network I/O</span>
            <span className="text-zinc-200 text-[10px]">↑ {netSent} • ↓ {netRecv} Mb/s</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2.5 border-t border-[#1f1f1f] text-[10px] text-zinc-500 font-mono">
          <span>Uptime: <strong className="text-zinc-300">{telemetry?.uptime_formatted || '14h 22m'}</strong></span>
          <span className="text-emerald-400">Stable</span>
        </div>
      </div>

      {/* 4. AI STATUS CARD */}
      <div className="rounded-xl border border-[#222222] bg-[#111111] p-3.5 flex flex-col justify-between shadow-xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#181818] border border-[#262626] text-cyan-400 shadow-sm">
              <Scan className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white font-sans tracking-tight">
                AI Vision Core
              </h4>
              <span className="text-[9px] text-zinc-400 font-mono block leading-tight">
                Neural Inference
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-mono text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>

        <div className="space-y-1.5 py-1.5 text-[10px] font-mono">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="text-zinc-400">Vision Engine</span>
            <span className="text-white font-semibold">OpenCV 4.11 CV2</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="text-zinc-400">Tracker Algorithm</span>
            <span className="text-[#3B82F6] font-semibold">Custom Zone Delta</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#161618] border border-[#202022]">
            <span className="text-zinc-400">Biometric Threshold</span>
            <span className="text-emerald-400 font-bold">75% Match</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2.5 border-t border-[#1f1f1f] text-[10px] text-zinc-500 font-mono">
          <span>Security: <strong className="text-zinc-300">Biometric Guard</strong></span>
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
