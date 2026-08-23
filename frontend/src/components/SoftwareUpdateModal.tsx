import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle, Terminal, Sparkles, X, ArrowUpRight, Loader2 } from 'lucide-react';
import { UpdateCheckInfo } from '../types';

interface SoftwareUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckInfo | null;
  onRefreshCheck: () => void;
  onShowToast: (msg: string, isErr?: boolean) => void;
}

export const SoftwareUpdateModal: React.FC<SoftwareUpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  onRefreshCheck,
  onShowToast,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const pollIntervalRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    if (isApplying) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/system/update/status');
          if (res.ok) {
            const data = await res.json();
            setUpdateStatus(data.status || 'idle');
            if (data.logs) setLogs(data.logs);
            if (data.error) setErrorMessage(data.error);

            if (data.status === 'restarting') {
              setIsReconnecting(true);
            }

            if (data.status === 'success' || data.status === 'error') {
              setIsApplying(false);
              clearInterval(pollIntervalRef.current);
              if (data.status === 'success') {
                onShowToast('CCTV Hub updated successfully!');
                setTimeout(() => {
                  window.location.reload();
                }, 2500);
              }
            }
          }
        } catch {
          // If server went down during restart, begin reconnection probe
          if (updateStatus === 'restarting' || isApplying) {
            setIsReconnecting(true);
            probeServerReconnect();
          }
        }
      }, 1000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, isApplying, updateStatus]);

  const probeServerReconnect = () => {
    const probeInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry/system');
        if (res.ok) {
          clearInterval(probeInterval);
          setIsReconnecting(false);
          setIsApplying(false);
          setUpdateStatus('success');
          onShowToast('CCTV Hub back online!');
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      } catch {
        // Still rebooting
      }
    }, 1500);
  };

  const handleStartUpdate = async () => {
    setIsApplying(true);
    setUpdateStatus('downloading');
    setLogs(['>> Requesting server to apply updates from GitHub...']);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/system/update/apply', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.detail || data.error || 'Failed to start update');
        setIsApplying(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to updater');
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const currentCommit = updateInfo?.current_commit || 'main';
  const latestCommit = updateInfo?.latest_commit || currentCommit;
  const hasUpdate = updateInfo?.update_available || false;
  const commitMsg = updateInfo?.latest_commit_message || 'Performance improvements & bug fixes';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-[#262626] bg-[#121215] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-blue-950/20 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6] shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white font-sans flex items-center gap-2">
                Software & System Updater
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                WebUI 1-Click Upgrades via GitHub Repository
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isApplying || isReconnecting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto font-sans text-xs">
          {/* Version Comparison Card */}
          <div className="p-3.5 rounded-xl bg-[#18181c] border border-[#262626] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400">Current Build</span>
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400">Latest Available</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="font-mono bg-[#111113] px-2.5 py-1 rounded-lg border border-[#222222] text-zinc-200 text-xs">
                {currentCommit}
              </div>

              <div className="flex items-center gap-1 text-[#3B82F6]">
                <ArrowUpRight className="h-4 w-4" />
              </div>

              <div className={`font-mono px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                hasUpdate 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {latestCommit}
                {hasUpdate && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />}
              </div>
            </div>

            {/* Commit message banner */}
            {hasUpdate && (
              <div className="p-2.5 rounded-lg bg-[#111113] border border-[#222222] text-[11px] text-zinc-300 space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-amber-400 font-mono block">What's New</span>
                <p className="line-clamp-2 italic font-mono text-zinc-200">"{commitMsg}"</p>
              </div>
            )}
          </div>

          {/* Progress / Status Indicator */}
          {isApplying && (
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs text-blue-300 font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
                  {updateStatus === 'downloading' && 'Fetching latest updates from GitHub...'}
                  {updateStatus === 'installing' && 'Upgrading backend dependencies...'}
                  {updateStatus === 'building' && 'Compiling React frontend bundle...'}
                  {updateStatus === 'restarting' && 'Restarting background service...'}
                </span>
                <span className="font-mono text-[10px] uppercase text-blue-400">{updateStatus}</span>
              </div>
              <div className="h-1.5 w-full bg-blue-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#3B82F6] rounded-full transition-all duration-500 animate-pulse"
                  style={{
                    width: 
                      updateStatus === 'downloading' ? '25%' :
                      updateStatus === 'installing' ? '55%' :
                      updateStatus === 'building' ? '85%' : '100%'
                  }}
                />
              </div>
            </div>
          )}

          {isReconnecting && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 flex items-center gap-2 text-xs">
              <RefreshCw className="h-4 w-4 animate-spin shrink-0 text-amber-400" />
              <span>Service restarting. Probing server to auto-reconnect...</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 flex items-center gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Console / Terminal Log Stream */}
          {(isApplying || logs.length > 0) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <Terminal className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span>Updater Console Output</span>
              </div>
              <div className="h-36 sm:h-44 w-full rounded-xl bg-black/90 border border-[#222222] p-2.5 font-mono text-[10px] text-zinc-300 overflow-y-auto space-y-1 select-text">
                {logs.map((log, idx) => (
                  <div key={idx} className={`leading-relaxed ${log.startsWith('[!]') ? 'text-rose-400' : log.startsWith('>>') ? 'text-[#3B82F6]' : 'text-zinc-400'}`}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#222222] flex items-center justify-between bg-[#101012] gap-2">
          <button
            type="button"
            onClick={onRefreshCheck}
            disabled={isApplying || isReconnecting}
            className="px-3 py-1.5 rounded-lg bg-[#18181c] hover:bg-[#222226] text-zinc-300 border border-[#2a2a2a] text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3 text-zinc-400" />
            <span>Check Again</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying || isReconnecting}
              className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs transition-colors disabled:opacity-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleStartUpdate}
              disabled={isApplying || isReconnecting || (!hasUpdate && currentCommit !== 'main')}
              className={`px-4 py-1.5 rounded-lg text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-lg ${
                hasUpdate
                  ? 'bg-[#3B82F6] hover:bg-blue-600 shadow-blue-500/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : hasUpdate ? (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Update to {latestCommit}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Reinstall / Rebuild</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
