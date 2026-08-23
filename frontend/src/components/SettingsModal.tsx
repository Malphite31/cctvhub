import React, { useState, useEffect } from 'react';
import {
  CameraDevice,
  S3Config,
  SambaConfig,
} from '../types';
import { CameraEditModal } from './CameraEditModal';
import { ConfirmModal } from './ConfirmModal';
import {
  Settings as SettingsIcon,
  X,
  ShieldCheck,
  Globe,
  Cloud,
  Server,
  CheckCircle2,
  AlertCircle,
  Mic,
  Video,
  User,
  KeyRound,
  ShieldAlert,
  Copy,
  Check,
  Lock,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  CameraOff,
  ChevronDown,
  ScanFace,
  Eye,
  Activity
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: CameraDevice[];
  activeDevice: string;
  onSelectDevice: (dev: string) => void;
  audioDevices: any[];
  activeAudioDevice: number | string | null;
  onSelectAudioDevice: (index: any) => void;
  cloudflareStatus?: string;
  onRefreshStorageLocation: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
  userRole?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  devices,
  activeDevice,
  onSelectDevice,
  audioDevices,
  activeAudioDevice,
  onSelectAudioDevice,
  cloudflareStatus = 'Online',
  onRefreshStorageLocation,
  onShowToast,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [activeTab, setActiveTab] = useState<'security' | 'vision' | 's3' | 'samba' | 'hardware'>('security');
  const [camToDelete, setCamToDelete] = useState<CameraDevice | null>(null);
  const [isDeletingCam, setIsDeletingCam] = useState(false);

  // Vision & AI Tracker Settings State
  const [visionSettings, setVisionSettings] = useState({
    enabled: true,
    detect_faces: false,
    detect_motion: true,
    show_bounding_boxes: true,
    show_corner_markers: true,
    show_center_reticles: true,
    show_metadata_tags: true,
    show_motion_vectors: true,
    hud_theme: 'cyber_blue',
  });

  // User Profile & Security State
  const [username, setUsername] = useState(() => localStorage.getItem('cctv_username') || 'admin');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('cctv_display_name') || 'Administrator');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorPin, setTwoFactorPin] = useState(() => localStorage.getItem('cctv_2fa_pin') || '');
  const [enable2FA, setEnable2FA] = useState(() => localStorage.getItem('cctv_enable_2fa') === 'true');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cctv_api_token') || 'cctv_sec_live_9f83a02e1b4c67');
  const [copiedKey, setCopiedKey] = useState(false);

  // S3 State
  const [s3Config, setS3Config] = useState<S3Config>({
    enabled: false,
    endpoint_url: '',
    access_key: '',
    secret_key: '',
    bucket_name: '',
    region: 'us-east-1',
    auto_upload: false,
  });
  const [s3Testing, setS3Testing] = useState(false);
  const [s3TestMsg, setS3TestMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Samba State
  const [sambaConfig, setSambaConfig] = useState<SambaConfig>({
    enabled: false,
    host: '',
    share: '',
    username: '',
    password: '',
    local_mount_path: '',
    auto_sync: false,
  });
  const [sambaTesting, setSambaTesting] = useState(false);
  const [sambaTestMsg, setSambaTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Camera Settings State
  const [camResolution, setCamResolution] = useState('1920x1080');
  const [camBrightness, setCamBrightness] = useState(50);
  const [camContrast, setCamContrast] = useState(50);

  // Camera Management Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleOpenEdit = (e: React.MouseEvent, cam: CameraDevice) => {
    e.stopPropagation();
    setEditingCamera(cam);
    setIsCameraModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingCamera(null);
    setIsCameraModalOpen(true);
  };

  const handleDeleteCamera = (e: React.MouseEvent, cam: CameraDevice) => {
    e.stopPropagation();
    setCamToDelete(cam);
  };

  const handleConfirmDeleteCamera = async () => {
    if (!camToDelete) return;
    setIsDeletingCam(true);
    const cam = camToDelete;
    try {
      const camId = cam.device;
      const res = await fetch(`/api/cameras/${encodeURIComponent(camId)}`, { method: 'DELETE' });
      if (res.ok) {
        onShowToast(`Camera "${cam.name}" deleted`);
        setCamToDelete(null);
        onRefreshStorageLocation();
      } else {
        const postRes = await fetch('/api/cameras/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: camId, device: cam.device, name: cam.name }),
        });
        if (postRes.ok) {
          onShowToast(`Camera "${cam.name}" deleted`);
          setCamToDelete(null);
          onRefreshStorageLocation();
        } else {
          onShowToast('Failed to delete camera', true);
        }
      }
    } catch {
      onShowToast('Error deleting camera', true);
    } finally {
      setIsDeletingCam(false);
    }
  };

  const handleScanHardware = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/cameras/scan', { method: 'POST' });
      if (res.ok) {
        onShowToast('Hardware scan completed');
        onRefreshStorageLocation();
      }
    } catch {
      onShowToast('Error scanning hardware', true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSetResolution = async (resStr: string) => {
    setCamResolution(resStr);
    const parts = resStr.split('x');
    const w = parseInt(parts[0], 10) || 1920;
    const h = parseInt(parts[1], 10) || 1080;
    const fps = 60;

    try {
      const res = await fetch(`/api/stream/resolution?dev=${encodeURIComponent(activeDevice)}&width=${w}&height=${h}&fps=${fps}`, {
        method: 'POST'
      });
      if (res.ok) {
        onShowToast(`Resolution set to ${resStr}`);
      }
    } catch {}
  };

  const handleSetAdjustments = async (newB: number, newC: number) => {
    setCamBrightness(newB);
    setCamContrast(newC);
    try {
      await fetch(`/api/stream/adjustments?dev=${activeDevice}&brightness=${newB}&contrast=${newC}`, {
        method: 'POST'
      });
    } catch {}
  };

  // Fetch configs on open
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/storage/s3/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setS3Config(data.config);
      })
      .catch(() => {});

    fetch('/api/storage/samba/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setSambaConfig(data.config);
      })
      .catch(() => {});

    fetch('/api/stream/tracker-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) setVisionSettings((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, [isOpen, activeTab]);

  const handleUpdateVisionSetting = async (key: string, value: any) => {
    const updated = { ...visionSettings, [key]: value };
    setVisionSettings(updated);
    try {
      const res = await fetch('/api/stream/tracker-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        if (key === 'detect_faces') {
          onShowToast(value ? 'Facial recognition engine enabled' : 'Facial recognition disabled (Power Saving Mode)');
        } else if (key === 'detect_motion') {
          onShowToast(value ? 'Motion detection engine enabled' : 'Motion detection disabled');
        } else {
          onShowToast('Vision HUD settings updated');
        }
      }
    } catch {
      onShowToast('Failed to update vision settings', true);
    }
  };

  const handleSaveProfileAndSecurity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword) {
      if (!currentPassword) {
        onShowToast('Please enter your current password', true);
        return;
      }
      if (newPassword !== confirmPassword) {
        onShowToast('New passwords do not match', true);
        return;
      }
      if (newPassword.length < 4) {
        onShowToast('Password must be at least 4 characters', true);
        return;
      }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            current_password: currentPassword.trim(),
            new_password: newPassword.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          onShowToast(data.detail || 'Password change failed', true);
          return;
        }

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onShowToast('Password updated successfully');
      } catch {
        onShowToast('Error connecting to authentication service', true);
        return;
      }
    }

    if (enable2FA && twoFactorPin.length !== 6) {
      onShowToast('2FA Security PIN must be 6 digits', true);
      return;
    }

    try {
      localStorage.setItem('cctv_username', username);
      localStorage.setItem('cctv_display_name', displayName);
      localStorage.setItem('cctv_enable_2fa', String(enable2FA));
      if (twoFactorPin) {
        localStorage.setItem('cctv_2fa_pin', twoFactorPin);
      }
      if (!newPassword) {
        onShowToast('User profile & security settings updated');
      }
    } catch {
      onShowToast('Failed to save security settings', true);
    }
  };

  const handleRegenerateApiKey = () => {
    const newKey = 'cctv_sec_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setApiKey(newKey);
    localStorage.setItem('cctv_api_token', newKey);
    onShowToast('Generated new surveillance API security token');
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    onShowToast('API token copied to clipboard');
  };

  const handleSaveS3 = async () => {
    try {
      const res = await fetch('/api/storage/s3/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s3Config)
      });
      if (res.ok) {
        onShowToast('S3 cloud configuration saved');
      }
    } catch {
      onShowToast('Failed to save S3 configuration', true);
    }
  };

  const handleTestS3 = async () => {
    setS3Testing(true);
    setS3TestMsg(null);
    try {
      const res = await fetch('/api/storage/s3/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s3Config)
      });
      const data = await res.json();
      if (data.success) {
        setS3TestMsg({ success: true, text: data.message || 'Connected to S3 bucket successfully!' });
      } else {
        setS3TestMsg({ success: false, text: data.error || 'Connection failed. Check credentials.' });
      }
    } catch (e: any) {
      setS3TestMsg({ success: false, text: e.message || 'Error testing S3 connection.' });
    } finally {
      setS3Testing(false);
    }
  };

  const handleSaveSamba = async () => {
    try {
      const res = await fetch('/api/storage/samba/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sambaConfig)
      });
      if (res.ok) {
        onShowToast('Samba configuration saved');
      }
    } catch {
      onShowToast('Failed to save Samba configuration', true);
    }
  };

  const handleTestSamba = async () => {
    setSambaTesting(true);
    setSambaTestMsg(null);
    try {
      const res = await fetch('/api/storage/samba/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sambaConfig)
      });
      const data = await res.json();
      if (data.success) {
        setSambaTestMsg({ success: true, text: data.message || 'Connected to Samba share successfully!' });
      } else {
        setSambaTestMsg({ success: false, text: data.error || 'Connection failed.' });
      }
    } catch (e: any) {
      setSambaTestMsg({ success: false, text: e.message || 'Error testing Samba share.' });
    } finally {
      setSambaTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh] overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-blue-500" />
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
              System Settings & Security
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Close Modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Responsive Horizontal Scrollable Tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/30 overflow-x-auto shrink-0 no-scrollbar">
          {(isViewer
            ? [{ id: 'security', label: 'My Account', icon: KeyRound }]
            : [
                { id: 'security', label: 'Account & Security', icon: KeyRound },
                { id: 'vision', label: 'AI & Vision', icon: ScanFace },
                { id: 's3', label: 'Cloud S3', icon: Cloud },
                { id: 'samba', label: 'Samba NAS', icon: Server },
                { id: 'hardware', label: 'Devices', icon: Video },
              ]
          ).map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
          {/* TAB 1: HARDWARE DEVICES */}
          {activeTab === 'hardware' && (
            <div className="space-y-3 text-xs">
              {/* Cameras */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">
                      Video Cameras ({devices.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleScanHardware}
                      disabled={isScanning}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 text-purple-400 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>{isScanning ? 'Scanning...' : 'Scan Hardware'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAdd}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-medium transition-colors shadow-xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Camera</span>
                    </button>
                  </div>
                </div>

                {/* Camera List or Empty State */}
                {devices.length === 0 ? (
                  <div className="p-6 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/60 text-center space-y-2">
                    <CameraOff className="h-8 w-8 text-zinc-600 mx-auto" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-xs text-zinc-300">No Cameras Configured</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Add a USB camera index or an RTSP network stream link.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAdd}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-mono transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Camera Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {devices.map((d) => {
                      const isActive = activeDevice === d.device;
                      return (
                        <div
                          key={d.device}
                          onClick={() => {
                            onSelectDevice(d.device);
                            onShowToast(`Switched active camera to ${d.name}`);
                          }}
                          className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                            isActive
                              ? 'border-blue-500 bg-blue-600/10 text-white'
                              : 'border-zinc-800/80 bg-zinc-950 hover:bg-zinc-900 text-zinc-300'
                          }`}
                        >
                          <div className="truncate min-w-0 pr-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                              <p className="font-medium text-xs text-zinc-200 truncate">{d.name}</p>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block truncate">
                              ID: {d.device} • {d.resolution || '1080p'} @ {d.fps || 60} FPS
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                isActive ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {isActive ? 'ACTIVE' : 'SELECT'}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(e, d)}
                              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                              title="Edit Camera"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteCamera(e, d)}
                              className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition-colors"
                              title="Delete Camera"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Active Camera Resolution & Picture Quality */}
                {devices.length > 0 && (() => {
                  const activeCamObj = devices.find(d => d.device === activeDevice);
                  const activeCamResolutions = (activeCamObj?.supported_resolutions && activeCamObj.supported_resolutions.length > 0)
                    ? activeCamObj.supported_resolutions
                    : (activeCamObj?.resolutions && activeCamObj.resolutions.length > 0)
                      ? activeCamObj.resolutions.map(r => ({ label: r, value: r.includes('(') ? (r.match(/\((.*?)\)/)?.[1] || r) : r, fps: `${activeCamObj.fps || 60} FPS` }))
                      : [
                          { label: '1080p FHD (1920x1080)', value: '1920x1080', fps: '60 FPS' },
                          { label: '720p HD (1280x720)', value: '1280x720', fps: '60 FPS' },
                          { label: 'VGA (640x480)', value: '640x480', fps: '60 FPS' },
                        ];

                  return (
                    <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                        <span>Camera Stream Resolution (Dev {activeDevice}):</span>
                        <span className="text-blue-400 font-bold">{camResolution}</span>
                      </div>
                      <div className="relative">
                        <select
                          value={camResolution}
                          onChange={(e) => handleSetResolution(e.target.value)}
                          className="w-full bg-[#18181b] hover:bg-[#202024] border border-[#2a2a30] rounded-lg pl-3 pr-8 py-2 text-zinc-200 text-xs font-mono outline-none cursor-pointer appearance-none transition-colors"
                        >
                          {activeCamResolutions.map((res) => (
                            <option key={res.value} value={res.value}>
                              {res.label} • {res.fps}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Brightness</span>
                            <span>{camBrightness}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={camBrightness}
                            onChange={(e) => handleSetAdjustments(Number(e.target.value), camContrast)}
                            className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Contrast</span>
                            <span>{camContrast}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={camContrast}
                            onChange={(e) => handleSetAdjustments(camBrightness, Number(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Microphones */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">Microphone Inputs</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">{audioDevices.length} Connected</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {audioDevices.map((mic) => {
                    const isSelected = activeAudioDevice !== null && activeAudioDevice !== undefined && String(activeAudioDevice) === String(mic.index);
                    return (
                      <div
                        key={String(mic.index)}
                        onClick={() => {
                          onSelectAudioDevice(mic.index);
                          onShowToast(`Switched microphone to ${mic.name}`);
                        }}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-600/10 text-white'
                            : 'border-zinc-800/80 bg-zinc-950 hover:bg-zinc-900 text-zinc-300'
                        }`}
                      >
                        <div className="truncate min-w-0 pr-2">
                          <p className="font-medium text-xs text-zinc-200 truncate">{mic.name}</p>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Device: {mic.index} • {mic.channels} ch • {mic.default_samplerate}Hz
                          </span>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isSelected ? 'ACTIVE' : 'SELECT'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tunnel Status */}
              <div className="p-2.5 rounded border border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="font-medium text-zinc-200">Cloudflare Tunnel Engine</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Zero-trust remote surveillance link</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  <ShieldCheck className="h-3 w-3" />
                  {cloudflareStatus}
                </span>
              </div>
            </div>
          )}

          {/* TAB: AI & VISION ANALYTICS */}
          {activeTab === 'vision' && (
            <div className="space-y-3 text-xs">
              {/* Facial Recognition Master Feature Toggle */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                      visionSettings.detect_faces 
                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                    }`}>
                      <ScanFace className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-100 font-mono text-xs uppercase tracking-wide">
                          Biometric Facial Recognition Engine
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                          visionSettings.detect_faces
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                        }`}>
                          {visionSettings.detect_faces ? 'Active • 15 FPS Inference' : 'Disabled • Low CPU / Eco'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Scans camera video streams in real-time against enrolled biometric face profiles. Disable this feature to minimize host CPU consumption and reduce temperatures on low-power hardware.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={visionSettings.detect_faces}
                      onChange={(e) => handleUpdateVisionSetting('detect_faces', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Motion Detection Master Feature Toggle */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                      visionSettings.detect_motion 
                        ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                    }`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-100 font-mono text-xs uppercase tracking-wide">
                          Real-time Motion Detection
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                          visionSettings.detect_motion
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                        }`}>
                          {visionSettings.detect_motion ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Monitors motion vector triggers to automate instant DVR snapshot captures and cloud recordings.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={visionSettings.detect_motion}
                      onChange={(e) => handleUpdateVisionSetting('detect_motion', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* HUD Visual Markers & Overlay Switches */}
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-purple-400" />
                    <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">
                      HUD Overlays & Tactical Visuals
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] text-zinc-400 font-mono">Master HUD:</span>
                    <input
                      type="checkbox"
                      checked={visionSettings.enabled}
                      onChange={(e) => handleUpdateVisionSetting('enabled', e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-850">
                    <span className="text-zinc-300 font-mono text-[11px]">Bounding Boxes</span>
                    <input
                      type="checkbox"
                      checked={visionSettings.show_bounding_boxes}
                      onChange={(e) => handleUpdateVisionSetting('show_bounding_boxes', e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-850">
                    <span className="text-zinc-300 font-mono text-[11px]">Center Reticles</span>
                    <input
                      type="checkbox"
                      checked={visionSettings.show_center_reticles}
                      onChange={(e) => handleUpdateVisionSetting('show_center_reticles', e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-850">
                    <span className="text-zinc-300 font-mono text-[11px]">Corner Markers</span>
                    <input
                      type="checkbox"
                      checked={visionSettings.show_corner_markers}
                      onChange={(e) => handleUpdateVisionSetting('show_corner_markers', e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-850">
                    <span className="text-zinc-300 font-mono text-[11px]">Metadata Tags</span>
                    <input
                      type="checkbox"
                      checked={visionSettings.show_metadata_tags}
                      onChange={(e) => handleUpdateVisionSetting('show_metadata_tags', e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER ACCOUNT & SECURITY */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveProfileAndSecurity} className="space-y-3 text-xs">
              {/* Profile Information */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-zinc-800/60">
                  <User className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">
                    Administrator Profile
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Yasuo"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Username / Operator ID</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Password Management */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-zinc-800/60">
                  <Lock className="h-3.5 w-3.5 text-purple-400" />
                  <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">
                    Security Credentials & Password
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2FA PIN Protection & Session Keys */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-semibold text-zinc-200 font-mono text-[11px] uppercase">
                      2-Factor PIN Protection
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[10px] font-mono text-zinc-400">Require PIN for DVR Delete</span>
                    <input
                      type="checkbox"
                      checked={enable2FA}
                      onChange={(e) => setEnable2FA(e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600 rounded"
                    />
                  </label>
                </div>

                {enable2FA && (
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">6-Digit Security PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={twoFactorPin}
                      onChange={(e) => setTwoFactorPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-40 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs font-mono tracking-widest text-center focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* API Security Token */}
                <div className="pt-2 border-t border-zinc-800/60">
                  <label className="block text-[10px] font-mono text-zinc-400 mb-1">Surveillance API Security Token</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={apiKey}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[11px] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono transition-colors"
                      title="Copy Token"
                    >
                      {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateApiKey}
                      className="px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-blue-400 text-[11px] font-mono transition-colors"
                      title="Regenerate Token"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-medium rounded text-xs transition-colors shadow-xs"
                >
                  Save Profile & Security
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: S3 CLOUD */}
          {activeTab === 's3' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded border border-zinc-800 bg-zinc-900/40">
                <div>
                  <span className="font-medium text-zinc-200">Enable S3 Cloud Backup</span>
                  <p className="text-[10px] text-zinc-400 font-mono">AWS S3, Cloudflare R2, MinIO, Wasabi</p>
                </div>
                <input
                  type="checkbox"
                  checked={s3Config.enabled}
                  onChange={(e) => setS3Config({ ...s3Config, enabled: e.target.checked })}
                  className="h-4 w-4 accent-blue-600 rounded"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    S3 Endpoint URL <span className="text-zinc-500 font-normal">(Optional for standard AWS S3)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://<accountid>.r2.cloudflarestorage.com"
                    value={s3Config.endpoint_url}
                    onChange={(e) => setS3Config({ ...s3Config, endpoint_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Bucket Name</label>
                    <input
                      type="text"
                      placeholder="cctv-recordings"
                      value={s3Config.bucket_name}
                      onChange={(e) => setS3Config({ ...s3Config, bucket_name: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Region</label>
                    <input
                      type="text"
                      placeholder="us-east-1"
                      value={s3Config.region}
                      onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Access Key ID</label>
                    <input
                      type="text"
                      placeholder="AKIA..."
                      value={s3Config.access_key}
                      onChange={(e) => setS3Config({ ...s3Config, access_key: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={s3Config.secret_key}
                      onChange={(e) => setS3Config({ ...s3Config, secret_key: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded border border-zinc-800 bg-zinc-900/30">
                  <span className="text-xs text-zinc-300 font-mono">Auto-upload new recordings to S3</span>
                  <input
                    type="checkbox"
                    checked={s3Config.auto_upload}
                    onChange={(e) => setS3Config({ ...s3Config, auto_upload: e.target.checked })}
                    className="h-4 w-4 accent-blue-600 rounded"
                  />
                </div>
              </div>

              {s3TestMsg && (
                <div className={`p-2 rounded text-xs flex items-center gap-2 ${s3TestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                  {s3TestMsg.success ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                  <span>{s3TestMsg.text}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleTestS3}
                  disabled={s3Testing}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded font-mono transition-colors text-xs"
                >
                  {s3Testing ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveS3}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-medium rounded transition-colors text-xs shadow-xs"
                >
                  Save S3 Settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: SAMBA / NAS */}
          {activeTab === 'samba' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded border border-zinc-800 bg-zinc-900/40">
                <div>
                  <span className="font-medium text-zinc-200">Enable Samba / SMB Replication</span>
                  <p className="text-[10px] text-zinc-400 font-mono">Replicate clips to Synology, TrueNAS, or network share</p>
                </div>
                <input
                  type="checkbox"
                  checked={sambaConfig.enabled}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, enabled: e.target.checked })}
                  className="h-4 w-4 accent-blue-600 rounded"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Local Mount / Mapped Network Path
                  </label>
                  <input
                    type="text"
                    placeholder="/mnt/samba/cctv or \\NAS\cctv"
                    value={sambaConfig.local_mount_path}
                    onChange={(e) => setSambaConfig({ ...sambaConfig, local_mount_path: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">SMB Host / Server IP</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100 or truenas.local"
                      value={sambaConfig.host}
                      onChange={(e) => setSambaConfig({ ...sambaConfig, host: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Share Name</label>
                    <input
                      type="text"
                      placeholder="cctv_storage"
                      value={sambaConfig.share}
                      onChange={(e) => setSambaConfig({ ...sambaConfig, share: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">SMB Username</label>
                    <input
                      type="text"
                      placeholder="admin or smbuser"
                      value={sambaConfig.username}
                      onChange={(e) => setSambaConfig({ ...sambaConfig, username: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">SMB Password</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={sambaConfig.password || ''}
                      onChange={(e) => setSambaConfig({ ...sambaConfig, password: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded border border-zinc-800 bg-zinc-900/30">
                  <span className="text-xs text-zinc-300 font-mono">Auto-sync new recordings to Samba</span>
                  <input
                    type="checkbox"
                    checked={sambaConfig.auto_sync}
                    onChange={(e) => setSambaConfig({ ...sambaConfig, auto_sync: e.target.checked })}
                    className="h-4 w-4 accent-blue-600 rounded"
                  />
                </div>
              </div>

              {sambaTestMsg && (
                <div className={`p-2 rounded text-xs flex items-center gap-2 ${sambaTestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                  {sambaTestMsg.success ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                  <span>{sambaTestMsg.text}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleTestSamba}
                  disabled={sambaTesting}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded font-mono transition-colors text-xs"
                >
                  {sambaTesting ? 'Testing...' : 'Test Share'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveSamba}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-medium rounded transition-colors text-xs shadow-xs"
                >
                  Save Samba Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-3.5 py-2 border-t border-zinc-800 bg-zinc-900/60 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded border border-zinc-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Camera Add / Edit Modal */}
      <CameraEditModal
        isOpen={isCameraModalOpen}
        onClose={() => {
          setIsCameraModalOpen(false);
          setEditingCamera(null);
        }}
        camera={editingCamera}
        onSaved={onRefreshStorageLocation}
      />

      {/* Delete Camera Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(camToDelete)}
        title="Delete Camera"
        message={
          <p>
            Are you sure you want to delete camera <strong className="text-white">"{camToDelete?.name}"</strong> ({camToDelete?.device})?
            This will permanently remove the camera configuration and stop the video feed.
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
