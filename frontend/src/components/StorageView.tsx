import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderOpen,
  FolderSearch,
  Cloud,
  Server,
  CheckCircle2,
  AlertCircle,
  Layers,
  Trash2,
  Film,
  Image as ImageIcon
} from 'lucide-react';
import { StorageLocationInfo, S3Config, SambaConfig } from '../types';
import { DirectoryPickerModal } from './DirectoryPickerModal';
import { ConfirmModal } from './ConfirmModal';

interface StorageViewProps {
  storageLocation: StorageLocationInfo | null;
  onRefresh: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
  userRole?: string;
}

export const StorageView: React.FC<StorageViewProps> = ({
  storageLocation,
  onRefresh,
  onShowToast,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [customPath, setCustomPath] = useState('');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [currentTargetMode, setCurrentTargetMode] = useState<'local' | 'samba' | 's3' | 'all'>('local');
  const [purgeLocal, setPurgeLocal] = useState<boolean>(false);

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
  const [purgeTarget, setPurgeTarget] = useState<'recordings' | 'snapshots' | 'all' | null>(null);

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    try {
      const endpoint =
        purgeTarget === 'recordings'
          ? '/api/storage/clear/recordings'
          : purgeTarget === 'snapshots'
          ? '/api/storage/clear/snapshots'
          : '/api/storage/clear/all';

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        onShowToast(
          purgeTarget === 'recordings'
            ? `Purged ${data.deleted_count || 0} video recording(s) from storage`
            : purgeTarget === 'snapshots'
            ? `Purged ${data.deleted_count || 0} snapshot photo(s) from storage`
            : `Purged ${data.total_deleted || 0} total media files from storage`
        );
        onRefresh();
      } else {
        onShowToast('Failed to purge media files from storage', true);
      }
    } catch {
      onShowToast('Error purging storage media', true);
    } finally {
      setPurgeTarget(null);
    }
  };

  useEffect(() => {
    if (storageLocation) {
      if (storageLocation.recordings_path) {
        setCustomPath(storageLocation.recordings_path);
      }
      if (storageLocation.target_mode) {
        setCurrentTargetMode(storageLocation.target_mode);
      }
      if (storageLocation.purge_local_after_upload !== undefined) {
        setPurgeLocal(storageLocation.purge_local_after_upload);
      }
    }
  }, [storageLocation?.recordings_path, storageLocation?.target_mode, storageLocation?.purge_local_after_upload]);

  useEffect(() => {
    fetch('/api/storage/s3/config')
      .then((r) => r.json())
      .then((d) => { if (d.config) setS3Config(d.config); })
      .catch(() => {});
    fetch('/api/storage/samba/config')
      .then((r) => r.json())
      .then((d) => { if (d.config) setSambaConfig(d.config); })
      .catch(() => {});
  }, []);

  const handleUpdateTargetMode = async (mode: 'local' | 'samba' | 's3' | 'all', purge: boolean) => {
    setCurrentTargetMode(mode);
    setPurgeLocal(purge);
    try {
      const res = await fetch('/api/storage/target-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_mode: mode, purge_local_after_upload: purge })
      });
      if (res.ok) {
        const modeLabels: Record<string, string> = {
          local: 'Local Storage Only',
          samba: 'Samba / NAS Only',
          s3: 'S3 Cloud Only',
          all: 'Multi-Destination Mirror'
        };
        onShowToast(`Primary Storage Route: ${modeLabels[mode] || mode}`);
        onRefresh();
      } else {
        onShowToast('Failed to update storage routing mode', true);
      }
    } catch {
      onShowToast('Error updating storage routing mode', true);
    }
  };

  const handleSaveLocation = async (targetPath?: string) => {
    const pathToSave = (targetPath || customPath || '').trim();
    if (!pathToSave) return;
    try {
      const res = await fetch('/api/storage/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathToSave })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(`Storage save location updated to "${pathToSave}"`);
        setCustomPath(pathToSave);
        onRefresh();
      } else {
        onShowToast(`Error: ${data.detail || data.error || 'Invalid directory'}`, true);
      }
    } catch {
      onShowToast('Failed to update storage directory', true);
    }
  };

  const handleSelectBrowserPath = async (selectedPath: string) => {
    setCustomPath(selectedPath);
    setIsBrowserOpen(false);
    await handleSaveLocation(selectedPath);
  };

  const handleOpenFolder = async () => {
    try {
      const res = await fetch('/api/storage/open-folder', { method: 'POST' });
      if (res.ok) {
        onShowToast('Opened storage folder in host File Explorer');
      } else {
        onShowToast('Could not open folder', true);
      }
    } catch {
      onShowToast('Error opening directory', true);
    }
  };

  const handleSaveS3 = async () => {
    try {
      const res = await fetch('/api/storage/s3/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s3Config)
      });
      if (res.ok) {
        onShowToast('S3 cloud backup settings saved');
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
      setS3TestMsg({
        success: data.success,
        text: data.success ? (data.message || 'Connected to S3 successfully!') : (data.error || 'Connection failed')
      });
    } catch (e: any) {
      setS3TestMsg({ success: false, text: e.message || 'Error testing connection' });
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
        onShowToast('Samba replication settings saved');
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
      setSambaTestMsg({
        success: data.success,
        text: data.success ? (data.message || 'Connected to Samba share!') : (data.error || 'Connection failed')
      });
    } catch (e: any) {
      setSambaTestMsg({ success: false, text: e.message || 'Error testing share' });
    } finally {
      setSambaTesting(false);
    }
  };

  const diskUsed = storageLocation ? storageLocation.used_gb : 0;
  const diskTotal = storageLocation ? storageLocation.total_gb : 0;
  const diskFree = storageLocation ? storageLocation.free_gb : 0;
  const diskPercent = storageLocation ? storageLocation.disk_percent : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 select-none text-xs">
      {/* 1. Storage Status & Local Directory */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] shrink-0">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-white truncate">Local Storage Infrastructure</h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono truncate">Surveillance recordings, snapshots & retention pool.</p>
            </div>
          </div>
          {!isViewer && (
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-medium shrink-0"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span className="hidden sm:inline">Open Folder</span>
              <span className="sm:hidden">Folder</span>
            </button>
          )}
        </div>

        {/* Viewer Notice */}
        {isViewer && (
          <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/60 text-[#3B82F6] text-[11px] font-mono flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>View-Only Mode: Storage directory and cloud / NAS synchronization settings are managed by Administrators.</span>
          </div>
        )}

        {/* Storage Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#161616] border border-[#222222]">
            <span className="text-[10px] text-zinc-400 font-mono">Used Space</span>
            <p className="text-sm sm:text-base font-bold text-white font-mono mt-0.5">{diskUsed.toFixed(1)} GB</p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#161616] border border-[#222222]">
            <span className="text-[10px] text-zinc-400 font-mono">Free Space</span>
            <p className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5">{diskFree.toFixed(1)} GB</p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#161616] border border-[#222222]">
            <span className="text-[10px] text-zinc-400 font-mono">Total Volume</span>
            <p className="text-sm sm:text-base font-bold text-white font-mono mt-0.5">{diskTotal.toFixed(1)} GB</p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#161616] border border-[#222222]">
            <span className="text-[10px] text-zinc-400 font-mono">Occupancy</span>
            <p className="text-sm sm:text-base font-bold text-[#3B82F6] font-mono mt-0.5">{diskPercent}%</p>
          </div>
        </div>

        {/* Media Breakdown & Storage Management */}
        <div className="p-3 rounded-xl bg-[#141416] border border-[#222226] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300">Active Storage Footprint</span>
            {!isViewer && (
              <button
                type="button"
                onClick={() => setPurgeTarget('all')}
                className="flex items-center gap-1 text-[10px] font-mono font-medium text-rose-400 hover:text-rose-300 transition-colors"
                title="Purge all videos and snapshots from storage"
              >
                <Trash2 className="h-3 w-3" />
                <span>Purge All Media</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Video Recordings */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#19191d] border border-[#26262c]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-[#3B82F6]">
                  <Film className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">Video Clips</p>
                  <p className="text-[10px] text-zinc-400 font-mono">{storageLocation?.recordings_mb || 0} MB</p>
                </div>
              </div>
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => setPurgeTarget('recordings')}
                  className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded border border-[#333] hover:border-rose-800 transition-all"
                  title="Purge all video recordings"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Snapshots */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#19191d] border border-[#26262c]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                  <ImageIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">Photos & Snaps</p>
                  <p className="text-[10px] text-zinc-400 font-mono">{storageLocation?.snapshots_mb || 0} MB</p>
                </div>
              </div>
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => setPurgeTarget('snapshots')}
                  className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded border border-[#333] hover:border-rose-800 transition-all"
                  title="Purge all snapshot photos"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Face Profiles */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#19191d] border border-[#26262c]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400">
                  <HardDrive className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">Face Profiles</p>
                  <p className="text-[10px] text-zinc-400 font-mono">{storageLocation?.faces_mb || 0} MB</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 bg-zinc-800/60 rounded">
                DB Managed
              </span>
            </div>
          </div>
        </div>

        {/* Directory Input & Interactive Browser */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-medium text-zinc-300">
              Host Video Recordings & Snapshots Path
            </label>
            {!isViewer && (
              <span className="text-[10px] text-zinc-500 font-mono">
                Click Browse to pick any drive or folder
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={customPath}
                disabled={isViewer}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="e.g. /opt/cctv-hub/backend/data/recordings"
                className="w-full bg-[#161616] border border-[#222222] rounded-lg pl-3 pr-8 py-1.5 text-white text-xs font-mono focus:border-[#3B82F6] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => setIsBrowserOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#3B82F6] transition-colors"
                  title="Browse Host Directories"
                >
                  <FolderSearch className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!isViewer && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBrowserOpen(true)}
                  className="px-3.5 py-1.5 bg-[#16161c] hover:bg-[#202028] border border-[#3B82F6]/60 hover:border-[#3B82F6] text-white font-medium rounded-lg transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                  title="Browse drives and folders without manual typing"
                >
                  <FolderSearch className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <span>Browse / Select Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveLocation()}
                  className="px-4 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-xs shrink-0 shadow-sm"
                >
                  Update Path
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Primary Storage Destination Routing */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#3B82F6]" />
            <div>
              <h4 className="font-semibold text-xs text-white">Primary Storage Destination Routing</h4>
              <p className="text-[10px] text-zinc-400 font-mono">
                Select target storage destination for new surveillance recordings and snapshots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950/60 text-[#3B82F6] border border-blue-800">
              Active: {currentTargetMode === 'local' ? 'Local Host Only' : currentTargetMode === 'samba' ? 'Samba / NAS Only' : currentTargetMode === 's3' ? 'S3 Cloud Only' : 'Multi-Destination Mirror'}
            </span>
          </div>
        </div>

        {/* 4 Interactive Route Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Option 1: Local Only */}
          <button
            type="button"
            disabled={isViewer}
            onClick={() => handleUpdateTargetMode('local', purgeLocal)}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
              currentTargetMode === 'local'
                ? 'bg-blue-600/15 border-[#3B82F6] text-white shadow-md shadow-blue-500/10 ring-1 ring-[#3B82F6]'
                : 'bg-[#161616] border-[#222222] text-zinc-300 hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#202020] text-[#3B82F6]">
                <HardDrive className="h-4 w-4" />
              </div>
              {currentTargetMode === 'local' && (
                <CheckCircle2 className="h-4 w-4 text-[#3B82F6]" />
              )}
            </div>
            <div>
              <div className="font-bold text-xs">Local Host Only</div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Save only to server host disk without remote network offload.
              </p>
            </div>
          </button>

          {/* Option 2: Samba Only */}
          <button
            type="button"
            disabled={isViewer}
            onClick={() => handleUpdateTargetMode('samba', purgeLocal)}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
              currentTargetMode === 'samba'
                ? 'bg-blue-600/15 border-[#3B82F6] text-white shadow-md shadow-blue-500/10 ring-1 ring-[#3B82F6]'
                : 'bg-[#161616] border-[#222222] text-zinc-300 hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#202020] text-emerald-400">
                <Server className="h-4 w-4" />
              </div>
              {currentTargetMode === 'samba' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-xs">Samba / NAS Only</div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Replicate directly to SMB / Samba NAS storage share.
              </p>
            </div>
          </button>

          {/* Option 3: S3 Cloud Only */}
          <button
            type="button"
            disabled={isViewer}
            onClick={() => handleUpdateTargetMode('s3', purgeLocal)}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
              currentTargetMode === 's3'
                ? 'bg-blue-600/15 border-[#3B82F6] text-white shadow-md shadow-blue-500/10 ring-1 ring-[#3B82F6]'
                : 'bg-[#161616] border-[#222222] text-zinc-300 hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#202020] text-amber-400">
                <Cloud className="h-4 w-4" />
              </div>
              {currentTargetMode === 's3' && (
                <CheckCircle2 className="h-4 w-4 text-amber-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-xs">S3 Cloud Only</div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Upload directly to AWS S3, Cloudflare R2, or MinIO bucket.
              </p>
            </div>
          </button>

          {/* Option 4: Mirror All */}
          <button
            type="button"
            disabled={isViewer}
            onClick={() => handleUpdateTargetMode('all', purgeLocal)}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
              currentTargetMode === 'all'
                ? 'bg-blue-600/15 border-[#3B82F6] text-white shadow-md shadow-blue-500/10 ring-1 ring-[#3B82F6]'
                : 'bg-[#161616] border-[#222222] text-zinc-300 hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#202020] text-purple-400">
                <Layers className="h-4 w-4" />
              </div>
              {currentTargetMode === 'all' && (
                <CheckCircle2 className="h-4 w-4 text-purple-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-xs">Multi-Destination Mirror</div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Retain local files and mirror backups to all configured remotes.
              </p>
            </div>
          </button>
        </div>

        {/* Purge Local Copy Toggle (when in Samba or S3 Only mode) */}
        {(currentTargetMode === 'samba' || currentTargetMode === 's3') && !isViewer && (
          <div className="p-3 rounded-lg bg-[#161618] border border-[#26262a] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                Zero Host Disk Footprint (Purge local cache after remote upload)
              </span>
              <p className="text-[10px] text-zinc-400 font-mono">
                Automatically deletes the temporary local file once successfully verified on {currentTargetMode === 'samba' ? 'Samba NAS' : 'S3 Cloud'}.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={purgeLocal}
                onChange={(e) => handleUpdateTargetMode(currentTargetMode, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6]"></div>
            </label>
          </div>
        )}
      </div>

      {/* 3. S3 Cloud & Samba NAS Offload Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* S3 Cloud */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-[#3B82F6]" />
              <h4 className="font-semibold text-xs text-white">S3 Cloud Offload</h4>
            </div>
            <input
              type="checkbox"
              disabled={isViewer}
              checked={s3Config.enabled}
              onChange={(e) => setS3Config({ ...s3Config, enabled: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#3B82F6] rounded disabled:opacity-50"
            />
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">S3 Endpoint URL</label>
              <input
                type="text"
                disabled={isViewer}
                value={s3Config.endpoint_url}
                onChange={(e) => setS3Config({ ...s3Config, endpoint_url: e.target.value })}
                placeholder="https://<accountid>.r2.cloudflarestorage.com"
                className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Bucket Name</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={s3Config.bucket_name}
                  onChange={(e) => setS3Config({ ...s3Config, bucket_name: e.target.value })}
                  placeholder="cctv-recordings"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Region</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={s3Config.region}
                  onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                  placeholder="us-east-1"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Access Key ID</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={s3Config.access_key}
                  onChange={(e) => setS3Config({ ...s3Config, access_key: e.target.value })}
                  placeholder="AKIA..."
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Secret Access Key</label>
                <input
                  type="password"
                  disabled={isViewer}
                  value={s3Config.secret_key}
                  onChange={(e) => setS3Config({ ...s3Config, secret_key: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {s3TestMsg && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${s3TestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                {s3TestMsg.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                <span>{s3TestMsg.text}</span>
              </div>
            )}

            {!isViewer && (
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleTestS3}
                  disabled={s3Testing}
                  className="px-3 py-1 bg-[#161616] hover:bg-[#202020] text-zinc-200 border border-[#222222] rounded-lg transition-colors text-[11px] font-mono"
                >
                  {s3Testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveS3}
                  className="px-3.5 py-1 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-[11px]"
                >
                  Save S3
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Samba / NAS */}
        <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#3B82F6]" />
              <h4 className="font-semibold text-xs text-white">Samba / NAS Sync</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-mono">Enable</span>
              <input
                type="checkbox"
                disabled={isViewer}
                checked={sambaConfig.enabled}
                onChange={(e) => setSambaConfig({ ...sambaConfig, enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#3B82F6] rounded disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Host IP & Share Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Host / Server IP</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={sambaConfig.host}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, host: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Share Name</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={sambaConfig.share}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, share: e.target.value })}
                  placeholder="cctv_storage"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Username (Optional for Guest)</label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={sambaConfig.username}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, username: e.target.value })}
                  placeholder="admin or guest"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Password</label>
                <input
                  type="password"
                  disabled={isViewer}
                  value={sambaConfig.password || ''}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Local Mount Path & Auto Sync */}
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className="text-[10px] text-zinc-400">Local Mount Path (Optional)</label>
                <span className="text-[9px] text-zinc-500 font-mono">Leave blank for direct network IP sync</span>
              </div>
              <input
                type="text"
                disabled={isViewer}
                value={sambaConfig.local_mount_path}
                onChange={(e) => setSambaConfig({ ...sambaConfig, local_mount_path: e.target.value })}
                placeholder="Leave blank, or e.g. /mnt/samba"
                className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[11px] text-zinc-300">Auto-sync recordings & snapshots to NAS</span>
              <input
                type="checkbox"
                disabled={isViewer}
                checked={sambaConfig.auto_sync}
                onChange={(e) => setSambaConfig({ ...sambaConfig, auto_sync: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#3B82F6] rounded disabled:opacity-50"
              />
            </div>

            {sambaTestMsg && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${sambaTestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                {sambaTestMsg.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                <span>{sambaTestMsg.text}</span>
              </div>
            )}

            {!isViewer && (
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleTestSamba}
                  disabled={sambaTesting}
                  className="px-3 py-1 bg-[#161616] hover:bg-[#202020] text-zinc-200 border border-[#222222] rounded-lg transition-colors text-[11px] font-mono"
                >
                  {sambaTesting ? 'Testing...' : 'Test Share'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSamba}
                  className="px-3.5 py-1 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-[11px]"
                >
                  Save Samba
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Directory Picker Modal */}
      <DirectoryPickerModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        initialPath={customPath}
        onSelectPath={handleSelectBrowserPath}
        onShowToast={onShowToast}
      />

      {/* Storage Media Purge Confirmation Modal */}
      <ConfirmModal
        isOpen={purgeTarget !== null}
        title={
          purgeTarget === 'recordings'
            ? 'Purge All Video Recordings'
            : purgeTarget === 'snapshots'
            ? 'Purge All Snapshot Photos'
            : 'Purge All Media from Storage'
        }
        message={
          <p>
            Are you sure you want to permanently delete{' '}
            <strong className="text-white">
              {purgeTarget === 'recordings'
                ? `all video recordings (${storageLocation?.recordings_mb || 0} MB)`
                : purgeTarget === 'snapshots'
                ? `all snapshot photos (${storageLocation?.snapshots_mb || 0} MB)`
                : `all video recordings and snapshot photos (${((storageLocation?.recordings_mb || 0) + (storageLocation?.snapshots_mb || 0)).toFixed(1)} MB)`}
            </strong>{' '}
            from storage?
            <br />
            This will permanently remove the files from local host disk, custom paths, and mirrored Samba/S3 locations.
          </p>
        }
        confirmText={
          purgeTarget === 'recordings'
            ? 'Purge Videos'
            : purgeTarget === 'snapshots'
            ? 'Purge Photos'
            : 'Purge All Media'
        }
        variant="danger"
        onConfirm={handleConfirmPurge}
        onClose={() => setPurgeTarget(null)}
      />
    </div>
  );
};
