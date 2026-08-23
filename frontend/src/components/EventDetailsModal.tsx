import React, { useState } from 'react';
import {
  X,
  ScanFace,
  Video,
  Camera,
  Activity,
  Car,
  Bell,
  Download,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { SurveillanceEvent } from '../types';

interface EventDetailsModalProps {
  event: SurveillanceEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteEvent?: (id: string | number) => void;
  onShowToast?: (msg: string, isErr?: boolean) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  isOpen,
  onClose,
  onDeleteEvent,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !event) return null;

  const type = (event.event_type || event.type || 'general').toLowerCase();

  const formatFullDate = (timestamp?: number | string) => {
    if (!timestamp) return 'Unknown time';
    const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getRelativeTime = (timestamp?: number | string) => {
    if (!timestamp) return '';
    const now = Date.now();
    const t = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
    if (isNaN(t)) return '';
    const diffSec = Math.floor((now - t) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const mediaUrl = event.clip_url || event.thumbnail_url || event.thumbnail;
  const isVideo = !!event.clip_url || type.includes('recording');

  const handleCopyJSON = () => {
    const jsonStr = JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('Event metadata copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      if (onShowToast) onShowToast('Failed to copy to clipboard', true);
    });
  };

  const handleDownloadSingleJSON = () => {
    const jsonStr = JSON.stringify(event, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event_log_${event.id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast(`Downloaded log #${event.id} JSON`);
  };

  const handleDownloadMedia = async () => {
    if (!mediaUrl) {
      if (onShowToast) onShowToast('No media attached to this event', true);
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = mediaUrl;
      const ext = isVideo ? 'mp4' : 'jpg';
      a.download = `event_${event.id}_${event.camera_id || 'cam'}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (onShowToast) onShowToast(`Downloading event ${isVideo ? 'video' : 'snapshot'}...`);
    } catch {
      if (onShowToast) onShowToast('Failed to download media file', true);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteEvent) return;
    setIsDeleting(true);
    try {
      await onDeleteEvent(event.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] bg-[#121212] border border-[#262626] rounded-xl shadow-2xl flex flex-col overflow-hidden text-white font-sans text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-[#222222] bg-[#161616] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-[#1e1e1e] border border-[#2c2c2c] shrink-0">
              {type.includes('face') ? (
                <ScanFace className="h-4 w-4 text-[#3B82F6]" />
              ) : type.includes('recording') ? (
                <Video className="h-4 w-4 text-rose-400" />
              ) : type.includes('snapshot') ? (
                <Camera className="h-4 w-4 text-purple-400" />
              ) : type.includes('vehicle') ? (
                <Car className="h-4 w-4 text-white" />
              ) : type.includes('motion') ? (
                <Activity className="h-4 w-4 text-emerald-400" />
              ) : (
                <Bell className="h-4 w-4 text-amber-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-xs sm:text-sm text-white truncate font-sans">
                  {event.title || 'Surveillance Event'}
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-[#222] text-zinc-300 border border-[#333] shrink-0">
                  #{event.id}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                <span>{formatFullDate(event.timestamp || event.time)}</span>
                <span className="text-[#3B82F6] font-medium shrink-0">({getRelativeTime(event.timestamp || event.time)})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Media Viewport */}
          {mediaUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-[#222222] bg-black aspect-video flex items-center justify-center group">
              {isVideo ? (
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={event.title}
                  className="w-full h-full object-contain"
                />
              )}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[9px] font-mono text-zinc-300">
                <span>{isVideo ? 'MP4 Clip' : 'Snapshot'}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#222222] bg-[#161616] p-6 flex flex-col items-center justify-center text-center gap-1.5">
              <Activity className="h-7 w-7 text-zinc-600" />
              <p className="text-[11px] font-mono text-zinc-400">No media attachment for this trigger</p>
              <span className="text-[9px] text-zinc-600 font-mono">System logged telemetry data only</span>
            </div>
          )}

          {/* Metadata Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 sm:p-2.5 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[9px] text-zinc-500 font-mono uppercase block">Camera</span>
              <p className="text-[11px] font-mono font-semibold text-white mt-0.5 truncate">
                {event.camera_id || event.camera || 'CAM 1'}
              </p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[9px] text-zinc-500 font-mono uppercase block">Type</span>
              <p className="text-[11px] font-mono font-semibold text-[#3B82F6] uppercase mt-0.5 truncate">
                {event.event_type || event.type || 'GENERAL'}
              </p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[9px] text-zinc-500 font-mono uppercase block">Epoch</span>
              <p className="text-[11px] font-mono text-zinc-300 mt-0.5 truncate">
                {event.timestamp || 'N/A'}
              </p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-lg bg-[#161616] border border-[#222222]">
              <span className="text-[9px] text-zinc-500 font-mono uppercase block">Asset</span>
              <p className="text-[11px] font-mono text-emerald-400 font-semibold mt-0.5 truncate">
                {isVideo ? 'MP4 Video' : event.thumbnail_url ? 'JPG Image' : 'Log Only'}
              </p>
            </div>
          </div>

          {/* Details / Description Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium">
              Event Details & Audit Notes
            </label>
            <div className="p-2.5 rounded-lg bg-[#161616] border border-[#222222] text-[11px] font-mono text-zinc-300 leading-relaxed break-words">
              {event.details || event.title || 'Standard security event record logged by the CCTV engine.'}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-3.5 py-2.5 sm:px-5 sm:py-3 border-t border-[#222222] bg-[#161616] shrink-0">
          <div className="flex items-center gap-1.5">
            {onDeleteEvent && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-colors text-[11px] font-mono"
                title="Delete log"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            )}

            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-zinc-300 hover:text-white transition-colors text-[11px] font-mono"
              title="Copy JSON"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownloadSingleJSON}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-zinc-200 hover:text-white transition-colors text-[11px] font-mono"
              title="Download JSON log"
            >
              <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span>JSON</span>
            </button>

            {mediaUrl && (
              <button
                onClick={handleDownloadMedia}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white transition-colors text-[11px] font-semibold font-mono shadow-xs"
                title={isVideo ? 'Download recorded video clip' : 'Download high-res snapshot'}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isVideo ? 'MP4' : 'Image'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
