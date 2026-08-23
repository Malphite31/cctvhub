import React, { useState, useMemo } from 'react';
import { RecordingClip, SnapshotItem, StorageLocationInfo } from '../types';
import {
  Play,
  Download,
  Trash2,
  Image as ImageIcon,
  CloudUpload,
  Server,
  X,
  FolderOpen,
  Search,
  RefreshCw,
  Film,
  Maximize2,
  CheckSquare,
  Square,
  Check
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface DVRTimelineProps {
  recordings: RecordingClip[];
  snapshots: SnapshotItem[];
  storageLocation: StorageLocationInfo | null;
  onDeleteClip: (filename: string) => void;
  onDeleteSnapshot: (filename: string) => void;
  onBatchDeleteClips?: (filenames: string[]) => void;
  onBatchDeleteSnapshots?: (filenames: string[]) => void;
  onRefresh: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
  userRole?: string;
}

export const DVRTimeline: React.FC<DVRTimelineProps> = ({
  recordings,
  snapshots,
  storageLocation,
  onDeleteClip,
  onDeleteSnapshot,
  onBatchDeleteClips,
  onBatchDeleteSnapshots,
  onRefresh,
  onShowToast,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [activeTab, setActiveTab] = useState<'clips' | 'snapshots'>('clips');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [selectedSnapshots, setSelectedSnapshots] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'clip' | 'snapshot'; filename: string } | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const [previewClip, setPreviewClip] = useState<string | null>(null);
  const [previewClipName, setPreviewClipName] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);
  const [syncingFile, setSyncingFile] = useState<string | null>(null);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    try {
      return new Date(timestamp * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return 'Recent';
    }
  };

  const handleOpenFolder = async () => {
    try {
      const res = await fetch('/api/storage/open-folder', { method: 'POST' });
      if (res.ok) {
        onShowToast('Opened storage directory in File Explorer');
      } else {
        onShowToast('Could not open folder on server', true);
      }
    } catch {
      onShowToast('Error opening directory', true);
    }
  };

  const handleUploadS3 = async (filename: string) => {
    setSyncingFile(filename);
    try {
      const res = await fetch(`/api/storage/s3/upload/${filename}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(`Uploaded ${filename} to S3 Cloud`);
      } else {
        onShowToast(`S3: ${data.detail || data.error || 'Check S3 configuration'}`, true);
      }
    } catch {
      onShowToast('Failed to upload to S3', true);
    } finally {
      setSyncingFile(null);
    }
  };

  const handleSyncSamba = async (filename: string) => {
    setSyncingFile(filename);
    try {
      const res = await fetch(`/api/storage/samba/sync/${filename}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast(`Synced ${filename} to Samba NAS`);
      } else {
        onShowToast(`Samba: ${data.detail || data.error || 'Check Samba configuration'}`, true);
      }
    } catch {
      onShowToast('Failed to sync to Samba', true);
    } finally {
      setSyncingFile(null);
    }
  };

  const filteredClips = useMemo(() => {
    if (!searchQuery) return recordings;
    const q = searchQuery.toLowerCase();
    return recordings.filter((c) => c.filename.toLowerCase().includes(q));
  }, [recordings, searchQuery]);

  const filteredSnapshots = useMemo(() => {
    if (!searchQuery) return snapshots;
    const q = searchQuery.toLowerCase();
    return snapshots.filter((s) => s.filename.toLowerCase().includes(q));
  }, [snapshots, searchQuery]);

  // Selection handlers
  const toggleSelectClip = (filename: string) => {
    setSelectedClips((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
  };

  const toggleSelectSnapshot = (filename: string) => {
    setSelectedSnapshots((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
  };

  const isAllClipsSelected =
    filteredClips.length > 0 && filteredClips.every((c) => selectedClips.includes(c.filename));

  const isAllSnapshotsSelected =
    filteredSnapshots.length > 0 &&
    filteredSnapshots.every((s) => selectedSnapshots.includes(s.filename));

  const handleToggleSelectAllClips = () => {
    if (isAllClipsSelected) {
      setSelectedClips([]);
    } else {
      setSelectedClips(filteredClips.map((c) => c.filename));
    }
  };

  const handleToggleSelectAllSnapshots = () => {
    if (isAllSnapshotsSelected) {
      setSelectedSnapshots([]);
    } else {
      setSelectedSnapshots(filteredSnapshots.map((s) => s.filename));
    }
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'clip') {
      onDeleteClip(itemToDelete.filename);
      setSelectedClips((prev) => prev.filter((fn) => fn !== itemToDelete.filename));
    } else {
      onDeleteSnapshot(itemToDelete.filename);
      setSelectedSnapshots((prev) => prev.filter((fn) => fn !== itemToDelete.filename));
    }
    setItemToDelete(null);
  };

  const handleConfirmBatchDelete = () => {
    if (activeTab === 'clips') {
      if (selectedClips.length === 0) {
        setShowBatchDeleteModal(false);
        return;
      }
      const count = selectedClips.length;
      if (onBatchDeleteClips) {
        onBatchDeleteClips(selectedClips);
      } else {
        for (const fn of selectedClips) {
          onDeleteClip(fn);
        }
        onShowToast(`Deleted ${count} recording(s)`);
      }
      setSelectedClips([]);
    } else {
      if (selectedSnapshots.length === 0) {
        setShowBatchDeleteModal(false);
        return;
      }
      const count = selectedSnapshots.length;
      if (onBatchDeleteSnapshots) {
        onBatchDeleteSnapshots(selectedSnapshots);
      } else {
        for (const fn of selectedSnapshots) {
          onDeleteSnapshot(fn);
        }
        onShowToast(`Deleted ${count} snapshot(s)`);
      }
      setSelectedSnapshots([]);
    }
    setShowBatchDeleteModal(false);
  };

  const currentSelectedCount = activeTab === 'clips' ? selectedClips.length : selectedSnapshots.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 select-none text-xs">
      {/* 1. Main Header & Controls Card */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-2.5 sm:space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] shrink-0">
              <Film className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-white font-sans truncate">
                Recordings & Media Archive
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono truncate">
                {recordings.length} Clips • {snapshots.length} Snaps • Path:{' '}
                <span className="text-zinc-300">{storageLocation?.recordings_path || 'Default'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-medium"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span className="hidden sm:inline">Open Folder</span>
              <span className="sm:hidden">Folder</span>
            </button>

            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-mono"
            >
              <RefreshCw className="h-3 w-3 text-[#3B82F6]" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search, Filter Pills & Multi-Select Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'clips' ? 'Search MP4 clips by name...' : 'Search snapshots by name...'}
              className="w-full pl-8 pr-3 py-1.5 bg-[#161616] border border-[#222222] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-sans"
            />
          </div>

          {/* Media Format Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#161616] border border-[#222222] shrink-0">
            <button
              onClick={() => setActiveTab('clips')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'clips'
                  ? 'bg-[#3B82F6] text-white font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="h-3 w-3" />
              <span>Clips ({recordings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('snapshots')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'snapshots'
                  ? 'bg-[#3B82F6] text-white font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ImageIcon className="h-3 w-3" />
              <span>Snaps ({snapshots.length})</span>
            </button>
          </div>
        </div>

        {/* Multi-Select Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-[#222222] text-xs font-mono">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <button
              onClick={activeTab === 'clips' ? handleToggleSelectAllClips : handleToggleSelectAllSnapshots}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              {(activeTab === 'clips' ? isAllClipsSelected : isAllSnapshotsSelected) ? (
                <CheckSquare className="h-4 w-4 text-[#3B82F6]" />
              ) : (
                <Square className="h-4 w-4 text-zinc-600" />
              )}
              <span>
                {(activeTab === 'clips' ? isAllClipsSelected : isAllSnapshotsSelected)
                  ? 'Deselect All'
                  : 'Select All'}
              </span>
            </button>

            {currentSelectedCount > 0 && (
              <span className="text-[#3B82F6] font-semibold">
                {currentSelectedCount} {activeTab === 'clips' ? 'clip(s)' : 'snap(s)'} selected
              </span>
            )}
          </div>

          {currentSelectedCount > 0 && !isViewer && (
            <div className="flex items-center gap-2 animate-in fade-in duration-150">
              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-rose-900/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Selected ({currentSelectedCount})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Media Grid Container */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        {/* CLIPS GRID */}
        {activeTab === 'clips' && (
          <div>
            {filteredClips.length === 0 ? (
              <div className="rounded-xl border border-[#222222] bg-[#121212] p-10 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Film className="h-8 w-8 opacity-20 text-zinc-400" />
                <p className="font-mono text-xs text-zinc-300">No Video Clips Found</p>
                <span className="text-[10px] text-zinc-500 max-w-sm">
                  Recordings started via the live surveillance player will appear here.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredClips.map((clip) => {
                  const isSelected = selectedClips.includes(clip.filename);
                  return (
                    <div
                      key={clip.filename}
                      className={`rounded-xl border bg-[#121212] overflow-hidden group transition-all flex flex-col justify-between relative ${
                        isSelected
                          ? 'border-[#3B82F6] ring-1 ring-[#3B82F6] bg-[#151518]'
                          : 'border-[#222222] hover:border-zinc-600'
                      }`}
                    >
                      {/* Selection Checkbox Pill (Top Left) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectClip(clip.filename);
                        }}
                        className={`absolute top-2 left-2 z-20 h-6 w-6 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#3B82F6] text-white shadow-md'
                            : 'bg-black/70 hover:bg-black text-white/50 hover:text-white border border-white/20'
                        }`}
                        title={isSelected ? 'Deselect clip' : 'Select clip'}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Square className="h-3.5 w-3.5" />}
                      </button>

                      {/* Thumbnail Viewport */}
                      <div
                        onClick={() => {
                          setPreviewClip(clip.url);
                          setPreviewClipName(clip.filename);
                        }}
                        className="relative aspect-video bg-black flex items-center justify-center cursor-pointer overflow-hidden group/thumb"
                      >
                        <video
                          src={clip.url}
                          className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 transition-opacity"
                          preload="metadata"
                        />

                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-xl transform scale-90 group-hover/thumb:scale-100 transition-transform">
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* File Size Badge */}
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.2 rounded bg-black/80 backdrop-blur text-[9px] font-mono text-zinc-300">
                          {clip.size_mb.toFixed(1)} MB
                        </span>
                      </div>

                      {/* Meta & Actions Bar */}
                      <div className="p-2.5 space-y-2">
                        <div>
                          <p className="font-semibold text-xs text-white truncate font-sans" title={clip.filename}>
                            {clip.filename}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                            {formatDate(clip.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setPreviewClip(clip.url);
                                setPreviewClipName(clip.filename);
                              }}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Play Video"
                            >
                              <Play className="h-3 w-3" />
                            </button>

                            <a
                              href={clip.url}
                              download={clip.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Download MP4"
                            >
                              <Download className="h-3 w-3" />
                            </a>

                            <button
                              onClick={() => handleUploadS3(clip.filename)}
                              disabled={syncingFile === clip.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Upload to S3 Cloud"
                            >
                              <CloudUpload className="h-3 w-3 text-[#3B82F6]" />
                            </button>

                            <button
                              onClick={() => handleSyncSamba(clip.filename)}
                              disabled={syncingFile === clip.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Sync to Samba NAS"
                            >
                              <Server className="h-3 w-3 text-emerald-400" />
                            </button>
                          </div>

                          {!isViewer && (
                            <button
                              onClick={() => setItemToDelete({ type: 'clip', filename: clip.filename })}
                              className="p-1 rounded bg-[#161616] hover:bg-rose-950/80 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Delete Clip"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SNAPSHOTS GRID */}
        {activeTab === 'snapshots' && (
          <div>
            {filteredSnapshots.length === 0 ? (
              <div className="rounded-xl border border-[#222222] bg-[#121212] p-10 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 opacity-20 text-zinc-400" />
                <p className="font-mono text-xs text-zinc-300">No Snapshots Found</p>
                <span className="text-[10px] text-zinc-500 max-w-sm">
                  Snapshots taken from the live video feed will appear here.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredSnapshots.map((snap) => {
                  const isSelected = selectedSnapshots.includes(snap.filename);
                  const sizeText =
                    typeof snap.size_kb === 'number'
                      ? `${snap.size_kb.toFixed(0)} KB`
                      : typeof snap.size_mb === 'number'
                      ? `${(snap.size_mb * 1024).toFixed(0)} KB`
                      : 'Image';

                  return (
                    <div
                      key={snap.filename}
                      className={`rounded-xl border bg-[#121212] overflow-hidden group transition-all flex flex-col justify-between relative ${
                        isSelected
                          ? 'border-[#3B82F6] ring-1 ring-[#3B82F6] bg-[#151518]'
                          : 'border-[#222222] hover:border-zinc-600'
                      }`}
                    >
                      {/* Selection Checkbox Pill (Top Left) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectSnapshot(snap.filename);
                        }}
                        className={`absolute top-2 left-2 z-20 h-6 w-6 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#3B82F6] text-white shadow-md'
                            : 'bg-black/70 hover:bg-black text-white/50 hover:text-white border border-white/20'
                        }`}
                        title={isSelected ? 'Deselect snapshot' : 'Select snapshot'}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Square className="h-3.5 w-3.5" />}
                      </button>

                      {/* Image Viewport */}
                      <div
                        onClick={() => {
                          setPreviewImage(snap.url);
                          setPreviewImageName(snap.filename);
                        }}
                        className="relative aspect-video bg-black flex items-center justify-center cursor-pointer overflow-hidden group/thumb"
                      >
                        <img
                          src={snap.url}
                          alt={snap.filename}
                          className="w-full h-full object-cover opacity-90 group-hover/thumb:opacity-100 transition-opacity"
                        />

                        {/* Expand Button Overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-xl transform scale-90 group-hover/thumb:scale-100 transition-transform">
                            <Maximize2 className="h-4 w-4" />
                          </div>
                        </div>

                        {/* File Size Badge */}
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.2 rounded bg-black/80 backdrop-blur text-[9px] font-mono text-zinc-300">
                          {sizeText}
                        </span>
                      </div>

                      {/* Meta & Actions Bar */}
                      <div className="p-2.5 space-y-2">
                        <div>
                          <p className="font-semibold text-xs text-white truncate font-sans" title={snap.filename}>
                            {snap.filename}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                            {formatDate(snap.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setPreviewImage(snap.url);
                                setPreviewImageName(snap.filename);
                              }}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="View Fullscreen"
                            >
                              <Maximize2 className="h-3 w-3" />
                            </button>

                            <a
                              href={snap.url}
                              download={snap.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Download Image"
                            >
                              <Download className="h-3 w-3" />
                            </a>

                            <button
                              onClick={() => handleUploadS3(snap.filename)}
                              disabled={syncingFile === snap.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Upload to S3 Cloud"
                            >
                              <CloudUpload className="h-3 w-3 text-[#3B82F6]" />
                            </button>

                            <button
                              onClick={() => handleSyncSamba(snap.filename)}
                              disabled={syncingFile === snap.filename}
                              className="p-1 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white transition-colors"
                              title="Sync to Samba NAS"
                            >
                              <Server className="h-3 w-3 text-emerald-400" />
                            </button>
                          </div>

                          {!isViewer && (
                            <button
                              onClick={() => setItemToDelete({ type: 'snapshot', filename: snap.filename })}
                              className="p-1 rounded bg-[#161616] hover:bg-rose-950/80 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Delete Snapshot"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Video Player Modal Lightbox */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
          <div className="relative w-full max-w-3xl bg-[#121212] border border-[#222222] rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222222] bg-[#161616]">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
                <span className="font-semibold text-xs text-white truncate font-sans">
                  {previewClipName}
                </span>
              </div>
              <button
                onClick={() => setPreviewClip(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                src={previewClip}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Image Snapshot Modal Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
          <div className="relative w-full max-w-3xl bg-[#121212] border border-[#222222] rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222222] bg-[#161616]">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
                <span className="font-semibold text-xs text-white truncate font-sans">
                  {previewImageName}
                </span>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="aspect-video bg-black flex items-center justify-center">
              <img
                src={previewImage}
                alt="Snapshot Preview"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Single Item Delete Modal */}
      <ConfirmModal
        isOpen={itemToDelete !== null}
        title={itemToDelete?.type === 'clip' ? 'Delete Video Recording' : 'Delete Snapshot'}
        message={
          <p>
            Are you sure you want to permanently delete <strong className="text-white">"{itemToDelete?.filename}"</strong>?
            This file will be deleted from storage.
          </p>
        }
        confirmText="Delete File"
        variant="danger"
        onConfirm={handleConfirmSingleDelete}
        onClose={() => setItemToDelete(null)}
      />

      {/* Batch Delete Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title={activeTab === 'clips' ? 'Delete Selected Video Recordings' : 'Delete Selected Snapshots'}
        message={
          <p>
            Are you sure you want to permanently delete <strong className="text-white">{currentSelectedCount}</strong> {activeTab === 'clips' ? 'video recording(s)' : 'snapshot(s)'}?
          </p>
        }
        confirmText={`Delete (${currentSelectedCount}) Files`}
        variant="danger"
        onConfirm={handleConfirmBatchDelete}
        onClose={() => setShowBatchDeleteModal(false)}
      />
    </div>
  );
};
