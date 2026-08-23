import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Bell,
  Menu,
  Settings,
  ChevronDown,
  LogOut,
  AlertTriangle,
  ScanFace,
  Activity,
  ArrowRight,
  CheckCheck,
  DownloadCloud
} from 'lucide-react';
import { SystemTelemetry, SurveillanceEvent, UpdateCheckInfo } from '../types';

interface NavbarProps {
  activeTab: string;
  telemetry: SystemTelemetry | null;
  unreadEventsCount: number;
  recentEvents?: SurveillanceEvent[];
  updateInfo?: UpdateCheckInfo | null;
  currentUser?: { username: string; display_name: string; role: string };
  onOpenUpdateModal?: () => void;
  onToggleMobileMenu: () => void;
  onOpenSettings: () => void;
  onSignOut?: () => void;
  onNavigateToEvents?: () => void;
  onOpenEventDetails?: (event: SurveillanceEvent) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  telemetry,
  unreadEventsCount,
  recentEvents = [],
  updateInfo,
  currentUser,
  onOpenUpdateModal,
  onToggleMobileMenu,
  onOpenSettings,
  onSignOut,
  onNavigateToEvents,
  onOpenEventDetails,
}) => {
  const [currentTime, setCurrentTime] = useState({
    time: '12:00:00',
    date: 'Aug 23, 2026'
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Dynamic telemetry rolling histories (8 samples)
  const [cpuHistory, setCpuHistory] = useState<number[]>([14, 20, 16, 26, 18, 22, 16, 21]);
  const [ramHistory, setRamHistory] = useState<number[]>([50, 52, 51, 53, 52, 54, 52, 53]);
  const [diskHistory, setDiskHistory] = useState<number[]>([91.1, 91.5, 91.2, 91.6, 91.3, 91.5, 91.2, 91.4]);

  const displayName = currentUser?.display_name || currentUser?.username || localStorage.getItem('cctv_display_name') || localStorage.getItem('cctv_username') || sessionStorage.getItem('cctv_username') || 'admin';
  const role = currentUser?.role || localStorage.getItem('cctv_role') || sessionStorage.getItem('cctv_role') || 'viewer';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime({
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (telemetry) {
      setCpuHistory((prev) => [...prev.slice(1), telemetry.cpu_percent]);
      setRamHistory((prev) => [...prev.slice(1), telemetry.ram_percent]);
      // Add subtle I/O telemetry wave variance so disk is visibly alive
      const diskJitter = Number((telemetry.disk_percent + Math.sin(Date.now() / 1500) * 0.4).toFixed(1));
      setDiskHistory((prev) => [...prev.slice(1), diskJitter]);
    }
  }, [telemetry]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'live': return 'Live Surveillance';
      case 'recordings': return 'Recordings Archive';
      case 'events': return 'Surveillance Events';
      case 'faces': return 'Biometrics & Faces';
      case 'storage': return 'Storage Infrastructure';
      case 'system': return 'System Telemetry';
      case 'users': return 'Users & Family Access';
      case 'sessions': return 'Device & Session Audit Logs';
      default: return 'Live Surveillance';
    }
  };

  const cpuVal = telemetry ? telemetry.cpu_percent : 0;
  const ramVal = telemetry ? telemetry.ram_percent : 0;
  const diskVal = telemetry ? telemetry.disk_percent : 0;

  // Fully Contained Auto-Scaled Sparkline Renderer (Never overlaps text)
  const renderSparkline = (
    history: number[],
    strokeColor: string,
    gradientId: string,
    minSpan: number = 6
  ) => {
    const width = 42;
    const height = 14;
    const pts = history.length >= 2 ? history : [history[0] || 0, history[0] || 0];

    const rawMin = Math.min(...pts);
    const rawMax = Math.max(...pts);
    const span = Math.max(minSpan, rawMax - rawMin);
    const mid = (rawMin + rawMax) / 2;
    const effectiveMin = mid - span * 0.55;
    const effectiveMax = mid + span * 0.55;

    const step = (width - 4) / (pts.length - 1);
    const mapped = pts.map((val, idx) => {
      const x = 2 + idx * step;
      const norm = (val - effectiveMin) / Math.max(0.001, effectiveMax - effectiveMin);
      const y = height - 2 - Math.max(0, Math.min(1, norm)) * (height - 4);
      return { x, y: Math.max(2, Math.min(height - 2, y)) };
    });

    let lineD = `M ${mapped[0].x.toFixed(1)},${mapped[0].y.toFixed(1)}`;
    for (let i = 0; i < mapped.length - 1; i++) {
      const p0 = mapped[i];
      const p1 = mapped[i + 1];
      const cx = (p0.x + p1.x) / 2;
      lineD += ` C ${cx.toFixed(1)},${p0.y.toFixed(1)} ${cx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    }

    const areaD = `${lineD} L ${width - 2},${height} L 2,${height} Z`;
    const lastPt = mapped[mapped.length - 1];

    return (
      <div className="w-11 h-3.5 shrink-0 flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full block" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path
            d={lineD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={lastPt.x} cy={lastPt.y} r="1.8" fill={strokeColor} />
        </svg>
      </div>
    );
  };

  const formatEventTime = (timestamp?: number, timeStr?: string) => {
    if (timeStr) return timeStr;
    if (!timestamp) return 'Recent';
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getEventIcon = (type?: string) => {
    switch (type) {
      case 'face':
      case 'face_match':
      case 'unrecognized_face':
        return <ScanFace className="h-3.5 w-3.5 text-[#3B82F6]" />;
      case 'door_open':
      case 'custom_tracker':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-emerald-400" />;
    }
  };

  return (
    <header className="relative h-14 sm:h-16 border-b border-[#222222] bg-[#080808] px-3 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-40 text-xs select-none">
      {/* Left: Page Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 z-10">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded-lg border border-[#222222] bg-[#121212] text-zinc-400 hover:text-white shrink-0"
          title="Toggle Navigation Menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight font-sans truncate">
          {getPageTitle(activeTab)}
        </h2>
      </div>

      {/* Center: FIXED POSITION TELEMETRY (Clean, Non-Overlapping & Dynamic Wave) */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-4 font-mono text-xs z-0 pointer-events-none">
        {/* CPU Telemetry */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">CPU</span>
          <span className="font-bold text-white tracking-tight text-xs min-w-[36px]">{cpuVal}%</span>
          {renderSparkline(cpuHistory, '#3B82F6', 'cpuWaveGrad', 8)}
        </div>

        <div className="h-3 w-[1px] bg-zinc-800 shrink-0" />

        {/* RAM Telemetry */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">RAM</span>
          <span className="font-bold text-white tracking-tight text-xs min-w-[36px]">{ramVal}%</span>
          {renderSparkline(ramHistory, '#3B82F6', 'ramWaveGrad', 4)}
        </div>

        <div className="h-3 w-[1px] bg-zinc-800 shrink-0" />

        {/* DISK Telemetry */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">DISK</span>
          <span className="font-bold text-white tracking-tight text-xs min-w-[36px]">{diskVal}%</span>
          {renderSparkline(diskHistory, '#3B82F6', 'diskWaveGrad', 0.8)}
        </div>
      </div>

      {/* Right: Date/Time + Notifications Dropdown + User Avatar Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 z-10">
        {/* Update Available Badge */}
        {updateInfo?.update_available && onOpenUpdateModal && (
          <button
            onClick={onOpenUpdateModal}
            className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-semibold transition-all animate-pulse shrink-0"
            title={`Software Update Available (${updateInfo.latest_commit}): ${updateInfo.latest_commit_message}`}
          >
            <DownloadCloud className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">UPDATE AVAILABLE</span>
            <span className="sm:hidden">UPDATE</span>
          </button>
        )}

        {/* Real Clock & Date */}
        <div className="hidden sm:flex flex-col text-right font-mono">
          <span className="text-xs font-bold text-white leading-tight">{currentTime.time}</span>
          <span className="text-[10px] text-zinc-500 leading-tight">{currentTime.date}</span>
        </div>

        {/* Notification Bell with Real Alerts Popover */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
            className={`p-2 rounded-xl border transition-colors relative ${
              showNotificationsMenu
                ? 'border-[#3B82F6] bg-[#1a1a1a] text-white'
                : 'border-[#222222] bg-[#121212] hover:bg-[#161616] text-zinc-400 hover:text-white'
            }`}
            title="Surveillance Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadEventsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {showNotificationsMenu && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-36px)] rounded-xl border border-[#222222] bg-[#121212] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans">
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222222] bg-[#161616]">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <span className="font-semibold text-white text-xs">Surveillance Alerts</span>
                  {unreadEventsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-mono font-semibold">
                      {unreadEventsCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Event Alert List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-[#1e1e1e]">
                {recentEvents.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 space-y-1">
                    <CheckCheck className="h-6 w-6 mx-auto text-zinc-600 mb-1" />
                    <p className="text-xs text-zinc-300 font-medium">All Clear</p>
                    <p className="text-[10px] text-zinc-500">No active security alerts recorded.</p>
                  </div>
                ) : (
                  recentEvents.slice(0, 6).map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => {
                        setShowNotificationsMenu(false);
                        if (onOpenEventDetails) {
                          onOpenEventDetails(evt);
                        } else if (onNavigateToEvents) {
                          onNavigateToEvents();
                        }
                      }}
                      className="p-3 hover:bg-[#18181a] cursor-pointer transition-colors flex items-start gap-2.5 group"
                    >
                      <div className="p-1.5 rounded-lg bg-[#1a1a1e] border border-[#26262a] shrink-0 mt-0.5 group-hover:border-[#3B82F6]/40 transition-colors">
                        {getEventIcon(evt.event_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-white text-xs truncate group-hover:text-[#3B82F6] transition-colors">
                            {evt.title || evt.details || 'Surveillance Alert'}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {formatEventTime(evt.timestamp, evt.time)}
                          </span>
                        </div>

                        {evt.details && (
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {evt.details}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 font-mono text-[9px] text-zinc-500">
                          <span>CAM {evt.camera || evt.camera_id || '1'}</span>
                          <span>•</span>
                          <span className="capitalize">{(evt.event_type || evt.type || 'motion').replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer View All */}
              <div className="p-2 border-t border-[#222222] bg-[#161616]">
                <button
                  onClick={() => {
                    setShowNotificationsMenu(false);
                    if (onNavigateToEvents) onNavigateToEvents();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#1f1f23] hover:bg-[#25252b] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View All Events Log</span>
                  <ArrowRight className="h-3 w-3 text-[#3B82F6]" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#222222] bg-[#121212] hover:bg-[#161616] transition-colors"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[#3B82F6]">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-white font-sans hidden sm:inline">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#222222] bg-[#121212] p-1.5 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-2 border-b border-[#222222]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white text-xs truncate">{displayName}</p>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 uppercase ${
                    role === 'admin'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  }`}>
                    {role === 'admin' ? 'Admin' : 'Viewer'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  {role === 'admin' ? 'System Administrator' : 'Family Member (Read-Only)'}
                </p>
              </div>

              {role === 'admin' && (
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-[#1a1a1a] transition-colors text-left text-xs"
                >
                  <Settings className="h-3.5 w-3.5 text-zinc-400" />
                  <span>NVR Settings</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  if (onSignOut) {
                    onSignOut();
                  } else {
                    localStorage.removeItem('cctv_auth_token');
                    window.location.reload();
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-950/30 transition-colors text-left text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
