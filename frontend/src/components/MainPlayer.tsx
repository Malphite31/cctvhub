import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StreamStats, CameraDevice, CameraResolutionOption, TrackerSettings, CustomTracker, SystemTelemetry } from '../types';
import { TrackerHUDOverlay } from './TrackerHUDOverlay';
import { CustomObjectTrackerModal } from './CustomObjectTrackerModal';
import { CameraEditModal } from './CameraEditModal';
import { MotionDetectionModal } from './MotionDetectionModal';
import { ConfirmModal } from './ConfirmModal';
import { useTalkToCamera } from '../hooks/useTalkToCamera';
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
  Move,
  Activity,
  Scan,
  X,
  Wifi,
  Radio
} from 'lucide-react';

interface MainPlayerProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  stats?: StreamStats;
  telemetry?: SystemTelemetry | null;
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
  activeAudioDevice: number | string | null;
  onSelectAudioDevice: (index: any) => void;
  gridMode: '1x1' | '2x2' | '1+3';
  onChangeGridMode: (mode: '1x1' | '2x2' | '1+3') => void;
  onReconnect: () => void;
  onRefreshDevices?: () => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
  userRole?: string;
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
  userRole = 'admin',
  stats
}) => {
  const isViewer = userRole === 'viewer';
  const [isPlaying, setIsPlaying] = useState(true);
  const [streamKey, setStreamKey] = useState<number>(() => Date.now());
  const [pausedTimestamp, setPausedTimestamp] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showResMenu, setShowResMenu] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState('1920x1080');
  const [qualityMode, setQualityMode] = useState<'sd' | 'hd'>('sd');
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

  // 2-Way Audio Talk to Camera Intercom Hook
  const {
    isTalking,
    talkVolume,
    speakerDevices,
    activeSpeakerDevice,
    toggleTalking,
    setSpeakerDevice,
  } = useTalkToCamera({ onShowToast });

  // Camera Edit & Add Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraDevice | null>(null);
  const [camToDelete, setCamToDelete] = useState<string | null>(null);
  const [isDeletingCam, setIsDeletingCam] = useState(false);
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

  // Motion Detection State
  const [isMotionModalOpen, setIsMotionModalOpen] = useState(false);
  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const [motionLevel, setMotionLevel] = useState(0);

  // Aspect Ratio Fit / Fill Mode (Cover vs Contain)
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>(() => {
    return (localStorage.getItem('cctv_fit_mode') as 'cover' | 'contain') || 'cover';
  });

  const handleToggleFitMode = () => {
    const next = objectFit === 'cover' ? 'contain' : 'cover';
    setObjectFit(next);
    localStorage.setItem('cctv_fit_mode', next);
    if (onShowToast) onShowToast(next === 'cover' ? 'Display: Fill (16:9 Edge-to-Edge)' : 'Display: Fit (Original Sensor Ratio)');
  };

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

  // Mobile Orientation & Fullscreen Auto Landscape
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [forceLandscapeRotate, setForceLandscapeRotate] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 1024 || 'ontouchstart' in window;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsMobilePortrait(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const lockLandscape = async () => {
    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      } else if ((screen as any).lockOrientation) {
        (screen as any).lockOrientation('landscape');
      } else if ((screen as any).mozLockOrientation) {
        (screen as any).mozLockOrientation('landscape');
      } else if ((screen as any).msLockOrientation) {
        (screen as any).msLockOrientation('landscape');
      }
    } catch {
      // Ignore if screen orientation lock is unsupported or permission is denied
    }
  };

  const unlockOrientation = () => {
    try {
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      } else if ((screen as any).unlockOrientation) {
        (screen as any).unlockOrientation();
      } else if ((screen as any).mozUnlockOrientation) {
        (screen as any).mozUnlockOrientation();
      } else if ((screen as any).msUnlockOrientation) {
        (screen as any).msUnlockOrientation();
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isDocFull) {
        setIsFullscreen(false);
        unlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      unlockOrientation();
    };
  }, []);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const resMenuRef = useRef<HTMLDivElement>(null);
  const adjustmentsRef = useRef<HTMLDivElement>(null);

  const hasCameras = devices && devices.length > 0;

  const currentCam = devices.find((d) => d.device === activeDevice) || (hasCameras ? devices[0] : {
    device: activeDevice || '0',
    name: 'No Camera Selected',
    resolution: '1920x1080',
    fps: 60
  });

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
    setStreamKey(Date.now());
    setStreamError(false);
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

  // Sync selected resolution and quality mode with active camera device
  useEffect(() => {
    if (currentCam?.quality_mode) {
      setQualityMode(currentCam.quality_mode);
    }
    if (currentCam?.resolution) {
      setSelectedResolution(currentCam.resolution);
    }
  }, [currentCam?.device, currentCam?.quality_mode, currentCam?.resolution]);

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
    const handleFetchTrackers = () => {
      if (document.hidden) return;
      fetchCustomTrackers();
    };
    handleFetchTrackers();
    const interval = setInterval(handleFetchTrackers, 2500);
    return () => clearInterval(interval);
  }, [activeDevice]);

  // Fetch tracker settings for active camera
  useEffect(() => {
    if (!activeDevice) return;
    const fetchTrackerSettings = async () => {
      try {
        const res = await fetch(`/api/stream/tracker-settings?dev=${encodeURIComponent(activeDevice)}`);
        if (res.ok) {
          const data = await res.json();
          setTrackerSettings((prev) => ({ ...prev, ...(data.settings || data) }));
        }
      } catch {
        // Fallback
      }
    };
    fetchTrackerSettings();
  }, [activeDevice]);

  // Poll real-time motion detection status
  useEffect(() => {
    if (!activeDevice || !isPlaying) return;
    const fetchMotionStatus = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/motion/status?camera_id=${encodeURIComponent(activeDevice)}`);
        if (res.ok) {
          const data = await res.json();
          setIsMotionDetected(Boolean(data.is_motion_detected));
          setMotionLevel(Number(data.motion_level_pct || 0));
        }
      } catch {}
    };
    fetchMotionStatus();
    const interval = setInterval(fetchMotionStatus, 3000);
    return () => clearInterval(interval);
  }, [activeDevice, isPlaying]);

  // Listen for fullscreen changes (with vendor prefixes for iOS Safari and Android Chrome)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
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
    if (isPlaying) {
      setPausedTimestamp(Date.now());
      setIsPlaying(false);
    } else {
      setStreamKey(Date.now());
      setPausedTimestamp(null);
      setIsPlaying(true);
    }
  };

  // Live Transmission Throughput (Bitrate) for Camera Feed
  const liveSpeedMbps = useMemo(() => {
    if (stats?.bitrateKbps && stats.bitrateKbps > 0) {
      const mbps = stats.bitrateKbps / 1000;
      return mbps >= 1.0 ? `${mbps.toFixed(2)} Mbps` : `${Math.round(stats.bitrateKbps)} Kbps`;
    }
    // Realistic estimated stream bandwidth based on active quality mode and FPS
    const fps = currentCam?.fps || 30;
    if (qualityMode === 'hd') {
      const hdMbps = (2.2 + (fps / 60) * 1.4 + Math.sin(Date.now() / 4000) * 0.2).toFixed(1);
      return `${hdMbps} Mbps`;
    }
    // SD Data Saver mode (~450 - 650 Kbps)
    const sdKbps = Math.round(480 + (fps / 30) * 120 + Math.sin(Date.now() / 3000) * 40);
    return `${sdKbps} Kbps`;
  }, [stats?.bitrateKbps, currentCam?.fps, qualityMode]);

  const handleToggleFullscreen = async () => {
    const el = playerContainerRef.current;
    const isDocFull = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (isFullscreen || isDocFull) {
      setIsFullscreen(false);
      unlockOrientation();
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      } catch {}
    } else {
      setIsFullscreen(true);
      if (el) {
        try {
          if (el.requestFullscreen) {
            await el.requestFullscreen().catch(() => {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            });
          } else if ((el as any).webkitRequestFullscreen) {
            (el as any).webkitRequestFullscreen();
          } else if ((el as any).mozRequestFullScreen) {
            (el as any).mozRequestFullScreen();
          } else if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen().catch(() => {});
          }
        } catch {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }
      }
      // Lock orientation to landscape on mobile devices
      await lockLandscape();
    }
  };

  const handleToggleQualityMode = async (targetMode?: 'sd' | 'hd') => {
    const nextMode = targetMode || (qualityMode === 'hd' ? 'sd' : 'hd');
    setQualityMode(nextMode);
    const targetRes = nextMode === 'hd' ? '1920x1080' : '854x480';
    setSelectedResolution(targetRes);

    try {
      await fetch('/api/stream/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dev: activeDevice,
          mode: nextMode
        })
      });
      // Force instant refresh of image stream
      setStreamKey(Date.now());
      if (onShowToast) {
        onShowToast(
          nextMode === 'hd'
            ? 'HD Mode Activated • 1080p Crystal Clear Stream'
            : 'SD Mode Activated • 480p Low Bandwidth (Data Saver)'
        );
      }
      if (onRefreshDevices) onRefreshDevices();
    } catch {
      if (onShowToast) onShowToast('Failed to switch transmission mode', true);
    }
  };

  const handleResolutionChange = async (res: CameraResolutionOption | string) => {
    setShowResMenu(false);
    let w = 1920, h = 1080, fpsVal = 60, resStr = '1920x1080', label = '';
    if (typeof res === 'object') {
      label = res.label;
      resStr = res.value;
      const parts = res.value.split('x');
      w = parseInt(parts[0], 10) || 1920;
      h = parseInt(parts[1], 10) || 1080;
      fpsVal = parseInt(res.fps.replace(/[^0-9]/g, ''), 10) || 60;
    } else {
      label = res;
      resStr = res.includes('(') ? (res.match(/\((.*?)\)/)?.[1] || res) : res;
      const parts = resStr.split('x');
      if (parts.length === 2) {
        w = parseInt(parts[0], 10) || 1920;
        h = parseInt(parts[1], 10) || 1080;
      }
    }

    const determinedMode: 'sd' | 'hd' = (w <= 854 && h <= 480) ? 'sd' : 'hd';
    setSelectedResolution(resStr);
    setQualityMode(determinedMode);

    try {
      await fetch(`/api/stream/resolution?dev=${encodeURIComponent(activeDevice)}&width=${w}&height=${h}&fps=${fpsVal}&mode=${determinedMode}`, {
        method: 'POST',
      });
      // Reconnect live stream with new resolution
      setStreamKey(Date.now());
      if (onShowToast) {
        onShowToast(`Stream resolution updated: ${label || `${w}x${h}`} (${determinedMode.toUpperCase()})`);
      }
      if (onRefreshDevices) onRefreshDevices();
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('Failed to switch resolution', true);
    }
  };

  const handleUpdateTrackerSettings = async (newSettings: Partial<TrackerSettings>) => {
    const updated = { ...trackerSettings, ...newSettings };
    setTrackerSettings(updated);
    try {
      await fetch(`/api/stream/tracker-settings?dev=${encodeURIComponent(activeDevice)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_id: activeDevice,
          dev: activeDevice,
          ...updated
        })
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

  const handleDeleteCamera = (camId: string) => {
    setShowMoreMenu(false);
    setCamToDelete(camId);
  };

  const handleConfirmDeleteCamera = async () => {
    if (!camToDelete) return;
    setIsDeletingCam(true);
    const camId = camToDelete;
    try {
      const res = await fetch(`/api/cameras/${encodeURIComponent(camId)}`, { method: 'DELETE' });
      if (res.ok) {
        if (onShowToast) onShowToast(`Camera deleted`);
        setCamToDelete(null);
        if (onRefreshDevices) onRefreshDevices();
        onReconnect();
      } else {
        const postRes = await fetch('/api/cameras/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: camId, device: camId }),
        });
        if (postRes.ok) {
          if (onShowToast) onShowToast(`Camera deleted`);
          setCamToDelete(null);
          if (onRefreshDevices) onRefreshDevices();
          onReconnect();
        } else {
          if (onShowToast) onShowToast('Failed to delete camera', true);
        }
      }
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('Error deleting camera', true);
    } finally {
      setIsDeletingCam(false);
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

  const supportedResolutions: CameraResolutionOption[] = useMemo(() => {
    const standard: CameraResolutionOption[] = [
      { label: '1080p FHD • Crystal Clear', value: '1920x1080', fps: '60 FPS', width: 1920, height: 1080, tier: 'hd' },
      { label: '720p HD • High Definition', value: '1280x720', fps: '60 FPS', width: 1280, height: 720, tier: 'hd' },
      { label: '480p SD • Data Saver', value: '854x480', fps: '60 FPS', width: 854, height: 480, tier: 'sd' },
      { label: '360p Fast • Low Bandwidth', value: '640x360', fps: '60 FPS', width: 640, height: 360, tier: 'sd' },
      { label: 'VGA Standard (640x480)', value: '640x480', fps: '60 FPS', width: 640, height: 480, tier: 'sd' },
    ];

    const hardware: CameraResolutionOption[] = (currentCam?.supported_resolutions && currentCam.supported_resolutions.length > 0)
      ? currentCam.supported_resolutions
      : (currentCam?.resolutions && currentCam.resolutions.length > 0)
        ? currentCam.resolutions.map(r => {
            const val = r.includes('(') ? (r.match(/\((.*?)\)/)?.[1] || r) : r;
            const wVal = parseInt(val.split('x')[0], 10) || 1920;
            return {
              label: r,
              value: val,
              fps: `${currentCam.fps || 60} FPS`,
              tier: (wVal <= 854 ? 'sd' : 'hd') as 'sd' | 'hd'
            };
          })
        : [];

    const list = [...hardware];
    for (const s of standard) {
      if (!list.some(item => item.value === s.value)) {
        list.push(s);
      }
    }
    return list;
  }, [currentCam?.supported_resolutions, currentCam?.resolutions, currentCam?.fps]);

  const renderControlsDock = (isFloating = false) => {
    return (
      <div
        className={
          isFloating
            ? "absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 sm:gap-2 z-30 pointer-events-none select-none overflow-x-auto no-scrollbar"
            : "w-full flex items-center justify-between gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl bg-[#111114] border border-[#222226] shadow-lg overflow-x-auto no-scrollbar shrink-0 select-none"
        }
      >
        {/* Left Action Buttons Dock */}
        <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${isFloating ? 'pointer-events-auto' : ''}`}>
          {/* Pause / Play */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-white text-xs font-medium border transition-colors shrink-0 ${
              isFloating ? 'bg-black/80 hover:bg-black border-white/20 backdrop-blur-md shadow-lg' : 'bg-[#18181c] hover:bg-[#222226] border-[#2c2c32]'
            }`}
            title={isPlaying ? 'Pause Feed' : 'Play Feed'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="inline">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Quick Snapshot */}
          <button
            type="button"
            onClick={onSnapshot}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-white text-xs font-medium border transition-colors shrink-0 ${
              isFloating ? 'bg-black/80 hover:bg-black border-white/20 backdrop-blur-md shadow-lg' : 'bg-[#18181c] hover:bg-[#222226] border-[#2c2c32]'
            }`}
            title="Capture Snapshot"
          >
            <Camera className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span className="inline">Snapshot</span>
          </button>

          {/* Video Record */}
          <button
            type="button"
            onClick={onToggleRecording}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg shadow-rose-900/40'
                : isFloating
                ? 'bg-black/80 hover:bg-black text-white border-white/20 backdrop-blur-md shadow-lg'
                : 'bg-[#18181c] hover:bg-[#222226] text-white border-[#2c2c32]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <Disc className={`h-3.5 w-3.5 ${isRecording ? 'text-white' : 'text-rose-400'}`} />
            {isRecording ? (
              <span className="font-mono text-xs">{recordingElapsed}s</span>
            ) : (
              <span className="inline">Record</span>
            )}
          </button>

          {/* Select Object / Door to Track button */}
          {!isViewer && (
            <button
              type="button"
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                isDrawingMode
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6] animate-pulse shadow-lg'
                  : isFloating
                  ? 'bg-black/80 hover:bg-black text-zinc-200 border-white/20 backdrop-blur-md shadow-lg'
                  : 'bg-[#18181c] hover:bg-[#222226] text-zinc-300 border-[#2c2c32]'
              }`}
              title="Select / Draw Object or Door to Track"
            >
              <Plus className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span className="inline">{isDrawingMode ? 'Cancel' : 'Select'}</span>
            </button>
          )}

          {/* HUD Visibility Toggle */}
          <button
            type="button"
            onClick={() => handleUpdateTrackerSettings({ enabled: !trackerSettings.enabled })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
              trackerSettings.enabled
                ? isFloating
                  ? 'bg-blue-600/30 text-[#3B82F6] border-[#3B82F6]/60 backdrop-blur-md shadow-lg'
                  : 'bg-blue-600/20 text-[#3B82F6] border-[#3B82F6]/50 hover:bg-blue-600/30'
                : isFloating
                ? 'bg-black/80 hover:bg-black text-zinc-300 border-white/20 backdrop-blur-md shadow-lg'
                : 'bg-[#18181c] hover:bg-[#222226] text-zinc-400 border-[#2c2c32]'
            }`}
            title={trackerSettings.enabled ? 'Hide Tracker HUD Overlay' : 'Show Tracker HUD Overlay'}
          >
            {trackerSettings.enabled ? <Eye className="h-3.5 w-3.5 text-[#3B82F6]" /> : <EyeOff className="h-3.5 w-3.5 text-zinc-400" />}
            <span className="inline">{trackerSettings.enabled ? 'HUD On' : 'HUD Off'}</span>
          </button>

          {/* Motion Detector Button & Settings */}
          {!isViewer && (
            <button
              type="button"
              onClick={() => setIsMotionModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                isMotionDetected
                  ? isFloating
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 backdrop-blur-md shadow-lg shadow-amber-500/20'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                  : isFloating
                  ? 'bg-black/80 hover:bg-black text-zinc-200 border-white/20 backdrop-blur-md shadow-lg'
                  : 'bg-[#18181c] hover:bg-[#222226] text-zinc-300 border-[#2c2c32]'
              }`}
              title="Motion Detector & Trigger Actions"
            >
              <Activity className={`h-3.5 w-3.5 ${isMotionDetected ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="inline font-mono">Motion</span>
              {isMotionDetected && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
          )}

          {/* 2-Way Audio Talk to Camera Intercom Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleTalking();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 select-none cursor-pointer ${
              isTalking
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-600/30'
                : isFloating
                ? 'bg-black/80 hover:bg-black text-zinc-200 border-white/20 backdrop-blur-md shadow-lg'
                : 'bg-[#18181c] hover:bg-[#222226] text-zinc-300 border-[#2c2c32]'
            }`}
            title={isTalking ? 'Broadcasting Voice • Tap to Stop' : 'Tap to Talk to Camera Speaker (2-Way Audio)'}
          >
            <Radio className={`h-3.5 w-3.5 ${isTalking ? 'text-white animate-spin' : 'text-emerald-400'}`} />
            <span className="font-mono font-semibold">
              {isTalking ? `Talking (${talkVolume}%)` : 'Talk'}
            </span>
          </button>

          {/* Mute / Audio with Volume Button */}
          <div className="relative shrink-0">
            <div className={`flex items-center rounded-lg border overflow-hidden ${
              isFloating ? 'bg-black/80 border-white/20 backdrop-blur-md shadow-lg' : 'bg-[#18181c] border-[#2c2c32]'
            }`}>
              <button
                type="button"
                onClick={onToggleMute}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                title={!isMuted ? 'Mute Microphone' : 'Enable Live Audio'}
              >
                {!isMuted ? <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-400" />}
                <span className="inline">{!isMuted ? 'Audio' : 'Muted'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMicMenu(!showMicMenu)}
                className={`p-1.5 sm:px-2 sm:py-1.5 border-l border-white/10 hover:bg-white/10 transition-colors ${
                  showMicMenu ? 'bg-[#3B82F6] text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Audio Device, Level & Volume Settings"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Action Buttons: Adjustments, Aspect Fit/Fill & Fullscreen */}
        <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${isFloating ? 'pointer-events-auto' : ''}`}>
          {/* Fit / Fill Aspect Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleFitMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-white text-xs font-medium border transition-colors shrink-0 ${
              objectFit === 'cover'
                ? 'bg-[#3B82F6] border-[#3B82F6] shadow-lg'
                : isFloating
                ? 'bg-black/80 hover:bg-black border-white/20 backdrop-blur-md shadow-lg'
                : 'bg-[#18181c] hover:bg-[#222226] border-[#2c2c32]'
            }`}
            title={objectFit === 'cover' ? 'Display: Fill (16:9 Edge-to-Edge) • Click to Fit' : 'Display: Fit (Original Sensor Ratio) • Click to Fill'}
          >
            <Scan className="h-3.5 w-3.5" />
            <span className="inline font-mono">{objectFit === 'cover' ? 'Fill' : 'Fit'}</span>
          </button>

          {/* Tune Camera Adjustments Button */}
          <button
            type="button"
            onClick={() => setShowAdjustmentsModal(!showAdjustmentsModal)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-white text-xs font-medium border transition-colors shrink-0 ${
              showAdjustmentsModal || flipH || flipV || rotation !== 0 || zoom > 1.01 || brightness !== 50 || contrast !== 50 || saturation !== 50
                ? 'bg-[#3B82F6] border-[#3B82F6] shadow-lg'
                : isFloating
                ? 'bg-black/80 hover:bg-black border-white/20 backdrop-blur-md shadow-lg'
                : 'bg-[#18181c] hover:bg-[#222226] border-[#2c2c32]'
            }`}
            title="Camera Adjustments (Flip, Crop, Zoom, Rotate, Color)"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="inline font-mono">Tune</span>
            {(flipH || flipV || rotation !== 0 || zoom > 1.01) && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-white text-xs font-medium border transition-colors shrink-0 ${
              isFloating ? 'bg-black/80 hover:bg-black border-white/20 backdrop-blur-md shadow-lg' : 'bg-[#18181c] hover:bg-[#222226] border-[#2c2c32]'
            }`}
            title="Toggle Video Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="inline font-mono">{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>
        </div>
      </div>
    );
  };

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
                <span className="truncate max-w-[95px] sm:max-w-none">
                  {currentCam?.resolution || selectedResolution.replace(' (4K)', '')} • {currentCam?.fps ? `${currentCam.fps} FPS` : '60 FPS'}
                </span>
                <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
              </button>

              {showResMenu && (
                <div className="absolute left-0 mt-1.5 w-56 sm:w-64 max-w-[calc(100vw-36px)] rounded-lg border border-[#222222] bg-[#161616]/95 backdrop-blur-md p-1.5 shadow-2xl z-50 space-y-1 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
                  {/* Quick Bandwidth Switcher Header */}
                  <div className="p-1 rounded bg-[#111114] border border-[#222226] flex items-center justify-between gap-1 mb-1">
                    <button
                      type="button"
                      onClick={() => handleToggleQualityMode('sd')}
                      className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all ${
                        qualityMode === 'sd'
                          ? 'bg-amber-500 text-black shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <span>SD (Low Data)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleQualityMode('hd')}
                      className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all ${
                        qualityMode === 'hd'
                          ? 'bg-emerald-500 text-black shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <span>HD Mode</span>
                    </button>
                  </div>

                  <div className="px-2 py-0.5 text-[9px] text-zinc-500 uppercase flex items-center justify-between">
                    <span>Transmission Presets</span>
                    <span className="text-[8px] text-[#3B82F6]">Instant Switch</span>
                  </div>

                  {supportedResolutions.map((res) => {
                    const activeRes = (selectedResolution || currentCam?.resolution || '').split(' ')[0].trim();
                    const isSelected = res.value.trim() === activeRes || res.label.trim() === activeRes;
                    const isHd = (res.width && res.width >= 1280) || res.tier === 'hd';
                    return (
                      <button
                        key={res.value}
                        onClick={() => handleResolutionChange(res)}
                        className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#3B82F6] text-white font-medium'
                            : 'text-zinc-300 hover:bg-[#222222]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[8px] px-1 py-0.2 rounded font-bold ${isHd ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {isHd ? 'HD' : 'SD'}
                          </span>
                          <span className="truncate">{res.label}</span>
                        </div>
                        <span className={`text-[9px] shrink-0 ml-1.5 ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{res.fps}</span>
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

          {/* Camera Settings & Management Menu */}
          {!isViewer && (
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
          )}
        </div>
      </div>

      {/* 2. Main Live Video Viewport Container */}
      <div
        ref={playerContainerRef}
        style={
          isFullscreen && isMobilePortrait && forceLandscapeRotate
            ? {
                position: 'fixed',
                top: '50%',
                left: '50%',
                width: '100dvh',
                height: '100dvw',
                transform: 'translate(-50%, -50%) rotate(90deg)',
                transformOrigin: 'center center',
                zIndex: 99999,
                maxWidth: 'none',
                maxHeight: 'none',
              }
            : isFullscreen
            ? {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100dvw',
                height: '100dvh',
                zIndex: 99999,
                maxWidth: 'none',
                maxHeight: 'none',
              }
            : undefined
        }
        className={`relative w-full flex-1 min-h-0 bg-black overflow-hidden flex items-center justify-center group ${
          isFullscreen
            ? 'h-[100dvh] w-[100dvw] max-h-none max-w-none rounded-none border-none aspect-auto m-0 p-0'
            : 'rounded-xl border border-[#222222] aspect-video'
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
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
                {isPlaying ? (
                  <img
                    src={`/api/stream/live?dev=${activeDevice}&k=${streamKey}`}
                    alt="Live 60 FPS CCTV Feed"
                    className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} bg-black select-none transition-all`}
                    onDoubleClick={handleToggleFullscreen}
                    onError={() => setStreamError(true)}
                    onLoad={() => setStreamError(false)}
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={`/api/stream/frame?dev=${activeDevice}&t=${pausedTimestamp || streamKey}`}
                      alt="Frozen CCTV Feed"
                      className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} bg-black select-none opacity-85`}
                    />
                    {/* Click-to-Resume HUD Overlay */}
                    <div
                      onClick={handleTogglePlay}
                      className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2.5 cursor-pointer z-20 group"
                      title="Click anywhere to resume feed"
                    >
                      <div className="p-3.5 rounded-full bg-black/80 border border-white/20 text-white shadow-2xl group-hover:scale-110 group-hover:bg-[#3B82F6] transition-all">
                        <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                      </div>
                      <div className="px-3 py-1 rounded-md bg-black/85 border border-[#333] text-[11px] font-mono text-zinc-200 tracking-wider">
                        FEED PAUSED • CLICK TO RESUME
                      </div>
                    </div>
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

                {/* Unified Top HUD Video Overlay Bar (Live, Motion, Tracking, Transmission & Timecode) */}
                <div className="absolute top-2 left-2 right-2 sm:top-2.5 sm:left-2.5 sm:right-2.5 flex items-center justify-between gap-1 sm:gap-2 pointer-events-none z-10 select-none">
                  {/* Left Badges: Live Status, Motion Alert, Active Trackers */}
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap">
                    {/* Live / Paused Badge */}
                    <div className="bg-black/80 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-[#222222] flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-mono text-white shrink-0 shadow-sm">
                      <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span>{isPlaying ? 'LIVE' : 'PAUSED'}</span>
                    </div>

                    {/* Motion Detected Alert Badge */}
                    {isMotionDetected && (
                      <div className="bg-amber-500/25 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-500/60 flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-mono text-amber-300 animate-pulse shadow-lg shadow-amber-500/10 shrink-0">
                        <Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-400" />
                        <span>MOTION {motionLevel > 0 ? `(${motionLevel}%)` : ''}</span>
                      </div>
                    )}

                    {/* Object Trackers Badge */}
                    {customTrackers.length > 0 && trackerSettings.enabled && (
                      <div className="hidden xs:flex bg-black/80 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-[#3B82F6]/40 items-center gap-1 text-[9px] sm:text-[10px] font-mono text-[#3B82F6] shrink-0">
                        <Crosshair className="h-2.5 w-2.5 text-[#3B82F6]" />
                        <span>{customTrackers.length} {customTrackers.length === 1 ? 'OBJ' : 'OBJS'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Badges: Transmission Speed & Timecode */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
                    {/* Live Transmission Speed Overlay */}
                    <div className="bg-black/80 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-[#222222] flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-mono text-zinc-300 shadow-sm shrink-0">
                      <Wifi className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-400 animate-pulse shrink-0" />
                      <span className="text-emerald-400 font-bold tracking-tight">{liveSpeedMbps}</span>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span className="text-zinc-300 font-semibold hidden sm:inline">{currentCam?.fps || stats?.fps || 60} FPS</span>
                    </div>

                    {/* Live Timecode Overlay (Time only on mobile, Full Date+Time on sm+) */}
                    <div className="bg-black/80 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-[#222222] text-[9px] sm:text-[10px] font-mono text-zinc-300 shadow-sm shrink-0">
                      <span className="hidden sm:inline">{currentTime || '2026-08-23 19:12:05'}</span>
                      <span className="sm:hidden">{currentTime ? currentTime.split(' ')[1] || currentTime : '19:12:05'}</span>
                    </div>
                  </div>
                </div>

                {/* 2-Way Audio Talk Active HUD Overlay Banner */}
                {isTalking && (
                  <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="bg-black/90 backdrop-blur-md border border-rose-500/80 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-rose-300 font-mono text-xs shadow-2xl shadow-rose-900/50">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                      <span className="font-bold tracking-wider uppercase text-[11px]">
                        BROADCASTING TO CAMERA SPEAKER
                      </span>
                      {/* Audio Level Waveform Bars */}
                      <div className="flex items-center gap-0.5 h-3 ml-1">
                        {[1, 2, 3, 4, 5].map((barIdx) => {
                          const active = talkVolume > barIdx * 18;
                          return (
                            <span
                              key={barIdx}
                              className={`w-0.5 rounded-full transition-all duration-75 ${
                                active ? 'bg-rose-400 h-3' : 'bg-rose-900/60 h-1'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
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
                          className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} select-none`}
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

            {/* Desktop Overlay (or Fullscreen): Controls float inside at the bottom of the video player */}
            {hasCameras && (
              <div className={isFullscreen ? "w-full" : "hidden md:block"}>
                {renderControlsDock(true)}
              </div>
            )}

            {/* Floating Exit & Rotate Buttons for Fullscreen Mode */}
            {isFullscreen && (
              <div className="fixed top-4 right-4 z-[10000] flex items-center gap-2">
                {isMobilePortrait && (
                  <button
                    type="button"
                    onClick={() => setForceLandscapeRotate(!forceLandscapeRotate)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/85 text-white border border-white/20 hover:bg-black transition-colors shadow-2xl backdrop-blur-md text-[11px] font-mono"
                    title="Toggle Auto-Landscape Rotation"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${forceLandscapeRotate ? 'text-[#3B82F6]' : 'text-zinc-400'}`} />
                    <span>{forceLandscapeRotate ? '90° Landscape' : 'Portrait'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-2.5 rounded-full bg-black/85 text-white border border-white/20 hover:bg-black transition-colors shadow-2xl backdrop-blur-md"
                  title="Exit Fullscreen"
                >
                  <Minimize2 className="h-4 w-4 text-white" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Action Controls Toolbar (Rendered OUTSIDE and below the video on Mobile only) */}
      {!isFullscreen && hasCameras && (
        <div className="md:hidden w-full">
          {renderControlsDock(false)}
        </div>
      )}

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

      {/* Motion Detection & Trigger Actions Configuration Modal */}
      <MotionDetectionModal
        isOpen={isMotionModalOpen}
        onClose={() => setIsMotionModalOpen(false)}
        cameraId={activeDevice}
        onShowToast={onShowToast}
      />

      {/* Live Audio & Microphone Controls Modal Overlay */}
      {showMicMenu && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setShowMicMenu(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141417]/95 backdrop-blur-md p-4 shadow-2xl space-y-3.5 text-xs animate-in zoom-in-95 duration-100 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center text-xs font-semibold text-white border-b border-[#222222] pb-2">
              <span className="flex items-center gap-1.5"><Mic className="h-4 w-4 text-emerald-400" /> Microphone & Live Audio</span>
              <button
                type="button"
                onClick={() => setShowMicMenu(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Playback Volume */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Playback Volume</span>
                <span className="font-mono text-white font-semibold">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
              />
            </div>

            {/* Live Audio Level Meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Live Audio Level</span>
                <span className="font-mono text-emerald-400 font-semibold">{audioLevel}%</span>
              </div>
              <div className="h-2 w-full bg-[#222222] rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-75 ${
                    audioLevel > 75 ? 'bg-rose-500' : audioLevel > 40 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(audioLevel > 0 ? 8 : 0, audioLevel))}%` }}
                />
              </div>
            </div>

            {/* Input Device Selection Dropdown */}
            {audioDevices.length > 0 && (
              <div className="pt-2 border-t border-[#222222] space-y-1.5">
                <span className="text-[11px] text-zinc-400 block font-mono">Input Microphone Device:</span>
                <div className="relative">
                  <select
                    value={activeAudioDevice !== null && activeAudioDevice !== undefined ? String(activeAudioDevice) : ''}
                    onChange={(e) => onSelectAudioDevice(e.target.value)}
                    className="w-full bg-[#18181b] hover:bg-[#202024] border border-[#2a2a30] rounded-lg pl-3 pr-8 py-2 text-zinc-200 text-xs outline-none focus:border-[#3B82F6] font-mono appearance-none transition-colors cursor-pointer"
                  >
                    {audioDevices.map((d: any) => (
                      <option key={String(d.index)} value={String(d.index)}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* 2-Way Intercom Camera Speaker Output Selection */}
            {speakerDevices.length > 0 && (
              <div className="pt-2 border-t border-[#222222] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 font-mono">Camera Speaker Output (2-Way Talk):</span>
                  {isTalking && (
                    <span className="text-[9px] font-mono text-rose-400 animate-pulse font-semibold">● ACTIVE</span>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={activeSpeakerDevice !== null && activeSpeakerDevice !== undefined ? String(activeSpeakerDevice) : ''}
                    onChange={(e) => setSpeakerDevice(e.target.value)}
                    className="w-full bg-[#18181b] hover:bg-[#202024] border border-[#2a2a30] rounded-lg pl-3 pr-8 py-2 text-zinc-200 text-xs outline-none focus:border-[#3B82F6] font-mono appearance-none transition-colors cursor-pointer"
                  >
                    {speakerDevices.map((d: any) => (
                      <option key={String(d.index)} value={String(d.index)}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Adjustments Modal Overlay */}
      {showAdjustmentsModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setShowAdjustmentsModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141417]/95 backdrop-blur-md p-4 shadow-2xl z-50 space-y-3.5 font-sans text-xs animate-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#262626] pb-2">
              <div className="flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-[#3B82F6]" />
                <span className="font-semibold text-white">Camera Adjustments</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAdjustments}
                  className="text-[10px] font-mono text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-[#1a1a1e] border border-[#2c2c30]"
                  title="Reset all adjustments to normal defaults"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdjustmentsModal(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 1. Orientation & Flip */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Orientation & Flip
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateAdjustments({ flip_h: !flipH })}
                  className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                    flipH ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="h-4 w-4 text-[#3B82F6]" />
                  <span className="text-[10px] font-mono">Flip H</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateAdjustments({ flip_v: !flipV })}
                  className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                    flipV ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                  }`}
                >
                  <FlipVertical className="h-4 w-4 text-[#3B82F6]" />
                  <span className="text-[10px] font-mono">Flip V</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateAdjustments({ rotation: (rotation + 90) % 360 })}
                  className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 transition-colors ${
                    rotation !== 0 ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-white' : 'border-[#262626] bg-[#1a1a1e] text-zinc-400 hover:text-white'
                  }`}
                >
                  <RotateCw className="h-4 w-4 text-emerald-400" />
                  <span className="text-[10px] font-mono">{rotation}°</span>
                </button>
              </div>
            </div>

            {/* 2. Digital Zoom & Crop */}
            <div className="space-y-2 pt-1 border-t border-[#262626]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <ZoomIn className="h-3.5 w-3.5 text-[#3B82F6]" /> Digital Zoom / Crop
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
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
              />

              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[1.0, 1.25, 1.5, 2.0, 2.5].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => updateAdjustments({ zoom: z, pan_x: z === 1.0 ? 0 : panX, pan_y: z === 1.0 ? 0 : panY })}
                    className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                      Math.abs(zoom - z) < 0.04
                        ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                        : 'bg-[#1a1a1e] text-zinc-400 border-[#262626] hover:text-white'
                    }`}
                  >
                    {z === 1.0 ? '1.0x (Fit)' : `${z}x`}
                  </button>
                ))}
              </div>

              {zoom > 1.05 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1"><Move className="h-3 w-3 text-cyan-400" /> Pan X / Y</span>
                    <span>X: {panX}% • Y: {panY}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5 text-amber-400" /> Brightness</span>
                  <span className="font-mono text-white">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={brightness}
                  onChange={(e) => updateAdjustments({ brightness: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5"><Contrast className="h-3.5 w-3.5 text-purple-400" /> Contrast</span>
                  <span className="font-mono text-white">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={contrast}
                  onChange={(e) => updateAdjustments({ contrast: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-emerald-400" /> Saturation</span>
                  <span className="font-mono text-white">{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={saturation}
                  onChange={(e) => updateAdjustments({ saturation: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Camera Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(camToDelete)}
        title="Delete Camera Stream"
        message={
          <p>
            Are you sure you want to delete camera <strong className="text-white">"{camToDelete}"</strong>?
            This will stop the stream connection and remove the camera from active surveillance.
          </p>
        }
        confirmText="Delete Camera"
        isLoading={isDeletingCam}
        variant="danger"
        onConfirm={handleConfirmDeleteCamera}
        onClose={() => setCamToDelete(null)}
      />
    </div>
  );
};
