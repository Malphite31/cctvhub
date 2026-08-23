import React, { useState, useEffect } from 'react';
import { UserSessionLog } from '../types';
import {
  Activity,
  Laptop,
  Smartphone,
  Globe,
  RefreshCw,
  LogOut,
  Search
} from 'lucide-react';

interface SessionLogsViewProps {
  onShowToast: (msg: string, isErr?: boolean) => void;
}

export const SessionLogsView: React.FC<SessionLogsViewProps> = ({ onShowToast }) => {
  const [sessions, setSessions] = useState<UserSessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222222] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/30">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Device & Session Audit Logs
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 font-mono text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeCount} Active Now</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Live audit logging of devices, IP addresses, location origin, login time, and quit timestamps.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSessions}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161616] hover:bg-[#202020] text-zinc-200 border border-[#262626] font-mono text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by user, IP, device, or network location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212] border border-[#222222] rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:border-[#3B82F6] focus:outline-none transition-colors font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#121212] border border-[#222222] p-1 rounded-xl">
          {(['all', 'active', 'ended'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterStatus(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-mono capitalize transition-colors ${
                filterStatus === mode
                  ? 'bg-[#3B82F6] text-white font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode} ({mode === 'all' ? sessions.length : mode === 'active' ? activeCount : sessions.length - activeCount})
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Activity List */}
      <div className="rounded-2xl border border-[#222222] bg-[#121212] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
          <h2 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
            Recorded Activity ({filteredSessions.length})
          </h2>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-mono text-xs">
            No session activity found matching your criteria.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSessions.map((sess) => {
              const isActive = sess.status === 'active';
              const isMobile =
                sess.device_info.toLowerCase().includes('phone') ||
                sess.device_info.toLowerCase().includes('android') ||
                sess.device_info.toLowerCase().includes('ipad');

              return (
                <div
                  key={sess.session_id || sess.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isActive
                      ? 'bg-emerald-950/20 border-emerald-800/60 shadow-sm'
                      : 'bg-[#18181c] border-[#26262a]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    {/* Left: Device & User Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700'
                      }`}>
                        {isMobile ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white font-mono text-xs">
                            {sess.username}
                          </span>
                          {sess.display_name && (
                            <span className="text-zinc-400 text-xs">({sess.display_name})</span>
                          )}
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wider ${
                            sess.role === 'admin'
                              ? 'bg-blue-900/40 text-blue-300 border border-blue-800/40'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}>
                            {sess.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono flex-wrap">
                          <span className="text-zinc-200">{sess.device_info}</span>
                          <span>•</span>
                          <span className="text-[#3B82F6] flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {sess.ip_address}
                          </span>
                          <span>•</span>
                          <span className="text-zinc-500 font-medium">[{sess.location}]</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Badges & Timestamps */}
                    <div className="text-right shrink-0 space-y-1.5 sm:min-w-[170px]">
                      {isActive ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>ACTIVE NOW</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                          <LogOut className="h-3 w-3 text-zinc-500" />
                          <span className="capitalize">{sess.logout_reason.replace(/_/g, ' ')}</span>
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-zinc-500 space-y-0.5">
                        <div>Connected: <span className="text-zinc-300">{formatDT(sess.login_time)}</span></div>
                        {!isActive && sess.logout_time && (
                          <div>Disconnected: <span className="text-zinc-300">{formatDT(sess.logout_time)}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
