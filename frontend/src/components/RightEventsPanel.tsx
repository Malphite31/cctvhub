import React, { useState } from 'react';
import {
  ScanFace,
  Activity,
  Car,
  Video,
  Camera,
  UserPlus,
  ArrowRight,
  Plus,
  ChevronDown
} from 'lucide-react';
import { SurveillanceEvent, EnrolledPerson } from '../types';

interface RightEventsPanelProps {
  events: SurveillanceEvent[];
  faces: EnrolledPerson[];
  onViewAllEvents: () => void;
  onViewAllFaces: () => void;
  onOpenEnrollModal: () => void;
  onOpenEvent?: (event: SurveillanceEvent) => void;
  userRole?: string;
}

export const RightEventsPanel: React.FC<RightEventsPanelProps> = ({
  events,
  faces,
  onViewAllEvents,
  onViewAllFaces,
  onOpenEnrollModal,
  onOpenEvent,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'face' | 'motion' | 'vehicle'>('all');

  const filteredEvents = events.filter((ev) => {
    if (selectedFilter === 'all') return true;
    const type = (ev.event_type || ev.type || '').toLowerCase();
    return type.includes(selectedFilter);
  });

  const formatTime = (timestamp?: number | string) => {
    if (!timestamp) return 'Just now';
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour12: false });
    }
    return String(timestamp);
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none text-xs xl:h-full">
      {/* 1. LIVE EVENT LOG (Top ~60% on desktop) */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 flex flex-col xl:flex-[3] min-h-[240px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#222222] shrink-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-xs text-white uppercase font-mono tracking-wider">
              Live Event Log
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">({events.length})</span>
          </div>

          {/* Filter Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as any)}
              className="bg-[#161616] hover:bg-[#1c1c1c] border border-[#262626] rounded-lg pl-2 pr-5 py-0.5 text-zinc-200 outline-none cursor-pointer text-[10px] font-mono appearance-none transition-colors"
            >
              <option value="all">All Events</option>
              <option value="face">Faces</option>
              <option value="motion">Motion</option>
              <option value="vehicle">Vehicles</option>
            </select>
            <ChevronDown className="absolute right-1.5 h-2.5 w-2.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-0.5">
          {filteredEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-6 gap-1.5">
              <Activity className="h-5 w-5 opacity-30 text-zinc-400" />
              <span className="font-mono text-[11px]">No Events Logged</span>
            </div>
          ) : (
            filteredEvents.slice(0, 15).map((ev) => (
              <div
                key={ev.id}
                onClick={() => onOpenEvent && onOpenEvent(ev)}
                className="flex items-center justify-between p-2 rounded-lg bg-[#161616] border border-[#222222] hover:border-zinc-600 hover:bg-[#1a1a1a] cursor-pointer transition-all gap-2 group"
              >
                {/* Time */}
                <span className="font-mono text-[9px] text-zinc-400 shrink-0">
                  {formatTime(ev.timestamp || ev.time)}
                </span>

                {/* Event Icon */}
                <div className="flex h-6 w-6 items-center justify-center rounded bg-[#1e1e1e] border border-[#2a2a2a] shrink-0">
                  {(ev.event_type === 'face' || ev.type === 'face') && (
                    <ScanFace className="h-3 w-3 text-[#3B82F6]" />
                  )}
                  {(ev.event_type === 'motion' || ev.type === 'motion') && (
                    <Activity className="h-3 w-3 text-emerald-400" />
                  )}
                  {(ev.event_type === 'vehicle' || ev.type === 'vehicle') && (
                    <Car className="h-3 w-3 text-white" />
                  )}
                  {(ev.event_type === 'recording' || ev.type === 'recording') && (
                    <Video className="h-3 w-3 text-rose-400" />
                  )}
                  {(ev.event_type === 'snapshot' || ev.type === 'snapshot') && (
                    <Camera className="h-3 w-3 text-purple-400" />
                  )}
                </div>

                {/* Title & Details */}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[11px] text-white truncate leading-tight font-sans">
                    {ev.title}
                  </p>
                  <span className="text-[9px] text-zinc-500 truncate block font-mono">
                    {ev.camera_id || ev.camera || 'CAM 1'}
                  </span>
                </div>

                {/* Thumbnail */}
                {(ev.thumbnail_url || ev.thumbnail) && (
                  <div className="h-7 w-10 rounded overflow-hidden border border-[#222222] bg-[#161616] shrink-0 relative flex items-center justify-center">
                    <img
                      src={ev.thumbnail_url || ev.thumbnail}
                      alt="Event"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* View All Link */}
        <div className="pt-1.5 border-t border-[#222222] flex justify-center shrink-0">
          <button
            onClick={onViewAllEvents}
            className="flex items-center gap-1 text-[11px] font-mono font-medium text-[#3B82F6] hover:underline"
          >
            <span>View All Events</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 2. FACE RECOGNITION (Bottom ~40% on desktop) */}
      <div className="rounded-xl border border-[#222222] bg-[#121212] p-3 flex flex-col xl:flex-[2] min-h-[190px] overflow-hidden justify-between">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#222222] shrink-0">
          <div className="flex items-center gap-1.5">
            <ScanFace className="h-3.5 w-3.5 text-[#3B82F6]" />
            <h4 className="font-semibold text-xs text-white uppercase font-mono tracking-wider">
              Face Recognition
            </h4>
          </div>
          
          <div className="flex items-center gap-2">
            {!isViewer && (
              <button
                onClick={onOpenEnrollModal}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
              >
                <Plus className="h-2.5 w-2.5 text-[#3B82F6]" />
                <span>Enroll</span>
              </button>
            )}

            <button
              onClick={onViewAllFaces}
              className="text-[10px] font-mono text-[#3B82F6] hover:underline"
            >
              View ({faces.length})
            </button>
          </div>
        </div>

        {/* Faces Content */}
        <div className="flex-1 py-2 flex flex-col justify-center overflow-y-auto">
          {faces.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-3 gap-2">
              <div className="p-2.5 rounded-full bg-[#181818] border border-[#262626]">
                <ScanFace className="h-5 w-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="font-mono text-[11px] text-zinc-300 font-medium">No Enrolled Faces</p>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  {isViewer ? 'No biometric identities registered' : 'Enroll face identities for optical recognition'}
                </p>
              </div>
              {!isViewer && (
                <button
                  onClick={onOpenEnrollModal}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-[11px] font-medium hover:bg-blue-600 shadow-md transition-colors"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>+ Enroll Subject Face</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-3 gap-2">
              {faces.slice(0, 6).map((person) => (
                <div
                  key={person.id}
                  className="rounded-lg bg-[#161616] border border-[#222222] p-1.5 flex flex-col items-center text-center space-y-1 group hover:border-[#3B82F6]/50 transition-colors"
                >
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-black border border-[#262626] shrink-0">
                    <img
                      src={person.photo_url || person.image}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] font-mono text-emerald-400 py-0.2">
                      {person.matchPercentage || 95}%
                    </span>
                  </div>
                  <p className="font-semibold text-[10px] text-white truncate w-full font-sans group-hover:text-[#3B82F6] transition-colors">
                    {person.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
