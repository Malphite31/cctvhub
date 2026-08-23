import React from 'react';
import { Cpu, Server, HardDrive, Radio, Video, RefreshCw } from 'lucide-react';
import { SystemTelemetry, CameraDevice } from '../types';

interface SystemViewProps {
  telemetry: SystemTelemetry | null;
  devices: CameraDevice[];
  onRefresh: () => void;
}

export const SystemView: React.FC<SystemViewProps> = ({
  telemetry,
  devices,
  onRefresh,
}) => {
  const cpuPercent = telemetry ? telemetry.cpu_percent : 0;
  const ramPercent = telemetry ? telemetry.ram_percent : 0;
  const ramUsedMb = telemetry ? telemetry.ram_used_mb : 0;
  const ramTotalMb = telemetry ? telemetry.ram_total_mb : 0;
  const diskPercent = telemetry ? telemetry.disk_percent : 0;
  const diskUsedGb = telemetry ? (telemetry.disk_total_gb - telemetry.disk_free_gb) : 0;
  const diskTotalGb = telemetry ? telemetry.disk_total_gb : 0;
  const cpuCount = telemetry ? telemetry.cpu_count : 4;
  const uptime = telemetry?.uptime_formatted || 'Online';
  const netSent = telemetry?.network_sent_mbps ?? 0;
  const netRecv = telemetry?.network_recv_mbps ?? 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 select-none text-xs">
      {/* Top Header */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] shrink-0">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs sm:text-sm text-white font-sans truncate">System Diagnostics & Telemetry</h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono truncate">Hardware resource utilization, network I/O, and active devices.</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-mono shrink-0"
        >
          <RefreshCw className="h-3 w-3 text-[#3B82F6]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary 4 Resource Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* CPU */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono"><Cpu className="h-3.5 w-3.5 text-[#3B82F6]" /> CPU</span>
            <span className="font-mono text-white font-bold">{cpuPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#222222] rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${cpuPercent}%` }} />
          </div>
          <span className="text-[9px] text-zinc-500 font-mono block">{cpuCount} Cores</span>
        </div>

        {/* RAM */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono"><Server className="h-3.5 w-3.5 text-[#3B82F6]" /> RAM</span>
            <span className="font-mono text-white font-bold">{ramPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#222222] rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${ramPercent}%` }} />
          </div>
          <span className="text-[9px] text-zinc-500 font-mono block">{ramUsedMb} / {ramTotalMb} MB</span>
        </div>

        {/* Storage */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono"><HardDrive className="h-3.5 w-3.5 text-[#3B82F6]" /> Disk</span>
            <span className="font-mono text-white font-bold">{diskPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#222222] rounded-full overflow-hidden">
            <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-300" style={{ width: `${diskPercent}%` }} />
          </div>
          <span className="text-[9px] text-zinc-500 font-mono block">{diskUsedGb.toFixed(1)} / {diskTotalGb.toFixed(1)} GB</span>
        </div>

        {/* Network & Uptime */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono"><Radio className="h-3.5 w-3.5 text-[#3B82F6]" /> Network</span>
            <span className="font-mono text-emerald-400 text-[10px] font-bold">Online</span>
          </div>
          <div className="text-[11px] font-mono text-white truncate">
            ↑ {netSent} • ↓ {netRecv} Mb/s
          </div>
          <span className="text-[9px] text-zinc-500 font-mono block truncate">Uptime: {uptime}</span>
        </div>
      </div>

      {/* Connected Cameras Hardware Table */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <Video className="h-3.5 w-3.5 text-[#3B82F6]" />
            <h4 className="font-semibold text-xs text-white">Video Capture Hardware Devices</h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">{devices.length} Active</span>
        </div>

        <div className="space-y-1.5">
          {devices.map((d) => (
            <div
              key={d.device}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#161616] border border-[#222222] gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-white truncate">{d.name}</p>
                  <span className="text-[9px] text-zinc-500 font-mono block truncate">Index: {d.device}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-[#222222] text-zinc-200">
                  {d.resolution || '1080p'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#222222] text-[#3B82F6]">
                  60 FPS
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
