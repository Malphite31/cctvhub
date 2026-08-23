import React from 'react';
import { ScanFace, Activity, Video, Camera, UserPlus, Trash2, ArrowUpRight } from 'lucide-react';
import { SurveillanceEvent, EnrolledPerson } from '../types';

interface RightEventsSidebarProps {
  events: SurveillanceEvent[];
  faces: EnrolledPerson[];
  onOpenEnrollModal: () => void;
  onDeleteFace: (id: string) => void;
  onViewAllEvents: () => void;
  onOpenEvent?: (event: SurveillanceEvent) => void;
}

export const RightEventsSidebar: React.FC<RightEventsSidebarProps> = ({
  events,
  faces,
  onOpenEnrollModal,
  onDeleteFace,
  onViewAllEvents,
  onOpenEvent,
}) => {
  const formatTime = (timestamp?: number | string) => {
    if (!timestamp) return 'Just now';
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour12: false });
    }
    return String(timestamp);
  };

  return (
    <div className="w-full xl:w-72 2xl:w-80 h-full flex flex-col gap-1.5 select-none text-xs shrink-0 overflow-hidden">
      {/* 1. Real Events Feed Card */}
      <div className="flex-1 min-h-0 rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300">
              Surveillance Stream Logs
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">({events.length})</span>
          </div>
          <button
            onClick={onViewAllEvents}
            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase"
          >
            <span>Audit</span>
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Real Events Scrollable List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pt-1.5 pr-0.5">
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-6">
              <Activity className="h-5 w-5 mb-1.5 opacity-30 text-zinc-400" />
              <span className="font-mono text-[10px] tracking-wider uppercase">Zero Active Trigger Events</span>
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => onOpenEvent && onOpenEvent(ev)}
                className="flex items-center justify-between p-1.5 rounded bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/60 hover:border-zinc-600 cursor-pointer transition-colors gap-2"
              >
                {/* Timestamp Badge */}
                <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950/60 px-1 py-0.5 rounded font-semibold shrink-0">
                  {formatTime(ev.timestamp || ev.time)}
                </span>

                {/* Event Type Icon */}
                <div className="shrink-0">
                  {(ev.event_type === 'face' || ev.type === 'face') && (
                    <div className="p-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ScanFace className="h-3 w-3" />
                    </div>
                  )}
                  {(ev.event_type === 'recording' || ev.type === 'recording') && (
                    <div className="p-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Video className="h-3 w-3" />
                    </div>
                  )}
                  {(ev.event_type === 'snapshot' || ev.type === 'snapshot') && (
                    <div className="p-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Camera className="h-3 w-3" />
                    </div>
                  )}
                  {(ev.event_type === 'motion' || ev.type === 'motion') && (
                    <div className="p-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Activity className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Title & Details */}
                <div className="min-w-0 flex-1 truncate">
                  <p className="text-[10px] font-medium text-zinc-200 leading-tight truncate font-sans">
                    {ev.title}
                  </p>
                  <span className="text-[9px] text-zinc-500 truncate block font-mono">{ev.camera_id || ev.camera || 'DEV 0'}</span>
                </div>

                {/* Optional Thumbnail */}
                {(ev.thumbnail_url || ev.thumbnail) && (
                  <div className="h-6 w-9 rounded overflow-hidden border border-zinc-800 bg-zinc-950 shrink-0">
                    <img src={ev.thumbnail_url || ev.thumbnail} alt="Event Thumbnail" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Biometrics Face Recognition Roster */}
      <div className="h-44 rounded border border-zinc-800/80 bg-zinc-950 p-2 flex flex-col justify-between shrink-0 overflow-hidden">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300">
              Enrolled Identities
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">({faces.length})</span>
          </div>
          <button
            onClick={onOpenEnrollModal}
            className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase"
          >
            <UserPlus className="h-2.5 w-2.5" />
            <span>+ Add</span>
          </button>
        </div>

        {/* Faces Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1 pr-0.5">
          {faces.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-2">
              <ScanFace className="h-4 w-4 mb-1 opacity-30 text-blue-400" />
              <p className="text-[10px] font-mono tracking-wider uppercase">Zero Enrolled Profiles</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {faces.map((person) => (
                <div
                  key={person.id}
                  className="group relative flex flex-col items-center text-center rounded p-1 bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 transition-all"
                >
                  <button
                    onClick={() => onDeleteFace(person.id)}
                    className="absolute top-1 right-1 z-20 p-0.5 bg-black/80 hover:bg-rose-600 text-zinc-400 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Profile"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>

                  <div className="h-10 w-full rounded overflow-hidden bg-zinc-950 mb-0.5 border border-zinc-800/80">
                    <img
                      src={person.photo_url || person.image}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <p className="text-[9px] font-semibold text-zinc-200 truncate w-full leading-tight font-mono">
                    {person.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onOpenEnrollModal}
          className="w-full flex items-center justify-center gap-1.5 py-1 rounded border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-200 text-[10px] font-mono uppercase font-semibold transition-colors shrink-0"
        >
          <UserPlus className="h-3 w-3 text-blue-400" />
          <span>Enroll New Profile</span>
        </button>
      </div>
    </div>
  );
};
