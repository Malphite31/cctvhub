import React from 'react';
import { Cpu, Server, HardDrive, Radio, Video, RefreshCw, ArrowUpRight, CheckCircle2, Download, GitBranch } from 'lucide-react';
import { SystemTelemetry, CameraDevice, UpdateCheckInfo } from '../types';

interface SystemViewProps {
  telemetry: SystemTelemetry | null;
  devices: CameraDevice[];
  updateInfo?: UpdateCheckInfo | null;
  onOpenUpdateModal?: () => void;
  onCheckUpdate?: () => void;
  onRefresh: () => void;
}

export const SystemView: React.FC<SystemViewProps> = ({
  telemetry,
  devices,
  updateInfo,
  onOpenUpdateModal,
  onCheckUpdate,
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

  const currentCommit = updateInfo?.current_commit || 'main';
  const latestCommit = updateInfo?.latest_commit || currentCommit;
  const hasUpdate = updateInfo?.update_available || false;
  const commitMsg = updateInfo?.latest_commit_message || 'Running latest release';
  const branch = updateInfo?.branch || 'main';

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

      {/* Software & Git Updates Card */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white flex items-center gap-2">
                Software & System Updates
                {hasUpdate && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    UPDATE AVAILABLE
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono">
                Continuous in-app delivery via GitHub repository
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onCheckUpdate && (
              <button
                type="button"
                onClick={onCheckUpdate}
                className="px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 border border-[#2a2a2a] text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                title="Check GitHub repository for new commits"
              >
                <RefreshCw className="h-3 w-3 text-zinc-400" />
                <span>Check Updates</span>
              </button>
            )}

            {onOpenUpdateModal && (
              <button
                type="button"
                onClick={onOpenUpdateModal}
                className={`px-3 py-1.5 rounded-lg text-white font-medium text-[11px] flex items-center gap-1.5 transition-all shadow-md ${
                  hasUpdate
                    ? 'bg-[#3B82F6] hover:bg-blue-600 shadow-blue-500/20'
                    : 'bg-[#18181c] hover:bg-[#242428] text-zinc-200 border border-[#2e2e34]'
                }`}
              >
                {hasUpdate ? <Download className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                <span>{hasUpdate ? 'Update Now' : 'Manage Version'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Build & Version Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">Current Commit</span>
            <div className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
              <span>{currentCommit}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#222222] text-zinc-400 font-normal">v2.1.0</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">Git Branch</span>
            <div className="font-mono text-xs text-white font-bold flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-[#3B82F6]" />
              <span>{branch}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">System Status</span>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {hasUpdate ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-amber-300 font-semibold">{latestCommit} Ready</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-semibold">Up to Date</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Latest Commit Message Preview */}
        <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] flex items-center justify-between text-[11px] font-mono text-zinc-300">
          <span className="truncate pr-2">
            <span className="text-zinc-500 mr-2">Release:</span>
            {commitMsg}
          </span>
          <span className="text-[9px] text-zinc-500 shrink-0">auto-checks every 30m</span>
        </div>
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

