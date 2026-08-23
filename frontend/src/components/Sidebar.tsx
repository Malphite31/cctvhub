import React from 'react';
import {
  Video,
  Film,
  Bell,
  ScanFace,
  HardDrive,
  Cpu,
  Users,
  Activity
} from 'lucide-react';
import { SystemTelemetry, CameraDevice, StorageLocationInfo } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  telemetry: SystemTelemetry | null;
  devices: CameraDevice[];
  storageLocation: StorageLocationInfo | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  userRole?: string;
  isFaceRecognitionEnabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  telemetry,
  devices,
  storageLocation,
  isOpenMobile = false,
  onCloseMobile,
  userRole = 'admin',
  isFaceRecognitionEnabled = true,
}) => {
  const isViewer = userRole === 'viewer';

  const primaryNav = [
    { id: 'live', label: 'Live Surveillance', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Film },
    { id: 'events', label: 'Events', icon: Bell },
    ...(isFaceRecognitionEnabled ? [{ id: 'faces', label: 'Biometrics & Faces', icon: ScanFace }] : []),
  ];

  const adminNav = [
    { id: 'users', label: 'Users & Family', icon: Users },
    { id: 'sessions', label: 'Device & Session Logs', icon: Activity },
  ];

  const systemNav = [
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'system', label: 'System', icon: Cpu },
  ];

  const diskPercent = storageLocation ? storageLocation.disk_percent : (telemetry ? telemetry.disk_percent : 0);
  const onlineCameras = devices.length;
  const uptime = telemetry?.uptime_formatted || 'Online';

  const content = (
    <div className="flex flex-col justify-between h-full p-4 select-none text-xs bg-[#080808]">
      {/* Top Section: Brand Header & Navigation */}
      <div className="space-y-5 overflow-y-auto pr-0.5 no-scrollbar">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1 h-12">
          {/* Blue Hexagonal Camera Reticle Logo */}
          <div className="shrink-0 flex items-center justify-center">
            <svg className="h-9 w-9 shrink-0 drop-shadow-md" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 2L32 10.0829V25.9171L18 34L4 25.9171V10.0829L18 2Z"
                fill="#2563EB"
              />
              <circle cx="18" cy="18" r="6.5" stroke="white" strokeWidth="2.2" fill="none" />
              <circle cx="18" cy="18" r="2.8" fill="white" />
            </svg>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center text-base font-bold tracking-tight font-sans leading-none">
              <span className="text-white">CCTV</span>
              <span className="text-[#3B82F6] ml-1.5">HUB</span>
            </div>
            <p className="text-[9px] font-mono tracking-[0.18em] text-zinc-500 uppercase mt-1 leading-none font-medium">
              Surveillance System
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#161616] text-white font-semibold border-l-2 border-[#3B82F6] shadow-sm'
                    : 'text-zinc-400 hover:bg-[#121212] hover:text-zinc-200 border-l-2 border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#3B82F6]' : 'text-zinc-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Admin Navigation Section */}
        {!isViewer && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
              Management & Logs
            </div>
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#161616] text-white font-semibold border-l-2 border-[#3B82F6] shadow-sm'
                      : 'text-zinc-400 hover:bg-[#121212] hover:text-zinc-200 border-l-2 border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#3B82F6]' : 'text-zinc-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* System Navigation Section */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
            System
          </div>
          {systemNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#161616] text-white font-semibold border-l-2 border-[#3B82F6] shadow-sm'
                    : 'text-zinc-400 hover:bg-[#121212] hover:text-zinc-200 border-l-2 border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#3B82F6]' : 'text-zinc-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom System Status Card (Matching Reference Inspiration) */}
      <div className="rounded-2xl border border-[#222222] bg-[#121212] p-4 space-y-3.5 shadow-sm">
        {/* Status Heading */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium text-white">All Systems Operational</span>
        </div>

        {/* Connected Cameras Count */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Cameras</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-white font-semibold">{onlineCameras} / {onlineCameras}</span>
            <span className="text-[#3B82F6] text-[10px] font-medium">Online</span>
          </div>
        </div>

        {/* Real Storage Usage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Storage Usage</span>
            <span className="text-white font-mono font-semibold">{diskPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#222222] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3B82F6] transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(2, diskPercent))}%` }}
            />
          </div>
        </div>

        {/* Live System Uptime */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#222222]">
          <span className="text-zinc-400">Uptime</span>
          <span className="text-[#3B82F6] font-mono font-medium">{uptime}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-[#222222] bg-[#080808] shrink-0 h-full">
        {content}
      </aside>

      {/* Mobile Navigation Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-64 bg-[#080808] border-r border-[#222222] h-full z-10 animate-in slide-in-from-left duration-200 shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
