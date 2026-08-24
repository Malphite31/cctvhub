import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Globe,
  Wifi,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Search,
  Trash2,
  Bug,
  Play,
  Pause
} from 'lucide-react';
import { SystemTelemetry, CameraDevice, UpdateCheckInfo, DevLogEntry } from '../types';

interface SystemViewProps {
  telemetry: SystemTelemetry | null;
  devices: CameraDevice[];
  updateInfo?: UpdateCheckInfo | null;
  onOpenUpdateModal?: () => void;
  onCheckUpdate?: () => void;
  onRefresh: () => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const SystemView: React.FC<SystemViewProps> = ({
  telemetry,
  devices,
  updateInfo,
  onOpenUpdateModal,
  onCheckUpdate,
  onRefresh,
  onShowToast,
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
  const network = telemetry?.network;

  // Copy state for individual items
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dev Logs state
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [rawLogsText, setRawLogsText] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO'>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  const fetchDevLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/telemetry/logs?limit=300&level=${logFilter}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setRawLogsText(data.raw_text || '');
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchDevLogs();
  }, [logFilter]);

  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchDevLogs, 4000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, logFilter]);

  const handleCopy = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      if (onShowToast) onShowToast(`Copied ${label} to clipboard: ${text}`);
    } catch {
      if (onShowToast) onShowToast('Failed to copy to clipboard', true);
    }
  };

  const handleCopyAllLogs = async () => {
    const textToCopy = rawLogsText || filteredLogs.map(l => l.raw || l.message || '').join('\n');
    if (!textToCopy) {
      if (onShowToast) onShowToast('No logs to copy', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2500);
      if (onShowToast) onShowToast(`Copied ${filteredLogs.length} log entries to clipboard for bug tracing!`);
    } catch {
      if (onShowToast) onShowToast('Failed to copy logs to clipboard', true);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/telemetry/logs', { method: 'DELETE' });
      setLogs([]);
      setRawLogsText('');
      if (onShowToast) onShowToast('Cleared log viewer buffer');
    } catch {
      if (onShowToast) onShowToast('Failed to clear logs', true);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (!logSearch.trim()) return true;
    const q = logSearch.toLowerCase();
    const raw = (l.raw || l.message || '').toLowerCase();
    return raw.includes(q) || (l.logger && l.logger.toLowerCase().includes(q));
  });

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

  const defaultAccessUrls = [
    {
      name: 'Public Cloudflare Tunnel',
      url: 'https://cctv.benzsiangco.site',
      ip: 'cctv.benzsiangco.site',
      type: 'public' as const,
      desc: 'HTTPS / SSL • Recommended for Mobile & 2-Way Audio'
    },
    {
      name: 'Local LAN Network',
      url: `http://${network?.primary_ip || '192.168.100.50'}:8000`,
      ip: `${network?.primary_ip || '192.168.100.50'}:8000`,
      type: 'lan' as const,
      desc: 'Direct Local Wi-Fi / Ethernet High-Speed Access'
    },
    {
      name: 'Tailscale VPN',
      url: `http://${network?.tailscale_ip || '100.104.29.49'}:8000`,
      ip: `${network?.tailscale_ip || '100.104.29.49'}:8000`,
      type: 'vpn' as const,
      desc: 'Encrypted Remote Access via Tailscale Mesh'
    }
  ];

  const accessList = network?.access_urls && network.access_urls.length > 0 ? network.access_urls : defaultAccessUrls;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 sm:space-y-4 select-none text-xs w-full pb-6">
      {/* Software & Git Updates Card */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] shrink-0">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-xs text-white flex items-center gap-2 flex-wrap">
                <span>Software & System Updates</span>
                {hasUpdate && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    UPDATE AVAILABLE
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono truncate">
                Continuous in-app delivery via GitHub repository
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 border border-[#2a2a2a] text-[10px] sm:text-[11px] font-mono flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
              title="Refresh telemetry and diagnostics"
            >
              <RefreshCw className="h-3 w-3 text-[#3B82F6] shrink-0" />
              <span>Refresh</span>
            </button>

            {onCheckUpdate && (
              <button
                type="button"
                onClick={onCheckUpdate}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 border border-[#2a2a2a] text-[10px] sm:text-[11px] font-mono flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
                title="Check GitHub repository for new commits"
              >
                <RefreshCw className="h-3 w-3 text-zinc-400 shrink-0" />
                <span className="truncate">Check</span>
              </button>
            )}

            {onOpenUpdateModal && (
              <button
                type="button"
                onClick={onOpenUpdateModal}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-white font-medium text-[10px] sm:text-[11px] flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-md cursor-pointer ${
                  hasUpdate
                    ? 'bg-[#3B82F6] hover:bg-blue-600 shadow-blue-500/20'
                    : 'bg-[#18181c] hover:bg-[#242428] text-zinc-200 border border-[#2e2e34]'
                }`}
              >
                {hasUpdate ? <Download className="h-3 w-3 shrink-0" /> : <ArrowUpRight className="h-3 w-3 shrink-0" />}
                <span className="truncate">{hasUpdate ? 'Update' : 'Manage'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Build & Version Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">Current Commit</span>
            <div className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
              <span className="truncate">{currentCommit}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#222222] text-zinc-400 font-normal shrink-0">v2.1.0</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">Git Branch</span>
            <div className="font-mono text-xs text-white font-bold flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-[#3B82F6] shrink-0" />
              <span className="truncate">{branch}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400">System Status</span>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {hasUpdate ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-amber-300 font-semibold truncate">{latestCommit} Ready</span>
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
        <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] flex items-center justify-between text-[11px] font-mono text-zinc-300 gap-2 min-w-0">
          <div className="min-w-0 truncate flex items-center">
            <span className="text-zinc-500 mr-1.5 shrink-0">Release:</span>
            <span className="truncate text-zinc-300">{commitMsg}</span>
          </div>
          <span className="text-[9px] text-zinc-500 shrink-0 hidden xs:inline">auto-checks 30m</span>
        </div>
      </div>

      {/* NEW: Network IP Addresses & Access URLs Section */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#3B82F6]" />
            <h4 className="font-semibold text-xs text-white">Network IP Addresses & Access Points</h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            Active Host: {network?.primary_ip || '192.168.100.50'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
          {accessList.map((item, idx) => {
            const isPublic = item.type === 'public';
            const isLan = item.type === 'lan';
            const urlKey = `url_${idx}`;

            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[#161616] border border-[#26262a] flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                      {isPublic ? <Globe className="h-3.5 w-3.5 text-blue-400" /> : isLan ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <Shield className="h-3.5 w-3.5 text-purple-400" />}
                      {item.name}
                    </span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      isPublic ? 'bg-blue-950/60 text-blue-300 border-blue-800' : isLan ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-purple-950/60 text-purple-300 border-purple-800'
                    }`}>
                      {isPublic ? 'HTTPS' : isLan ? 'LAN' : 'VPN'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    {item.desc}
                  </p>
                </div>

                {/* Unified Interactive Address Bar */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e0e11] border border-[#222226] hover:border-[#2e2e36] font-mono text-[11px] gap-2 transition-colors">
                  <span className="truncate font-semibold text-white select-all" title={item.url}>
                    {item.url}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.url, urlKey, item.name)}
                      className="px-2 py-1 rounded bg-[#1c1c22] hover:bg-[#282830] text-zinc-200 text-[10px] font-mono flex items-center gap-1 border border-[#303038] transition-colors cursor-pointer"
                      title="Copy address to clipboard"
                    >
                      {copiedKey === urlKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-[#3B82F6]" />}
                      <span>{copiedKey === urlKey ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded bg-[#1c1c22] hover:bg-[#282830] text-zinc-400 hover:text-white border border-[#303038] transition-colors cursor-pointer flex items-center justify-center"
                      title="Open in new browser tab"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Network Interfaces breakdown */}
        {network?.interfaces && network.interfaces.length > 0 && (
          <div className="pt-2 border-t border-[#1c1c1c] flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-400">
            <span className="text-zinc-500">Host Interfaces:</span>
            {network.interfaces.map((iface, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-[#18181c] border border-[#262628] text-zinc-300 flex items-center gap-1">
                <span className="text-[#3B82F6]">{iface.interface}:</span>
                <span className="text-white font-bold">{iface.ip}</span>
              </span>
            ))}
          </div>
        )}
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

      {/* NEW: Developer & System Diagnostics Logs Viewer (Terminal) */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Bug className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-xs text-white flex items-center gap-2">
                <span>System & Developer Debug Logs</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#1c1c20] text-zinc-400 border border-[#2c2c30]">
                  {filteredLogs.length} Entries
                </span>
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono truncate">
                Live terminal output for instant bug tracing, error inspection & AI reporting
              </p>
            </div>
          </div>

          {/* Dev Logs Top Action Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Copy All Logs Button */}
            <button
              type="button"
              onClick={handleCopyAllLogs}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                copiedLogs
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-[#3B82F6] hover:bg-blue-600 text-white shadow-blue-500/20'
              }`}
              title="Copy full logs text to clipboard for AI / Bug Reporting"
            >
              {copiedLogs ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLogs ? 'Copied Full Logs!' : 'Copy All Logs'}</span>
            </button>

            {/* Refresh Logs */}
            <button
              type="button"
              onClick={fetchDevLogs}
              disabled={isLoadingLogs}
              className="px-2.5 py-1.5 rounded-lg bg-[#18181c] hover:bg-[#222226] text-zinc-300 border border-[#2c2c30] text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh log output"
            >
              <RefreshCw className={`h-3 w-3 text-[#3B82F6] ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Refresh</span>
            </button>

            {/* Auto Refresh Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                autoRefreshLogs
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-[#18181c] text-zinc-400 border-[#2c2c30] hover:text-zinc-200'
              }`}
              title="Auto-refresh log stream every 4 seconds"
            >
              {autoRefreshLogs ? <Play className="h-3 w-3 fill-emerald-400 text-emerald-400" /> : <Pause className="h-3 w-3" />}
              <span className="hidden sm:inline">Auto</span>
            </button>

            {/* Clear Logs */}
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-2 py-1.5 rounded-lg bg-[#18181c] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-[#2c2c30] text-[11px] font-mono transition-colors cursor-pointer"
              title="Clear terminal view buffer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Filter Bar: Level Pills + Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Level Pills */}
          <div className="flex items-center gap-1 bg-[#161616] p-1 rounded-lg border border-[#222222]">
            {(['ALL', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLogFilter(lvl)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  logFilter === lvl
                    ? lvl === 'ERROR'
                      ? 'bg-rose-500 text-white'
                      : lvl === 'WARN'
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#3B82F6] text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-[#222226]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Logs Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search logs (e.g. error, camera, alsa)..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="w-full bg-[#161616] border border-[#222222] focus:border-[#3B82F6] rounded-lg pl-8 pr-3 py-1.5 text-[11px] font-mono text-zinc-200 placeholder-zinc-500 outline-none transition-colors"
            />
            {logSearch && (
              <button
                type="button"
                onClick={() => setLogSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-[10px] font-mono"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Terminal Window Box */}
        <div
          ref={logTerminalRef}
          className="rounded-xl border border-[#1e1e24] bg-[#09090b] p-3 sm:p-4 font-mono text-[11px] h-72 sm:h-96 overflow-y-auto space-y-1 leading-relaxed select-text shadow-inner no-scrollbar"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center space-y-2 py-8 select-none">
              <Terminal className="h-8 w-8 text-zinc-600" />
              <p>No log records matching current filter.</p>
              <button
                type="button"
                onClick={() => { setLogFilter('ALL'); setLogSearch(''); }}
                className="text-xs text-[#3B82F6] hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredLogs.map((l, idx) => {
              const rawLine = l.raw || l.message || '';
              const isErr = l.level === 'ERROR' || rawLine.toLowerCase().includes('error') || rawLine.toLowerCase().includes('exception') || rawLine.toLowerCase().includes('failed');
              const isWarn = l.level === 'WARN' || rawLine.toLowerCase().includes('warn');

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 py-0.5 px-1 rounded hover:bg-[#151518] transition-colors break-all ${
                    isErr ? 'text-rose-400 bg-rose-950/20' : isWarn ? 'text-amber-300' : 'text-zinc-300'
                  }`}
                >
                  <span className="text-zinc-600 select-none shrink-0 text-[10px]">
                    {String(idx + 1).padStart(3, '0')}
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-bold shrink-0 select-none ${
                    isErr ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : isWarn ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {l.level || (isErr ? 'ERROR' : isWarn ? 'WARN' : 'INFO')}
                  </span>
                  <span className="flex-1 font-mono text-zinc-200">
                    {rawLine}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Host Device, Power / Battery & Thermal Diagnostics Row */}
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
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#161616] border border-[#222222]">
              <div className="flex items-center gap-2">
                <Flame className={`h-4 w-4 ${getTempColor(primaryTemp)}`} />
                <span className="text-zinc-300 text-[11px] font-medium">CPU Core / Package</span>
              </div>
              <span className={`font-mono font-bold text-sm ${getTempColor(primaryTemp)}`}>
                {primaryTemp !== null && primaryTemp !== undefined ? `${primaryTemp}°C` : '42.0°C (Nominal)'}
              </span>
            </div>

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


