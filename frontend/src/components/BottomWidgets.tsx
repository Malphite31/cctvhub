import React, { useState } from 'react';
import { Video, Bell, Users } from 'lucide-react';
import { StorageLocationInfo, CameraDevice } from '../types';

interface BottomWidgetsProps {
  devices: CameraDevice[];
  eventsCount: number;
  facesCount: number;
  storageLocation: StorageLocationInfo | null;
  onOpenStorageSettings: () => void;
}

export const BottomWidgets: React.FC<BottomWidgetsProps> = ({
  devices,
  eventsCount,
  facesCount,
  storageLocation,
  onOpenStorageSettings,
}) => {
  const [motionDetection, setMotionDetection] = useState(true);
  const [faceDetection, setFaceDetection] = useState(true);
  const [perfMode, setPerfMode] = useState('60 FPS Ultra-Low Latency');

  const diskUsed = storageLocation ? storageLocation.used_gb : 0;
  const diskTotal = storageLocation ? storageLocation.total_gb : 0;
  const diskPercent = storageLocation ? storageLocation.disk_percent : 0;
  const diskFree = storageLocation ? storageLocation.free_gb : 0;
  const recSizeMb = storageLocation ? storageLocation.recordings_mb : 0;
  const snapSizeMb = storageLocation ? storageLocation.snapshots_mb : 0;
  const camerasCount = Math.max(1, devices.length);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 select-none text-xs shrink-0">
      {/* 1. Surveillance Pipeline Card */}
      <div className="rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Pipeline Matrix
          </span>
          <span className="text-[9px] text-emerald-400 font-mono font-bold">● ACTIVE</span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center py-1">
          <div className="p-1 rounded bg-zinc-900/60 border border-zinc-800/60">
            <Video className="h-3 w-3 mx-auto text-blue-400 mb-0.5" />
            <span className="text-xs font-bold text-white block font-mono leading-none">{camerasCount}</span>
            <span className="text-[8px] text-zinc-500 font-mono uppercase">Cams</span>
          </div>

          <div className="p-1 rounded bg-zinc-900/60 border border-zinc-800/60">
            <Bell className="h-3 w-3 mx-auto text-purple-400 mb-0.5" />
            <span className="text-xs font-bold text-white block font-mono leading-none">{eventsCount}</span>
            <span className="text-[8px] text-zinc-500 font-mono uppercase">Events</span>
          </div>

          <div className="p-1 rounded bg-zinc-900/60 border border-zinc-800/60">
            <Users className="h-3 w-3 mx-auto text-emerald-400 mb-0.5" />
            <span className="text-xs font-bold text-white block font-mono leading-none">{facesCount}</span>
            <span className="text-[8px] text-zinc-500 font-mono uppercase">Faces</span>
          </div>
        </div>
      </div>

      {/* 2. Storage Breakdown Donut Card */}
      <div
        onClick={onOpenStorageSettings}
        className="rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col justify-between cursor-pointer hover:border-zinc-700 transition-colors"
      >
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Storage Archive
          </span>
          <span className="text-[10px] text-blue-400 font-bold font-mono">{diskPercent}%</span>
        </div>

        <div className="flex items-center justify-between gap-2 py-1">
          {/* Donut Progress Circle */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-10 h-10 -rotate-90">
              <circle cx="20" cy="20" r="15" stroke="#27272a" strokeWidth="4" fill="none" />
              <circle
                cx="20"
                cy="20"
                r="15"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeDasharray="94"
                strokeDashoffset={94 - (94 * (diskPercent || 5)) / 100}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[9px] font-bold text-white font-mono leading-none">{diskUsed}G</span>
            </div>
          </div>

          <div className="space-y-0.5 text-[9px] flex-1 truncate font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>Clips:</span>
              <span className="text-zinc-200">{recSizeMb} MB</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Snaps:</span>
              <span className="text-zinc-200">{snapSizeMb} MB</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Free:</span>
              <span className="text-emerald-400">{diskFree} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tactical Vision Triggers Card */}
      <div className="rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Vision Triggers
          </span>
          <span className="text-[9px] text-emerald-400 font-mono font-bold">ONLINE</span>
        </div>

        <div className="space-y-1.5 py-1">
          <label className="flex items-center justify-between text-[10px] font-mono text-zinc-300 cursor-pointer">
            <span>Motion Detection</span>
            <input
              type="checkbox"
              checked={motionDetection}
              onChange={(e) => setMotionDetection(e.target.checked)}
              className="h-3 w-3 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-[10px] font-mono text-zinc-300 cursor-pointer">
            <span>Face Identification</span>
            <input
              type="checkbox"
              checked={faceDetection}
              onChange={(e) => setFaceDetection(e.target.checked)}
              className="h-3 w-3 accent-blue-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 4. Stream Throughput Card */}
      <div className="rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Throughput
          </span>
          <span className="text-[10px] text-blue-400 font-bold font-mono">60.0 FPS</span>
        </div>

        <div className="py-1 space-y-1">
          <select
            value={perfMode}
            onChange={(e) => setPerfMode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-zinc-200 text-[10px] outline-none font-mono"
          >
            <option>60 FPS Ultra-Low Latency</option>
            <option>High Definition (1080p60)</option>
            <option>Low Bandwidth Mode</option>
          </select>
          <span className="text-[8px] text-zinc-500 font-mono block truncate">
            0 dropped frames • {diskTotal} GB host
          </span>
        </div>
      </div>
    </div>
  );
};
