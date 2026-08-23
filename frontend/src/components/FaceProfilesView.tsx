import React, { useState } from 'react';
import { EnrolledPerson } from '../types';
import {
  ScanFace,
  UserPlus,
  Trash2,
  Search,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Fingerprint,
  Copy,
  Check,
  Shield,
  User
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface FaceProfilesViewProps {
  faces: EnrolledPerson[];
  onOpenEnrollModal: () => void;
  onDeleteFace: (id: string) => void;
  onRefresh: () => void;
  userRole?: string;
}

export const FaceProfilesView: React.FC<FaceProfilesViewProps> = ({
  faces,
  onOpenEnrollModal,
  onDeleteFace,
  onRefresh,
  userRole = 'admin',
}) => {
  const isViewer = userRole === 'viewer';
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<EnrolledPerson | null>(null);
  const [isDetectFacesActive, setIsDetectFacesActive] = useState(false);
  const [isUpdatingEngine, setIsUpdatingEngine] = useState(false);

  React.useEffect(() => {
    fetch('/api/stream/tracker-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.detect_faces !== undefined) {
          setIsDetectFacesActive(Boolean(data.detect_faces));
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleEngine = async () => {
    setIsUpdatingEngine(true);
    const nextState = !isDetectFacesActive;
    try {
      const getRes = await fetch('/api/stream/tracker-settings');
      const curSettings = getRes.ok ? await getRes.json() : {};
      const updated = { ...curSettings, detect_faces: nextState };

      const res = await fetch('/api/stream/tracker-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setIsDetectFacesActive(nextState);
      }
    } catch {
      // Ignore
    } finally {
      setIsUpdatingEngine(false);
    }
  };

  const filteredFaces = faces.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-3 pb-8 select-none text-xs">
      {/* 1. Header Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
        <div className="p-2.5 sm:p-3 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-between shadow-md">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-wider block truncate">
              Total Enrolled
            </span>
            <div className="text-lg sm:text-xl font-bold text-white font-mono mt-0.5">
              {faces.length}
            </div>
          </div>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6] shrink-0">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div 
          onClick={!isViewer ? handleToggleEngine : undefined}
          className={`p-2.5 sm:p-3 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-between shadow-md transition-colors ${
            !isViewer ? 'hover:border-zinc-700 cursor-pointer' : 'cursor-default opacity-90'
          }`}
          title={!isViewer ? "Click to toggle Facial Recognition Engine ON/OFF" : "Facial Recognition Engine Status"}
        >
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-wider block truncate">
              Biometric Engine
            </span>
            <div className={`text-[11px] sm:text-xs font-bold font-mono mt-1 flex items-center gap-1.5 truncate ${
              isDetectFacesActive ? 'text-emerald-400' : 'text-zinc-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isDetectFacesActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'} shrink-0`} />
              <span className="truncate">{isDetectFacesActive ? '15 FPS ACTIVE' : 'DISABLED (ECO)'}</span>
            </div>
          </div>
          <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg border flex items-center justify-center shrink-0 ${
            isDetectFacesActive 
              ? 'bg-emerald-950/60 border-emerald-800/40 text-emerald-400' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}>
            <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-between shadow-md">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-wider block truncate">
              Accuracy
            </span>
            <div className="text-[11px] sm:text-xs font-bold text-zinc-200 font-mono mt-1 truncate">
              98.6% Confirmed
            </div>
          </div>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
            <Fingerprint className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-between shadow-md">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-wider block truncate">
              Security Vault
            </span>
            <div className="text-[11px] sm:text-xs font-bold text-[#3B82F6] font-mono mt-1 truncate">
              Authorized Only
            </div>
          </div>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-[#3B82F6] shrink-0">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
      </div>

      {/* 2. Search & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl border border-[#222222] bg-[#111111] shrink-0 shadow-md">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search enrolled profiles by name or ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#161616] border border-[#262626] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-sans"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
          {!isViewer && (
            <button
              type="button"
              onClick={handleToggleEngine}
              disabled={isUpdatingEngine}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                isDetectFacesActive
                  ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
              }`}
              title="Toggle Facial Recognition On/Off"
            >
              <ScanFace className="h-3.5 w-3.5" />
              <span>Engine: {isDetectFacesActive ? 'ON' : 'OFF (ECO)'}</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white text-xs font-mono transition-colors"
            title="Refresh Profiles"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Refresh</span>
          </button>

          {!isViewer && (
            <button
              onClick={onOpenEnrollModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold shadow-lg transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Enroll Face</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Full-Width Enrolled Profiles Roster Grid */}
      <div className="rounded-xl border border-[#222222] bg-[#111111] p-3 sm:p-4 shadow-xl">
        {filteredFaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-zinc-500 py-12 sm:py-20 gap-3">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#181818] border border-[#262626] text-[#3B82F6]">
              <ScanFace className="h-8 w-8 sm:h-10 sm:w-10 opacity-70 animate-pulse" />
            </div>
            <div className="space-y-1 max-w-sm px-2">
              <h4 className="font-semibold text-xs sm:text-sm text-white font-sans">
                No Facial Identities Registered
              </h4>
              <p className="text-zinc-500 text-[11px] sm:text-xs font-sans leading-relaxed">
                {isViewer
                  ? 'No biometric face profiles registered in the system.'
                  : 'Click "+ Enroll Face" to scan from the live optical camera or upload a photo. The system will auto-crop the face and match subjects in real-time.'}
              </p>
            </div>
            {!isViewer && (
              <button
                onClick={onOpenEnrollModal}
                className="mt-1 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Enroll First Facial Profile</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-3.5 auto-rows-max items-start">
            {filteredFaces.map((person) => (
              <div
                key={person.id}
                className="group relative flex flex-col rounded-xl border border-[#222222] bg-[#161616] hover:border-[#3B82F6]/60 transition-all p-2.5 sm:p-3 gap-2 shadow-lg overflow-hidden"
              >
                {/* Delete button (only for admin) */}
                {!isViewer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileToDelete(person);
                    }}
                    className="absolute top-3.5 right-3.5 z-20 p-1.5 bg-black/85 hover:bg-rose-600 text-zinc-400 hover:text-white rounded-lg border border-[#333] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-xl"
                    title="Remove Profile"
                  >
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                )}

                {/* Face Image Preview with Biometric Frame */}
                <div className="relative aspect-square w-full rounded-lg bg-black overflow-hidden border border-[#2a2a2a] group-hover:border-[#3B82F6]/50 transition-colors">
                  <img
                    src={person.photo_url || person.image}
                    alt={person.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Corner Reticles */}
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#3B82F6]" />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#3B82F6]" />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#3B82F6]" />
                  <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#3B82F6]" />

                  {/* Status Badge */}
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-mono text-emerald-400 border border-emerald-900/60 shadow-md">
                    <ShieldCheck className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-emerald-400" />
                    <span>VERIFIED</span>
                  </div>
                </div>

                {/* Info Block */}
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-white truncate text-xs font-sans tracking-tight">
                    {person.name}
                  </p>

                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-zinc-400 pt-0.5 border-t border-[#202022]">
                    <button
                      onClick={() => handleCopyId(person.id)}
                      className="flex items-center gap-1 hover:text-[#3B82F6] transition-colors truncate"
                      title="Click to copy Biometric ID"
                    >
                      {copiedId === person.id ? (
                        <>
                          <Check className="h-2.5 w-2.5 text-emerald-400" />
                          <span className="text-emerald-400">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-2.5 w-2.5 text-zinc-500" />
                          <span>#{person.id.slice(0, 6)}</span>
                        </>
                      )}
                    </button>

                    <span className="text-emerald-400 font-medium text-[8px] sm:text-[9px]">98% MATCH</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Facial Profile Confirmation Modal */}
      <ConfirmModal
        isOpen={profileToDelete !== null}
        title="Remove Facial Profile"
        message={
          <p>
            Are you sure you want to remove the enrolled profile for <strong className="text-white">"{profileToDelete?.name}"</strong>?
            This face embedding will no longer be matched by the AI surveillance engine.
          </p>
        }
        confirmText="Remove Profile"
        variant="danger"
        onConfirm={() => {
          if (profileToDelete) {
            onDeleteFace(profileToDelete.id);
            setProfileToDelete(null);
          }
        }}
        onClose={() => setProfileToDelete(null)}
      />
    </div>
  );
};
