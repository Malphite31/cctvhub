import React, { useState, useEffect } from 'react';
import { UserSessionLog } from '../types';
import {
  Laptop,
  Smartphone,
  Globe,
  RefreshCw,
  LogOut,
  Search,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface SessionLogsViewProps {
  onShowToast: (msg: string, isErr?: boolean) => void;
}

export const SessionLogsView: React.FC<SessionLogsViewProps> = ({ onShowToast }) => {
  const [sessions, setSessions] = useState<UserSessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all');

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/sessions?limit=200');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      onShowToast('Failed to fetch session audit logs', true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSessions = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        onShowToast(`Purged ${data.cleared_count || 0} session audit log entries`);
        setShowClearModal(false);
        fetchSessions();
      } else {
        onShowToast('Failed to clear session logs', true);
      }
    } catch {
      onShowToast('Error connecting to session audit service', true);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatDT = (ts?: number) => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour12: false })}`;
  };

  const activeCount = sessions.filter((s) => s.status === 'active').length;

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus === 'active' && s.status !== 'active') return false;
    if (filterStatus === 'ended' && s.status !== 'ended') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.username.toLowerCase().includes(q) ||
      (s.display_name && s.display_name.toLowerCase().includes(q)) ||
      s.ip_address.toLowerCase().includes(q) ||
      s.device_info.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3 text-xs font-sans select-none">
      {/* Top Compact Control Bar: Search + Filter Pills + Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 sm:p-2.5 rounded-lg border border-[#222222] bg-[#111111] shrink-0">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter sessions by user, IP, or device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#161616] border border-[#262626] p-0.5 rounded-lg overflow-x-auto no-scrollbar shrink-0">
          {(['all', 'active', 'ended'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterStatus(mode)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono capitalize whitespace-nowrap transition-colors shrink-0 ${
                filterStatus === mode
                  ? 'bg-[#3B82F6] text-white font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode} ({mode === 'all' ? sessions.length : mode === 'active' ? activeCount : sessions.length - activeCount})
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-mono transition-colors"
              title="Clear all session audit logs"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchSessions}
            disabled={isLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white border border-[#2a2a2a] text-xs font-mono transition-colors disabled:opacity-50"
            title="Refresh session logs"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sessions Activity List */}
      <div className="rounded-lg border border-[#222222] bg-[#111111] p-2.5 sm:p-3 space-y-2 shadow-sm flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-xs font-mono">
              Audit Entries
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
              {filteredSessions.length}
            </span>
          </div>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/70 border border-emerald-800/80 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount} Online
            </span>
          )}
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 font-mono text-xs">
            No session activity found matching your criteria.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredSessions.map((sess) => {
              const isActive = sess.status === 'active';
              const isMobile =
                sess.device_info.toLowerCase().includes('phone') ||
                sess.device_info.toLowerCase().includes('android') ||
                sess.device_info.toLowerCase().includes('ipad');

              return (
                <div
                  key={sess.session_id || sess.id}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-[#121c16] border-emerald-800/50 shadow-xs'
                      : 'bg-[#151518] border-[#222222] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5">
                    {/* User and Device Info */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-md shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {isMobile ? <Smartphone className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                      </div>

                      <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white font-mono text-xs truncate">
                          {sess.username}
                        </span>
                        {sess.display_name && (
                          <span className="text-zinc-400 text-xs truncate">({sess.display_name})</span>
                        )}
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wider ${
                          sess.role === 'admin'
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-800/40'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {sess.role}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 font-mono text-[9px]">
                          <LogOut className="h-2.5 w-2.5 text-zinc-500" />
                          <span className="capitalize">{sess.logout_reason.replace(/_/g, ' ')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Second Row: Technical Specs & Timestamps */}
                  <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-[#202024] text-[10px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="text-zinc-300 truncate">{sess.device_info}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-[#3B82F6] flex items-center gap-1 shrink-0">
                        <Globe className="h-2.5 w-2.5" />
                        {sess.ip_address}
                      </span>
                      {sess.location && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-500 truncate">[{sess.location}]</span>
                        </>
                      )}
                    </div>

                    <div className="text-zinc-400 shrink-0 text-right">
                      <span>Login: {formatDT(sess.login_time)}</span>
                      {!isActive && sess.logout_time && (
                        <span className="text-zinc-500 ml-2">End: {formatDT(sess.logout_time)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear Session Logs Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title="Clear Session Audit Logs"
        message={
          <p>
            Are you sure you want to purge all <strong className="text-white">{sessions.length}</strong> session audit records?
            This will permanently remove device, IP, and timestamp history from the database.
          </p>
        }
        confirmText="Purge All Records"
        isLoading={isClearing}
        variant="danger"
        onConfirm={handleClearSessions}
        onClose={() => setShowClearModal(false)}
      />
    </div>
  );
};
