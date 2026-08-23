import React, { useState, useRef } from 'react';
import { CameraDevice } from '../types';
import { CameraEditModal } from './CameraEditModal';
import { ConfirmModal } from './ConfirmModal';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react';

interface CameraStripProps {
  devices: CameraDevice[];
  activeDevice: string;
  onSelectDevice: (dev: string) => void;
  onOpenSettings?: () => void;
  onRefreshDevices?: () => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
  userRole?: string;
}

export const CameraStrip: React.FC<CameraStripProps> = ({
  devices,
  activeDevice,
  onSelectDevice,
  onOpenSettings,
  onRefreshDevices,
  onShowToast,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCam, setEditingCam] = useState<CameraDevice | null>(null);
  const [camToDelete, setCamToDelete] = useState<CameraDevice | null>(null);
  const [isDeletingCam, setIsDeletingCam] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 260;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleOpenAdd = () => {
    setEditingCam(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, cam: CameraDevice) => {
    e.stopPropagation();
    setEditingCam(cam);
    setIsEditModalOpen(true);
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
        if (onShowToast) onShowToast(`Camera "${cam.name}" deleted`);
        setCamToDelete(null);
        if (onRefreshDevices) onRefreshDevices();
      } else {
        // Fallback to POST /api/cameras/delete
        const postRes = await fetch('/api/cameras/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: camId, device: cam.device, name: cam.name }),
        });
        if (postRes.ok) {
          if (onShowToast) onShowToast(`Camera "${cam.name}" deleted`);
          setCamToDelete(null);
          if (onRefreshDevices) onRefreshDevices();
        } else {
          const errData = await postRes.json().catch(() => ({}));
          if (onShowToast) onShowToast(errData.detail || 'Failed to delete camera', true);
        }
      }
    } catch {
      if (onShowToast) onShowToast('Error deleting camera', true);
    } finally {
      setIsDeletingCam(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#222222] bg-[#121212] px-3 py-1.5 space-y-1.5 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-[10px] text-white tracking-tight uppercase font-mono">
            Cameras ({devices.length})
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {devices.length > 0 && !isViewer && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] text-[9px] font-mono text-zinc-300 hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3 text-[#3B82F6]" />
              <span>Add Camera</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="text-[10px] font-mono text-[#3B82F6] hover:underline"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative flex items-center group/carousel">
        {/* Left Arrow */}
        {devices.length > 0 && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 z-20 h-full px-1 bg-gradient-to-r from-black/80 to-transparent text-zinc-400 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Scrollable Horizontal Camera Cards */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-2 overflow-x-auto no-scrollbar w-full py-0.5"
        >
          {devices.length === 0 ? (
            isViewer ? (
              <div className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-[#222222] bg-[#141416] text-zinc-500 font-mono text-xs">
                No active camera streams available
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-dashed border-[#28282c] hover:border-[#3B82F6]/60 bg-[#141416]/60 hover:bg-[#18181c] text-zinc-400 hover:text-white transition-all group/empty cursor-pointer"
              >
                <div className="p-1 rounded-md bg-[#1e1e24] group-hover/empty:bg-[#3B82F6] text-zinc-400 group-hover/empty:text-white transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono text-xs text-zinc-300 group-hover/empty:text-white">
                  No cameras connected — Click to add your first camera feed
                </span>
              </button>
            )
          ) : (
            <>
              {devices.map((cam, idx) => {
                const isActive = activeDevice === cam.device;
                return (
                  <div
                    key={cam.device}
                    onClick={() => onSelectDevice(cam.device)}
                    className={`w-28 sm:w-32 shrink-0 rounded-lg bg-[#161616] p-1.5 cursor-pointer transition-all duration-150 border flex flex-col justify-between group relative ${
                      isActive
                        ? 'border-[#3B82F6] ring-1 ring-[#3B82F6]'
                        : 'border-[#222222] hover:border-zinc-600'
                    }`}
                  >
                    {/* Thumbnail Container with Hover Edit / Delete Action Overlay */}
                    <div className="relative aspect-video rounded bg-black overflow-hidden mb-1">
                      <img
                        src={`/api/stream/live?dev=${cam.device}`}
                        alt={cam.name}
                        className="w-full h-full object-cover"
                      />

                      {/* Top Right: Live Tag */}
                      <span className="absolute top-0.5 right-0.5 bg-black/80 backdrop-blur-xs px-1 py-0.2 rounded text-[7px] font-mono text-emerald-400">
                        ● LIVE
                      </span>

                      {/* Quick Hover Action Overlay on Thumbnail */}
                      {!isViewer && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
                          <button
                            onClick={(e) => handleOpenEdit(e, cam)}
                            className="p-1 rounded-full bg-black/80 hover:bg-[#3B82F6] text-white border border-white/20 transition-colors shadow-lg"
                            title="Edit Camera Details"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteCamera(e, cam)}
                            className="p-1 rounded-full bg-black/80 hover:bg-rose-600 text-white border border-white/20 transition-colors shadow-lg"
                            title="Delete Camera"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Label & Details Info Section */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[10px] text-white truncate font-sans leading-none">
                          CAM {idx + 1}
                        </p>
                        <span className="text-[8px] text-zinc-400 truncate font-mono block leading-none mt-0.5">
                          {cam.name}
                        </span>
                      </div>

                      <span className="text-[8px] font-mono text-zinc-500 uppercase shrink-0">
                        DEV {cam.device}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Add Camera Card (only shown for admins when cameras exist) */}
              {!isViewer && (
                <div
                  onClick={handleOpenAdd}
                  className="w-24 sm:w-28 shrink-0 rounded-lg border border-dashed border-[#333333] hover:border-[#3B82F6] bg-[#161616] hover:bg-[#1c1c1c] p-2 flex flex-col items-center justify-center gap-1 cursor-pointer text-zinc-400 hover:text-white transition-all min-h-[68px]"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#202020] border border-[#2a2a2a]">
                    <Plus className="h-3 w-3 text-[#3B82F6]" />
                  </div>
                  <span className="text-[9px] font-medium font-sans">Add Camera</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Arrow */}
        {devices.length > 0 && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 z-20 h-full px-1 bg-gradient-to-l from-black/80 to-transparent text-zinc-400 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Camera Add / Edit Modal */}
      <CameraEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCam(null);
        }}
        camera={editingCam}
        onSaved={() => {
          if (onRefreshDevices) onRefreshDevices();
          if (onShowToast) onShowToast(editingCam ? 'Camera updated' : 'Camera added');
        }}
      />

      {/* Delete Camera Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(camToDelete)}
        title="Delete Camera"
        message={
          <p>
            Are you sure you want to delete camera <strong className="text-white">"{camToDelete?.name}"</strong> ({camToDelete?.device})?
            This will stop the video feed and remove the camera from active surveillance.
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
