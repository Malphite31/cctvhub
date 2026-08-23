import React, { useState, useEffect } from 'react';
import {
  Activity,
  Camera,
  Video,
  Zap,
  FileText,
  Sliders,
  Clock,
  CheckCircle2,
  X,
  Eye,
  Play
} from 'lucide-react';

interface MotionSettings {
  enabled: boolean;
  sensitivity: number; // 1-100
  action: 'snapshot' | 'record' | 'both' | 'log_only';
  cooldown_seconds: number;
  record_duration_seconds: number;
  highlight_boxes: boolean;
}

interface MotionDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraId: string;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const MotionDetectionModal: React.FC<MotionDetectionModalProps> = ({
  isOpen,
  onClose,
  cameraId,
  onShowToast
}) => {
  const [settings, setSettings] = useState<MotionSettings>({
    enabled: true,
    sensitivity: 50,
    action: 'both',
    cooldown_seconds: 10,
    record_duration_seconds: 15,
    highlight_boxes: true
  });
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, cameraId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/motion/settings?camera_id=${encodeURIComponent(cameraId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch motion settings:', err);
    }
  };

  const handleSave = async (updated?: Partial<MotionSettings>) => {
    const toSave = { ...settings, ...(updated || {}) };
    setSettings(toSave);
    try {
      const res = await fetch('/api/motion/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_id: cameraId,
          ...toSave
        })
      });
      if (res.ok) {
        if (onShowToast) onShowToast('Motion detector settings saved');
      } else {
        if (onShowToast) onShowToast('Failed to update motion settings', true);
      }
    } catch (err) {
      if (onShowToast) onShowToast('Error connecting to motion server', true);
    }
  };

  const handleTestTrigger = async () => {
    setIsTesting(true);
    try {
      const res = await fetch(`/api/motion/test-trigger?camera_id=${encodeURIComponent(cameraId)}`, {
        method: 'POST'
      });
      if (res.ok) {
        if (onShowToast) onShowToast(`Test motion trigger executed for CAM ${cameraId}`);
      } else {
        if (onShowToast) onShowToast('Test trigger failed: Camera not ready', true);
      }
    } catch (err) {
      if (onShowToast) onShowToast('Error triggering test motion', true);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none font-sans">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#121215] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222226] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Motion Detection & Trigger Actions</h3>
              <p className="text-[11px] text-zinc-400 font-mono">Camera ID: CAM {cameraId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181c] border border-[#282830]">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white block">Enable Motion Detection</span>
            <span className="text-[10px] text-zinc-400">Continuously analyze video frames for movement</span>
          </div>
          <button
            type="button"
            onClick={() => handleSave({ enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? 'bg-[#3B82F6]' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Trigger Action Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-200 block">
            Automated Action on Motion Trigger
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Both: Snapshot + Video */}
            <button
              type="button"
              onClick={() => handleSave({ action: 'both' })}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                settings.action === 'both'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white ring-1 ring-[#3B82F6]'
                  : 'border-[#26262a] bg-[#161619] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>Snapshot + Video</span>
                </div>
                {settings.action === 'both' && <CheckCircle2 className="h-3.5 w-3.5 text-[#3B82F6]" />}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Saves high-res snapshot & records a full video clip
              </p>
            </button>

            {/* Snapshot Only */}
            <button
              type="button"
              onClick={() => handleSave({ action: 'snapshot' })}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                settings.action === 'snapshot'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white ring-1 ring-[#3B82F6]'
                  : 'border-[#26262a] bg-[#161619] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Camera className="h-4 w-4 text-cyan-400" />
                  <span>Snapshot Only</span>
                </div>
                {settings.action === 'snapshot' && <CheckCircle2 className="h-3.5 w-3.5 text-[#3B82F6]" />}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Captures instant high-res JPEG image
              </p>
            </button>

            {/* Video Record Only */}
            <button
              type="button"
              onClick={() => handleSave({ action: 'record' })}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                settings.action === 'record'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white ring-1 ring-[#3B82F6]'
                  : 'border-[#26262a] bg-[#161619] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Video className="h-4 w-4 text-rose-400" />
                  <span>Record Video Clip</span>
                </div>
                {settings.action === 'record' && <CheckCircle2 className="h-3.5 w-3.5 text-[#3B82F6]" />}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Records H.264 video file ({settings.record_duration_seconds}s)
              </p>
            </button>

            {/* Log Event Only */}
            <button
              type="button"
              onClick={() => handleSave({ action: 'log_only' })}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                settings.action === 'log_only'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white ring-1 ring-[#3B82F6]'
                  : 'border-[#26262a] bg-[#161619] text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <FileText className="h-4 w-4 text-purple-400" />
                  <span>Log Event Only</span>
                </div>
                {settings.action === 'log_only' && <CheckCircle2 className="h-3.5 w-3.5 text-[#3B82F6]" />}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Logs event in database without saving media files
              </p>
            </button>
          </div>
        </div>

        {/* Sliders Section */}
        <div className="space-y-4 pt-2 border-t border-[#222226]">
          {/* Motion Sensitivity */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#3B82F6]" />
                Motion Sensitivity
              </span>
              <span className="font-mono text-white font-semibold bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                {settings.sensitivity}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="95"
              value={settings.sensitivity}
              onChange={(e) => setSettings({ ...settings, sensitivity: Number(e.target.value) })}
              onMouseUp={() => handleSave()}
              onTouchEnd={() => handleSave()}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Low (Large movements)</span>
              <span>Medium (50%)</span>
              <span>High (Subtle movement)</span>
            </div>
          </div>

          {/* Video Recording Duration (when record or both is active) */}
          {(settings.action === 'record' || settings.action === 'both') && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-rose-400" />
                  Motion Video Clip Duration
                </span>
                <span className="font-mono text-white font-semibold bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                  {settings.record_duration_seconds} Seconds
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={settings.record_duration_seconds}
                onChange={(e) => setSettings({ ...settings, record_duration_seconds: Number(e.target.value) })}
                onMouseUp={() => handleSave()}
                onTouchEnd={() => handleSave()}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>5s Short Clip</span>
                <span>15s Standard</span>
                <span>60s Extended</span>
              </div>
            </div>
          )}

          {/* Trigger Cooldown */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Trigger Cooldown Window
              </span>
              <span className="font-mono text-white font-semibold bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                {settings.cooldown_seconds} Seconds
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={settings.cooldown_seconds}
              onChange={(e) => setSettings({ ...settings, cooldown_seconds: Number(e.target.value) })}
              onMouseUp={() => handleSave()}
              onTouchEnd={() => handleSave()}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 block">
              Minimum delay between automated snapshots/recordings during continuous motion.
            </span>
          </div>

          {/* Show Motion Boxes Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#16161a] border border-[#242428]">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-zinc-200">Highlight Motion Boxes on Live Video Feed</span>
            </div>
            <button
              type="button"
              onClick={() => handleSave({ highlight_boxes: !settings.highlight_boxes })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                settings.highlight_boxes ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  settings.highlight_boxes ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#222226]">
          <button
            type="button"
            onClick={handleTestTrigger}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{isTesting ? 'Testing Trigger...' : 'Test Motion Trigger'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold shadow-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
