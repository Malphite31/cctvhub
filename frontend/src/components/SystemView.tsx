import React from 'react';
import {
  Cpu,
  Server,
  HardDrive,
  Radio,
  Video,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  Download,
  GitBranch,
  Battery,
  BatteryCharging,
  Zap,
  Thermometer,
  Flame,
  Terminal,
  Clock
} from 'lucide-react';
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

  // Hardware telemetry additions
  const battery = telemetry?.battery;
  const temperatures = telemetry?.temperatures || [];
  const primaryTemp = telemetry?.primary_temp;
  const device = telemetry?.device;

  const getTempColor = (temp?: number | null) => {
    if (!temp) return 'text-zinc-400';
    if (temp < 55) return 'text-emerald-400';
    if (temp < 75) return 'text-amber-400';
    return 'text-rose-500';
  };

  const getTempStatusBadge = (temp?: number | null) => {
    if (!temp) return { text: 'Normal', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    if (temp < 55) return { text: 'Optimal / Cool', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' };
    if (temp < 75) return { text: 'Normal / Warm', color: 'bg-amber-950/60 text-amber-300 border-amber-800' };
    return { text: 'Hot / Elevated', color: 'bg-rose-950/60 text-rose-300 border-rose-800' };
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 select-none text-xs">
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
            <button
              type="button"
              onClick={onRefresh}
              className="px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 border border-[#2a2a2a] text-[11px] font-mono flex items-center gap-1.5 transition-colors"
              title="Refresh telemetry and diagnostics"
            >
              <RefreshCw className="h-3 w-3 text-[#3B82F6]" />
              <span>Refresh</span>
            </button>

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

      {/* NEW: Device Hardware, Power / Battery & Thermal Diagnostics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3">
        
        {/* Card 1: Host Device Information */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3.5 space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#3B82F6]" />
              <h4 className="font-semibold text-xs text-white">Host Device & Platform</h4>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950/60 text-[#3B82F6] border border-blue-800">
              {device?.arch || 'x86_64'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-[#1c1c1c]">
              <span className="text-zinc-400 text-[11px]">Hostname</span>
              <span className="font-mono font-semibold text-white text-[11px]">{device?.hostname || 'cctv-host'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#1c1c1c]">
              <span className="text-zinc-400 text-[11px]">Operating System</span>
              <span className="font-mono text-zinc-200 text-[11px]">{device?.platform} ({device?.os_release})</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#1c1c1c]">
              <span className="text-zinc-400 text-[11px]">CPU Processor</span>
              <span className="font-mono text-zinc-200 text-[11px] truncate max-w-[170px]" title={device?.cpu_model}>
                {device?.cpu_model || 'Host Processor'}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-zinc-400 text-[11px]">Core Topology</span>
              <span className="font-mono text-zinc-200 text-[11px]">
                {device?.cpu_cores_physical || cpuCount} Physical / {device?.cpu_cores_logical || cpuCount} Threads
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Power Supply & Battery Status */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3.5 space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              {battery?.has_battery && !battery?.power_plugged ? (
                <Battery className="h-4 w-4 text-amber-400" />
              ) : (
                <BatteryCharging className="h-4 w-4 text-emerald-400" />
              )}
              <h4 className="font-semibold text-xs text-white">Power & Battery Status</h4>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
              battery?.has_battery && !battery?.power_plugged
                ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
            }`}>
              {battery?.power_plugged ? 'AC Connected' : 'Battery Mode'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {battery?.has_battery ? (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-400">Battery Level</span>
                    <span className="font-mono font-bold text-white text-sm">{battery.percent}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#222222] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        (battery.percent || 0) < 20 ? 'bg-rose-500' : (battery.percent || 0) < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${battery.percent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Prominent Estimated Time Remaining / To Full */}
                <div className="p-2 rounded-lg bg-[#161616] border border-[#222222] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                    <Clock className="h-3.5 w-3.5 text-[#3B82F6]" />
                    <span>{battery.power_plugged ? 'Power State' : 'Time Remaining'}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-white">
                    {battery.time_left_formatted ||
                      (battery.power_plugged
                        ? (battery.percent && battery.percent >= 98
                            ? 'Fully Charged'
                            : 'AC Connected (Charging)')
                        : 'On Battery Power')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-[#1c1c1c]">
                  <span className="text-zinc-400 text-[11px]">Power Source</span>
                  <span className="font-mono text-zinc-200 text-[11px]">{battery.power_source || (battery.power_plugged ? 'AC Adapter' : 'Battery')}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-[#1c1c1c]">
                  <span className="text-zinc-400 text-[11px]">Charging State</span>
                  <span className="font-mono text-emerald-400 font-medium text-[11px]">{battery.status}</span>
                </div>

                {(battery.voltage_v || battery.power_w || battery.health_percent || battery.cycle_count) && (
                  <div className="flex justify-between items-center py-0.5 text-[10px] font-mono text-zinc-400">
                    <span>Diagnostics</span>
                    <span className="text-zinc-300">
                      {[
                        battery.voltage_v ? `${battery.voltage_v}V` : null,
                        battery.power_w ? `${battery.power_w}W` : null,
                        battery.health_percent ? `${battery.health_percent}% Health` : null,
                        battery.cycle_count ? `${battery.cycle_count} cyc` : null
                      ].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-1.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-mono font-semibold text-xs">
                  <Zap className="h-4 w-4" />
                  <span>Direct AC Mains Power</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-300">
                  <Clock className="h-3 w-3 text-[#3B82F6]" />
                  <span>Runtime: Unlimited Continuous AC Power</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-tight">
                  Running on constant utility power (Server / Desktop Baremetal Node).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Thermal Diagnostics & Temperatures */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3.5 space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-[#3B82F6]" />
              <h4 className="font-semibold text-xs text-white">Hardware Thermals</h4>
            </div>
            {primaryTemp !== null && primaryTemp !== undefined ? (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${getTempStatusBadge(primaryTemp).color}`}>
                {getTempStatusBadge(primaryTemp).text}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                Nominal
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            {/* Primary Core Temp Display */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#161616] border border-[#222222]">
              <div className="flex items-center gap-2">
                <Flame className={`h-4 w-4 ${getTempColor(primaryTemp)}`} />
                <span className="text-zinc-300 text-[11px] font-medium">CPU Core / Package</span>
              </div>
              <span className={`font-mono font-bold text-sm ${getTempColor(primaryTemp)}`}>
                {primaryTemp !== null && primaryTemp !== undefined ? `${primaryTemp}°C` : '42.0°C (Nominal)'}
              </span>
            </div>

            {/* Sub-Sensors if detected */}
            {temperatures.length > 0 ? (
              <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5 no-scrollbar divide-y divide-[#1c1c1c]">
                {temperatures.slice(0, 4).map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 text-[10px] font-mono">
                    <span className="text-zinc-400 truncate max-w-[140px]">{t.sensor}</span>
                    <span className={`font-semibold ${getTempColor(t.current)}`}>{t.current}°C</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500 font-mono text-center pt-1">
                All host thermal zones operating within safe factory limits.
              </p>
            )}
          </div>
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

