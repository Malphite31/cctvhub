import React, { useState, useEffect } from 'react';
import { CameraDevice } from '../types';
import {
  X,
  Camera,
  Save,
  RefreshCw,
  Video,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CameraEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera?: CameraDevice | null;
  onSaved: () => void;
}

interface HardwareDevice {
  device: string;
  name: string;
  type: string;
  resolution?: string;
  fps?: number;
  is_available?: boolean;
}

const RESOLUTION_PRESETS = [
  { label: '1080p FHD (1920x1080)', value: '1920x1080', fps: 60 },
  { label: '4K UHD (3840x2160)', value: '3840x2160', fps: 30 },
  { label: '720p HD (1280x720)', value: '1280x720', fps: 60 },
  { label: 'VGA (640x480)', value: '640x480', fps: 60 },
];

const ZONE_PRESETS = [
  'Front Entrance',
  'Backyard Gate',
  'Driveway / Garage',
  'Perimeter Fence',
  'Living Room / Hall',
  'Server Room',
  'Warehouse Floor',
  'Cashier / Office'
];

export const CameraEditModal: React.FC<CameraEditModalProps> = ({
  isOpen,
  onClose,
  camera = null,
  onSaved,
}) => {
  const isEditing = !!camera;
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [resolution, setResolution] = useState('1920x1080');
  const [fps, setFps] = useState(60);
  const [zone, setZone] = useState('Front Entrance');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Hardware Scan State
  const [hardwareDevices, setHardwareDevices] = useState<HardwareDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedHardware, setSelectedHardware] = useState<string | null>(null);

  const fetchHardwareDevices = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/cameras/hardware');
      if (res.ok) {
        const data = await res.json();
        const devs: HardwareDevice[] = data.devices || [];
        setHardwareDevices(devs);

        // If not editing and no source selected yet, auto-select first available camera
        if (!camera && devs.length > 0) {
          const firstAvail = devs.find(d => d.is_available) || devs[0];
          setSelectedHardware(firstAvail.device);
          setName(firstAvail.name);
          setSource(firstAvail.device);
          if (firstAvail.name.toLowerCase().includes('4k')) {
            setResolution('3840x2160');
            setFps(30);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching hardware devices:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHardwareDevices();
      if (camera) {
        setName(camera.name || '');
        setSource(camera.device || '0');
        setResolution(camera.resolution?.split(' ')[0] || '1920x1080');
        setFps(camera.fps || 60);
        setZone((camera as any).zone || 'Front Entrance');
        setSelectedHardware(camera.device);
      } else {
        setName('New Surveillance Camera');
        setSource('0');
        setResolution('1920x1080');
        setFps(60);
        setZone('Front Entrance');
        setSelectedHardware(null);
      }
    }
  }, [camera, isOpen]);

  if (!isOpen) return null;

  const handleSelectHardware = (dev: HardwareDevice) => {
    setSelectedHardware(dev.device);
    setSource(dev.device);
    if (!isEditing || name === 'New Surveillance Camera') {
      setName(dev.name);
    }
    if (dev.name.toLowerCase().includes('4k')) {
      setResolution('3840x2160');
      setFps(30);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a camera name');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      if (isEditing && camera) {
        // Update existing camera
        const res = await fetch(`/api/cameras/${camera.device}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            source: source || camera.device,
            resolution,
            fps: Number(fps),
            zone,
          }),
        });
        if (!res.ok) throw new Error('Failed to update camera');
      } else {
        // Add new camera
        const res = await fetch('/api/cameras/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            source: source || '0',
            resolution,
            fps: Number(fps),
            zone,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'Failed to add camera');
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving camera source');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222] bg-[#141414]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#3B82F6]">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-white font-sans tracking-tight">
                {isEditing ? 'Configure Camera Source' : 'Add New Camera Source'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                Connect USB webcam, DirectShow device or IP RTSP stream
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#202020] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. DETECTED HARDWARE CAMERAS QUICK SELECTOR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Detected Hardware Cameras ({hardwareDevices.length})
              </label>
              <button
                type="button"
                onClick={fetchHardwareDevices}
                disabled={isScanning}
                className="text-[10px] font-mono text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Rescan Devices'}</span>
              </button>
            </div>

            {hardwareDevices.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-[#2a2a2a] bg-[#161616] text-center text-zinc-500 font-mono text-[11px]">
                No USB cameras auto-detected. You can specify a manual index or RTSP URL below.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {hardwareDevices.map((dev) => {
                  const isSelected = selectedHardware === dev.device || source === dev.device;
                  return (
                    <button
                      key={dev.device}
                      type="button"
                      onClick={() => handleSelectHardware(dev)}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-all ${
                        isSelected
                          ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-white shadow-sm'
                          : 'border-[#262626] bg-[#161616] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className={`p-1 rounded ${isSelected ? 'bg-[#3B82F6] text-white' : 'bg-[#222] text-zinc-400'}`}>
                          <Video className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-white truncate block">
                            {dev.name}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400 block">
                            Device Index {dev.device} • {dev.type.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-[#3B82F6] shrink-0" />
                      ) : dev.is_available ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" title="Online" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. CAMERA DISPLAY NAME */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              Camera Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EMEET SmartCam 4K, Front Door, Lobby Cam"
              className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors font-sans"
              required
            />
          </div>

          {/* 3. STREAM SOURCE / DEVICE INDEX / RTSP URL */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Stream Source (Device Index or Network RTSP URL)
              </label>
              <span className="text-[9px] text-zinc-500 font-mono">
                Index 0, 1, 2 or rtsp://
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setSelectedHardware(e.target.value);
                }}
                placeholder="0, 1, 2 or rtsp://admin:pass@192.168.1.100:554/stream"
                className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-[#3B82F6] focus:outline-none transition-colors"
                required
              />
            </div>
            {/* Quick Source Type Shortcuts */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              <span className="text-[9px] font-mono text-zinc-500 shrink-0">Presets:</span>
              <button
                type="button"
                onClick={() => { setSource('rtsp://admin:admin@192.168.1.100:554/live'); setSelectedHardware(null); }}
                className="px-1.5 py-0.5 rounded bg-[#1c1c20] hover:bg-[#26262b] border border-[#2a2a30] text-[9px] font-mono text-zinc-300 transition-colors shrink-0"
              >
                + RTSP Stream
              </button>
              <button
                type="button"
                onClick={() => { setSource('http://192.168.1.100:8080/video'); setSelectedHardware(null); }}
                className="px-1.5 py-0.5 rounded bg-[#1c1c20] hover:bg-[#26262b] border border-[#2a2a30] text-[9px] font-mono text-zinc-300 transition-colors shrink-0"
              >
                + HTTP MJPEG
              </button>
              <button
                type="button"
                onClick={() => { setSource('0'); setSelectedHardware('0'); }}
                className="px-1.5 py-0.5 rounded bg-[#1c1c20] hover:bg-[#26262b] border border-[#2a2a30] text-[9px] font-mono text-zinc-300 transition-colors shrink-0"
              >
                Index 0
              </button>
              <button
                type="button"
                onClick={() => { setSource('1'); setSelectedHardware('1'); }}
                className="px-1.5 py-0.5 rounded bg-[#1c1c20] hover:bg-[#26262b] border border-[#2a2a30] text-[9px] font-mono text-zinc-300 transition-colors shrink-0"
              >
                Index 1
              </button>
            </div>
          </div>

          {/* 4. TARGET RESOLUTION & FPS */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Target Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
              >
                {RESOLUTION_PRESETS.map((res) => (
                  <option key={res.value} value={res.value}>
                    {res.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Frame Rate (FPS)
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
              >
                <option value={60}>60 FPS (Ultra Smooth)</option>
                <option value={30}>30 FPS (Standard NVR)</option>
                <option value={24}>24 FPS (Cinematic)</option>
                <option value={15}>15 FPS (Bandwidth Saver)</option>
              </select>
            </div>
          </div>

          {/* 5. ASSIGNED SECURITY ZONE */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              Assigned Security Zone / Location
            </label>
            <input
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="e.g. Front Entrance, Living Room"
              className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors font-sans mb-1.5"
            />
            <div className="flex flex-wrap gap-1">
              {ZONE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setZone(preset)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                    zone === preset
                      ? 'bg-white/10 text-white border-white'
                      : 'bg-[#161616] text-zinc-400 border-[#262626] hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-zinc-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : isEditing ? 'Update Camera' : 'Add Camera'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
