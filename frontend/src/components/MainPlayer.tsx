import React, { useState, useEffect, useRef } from 'react';
import { StreamStats, CameraDevice, TrackerSettings, CustomTracker } from '../types';
import { TrackerHUDOverlay } from './TrackerHUDOverlay';
import { CustomObjectTrackerModal } from './CustomObjectTrackerModal';
import { CameraEditModal } from './CameraEditModal';
import {
  Play,
  Pause,
  Camera,
  Disc,
  Mic,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronDown,
  LayoutGrid,
  Sun,
  Contrast,
  MoreHorizontal,
  Monitor,
  Crosshair,
  Plus,
  Trash2,
  Edit3,
  CameraOff,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  ZoomIn,
  Move
} from 'lucide-react';

interface MainPlayerProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  stats?: StreamStats;
  devices: CameraDevice[];
  activeDevice: string;
  onSelectDevice: (dev: string) => void;
  isRecording: boolean;
  recordingElapsed: number;
  onSnapshot: () => void;
  onToggleRecording: () => void;
  onToggleFullscreen?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  audioLevel: number;
  volume: number;
  onChangeVolume: (vol: number) => void;
  audioDevices: any[];
  activeAudioDevice: number | null;
  onSelectAudioDevice: (index: number) => void;
  gridMode: '1x1' | '2x2' | '1+3';
  onChangeGridMode: (mode: '1x1' | '2x2' | '1+3') => void;
  onReconnect: () => void;
  onRefreshDevices?: () => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const MainPlayer: React.FC<MainPlayerProps> = ({
  devices,
  activeDevice,
  onSelectDevice,
  isRecording,
  recordingElapsed,
  onSnapshot,
  onToggleRecording,
  isMuted,
  onToggleMute,
  audioLevel,
  volume,
  onChangeVolume,
  audioDevices,
  activeAudioDevice,
  onSelectAudioDevice,
  gridMode,
  onChangeGridMode,
  onReconnect,
  onRefreshDevices,
  onShowToast,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showResMenu, setShowResMenu] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState('1920x1080');
  const [streamError, setStreamError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Camera Adjustments (Flip, Crop, Zoom, Color) State
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [saturation, setSaturation] = useState(50);
  const [showAdjustmentsModal, setShowAdjustmentsModal] = useState(false);

  // Camera Edit & Add Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Custom Object & Zone Trackers State
  const [customTrackers, setCustomTrackers] = useState<CustomTracker[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState<CustomTracker | null>(null);
  const [drawnBounds, setDrawnBounds] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 25,
    y: 25,
    width: 35,
    height: 45,
  });

  // Vision Tracker Global Settings
  const [trackerSettings, setTrackerSettings] = useState<TrackerSettings>({
    enabled: true,
    show_bounding_boxes: true,
    show_corner_markers: true,
    show_center_reticles: true,
    show_metadata_tags: true,
    show_motion_vectors: false,
    detect_faces: false,
    detect_motion: false,
    hud_theme: 'cyber_blue',
  });

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const resMenuRef = useRef<HTMLDivElement>(null);
  const adjustmentsRef = useRef<HTMLDivElement>(null);

  const hasCameras = devices && devices.length > 0;

  // Fetch camera adjustments (flip, rotation, zoom, color)
  const fetchAdjustments = async (dev: string) => {
    if (!dev) return;
    try {
      const res = await fetch(`/api/stream/adjustments?dev=${dev}`);
      if (res.ok) {
        const data = await res.json();
        setFlipH(Boolean(data.flip_h));
        setFlipV(Boolean(data.flip_v));
        setRotation(Number(data.rotation) || 0);
        setZoom(Number(data.zoom) || 1.0);
        setPanX(Number(data.pan_x) || 0);
        setPanY(Number(data.pan_y) || 0);
        setBrightness(Number(data.brightness) ?? 50);
        setContrast(Number(data.contrast) ?? 50);
        setSaturation(Number(data.saturation) ?? 50);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAdjustments(activeDevice);
  }, [activeDevice]);

  const updateAdjustments = async (updates: Partial<{
    flip_h: boolean;
    flip_v: boolean;
    rotation: number;
    zoom: number;
    pan_x: number;
    pan_y: number;
    brightness: number;
    contrast: number;
    saturation: number;
  }>) => {
    const payload = {
      dev: activeDevice,
      flip_h: updates.flip_h !== undefined ? updates.flip_h : flipH,
      flip_v: updates.flip_v !== undefined ? updates.flip_v : flipV,
      rotation: updates.rotation !== undefined ? updates.rotation : rotation,
      zoom: updates.zoom !== undefined ? updates.zoom : zoom,
      pan_x: updates.pan_x !== undefined ? updates.pan_x : panX,
      pan_y: updates.pan_y !== undefined ? updates.pan_y : panY,
      brightness: updates.brightness !== undefined ? updates.brightness : brightness,
      contrast: updates.contrast !== undefined ? updates.contrast : contrast,
      saturation: updates.saturation !== undefined ? updates.saturation : saturation,
    };

    if (updates.flip_h !== undefined) setFlipH(updates.flip_h);
    if (updates.flip_v !== undefined) setFlipV(updates.flip_v);
    if (updates.rotation !== undefined) setRotation(updates.rotation);
    if (updates.zoom !== undefined) setZoom(updates.zoom);
    if (updates.pan_x !== undefined) setPanX(updates.pan_x);
    if (updates.pan_y !== undefined) setPanY(updates.pan_y);
    if (updates.brightness !== undefined) setBrightness(updates.brightness);
    if (updates.contrast !== undefined) setContrast(updates.contrast);
    if (updates.saturation !== undefined) setSaturation(updates.saturation);

    try {
      await fetch('/api/stream/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {}
  };

  const handleResetAdjustments = () => {
    updateAdjustments({
      flip_h: false,
      flip_v: false,
      rotation: 0,
      zoom: 1.0,
      pan_x: 0,
      pan_y: 0,
      brightness: 50,
      contrast: 50,
      saturation: 50,
    });
    if (onShowToast) onShowToast('Camera adjustments reset to defaults');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      setCurrentTime(`${yr}-${mo}-${da} ${timeStr}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch custom trackers for active camera
  const fetchCustomTrackers = async () => {
    if (!activeDevice) return;
    try {
      const res = await fetch(`/api/trackers/list?camera_id=${activeDevice}`);
      if (res.ok) {
        const data = await res.json();
        setCustomTrackers(data.trackers || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchCustomTrackers();
    const interval = setInterval(fetchCustomTrackers, 1000);
    return () => clearInterval(interval);
  }, [activeDevice]);

  // Fetch initial tracker settings
  useEffect(() => {
    const fetchTrackerSettings = async () => {
      try {
        const res = await fetch('/api/stream/tracker-settings');
        if (res.ok) {
          const data = await res.json();
          setTrackerSettings((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Fallback
      }
    };
    fetchTrackerSettings();
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
        setShowMicMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (resMenuRef.current && !resMenuRef.current.contains(e.target as Node)) {
        setShowResMenu(false);
      }
      if (adjustmentsRef.current && !adjustmentsRef.current.contains(e.target as Node)) {
        setShowAdjustmentsModal(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleToggleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleResolutionChange = async (resStr: string) => {
    setSelectedResolution(resStr);
    setShowResMenu(false);
    let w = 1920, h = 1080, fps = 60;
    if (resStr.includes('3840x2160') || resStr.includes('4K')) {
      w = 3840; h = 2160; fps = 30;
    } else if (resStr.includes('1920x1080') || resStr.includes('1080p')) {
      w = 1920; h = 1080; fps = 60;
    } else if (resStr.includes('1280x720') || resStr.includes('720p')) {
      w = 1280; h = 720; fps = 60;
    } else if (resStr.includes('640x480') || resStr.includes('VGA')) {
      w = 640; h = 480; fps = 60;
    }

    try {
      await fetch(`/api/stream/resolution?dev=${activeDevice}&width=${w}&height=${h}&fps=${fps}`, {
        method: 'POST',
      });
      if (onShowToast) {
        onShowToast(`Stream resolution updated: ${resStr.replace(' (4K)', '')}`);
      }
    } catch {
      // Ignore
    }
  };

  const handleUpdateTrackerSettings = async (newSettings: Partial<TrackerSettings>) => {
    const updated = { ...trackerSettings, ...newSettings };
    setTrackerSettings(updated);
    try {
      await fetch('/api/stream/tracker-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch {
      // Ignore
    }
  };

  // When user finishes drawing a box on the video feed
  const handleBoxDrawn = (bounds: { x: number; y: number; width: number; height: number }) => {
    setIsDrawingMode(false);
    setDrawnBounds(bounds);
    setEditingTracker(null);
    setIsCustomModalOpen(true);
  };

  // Camera Management Handlers
  const handleOpenEditCamera = () => {
    setShowMoreMenu(false);
    setEditingCamera(currentCam as CameraDevice);
    setIsCameraModalOpen(true);
  };

  const handleOpenAddCamera = () => {
    setShowMoreMenu(false);
    setEditingCamera(null);
    setIsCameraModalOpen(true);
  };

  const handleDeleteCamera = async (camId: string) => {
    setShowMoreMenu(false);
    try {
      const res = await fetch(`/api/cameras/${camId}`, { method: 'DELETE' });
      if (res.ok) {
        onReconnect();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanHardware = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/cameras/scan', { method: 'POST' });
      const data = await res.json();
      if (onRefreshDevices) onRefreshDevices();
      if (onShowToast) {
        const addedCount = data.added ? data.added.length : (data.cameras ? data.cameras.length : 0);
        onShowToast(`Hardware scan complete • ${addedCount} camera(s) detected`);
      }
      onReconnect();
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('Hardware camera scan failed', true);
    } finally {
      setIsScanning(false);
    }
  };

  const currentCam = devices.find((d) => d.device === activeDevice) || (hasCameras ? devices[0] : {
    device: activeDevice || '0',
    name: 'No Camera Selected'
  });

  return (
    <div className="rounded-xl border border-[#222222] bg-[#121212] p-2.5 sm:p-4 flex flex-col justify-between gap-2.5 sm:gap-3 select-none overflow-hidden text-xs h-full">
      {/* 1. Player Top Header */}
      <div className="flex items-center justify-between pb-1 shrink-0 gap-2">
        {/* Left: Camera Status & Name + Interactive Resolution Dropdown */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${hasCameras ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <h3 className="font-semibold text-xs sm:text-sm text-white tracking-tight font-sans truncate">
            {hasCameras ? currentCam.name : 'No Cameras Configured'}
          </h3>

          {/* Interactive Resolution Dropdown Badge */}
          {hasCameras && (
            <div className="relative shrink-0" ref={resMenuRef}>
              <button
                onClick={() => setShowResMenu(!showResMenu)}
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a1a1a] hover:bg-[#242424] text-zinc-300 hover:text-white border border-[#262626] transition-colors"
                title="Change Camera Stream Resolution"
              >
                <Monitor className="h-3 w-3 text-[#3B82F6] shrink-0" />
                <span className="truncate max-w-[80px] sm:max-w-none">{selectedResolution.replace(' (4K)', '')} • 60 FPS</span>
                <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
              </button>

              {showResMenu && (
                <div className="absolute left-0 mt-1.5 w-48 sm:w-52 max-w-[calc(100vw-36px)] rounded-lg border border-[#222222] bg-[#161616]/95 backdrop-blur-md p-1.5 shadow-2xl z-50 space-y-0.5 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[9px] text-zinc-500 uppercase border-b border-[#222222]">
                    Stream Resolution
                  </div>
                  {[
                    { label: '4K UHD (3840x2160)', value: '3840x2160', fps: '30 FPS' },
                    { label: '1080p FHD (1920x1080)', value: '1920x1080', fps: '60 FPS' },
                    { label: '720p HD (1280x720)', value: '1280x720', fps: '60 FPS' },
                    { label: 'VGA (640x480)', value: '640x480', fps: '60 FPS' },
                  ].map((res) => {
                    const isSelected = selectedResolution.includes(res.value);
                    return (
                      <button
                        key={res.value}
                        onClick={() => handleResolutionChange(res.label)}
                        className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#3B82F6] text-white font-medium'
                            : 'text-zinc-300 hover:bg-[#222222]'
                        }`}
                      >
                        <span className="truncate">{res.label}</span>
                        <span className={`text-[9px] shrink-0 ml-1 ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{res.fps}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {hasCameras && (
            <span className="hidden md:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-zinc-400 border border-[#262626]">
              MJPEG
            </span>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Snapshot */}
          {hasCameras && (
            <button
              onClick={onSnapshot}
              className="p-1.5 rounded-lg border border-[#222222] bg-[#161616] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white transition-colors"
              title="Snapshot Image"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Grid Layout Toggle */}
          {hasCameras && (
            <button
              onClick={() => onChangeGridMode(gridMode === '1x1' ? '2x2' : '1x1')}
              className={`p-1.5 rounded-lg border border-[#222222] transition-colors ${
                gridMode !== '1x1' ? 'bg-[#3B82F6] text-white' : 'bg-[#161616] text-zinc-300 hover:text-white hover:bg-[#1f1f1f]'
              }`}
              title="Toggle Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Fullscreen */}
          {hasCameras && (
            <button
              onClick={handleToggleFullscreen}
              className={`p-1.5 rounded-lg border border-[#222222] transition-colors ${
                isFullscreen ? 'bg-[#3B82F6] text-white' : 'bg-[#161616] text-zinc-300 hover:text-white hover:bg-[#1f1f1f]'
              }`}
              title="Toggle Video Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Camera Adjustments (Flip, Crop, Zoom, Rotate, Color Tuning) */}
          {hasCameras && (
            <div className="relative" ref={adjustmentsRef}>
              <button
                onClick={() => setShowAdjustmentsModal(!showAdjustmentsModal)}
                className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                  showAdjustmentsModal || flipH || flipV || rotation !== 0 || zoom > 1.01 || brightness !== 50 || contrast !== 50 || saturation !== 50
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'border-[#222222] bg-[#161616] text-zinc-300 hover:text-white hover:bg-[#1f1f1f]'
                }`}
                title="Camera Adjustments (Flip, Crop, Zoom, Rotate, Color)"
              >
                <Sliders className="h-3.5 w-3.5" />
                {(flipH || flipV || rotation !== 0 || zoom > 1.01) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              {showAdjustmentsModal && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-36px)] rounded-xl border border-[#262626] bg-[#141417]/95 backdrop-blur-md p-3.5 shadow-2xl z-50 space-y-3 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-[#262626] pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-[#3B82F6]" />
                      <span className="font-semibold text-white">Camera Adjustments</span>
                    </div>
                    <button
                      onClick={handleResetAdjustments}
                      className="text-[10px] font-mono text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                      title="Reset all adjustments to normal defaults"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* 1. Orientation & Flip */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Orientation & Flip
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Flip H */}
                      <button
                        type="button"
                        onClick={() => updateAdjustments({ flip_h: !flipH })}
                        className={`p-1.5 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                          flipH ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <FlipHorizontal className="h-3.5 w-3.5 text-[#3B82F6]" />
                        <span className="text-[9px] font-mono">Flip H</span>
                      </button>

                      {/* Flip V */}
                      <button
                        type="button"
                        onClick={() => updateAdjustments({ flip_v: !flipV })}
                        className={`p-1.5 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                          flipV ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <FlipVertical className="h-3.5 w-3.5 text-[#3B82F6]" />
                        <span className="text-[9px] font-mono">Flip V</span>
                      </button>

                      {/* Rotate 90 */}
                      <button
                        type="button"
                        onClick={() => updateAdjustments({ rotation: (rotation + 90) % 360 })}
                        className={`p-1.5 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                          rotation !== 0 ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <RotateCw className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[9px] font-mono">{rotation}°</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Digital Zoom & Crop */}
                  <div className="space-y-1.5 pt-1 border-t border-[#262626]">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <ZoomIn className="h-3 w-3 text-[#3B82F6]" /> Digital Zoom / Crop
                      </span>
                      <span className="font-mono text-white font-semibold">{zoom.toFixed(2)}x</span>
                    </div>

                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => updateAdjustments({ zoom: Number(e.target.value) })}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                    />

                    {/* Quick Zoom Presets */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      {[1.0, 1.25, 1.5, 2.0, 2.5].map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => updateAdjustments({ zoom: z, pan_x: z === 1.0 ? 0 : panX, pan_y: z === 1.0 ? 0 : panY })}
                          className={`flex-1 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                            Math.abs(zoom - z) < 0.04
                              ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                              : 'bg-[#1a1a1e] text-zinc-400 border-[#262626] hover:text-white'
                          }`}
                        >
                          {z === 1.0 ? '1.0x (Fit)' : `${z}x`}
                        </button>
                      ))}
                    </div>

                    {/* Pan Sliders when Zoomed */}
                    {zoom > 1.05 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                          <span className="flex items-center gap-1"><Move className="h-2.5 w-2.5 text-cyan-400" /> Pan X / Y</span>
                          <span>X: {panX}% • Y: {panY}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={panX}
                            onChange={(e) => updateAdjustments({ pan_x: Number(e.target.value) })}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            title="Pan Horizontal"
                          />
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={panY}
                            onChange={(e) => updateAdjustments({ pan_y: Number(e.target.value) })}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            title="Tilt Vertical"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Picture & Color Tuning */}
                  <div className="space-y-2 pt-1 border-t border-[#262626]">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Color & Lighting
                    </span>

                    {/* Brightness */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1.5"><Sun className="h-3 w-3 text-amber-400" /> Brightness</span>
                        <span className="font-mono text-white">{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={brightness}
                        onChange={(e) => updateAdjustments({ brightness: Number(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1.5"><Contrast className="h-3 w-3 text-purple-400" /> Contrast</span>
                        <span className="font-mono text-white">{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={contrast}
                        onChange={(e) => updateAdjustments({ contrast: Number(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1.5"><Eye className="h-3 w-3 text-emerald-400" /> Saturation</span>
                        <span className="font-mono text-white">{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={saturation}
                        onChange={(e) => updateAdjustments({ saturation: Number(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* More Camera Settings & Edit/Delete Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 rounded-lg border border-[#222222] bg-[#161616] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white transition-colors"
              title="Camera Settings, Edit & Delete"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-36px)] rounded-xl border border-[#222222] bg-[#161616]/95 backdrop-blur-md p-3.5 shadow-2xl z-50 space-y-3 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="flex justify-between items-center border-b border-[#222222] pb-2">
                  <p className="font-semibold text-white">Camera Management</p>
                  <span className="text-[10px] text-[#3B82F6] font-mono">Dev {currentCam.device}</span>
                </div>

                {/* Edit & Add Actions */}
                <div className="space-y-1">
                  {hasCameras && (
                    <button
                      onClick={handleOpenEditCamera}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] text-white text-xs flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Edit3 className="h-3.5 w-3.5 text-[#3B82F6]" />
                        Edit Camera Details
                      </span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenAddCamera}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] text-white text-xs flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-emerald-400" />
                      Add New Camera Source
                    </span>
                  </button>

                  <button
                    onClick={handleScanHardware}
                    disabled={isScanning}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] text-white text-xs flex items-center justify-between transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`h-3.5 w-3.5 text-purple-400 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning Hardware...' : 'Scan Hardware Devices'}
                    </span>
                  </button>

                  {hasCameras && (
                    <button
                      onClick={() => handleDeleteCamera(currentCam.device)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-300 text-xs flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        Delete This Camera
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Live Video Viewport Container */}
      <div
        ref={playerContainerRef}
        className={`relative w-full flex-1 min-h-0 rounded-xl bg-black border border-[#222222] overflow-hidden flex items-center justify-center group ${
          isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-none aspect-auto' : 'aspect-video'
        }`}
      >
        {/* EMPTY STATE: WHEN NO CAMERAS ARE CONNECTED */}
        {!hasCameras ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3.5 bg-[#0e0e11] select-none">
            {/* Ambient Pulse Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 bg-[#3B82F6]/5 rounded-full blur-3xl animate-pulse" />
            </div>

            <div className="relative p-4 rounded-2xl bg-[#161619] border border-[#26262a] text-zinc-400 shadow-2xl">
              <CameraOff className="h-9 w-9 text-zinc-500" />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-[#161619]" />
            </div>

            <div className="space-y-1 max-w-sm relative z-10">
              <h4 className="text-sm font-semibold text-white font-sans tracking-tight">
                No Surveillance Cameras Active
              </h4>
              <p className="text-zinc-500 text-xs leading-relaxed font-sans">
                No physical video capture devices or network RTSP streams are configured in your security pool.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 relative z-10">
              <button
                onClick={handleOpenAddCamera}
                className="px-3.5 py-2 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Camera Source</span>
              </button>
              <button
                onClick={handleScanHardware}
                disabled={isScanning}
                className="px-3.5 py-2 rounded-lg bg-[#18181a] hover:bg-[#222225] border border-[#2a2a2e] text-zinc-300 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning Hardware...' : 'Scan Connected Hardware'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Custom Object Tracker & Drawing HUD Overlay */}
            <TrackerHUDOverlay
              settings={trackerSettings}
              customTrackers={customTrackers}
              isDrawingMode={isDrawingMode}
              onBoxDrawn={handleBoxDrawn}
              onCancelDrawing={() => setIsDrawingMode(false)}
            />

            {/* SINGLE CAMERA VIEW (1x1) */}
            {gridMode === '1x1' && (
              <div className="relative w-full h-full flex items-center justify-center">
                {isPlaying ? (
                  <img
                    src={`/api/stream/live?dev=${activeDevice}`}
                    alt="Live 60 FPS CCTV Feed"
                    className="w-full h-full object-contain bg-black select-none"
                    onDoubleClick={handleToggleFullscreen}
                    onError={() => setStreamError(true)}
                    onLoad={() => setStreamError(false)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                    <Pause className="h-10 w-10 text-zinc-600" />
                    <span className="text-xs font-mono uppercase tracking-wider">Feed Paused</span>
                  </div>
                )}

                {/* Stream Error Notice */}
                {streamError && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-30">
                    <p className="text-xs font-mono text-zinc-300">Connecting Camera Signal...</p>
                    <button
                      onClick={() => {
                        setStreamError(false);
                        onReconnect();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#161616] hover:bg-[#222222] text-xs font-medium text-white border border-[#333]"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}

                {/* Top Left Live Badge & Active Trackers Indicator */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-10">
                  <div className="bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[#222222] flex items-center gap-1.5 text-[10px] font-mono text-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>LIVE</span>
                  </div>

                  {customTrackers.length > 0 && trackerSettings.enabled && (
                    <div className="bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[#3B82F6]/40 flex items-center gap-1 text-[10px] font-mono text-[#3B82F6]">
                      <Crosshair className="h-2.5 w-2.5" />
                      <span>{customTrackers.length} OBJECT{customTrackers.length > 1 ? 'S' : ''} TRACKED</span>
                    </div>
                  )}
                </div>

                {/* Top Right Live Timecode */}
                <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[#222222] text-[10px] font-mono text-zinc-300 pointer-events-none z-10">
                  {currentTime || '2026-08-23 19:12:05'}
                </div>
              </div>
            )}

            {/* 2x2 QUAD GRID VIEW (4 SLOTS WITH EMPTY STATES) */}
            {gridMode === '2x2' && (
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1.5 p-1.5 bg-[#0a0a0c]">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const cam = devices[slotIdx];
                  if (cam) {
                    const isActive = activeDevice === cam.device;
                    return (
                      <div
                        key={cam.device}
                        onClick={() => onSelectDevice(cam.device)}
                        className={`relative rounded-lg bg-black flex items-center justify-center overflow-hidden cursor-pointer border transition-all ${
                          isActive ? 'border-[#3B82F6] ring-1 ring-[#3B82F6]' : 'border-[#222222] hover:border-zinc-600'
                        }`}
                      >
                        <img
                          src={`/api/stream/live?dev=${cam.device}`}
                          alt={cam.name}
                          className="w-full h-full object-contain"
                        />
                        {/* Top Left Camera Name */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-mono text-white border border-[#222222]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="truncate max-w-[110px]">{cam.name}</span>
                        </div>
                        {/* Top Right Dev Tag */}
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-400 border border-[#222222]">
                          DEV {cam.device}
                        </div>
                      </div>
                    );
                  }

                  // EMPTY CAMERA SLOT PLACEHOLDER
                  return (
                    <div
                      key={`empty-slot-${slotIdx}`}
                      onClick={handleOpenAddCamera}
                      className="group relative rounded-lg border border-dashed border-[#26262a] bg-[#121215] hover:bg-[#15151a] hover:border-[#3B82F6]/60 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all duration-150"
                    >
                      {/* Corner Target Brackets */}
                      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-zinc-700 group-hover:border-[#3B82F6]" />
                      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-zinc-700 group-hover:border-[#3B82F6]" />
                      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-zinc-700 group-hover:border-[#3B82F6]" />
                      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-zinc-700 group-hover:border-[#3B82F6]" />

                      <div className="p-2 rounded-lg bg-[#18181d] border border-[#26262e] text-zinc-500 group-hover:text-[#3B82F6] group-hover:border-[#3B82F6]/40 transition-colors shadow-md">
                        <Plus className="h-4 w-4" />
                      </div>

                      <div className="mt-2 space-y-0.5">
                        <span className="text-[11px] font-mono font-semibold text-zinc-400 group-hover:text-white block">
                          CAM SLOT {slotIdx + 1}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-600 group-hover:text-[#3B82F6] block">
                          + Click to add camera
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Bottom Player Controls Dock */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 sm:gap-2 z-30 pointer-events-none">
              <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto flex-wrap">
                {/* Pause / Play */}
                <button
                  onClick={handleTogglePlay}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded bg-black/80 hover:bg-black text-white text-[11px] font-medium border border-[#333333] backdrop-blur transition-colors"
                  title={isPlaying ? 'Pause Feed' : 'Play Feed'}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                {/* Quick Snapshot */}
                <button
                  onClick={onSnapshot}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded bg-black/80 hover:bg-black text-white text-[11px] font-medium border border-[#333333] backdrop-blur transition-colors"
                  title="Capture Snapshot"
                >
                  <Camera className="h-3 w-3 text-[#3B82F6]" />
                  <span className="hidden sm:inline">Snapshot</span>
                </button>

                {/* Video Record */}
                <button
                  onClick={onToggleRecording}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] font-medium border backdrop-blur transition-colors ${
                    isRecording
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                      : 'bg-black/80 hover:bg-black text-white border-[#333333]'
                  }`}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                  <Disc className={`h-3 w-3 ${isRecording ? 'text-white' : 'text-rose-400'}`} />
                  <span>{isRecording ? `${recordingElapsed}s` : 'Record'}</span>
                </button>

                {/* Select Object / Door to Track button */}
                <button
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] font-medium border backdrop-blur transition-colors ${
                    isDrawingMode
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] animate-pulse'
                      : 'bg-black/80 hover:bg-black text-zinc-300 border-[#333333]'
                  }`}
                  title="Select / Draw Object or Door to Track"
                >
                  <Plus className="h-3 w-3 text-[#3B82F6]" />
                  <span className="hidden sm:inline">{isDrawingMode ? 'Cancel Selection' : 'Select Object'}</span>
                </button>

                {/* HUD Visibility Toggle (Show / Hide Overlay) */}
                <button
                  onClick={() => handleUpdateTrackerSettings({ enabled: !trackerSettings.enabled })}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded text-[11px] font-medium border backdrop-blur transition-colors ${
                    trackerSettings.enabled
                      ? 'bg-blue-600/20 text-[#3B82F6] border-[#3B82F6]/50 hover:bg-blue-600/30'
                      : 'bg-black/80 hover:bg-black text-zinc-400 border-[#333333]'
                  }`}
                  title={trackerSettings.enabled ? 'Hide Tracker HUD Overlay' : 'Show Tracker HUD Overlay'}
                >
                  {trackerSettings.enabled ? <Eye className="h-3 w-3 text-[#3B82F6]" /> : <EyeOff className="h-3 w-3 text-zinc-400" />}
                  <span className="hidden md:inline">{trackerSettings.enabled ? 'HUD On' : 'HUD Off'}</span>
                </button>

                {/* Mute / Audio with Volume Slider */}
                <div className="relative" ref={micMenuRef}>
                  <div className="flex items-center rounded bg-black/80 border border-[#333333] overflow-hidden backdrop-blur">
                    <button
                      onClick={onToggleMute}
                      className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] font-medium text-white hover:bg-white/10 transition-colors"
                      title={!isMuted ? 'Mute Microphone' : 'Enable Live Audio'}
                    >
                      {!isMuted ? <Volume2 className="h-3 w-3 text-emerald-400" /> : <VolumeX className="h-3 w-3 text-zinc-400" />}
                      <span className="hidden md:inline">{!isMuted ? 'Audio' : 'Muted'}</span>
                    </button>

                    <button
                      onClick={() => setShowMicMenu(!showMicMenu)}
                      className="px-1.5 py-1 border-l border-[#333333] hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Audio Device & Volume"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Mic Volume Popup */}
                  {showMicMenu && (
                    <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-56 sm:w-64 max-w-[calc(100vw-36px)] rounded-xl border border-[#222222] bg-[#121212]/95 backdrop-blur-md p-3 shadow-2xl space-y-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-white border-b border-[#222222] pb-1.5">
                        <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-emerald-400" /> Microphone</span>
                        <span className="font-mono text-[10px] text-zinc-400">{volume}%</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Volume</span>
                          <span>{volume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(e) => onChangeVolume(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Level</span>
                          <span className="font-mono text-emerald-400">{audioLevel}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#222222] rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-75 ${
                              audioLevel > 75 ? 'bg-rose-500' : audioLevel > 40 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(audioLevel > 0 ? 8 : 0, audioLevel))}%` }}
                          />
                        </div>
                      </div>

                      {audioDevices.length > 0 && (
                        <div className="pt-1 border-t border-[#222222]">
                          <span className="text-[9px] text-zinc-400 block mb-0.5">Input Device:</span>
                          <select
                            value={activeAudioDevice !== null ? activeAudioDevice : ''}
                            onChange={(e) => onSelectAudioDevice(Number(e.target.value))}
                            className="w-full bg-[#1a1a1a] border border-[#262626] rounded p-1 text-zinc-200 text-[10px] outline-none"
                          >
                            {audioDevices.map((d: any) => (
                              <option key={d.index} value={d.index}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom-Right Controls: Adjustments & Fullscreen */}
              <div className="pointer-events-auto shrink-0 flex items-center gap-1.5">
                <button
                  onClick={() => setShowAdjustmentsModal(!showAdjustmentsModal)}
                  className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded text-white text-[11px] font-medium border backdrop-blur transition-colors ${
                    showAdjustmentsModal || flipH || flipV || rotation !== 0 || zoom > 1.01
                      ? 'bg-[#3B82F6] border-[#3B82F6]'
                      : 'bg-black/80 hover:bg-black border-[#333333]'
                  }`}
                  title="Camera Adjustments (Flip, Crop, Zoom, Rotate, Color)"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline font-mono">Tune</span>
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded bg-black/80 hover:bg-black text-white text-[11px] font-medium border border-[#333333] backdrop-blur transition-colors"
                  title="Toggle Video Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline font-mono">{isFullscreen ? 'Exit' : 'Full'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Custom Object Tracker Configuration Modal */}
      <CustomObjectTrackerModal
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setEditingTracker(null);
        }}
        cameraId={activeDevice}
        initialBounds={drawnBounds}
        editingTracker={editingTracker}
        onSaved={fetchCustomTrackers}
      />

      {/* Camera Add / Edit Configuration Modal */}
      <CameraEditModal
        isOpen={isCameraModalOpen}
        onClose={() => {
          setIsCameraModalOpen(false);
          setEditingCamera(null);
        }}
        camera={editingCamera}
        onSaved={onReconnect}
      />
    </div>
  );
};
