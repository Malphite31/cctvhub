import React, { useState, useEffect } from 'react';
import { HardDrive, FolderOpen, Cloud, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { StorageLocationInfo, S3Config, SambaConfig } from '../types';

interface StorageViewProps {
  storageLocation: StorageLocationInfo | null;
  onRefresh: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
}

export const StorageView: React.FC<StorageViewProps> = ({
  storageLocation,
  onRefresh,
  onShowToast,
}) => {
  const [customPath, setCustomPath] = useState('');
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

  useEffect(() => {
    if (storageLocation) {
      setCustomPath(storageLocation.recordings_path);
    }
    fetch('/api/storage/s3/config')
      .then((r) => r.json())
      .then((d) => { if (d.config) setS3Config(d.config); })
      .catch(() => {});
    fetch('/api/storage/samba/config')
      .then((r) => r.json())
      .then((d) => { if (d.config) setSambaConfig(d.config); })
      .catch(() => {});
  }, [storageLocation]);

  const handleSaveLocation = async () => {
    try {
      const res = await fetch('/api/storage/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: customPath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast('Storage save location updated');
        onRefresh();
      } else {
        onShowToast(`Error: ${data.detail || data.error || 'Invalid directory'}`, true);
      }
    } catch {
      onShowToast('Failed to update storage directory', true);
    }
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
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-medium shrink-0"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span className="hidden sm:inline">Open Folder</span>
            <span className="sm:hidden">Folder</span>
          </button>
        </div>

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

        {/* Directory Input */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-zinc-300">
            Host Video Recordings & Snapshots Path
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="e.g. D:\CCTV_Recordings or /mnt/cctv"
              className="flex-1 bg-[#161616] border border-[#222222] rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:border-[#3B82F6] focus:outline-none"
            />
            <button
              onClick={handleSaveLocation}
              className="px-4 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-xs shrink-0"
            >
              Update Path
            </button>
          </div>
        </div>
      </div>

      {/* 2. S3 Cloud & Samba NAS Offload */}
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
              checked={s3Config.enabled}
              onChange={(e) => setS3Config({ ...s3Config, enabled: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#3B82F6] rounded"
            />
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">S3 Endpoint URL</label>
              <input
                type="text"
                value={s3Config.endpoint_url}
                onChange={(e) => setS3Config({ ...s3Config, endpoint_url: e.target.value })}
                placeholder="https://<accountid>.r2.cloudflarestorage.com"
                className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Bucket Name</label>
                <input
                  type="text"
                  value={s3Config.bucket_name}
                  onChange={(e) => setS3Config({ ...s3Config, bucket_name: e.target.value })}
                  placeholder="cctv-recordings"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Region</label>
                <input
                  type="text"
                  value={s3Config.region}
                  onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                  placeholder="us-east-1"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Access Key ID</label>
                <input
                  type="text"
                  value={s3Config.access_key}
                  onChange={(e) => setS3Config({ ...s3Config, access_key: e.target.value })}
                  placeholder="AKIA..."
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Secret Access Key</label>
                <input
                  type="password"
                  value={s3Config.secret_key}
                  onChange={(e) => setS3Config({ ...s3Config, secret_key: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            {s3TestMsg && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${s3TestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                {s3TestMsg.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                <span>{s3TestMsg.text}</span>
              </div>
            )}

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
                checked={sambaConfig.enabled}
                onChange={(e) => setSambaConfig({ ...sambaConfig, enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#3B82F6] rounded"
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
                  value={sambaConfig.host}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, host: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Share Name</label>
                <input
                  type="text"
                  value={sambaConfig.share}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, share: e.target.value })}
                  placeholder="cctv_storage"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Username (Optional for Guest)</label>
                <input
                  type="text"
                  value={sambaConfig.username}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, username: e.target.value })}
                  placeholder="admin or guest"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Password</label>
                <input
                  type="password"
                  value={sambaConfig.password || ''}
                  onChange={(e) => setSambaConfig({ ...sambaConfig, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            {/* Local Mount Path & Auto Sync */}
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Local Linux / Host Mount Path (Optional)</label>
              <input
                type="text"
                value={sambaConfig.local_mount_path}
                onChange={(e) => setSambaConfig({ ...sambaConfig, local_mount_path: e.target.value })}
                placeholder="/mnt/samba/cctv (Leave blank if connecting via IP)"
                className="w-full bg-[#161616] border border-[#222222] rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[11px] text-zinc-300">Auto-sync recordings & snapshots to NAS</span>
              <input
                type="checkbox"
                checked={sambaConfig.auto_sync}
                onChange={(e) => setSambaConfig({ ...sambaConfig, auto_sync: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#3B82F6] rounded"
              />
            </div>

            {sambaTestMsg && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${sambaTestMsg.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                {sambaTestMsg.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                <span>{sambaTestMsg.text}</span>
              </div>
            )}

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
          </div>
        </div>
      </div>
    </div>
  );
};
