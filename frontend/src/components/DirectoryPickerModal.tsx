import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderPlus,
  HardDrive,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  Check,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Server
} from 'lucide-react';
import { DirectoryBrowseResult } from '../types';

interface DirectoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPath?: string;
  onSelectPath: (path: string) => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const DirectoryPickerModal: React.FC<DirectoryPickerModalProps> = ({
  isOpen,
  onClose,
  initialPath,
  onSelectPath,
  onShowToast,
}) => {
  const [currentData, setCurrentData] = useState<DirectoryBrowseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const wasOpenRef = React.useRef(false);

  const fetchDirectory = useCallback(async (path?: string) => {
    setIsLoading(true);
    try {
      const url = path ? `/api/storage/browse?path=${encodeURIComponent(path)}` : '/api/storage/browse';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCurrentData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        if (onShowToast) onShowToast(err.detail || 'Could not access directory', true);
      }
    } catch {
      if (onShowToast) onShowToast('Failed to connect to storage service', true);
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSearchQuery('');
      setIsCreatingFolder(false);
      setNewFolderName('');
      fetchDirectory(initialPath);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialPath, fetchDirectory]);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    setSearchQuery('');
    setIsCreatingFolder(false);
    fetchDirectory(path);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !currentData) return;

    setIsSubmittingFolder(true);
    try {
      const res = await fetch('/api/storage/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_path: currentData.current_path,
          folder_name: newFolderName.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast(data.message || `Created folder "${newFolderName.trim()}"`);
        setNewFolderName('');
        setIsCreatingFolder(false);
        fetchDirectory(data.path || currentData.current_path);
      } else {
        if (onShowToast) onShowToast(data.detail || data.error || 'Failed to create folder', true);
      }
    } catch {
      if (onShowToast) onShowToast('Error creating directory', true);
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleConfirmSelect = () => {
    if (!currentData) return;
    onSelectPath(currentData.current_path);
    onClose();
  };

  const filteredFolders = (currentData?.folders || []).filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#121212] border border-[#262626] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#222222] bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-[#3B82F6] border border-[#3B82F6]/30">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Select Storage Save Directory</h3>
              <p className="text-[10px] text-zinc-400 font-mono">Browse system drives, mounted disks & folders without typing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drives & Top-Level Mounts Quick Bar */}
        {currentData?.drives && currentData.drives.length > 0 && (
          <div className="px-4 py-2 bg-[#0e0e11] border-b border-[#222222] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold shrink-0 mr-1 flex items-center gap-1">
              <Server className="h-3 w-3" /> Drives:
            </span>
            {currentData.drives.map((d) => {
              const isCurrentDrive = currentData.current_path.startsWith(d.path);
              return (
                <button
                  key={d.path}
                  onClick={() => handleNavigate(d.path)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition-colors shrink-0 ${
                    isCurrentDrive
                      ? 'bg-[#3B82F6]/20 border-[#3B82F6]/50 text-white font-semibold shadow-xs'
                      : 'bg-[#161616] border-[#262626] text-zinc-400 hover:text-white hover:bg-[#202020]'
                  }`}
                  title={`${d.label} • ${d.free_gb} GB Free`}
                >
                  <HardDrive className={`h-3 w-3 ${isCurrentDrive ? 'text-[#3B82F6]' : 'text-zinc-500'}`} />
                  <span>{d.name}</span>
                  {d.free_gb > 0 && (
                    <span className="text-[9px] text-emerald-400 font-normal">
                      {d.free_gb}G
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation, Breadcrumb & Actions Bar */}
        <div className="p-3 bg-[#161616] border-b border-[#222222] flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Up Level Button */}
            <button
              onClick={() => currentData?.parent_path && handleNavigate(currentData.parent_path)}
              disabled={!currentData?.parent_path}
              className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-zinc-300 hover:text-white border border-[#2e2e2e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Go up to parent directory"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>

            {/* Breadcrumb Trail */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0">
              {currentData?.breadcrumbs.map((b, idx) => {
                const isLast = idx === currentData.breadcrumbs.length - 1;
                return (
                  <React.Fragment key={b.path}>
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />}
                    <button
                      onClick={() => handleNavigate(b.path)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap transition-colors ${
                        isLast
                          ? 'bg-[#3B82F6]/20 text-white font-semibold border border-[#3B82F6]/40'
                          : 'text-zinc-400 hover:text-white hover:bg-[#222222]'
                      }`}
                    >
                      {b.name || '/'}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* New Folder Toggle */}
            <button
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors shrink-0 ${
                isCreatingFolder
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'bg-[#202020] hover:bg-[#282828] text-zinc-300 hover:text-white border-[#2e2e2e]'
              }`}
              title="Create a new folder in this location"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Folder</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchDirectory(currentData?.current_path)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-zinc-300 hover:text-white border border-[#2e2e2e] transition-colors shrink-0"
              title="Refresh directory listing"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* New Folder Inline Form */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2 pt-1 animate-in fade-in duration-100">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name (e.g. CCTV_Recordings)"
                autoFocus
                className="flex-1 bg-[#0e0e11] border border-[#3B82F6] rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmittingFolder || !newFolderName.trim()}
                className="px-3 py-1 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-[11px] font-medium transition-colors disabled:opacity-50"
              >
                {isSubmittingFolder ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-2 py-1 rounded-lg bg-[#202020] text-zinc-400 hover:text-white text-[11px]"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Search Filter Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders in current location..."
              className="w-full pl-7 pr-3 py-1 bg-[#0e0e11] border border-[#222222] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Directory Listing Area */}
        <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto p-2 space-y-1 bg-[#0e0e11] divide-y divide-[#18181c]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-zinc-500">
              <RefreshCw className="h-6 w-6 text-[#3B82F6] animate-spin" />
              <span className="font-mono text-[11px]">Loading folders...</span>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
              <Folder className="h-8 w-8 text-zinc-600" />
              <p className="font-mono text-xs text-zinc-400">
                {searchQuery ? 'No matching folders found' : 'No subdirectories in this location'}
              </p>
              <span className="text-[10px] text-zinc-500">
                You can select this location or create a new folder using the &quot;New Folder&quot; button above.
              </span>
            </div>
          ) : (
            filteredFolders.map((folder) => (
              <div
                key={folder.path}
                onClick={() => handleNavigate(folder.path)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#161616] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-md bg-[#1a1a1f] text-[#3B82F6] border border-[#282830] group-hover:border-[#3B82F6]/40 transition-colors shrink-0">
                    <Folder className="h-4 w-4 fill-[#3B82F6]/20" />
                  </div>
                  <span className="font-medium text-white text-xs truncate group-hover:text-[#3B82F6] transition-colors">
                    {folder.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {folder.is_writable ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      <span className="hidden sm:inline">Writable</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                      <ShieldAlert className="h-3 w-3 text-amber-500" />
                      <span className="hidden sm:inline">Read-only</span>
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Selection Confirmation */}
        <div className="p-3.5 bg-[#161616] border-t border-[#222222] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="text-[10px] text-zinc-400 font-mono block">Selected Save Location:</span>
            <div className="flex items-center gap-1.5 text-white font-mono font-semibold text-xs truncate bg-[#0e0e11] px-2.5 py-1 rounded-lg border border-[#262626]">
              <Folder className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
              <span className="truncate">{currentData?.current_path || '...'}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400 pt-0.5">
              <span>Free: <strong className="text-emerald-400">{currentData?.free_gb || 0} GB</strong></span>
              <span>Total: <strong className="text-zinc-200">{currentData?.total_gb || 0} GB</strong></span>
              {currentData?.is_writable ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Writable
                </span>
              ) : (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Permission Warning
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelect}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Select This Folder</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
