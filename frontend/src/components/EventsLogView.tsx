import React, { useState, useMemo } from 'react';
import { SurveillanceEvent } from '../types';
import {
  Bell,
  Search,
  ScanFace,
  Video,
  Camera,
  Activity,
  Download,
  Clock,
  RefreshCw,
  Car,
  Trash2,
  Eye,
  FileJson,
  CheckSquare,
  Square
} from 'lucide-react';

import { ConfirmModal } from './ConfirmModal';

interface EventsLogViewProps {
  events: SurveillanceEvent[];
  onRefresh: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
  onOpenEvent?: (event: SurveillanceEvent) => void;
  onDeleteEvent?: (id: string | number) => void;
  onClearEvents?: () => void;
  onBatchDeleteEvents?: (ids: (string | number)[]) => void;
}

export const EventsLogView: React.FC<EventsLogViewProps> = ({
  events,
  onRefresh,
  onShowToast,
  onOpenEvent,
  onDeleteEvent,
  onClearEvents,
  onBatchDeleteEvents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'face' | 'motion' | 'vehicle' | 'recording' | 'snapshot'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [showClearModal, setShowClearModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<(string | number) | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const type = (ev.event_type || ev.type || '').toLowerCase();
      const matchesFilter =
        selectedFilter === 'all' ||
        (selectedFilter === 'face' && type.includes('face')) ||
        (selectedFilter === 'motion' && type.includes('motion')) ||
        (selectedFilter === 'vehicle' && type.includes('vehicle')) ||
        (selectedFilter === 'recording' && type.includes('recording')) ||
        (selectedFilter === 'snapshot' && type.includes('snapshot'));

      const title = (ev.title || ev.details || '').toLowerCase();
      const camera = (ev.camera_id || ev.camera || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || title.includes(q) || camera.includes(q) || type.includes(q) || String(ev.id).includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [events, selectedFilter, searchQuery]);

  const formatFullDate = (timestamp?: number | string) => {
    if (!timestamp) return 'Just now';
    const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const handleExportCSV = () => {
    if (filteredEvents.length === 0) {
      onShowToast('No logs to export', true);
      return;
    }
    const headers = ['ID', 'Timestamp_Local', 'Timestamp_Epoch', 'Event_Type', 'Camera', 'Title', 'Details', 'Thumbnail_URL', 'Clip_URL'];
    const rows = filteredEvents.map((ev) => [
      ev.id,
      `"${formatFullDate(ev.timestamp || ev.time)}"`,
      ev.timestamp || '',
      ev.event_type || ev.type || 'General',
      `"${(ev.camera_id || ev.camera || 'Default').replace(/"/g, '""')}"`,
      `"${(ev.title || '').replace(/"/g, '""')}"`,
      `"${(ev.details || '').replace(/"/g, '""')}"`,
      `"${(ev.thumbnail_url || ev.thumbnail || '').replace(/"/g, '""')}"`,
      `"${(ev.clip_url || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cctv_events_audit_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${filteredEvents.length} event logs to CSV`);
  };

  const handleExportJSON = () => {
    if (filteredEvents.length === 0) {
      onShowToast('No logs to export', true);
      return;
    }
    const exportData = {
      exported_at: new Date().toISOString(),
      total_records: filteredEvents.length,
      events: filteredEvents
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cctv_events_audit_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${filteredEvents.length} event logs to JSON`);
  };

  const handleDownloadRowMediaOrJSON = (e: React.MouseEvent, ev: SurveillanceEvent) => {
    e.stopPropagation();
    const mediaUrl = ev.clip_url || ev.thumbnail_url || ev.thumbnail;
    if (mediaUrl) {
      const a = document.createElement('a');
      a.href = mediaUrl;
      const isVideo = !!ev.clip_url || (ev.event_type || ev.type || '').includes('recording');
      a.download = `event_${ev.id}_${ev.camera_id || 'cam'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onShowToast(`Downloading event #${ev.id} media asset...`);
    } else {
      const blob = new Blob([JSON.stringify(ev, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_log_${ev.id}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast(`Downloaded log #${ev.id} JSON report`);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
    }
  };

  const handleToggleSelectOne = (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmClearEvents = () => {
    if (onClearEvents) {
      setSelectedIds(new Set());
      onClearEvents();
    }
    setShowClearModal(false);
  };

  const handleConfirmDeleteSingleEvent = () => {
    if (eventToDelete !== null && onDeleteEvent) {
      onDeleteEvent(eventToDelete);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(eventToDelete);
        return next;
      });
    }
    setEventToDelete(null);
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) {
      setShowBatchDeleteModal(false);
      return;
    }
    const idsList = Array.from(selectedIds);
    if (onBatchDeleteEvents) {
      await onBatchDeleteEvents(idsList);
    } else if (onDeleteEvent) {
      for (const id of idsList) {
        await onDeleteEvent(id);
      }
    }
    setSelectedIds(new Set());
    setShowBatchDeleteModal(false);
  };

  const renderBadge = (type: string) => {
    if (type.includes('face')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 shrink-0">
          <ScanFace className="h-2.5 w-2.5" />
          FACE RECOG
        </span>
      );
    }
    if (type.includes('recording')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60 shrink-0">
          <Video className="h-2.5 w-2.5" />
          RECORDING
        </span>
      );
    }
    if (type.includes('snapshot')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-950/80 text-purple-300 border border-purple-800/60 shrink-0">
          <Camera className="h-2.5 w-2.5" />
          SNAPSHOT
        </span>
      );
    }
    if (type.includes('vehicle')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-white border border-zinc-700 shrink-0">
          <Car className="h-2.5 w-2.5" />
          VEHICLE
        </span>
      );
    }
    if (type.includes('motion')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shrink-0">
          <Activity className="h-2.5 w-2.5" />
          MOTION
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
        <Bell className="h-2.5 w-2.5" />
        SYSTEM
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 select-none text-xs">
      {/* 1. Top Header & Action Controls */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 sm:p-4 space-y-2.5 sm:space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-white font-sans truncate">
                Surveillance Audit Trail & Event Logs
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono hidden sm:block truncate">
                Click any log to view details, inspect video/snapshots, download records, or delete items.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-mono"
              title="Download CSV log audit trail"
            >
              <Download className="h-3 w-3 text-emerald-400" />
              <span>CSV</span>
            </button>

            {/* Export JSON Button */}
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-mono"
              title="Download JSON log archive"
            >
              <FileJson className="h-3 w-3 text-[#3B82F6]" />
              <span>JSON</span>
            </button>

            {/* Clear All Logs Button */}
            {onClearEvents && (
              <button
                onClick={() => setShowClearModal(true)}
                disabled={events.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 border border-[#333] hover:border-rose-900/60 transition-colors text-[11px] font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear all logged events"
              >
                <Trash2 className="h-3 w-3 text-rose-400" />
                <span className="hidden sm:inline">Clear All</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-white border border-[#333] transition-colors text-[11px] font-mono"
              title="Refresh log feed"
            >
              <RefreshCw className="h-3 w-3 text-[#3B82F6]" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, identity, event title, or camera..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#161616] border border-[#222222] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-sans"
            />
          </div>

          {/* Filter Pills - Horizontal Scroll on Mobile */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#161616] border border-[#222222] overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: 'All', count: events.length },
              { id: 'face', label: 'Faces', count: events.filter((e) => (e.event_type || e.type || '').includes('face')).length },
              { id: 'motion', label: 'Motion', count: events.filter((e) => (e.event_type || e.type || '').includes('motion')).length },
              { id: 'vehicle', label: 'Vehicles', count: events.filter((e) => (e.event_type || e.type || '').includes('vehicle')).length },
              { id: 'recording', label: 'Clips', count: events.filter((e) => (e.event_type || e.type || '').includes('recording')).length },
              { id: 'snapshot', label: 'Snaps', count: events.filter((e) => (e.event_type || e.type || '').includes('snapshot')).length },
            ].map((tab) => {
              const isSelected = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id as any)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-[#3B82F6] text-white font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-[#222222] text-zinc-400'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Batch Selection Banner */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#1e1b18] border border-amber-500/30 text-xs font-mono animate-in fade-in duration-150">
            <span className="font-semibold text-amber-300">{selectedIds.size} log{selectedIds.size > 1 ? 's' : ''} selected</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-0.5 rounded bg-[#262626] hover:bg-[#333333] text-zinc-300 text-[11px] font-mono transition-colors"
              >
                Deselect
              </button>
              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold font-mono transition-colors shadow-xs"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Events Feed List Container */}
      <div className="flex-1 min-h-0 rounded-xl border border-[#222222] bg-[#121212] overflow-hidden flex flex-col">
        {/* DESKTOP TABLE VIEW (md: and above) */}
        <div className="hidden md:flex flex-col flex-1 min-h-0">
          {/* Table Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#222222] bg-[#161616] text-[10px] font-mono uppercase tracking-wider text-zinc-400 shrink-0">
            <div className="flex items-center gap-3 w-56">
              <button
                onClick={handleToggleSelectAll}
                className="text-zinc-400 hover:text-white transition-colors"
                title={selectedIds.size === filteredEvents.length ? 'Deselect All' : 'Select All'}
              >
                {filteredEvents.length > 0 && selectedIds.size === filteredEvents.length ? (
                  <CheckSquare className="h-4 w-4 text-[#3B82F6]" />
                ) : (
                  <Square className="h-4 w-4 text-zinc-600" />
                )}
              </button>
              <span>Timestamp</span>
            </div>

            <div className="w-32">Classification</div>
            <div className="flex-1 px-3">Description / Metadata</div>
            <div className="w-28 text-center">Camera</div>
            <div className="w-28 text-right pr-2">Actions</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1e1e1e]">
            {filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Activity className="h-8 w-8 opacity-20 text-zinc-400" />
                <p className="font-mono text-xs text-zinc-300">No Surveillance Events Found</p>
                <span className="text-[11px] text-zinc-500 max-w-sm">
                  Real-time security logs, recognized identities, and camera triggers will populate automatically.
                </span>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const type = (ev.event_type || ev.type || 'general').toLowerCase();
                const isSelected = selectedIds.has(ev.id);

                return (
                  <div
                    key={ev.id}
                    onClick={() => onOpenEvent && onOpenEvent(ev)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors text-xs gap-3 group ${
                      isSelected ? 'bg-[#1a1f2c] hover:bg-[#202738]' : 'hover:bg-[#161616]'
                    }`}
                  >
                    {/* Checkbox & Timestamp */}
                    <div className="w-56 font-mono text-[11px] text-zinc-300 flex items-center gap-3 shrink-0">
                      <button
                        onClick={(e) => handleToggleSelectOne(e, ev.id)}
                        className="text-zinc-500 hover:text-white transition-colors shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#3B82F6]" />
                        ) : (
                          <Square className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400" />
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{formatFullDate(ev.timestamp || ev.time)}</span>
                      </div>
                    </div>

                    {/* Classification Badge */}
                    <div className="w-32 shrink-0">
                      {renderBadge(type)}
                    </div>

                    {/* Title, Thumbnail & Details */}
                    <div className="flex-1 min-w-0 px-3 flex items-center gap-3">
                      {(ev.thumbnail_url || ev.thumbnail) && (
                        <div className="h-7 w-11 rounded overflow-hidden border border-[#222222] bg-[#161616] shrink-0 relative flex items-center justify-center">
                          <img
                            src={ev.thumbnail_url || ev.thumbnail}
                            alt="Event Thumbnail"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="truncate min-w-0">
                        <p className="font-semibold text-xs text-white truncate font-sans">
                          {ev.title || ev.details || 'Surveillance Trigger'}
                        </p>
                        {ev.details && ev.title && (
                          <p className="text-[10px] text-zinc-500 truncate font-mono">{ev.details}</p>
                        )}
                      </div>
                    </div>

                    {/* Camera */}
                    <div className="w-28 text-center font-mono text-[11px] text-zinc-400 shrink-0 truncate">
                      {ev.camera_id || ev.camera || 'CAM 1'}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="w-28 flex items-center justify-end gap-1 shrink-0 pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenEvent) onOpenEvent(ev);
                        }}
                        className="p-1 rounded bg-[#161616] group-hover:bg-[#222222] text-zinc-400 hover:text-white transition-colors"
                        title="Open event details"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#3B82F6]" />
                      </button>

                      <button
                        onClick={(e) => handleDownloadRowMediaOrJSON(e, ev)}
                        className="p-1 rounded bg-[#161616] group-hover:bg-[#222222] text-zinc-400 hover:text-white transition-colors"
                        title="Download event media or JSON"
                      >
                        <Download className="h-3.5 w-3.5 text-emerald-400" />
                      </button>

                      {onDeleteEvent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(ev.id);
                          }}
                          className="p-1 rounded bg-[#161616] group-hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Delete this log"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MOBILE COMPACT CARDS VIEW (< md screens) */}
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-[#1e1e1e] p-1.5 space-y-1.5">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Activity className="h-7 w-7 opacity-20 text-zinc-400" />
              <p className="font-mono text-xs text-zinc-300">No Events Found</p>
              <span className="text-[10px] text-zinc-500">Security triggers will populate automatically.</span>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const type = (ev.event_type || ev.type || 'general').toLowerCase();
              const isSelected = selectedIds.has(ev.id);

              return (
                <div
                  key={ev.id}
                  onClick={() => onOpenEvent && onOpenEvent(ev)}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#1a1f2c] border-[#3B82F6]/50'
                      : 'bg-[#151515] border-[#222222] hover:border-zinc-700'
                  }`}
                >
                  {/* Top Line: Checkbox + Timestamp + Classification + Camera */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => handleToggleSelectOne(e, ev.id)}
                        className="text-zinc-500 hover:text-white transition-colors shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[#3B82F6]" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                      </button>
                      <span className="font-mono text-[10px] text-zinc-300 flex items-center gap-1 truncate">
                        <Clock className="h-3 w-3 text-zinc-500 shrink-0" />
                        {formatFullDate(ev.timestamp || ev.time)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderBadge(type)}
                      <span className="font-mono text-[9px] text-zinc-400 px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#262626]">
                        {ev.camera_id || ev.camera || 'CAM 1'}
                      </span>
                    </div>
                  </div>

                  {/* Middle Line: Thumbnail + Title & Details */}
                  <div className="flex items-center gap-2.5">
                    {(ev.thumbnail_url || ev.thumbnail) && (
                      <img
                        src={ev.thumbnail_url || ev.thumbnail}
                        alt="Event Thumbnail"
                        className="h-10 w-14 object-cover rounded border border-[#222222] bg-black shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-white truncate font-sans">
                        {ev.title || ev.details || 'Surveillance Trigger'}
                      </p>
                      {ev.details && ev.title && (
                        <p className="text-[10px] text-zinc-400 line-clamp-1 font-mono mt-0.5">
                          {ev.details}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom Line: Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#202020] text-[11px] font-mono">
                    <span className="text-[9px] text-zinc-500">ID #{ev.id}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenEvent) onOpenEvent(ev);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] hover:bg-[#282828] text-zinc-200 text-[10px]"
                      >
                        <Eye className="h-3 w-3 text-[#3B82F6]" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={(e) => handleDownloadRowMediaOrJSON(e, ev)}
                        className="p-1 rounded bg-[#202020] hover:bg-[#282828] text-zinc-300"
                        title="Download Asset"
                      >
                        <Download className="h-3 w-3 text-emerald-400" />
                      </button>

                      {onDeleteEvent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(ev.id);
                          }}
                          className="p-1 rounded bg-[#202020] hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Clear All Events Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title="Clear All Event Logs"
        message={
          <p>
            Are you sure you want to permanently clear all <strong className="text-white">{events.length}</strong> event logs?
            This will purge the audit trail history.
          </p>
        }
        confirmText="Clear All Logs"
        variant="danger"
        onConfirm={handleConfirmClearEvents}
        onClose={() => setShowClearModal(false)}
      />

      {/* Batch Delete Events Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title="Delete Selected Event Logs"
        message={
          <p>
            Are you sure you want to delete <strong className="text-white">{selectedIds.size}</strong> selected log entries?
          </p>
        }
        confirmText={`Delete (${selectedIds.size}) Logs`}
        variant="danger"
        onConfirm={handleConfirmBatchDelete}
        onClose={() => setShowBatchDeleteModal(false)}
      />

      {/* Single Event Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={eventToDelete !== null}
        title="Delete Event Log"
        message={
          <p>
            Are you sure you want to remove event log <strong className="text-white">#{eventToDelete}</strong> from the surveillance database?
          </p>
        }
        confirmText="Delete Log"
        variant="danger"
        onConfirm={handleConfirmDeleteSingleEvent}
        onClose={() => setEventToDelete(null)}
      />
    </div>
  );
};
