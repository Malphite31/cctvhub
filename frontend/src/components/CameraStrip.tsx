import React, { useState, useRef } from 'react';
import { CameraDevice } from '../types';
import { CameraEditModal } from './CameraEditModal';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Edit3,
  Trash2
} from 'lucide-react';

interface CameraStripProps {
  devices: CameraDevice[];
  activeDevice: string;
  onSelectDevice: (dev: string) => void;
  onOpenSettings: () => void;
  onRefreshDevices?: () => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const CameraStrip: React.FC<CameraStripProps> = ({
  devices,
  activeDevice,
  onSelectDevice,
  onOpenSettings,
  onRefreshDevices,
  onShowToast,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCam, setEditingCam] = useState<CameraDevice | null>(null);
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

  const handleDeleteCamera = async (e: React.MouseEvent, cam: CameraDevice) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/cameras/${cam.device}`, { method: 'DELETE' });
      if (res.ok) {
        if (onShowToast) onShowToast(`Camera "${cam.name}" deleted`);
        if (onRefreshDevices) onRefreshDevices();
      } else {
        if (onShowToast) onShowToast('Failed to delete camera', true);
      }
    } catch {
      if (onShowToast) onShowToast('Error deleting camera', true);
    }
  };

  return (
    <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 space-y-2.5 select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-[11px] text-white tracking-tight uppercase font-mono">
            Cameras ({devices.length})
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
          >
            <Plus className="h-3 w-3 text-[#3B82F6]" />
            <span>Add Camera</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="text-[11px] font-mono text-[#3B82F6] hover:underline"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative flex items-center group/carousel">
        {/* Left Arrow */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 z-20 h-full px-1.5 bg-gradient-to-r from-black/80 to-transparent text-zinc-400 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Scrollable Horizontal Camera Cards */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar w-full py-0.5"
        >
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-500 w-full text-xs font-mono gap-2 border border-dashed border-[#262626] rounded-lg">
              <div className="flex items-center gap-1.5 opacity-60">
                <Video className="h-4 w-4" />
                <span>No cameras connected</span>
              </div>
              <button
                onClick={handleOpenAdd}
                className="px-2.5 py-1 bg-[#3B82F6] hover:bg-blue-600 text-white rounded text-[10px] font-medium font-sans flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Add Camera Now</span>
              </button>
            </div>
          ) : (
            devices.map((cam, idx) => {
              const isActive = activeDevice === cam.device;
              return (
                <div
                  key={cam.device}
                  onClick={() => onSelectDevice(cam.device)}
                  className={`w-48 sm:w-56 shrink-0 rounded-lg bg-[#161616] p-2 cursor-pointer transition-all duration-150 border flex flex-col justify-between group relative ${
                    isActive
                      ? 'border-[#3B82F6] ring-1 ring-[#3B82F6]'
                      : 'border-[#222222] hover:border-zinc-600'
                  }`}
                >
                  {/* Thumbnail Container with Hover Edit / Delete Action Overlay */}
                  <div className="relative aspect-video rounded bg-black overflow-hidden mb-1.5">
                    <img
                      src={`/api/stream/live?dev=${cam.device}`}
                      alt={cam.name}
                      className="w-full h-full object-cover"
                    />

                    {/* Top Right: Live Tag */}
                    <span className="absolute top-1 right-1 bg-black/80 backdrop-blur-xs px-1 py-0.2 rounded text-[8px] font-mono text-emerald-400">
                      ● LIVE
                    </span>

                    {/* Quick Hover Action Overlay on Thumbnail */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      <button
                        onClick={(e) => handleOpenEdit(e, cam)}
                        className="p-1.5 rounded-full bg-black/80 hover:bg-[#3B82F6] text-white border border-white/20 transition-colors shadow-lg"
                        title="Edit Camera Details"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCamera(e, cam)}
                        className="p-1.5 rounded-full bg-black/80 hover:bg-rose-600 text-white border border-white/20 transition-colors shadow-lg"
                        title="Delete Camera"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Label & Details Info Section */}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] text-white truncate font-sans">
                        CAM {idx + 1}
                      </p>
                      <span className="text-[9px] text-zinc-400 truncate font-mono block">
                        {cam.name}
                      </span>
                    </div>

                    <span className="text-[9px] font-mono text-zinc-500 uppercase shrink-0">
                      DEV {cam.device}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Camera Card */}
          <div
            onClick={handleOpenAdd}
            className="w-48 sm:w-56 shrink-0 rounded-lg border border-dashed border-[#333333] hover:border-[#3B82F6] bg-[#161616] hover:bg-[#1c1c1c] p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-zinc-400 hover:text-white transition-all min-h-[110px]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#202020] border border-[#2a2a2a]">
              <Plus className="h-3.5 w-3.5 text-[#3B82F6]" />
            </div>
            <span className="text-[11px] font-medium font-sans">Add Camera</span>
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 z-20 h-full px-2 bg-gradient-to-l from-black/80 to-transparent text-zinc-400 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
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
    </div>
  );
};
