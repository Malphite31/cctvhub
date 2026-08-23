import React from 'react';
import { Camera, Disc, Maximize, PictureInPicture, RefreshCw, Volume2, VolumeX, Mic } from 'lucide-react';

interface StreamControlsProps {
  isRecording: boolean;
  recordingElapsed: number;
  onSnapshot: () => void;
  onToggleRecording: () => void;
  onToggleFullscreen: () => void;
  onTogglePiP: () => void;
  onReconnect: () => void;
  activeStream: string;
  onChangeStream: (name: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  audioLevel: number;
  volume: number;
  onChangeVolume: (vol: number) => void;
}

export const StreamControls: React.FC<StreamControlsProps> = ({
  isRecording,
  recordingElapsed,
  onSnapshot,
  onToggleRecording,
  onToggleFullscreen,
  onTogglePiP,
  onReconnect,
  activeStream,
  onChangeStream,
  isMuted,
  onToggleMute,
  audioLevel,
  volume,
  onChangeVolume,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 backdrop-blur">
      {/* Preset Selector */}
      <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
        <button
          onClick={() => onChangeStream('webcam_60fps')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            activeStream === 'webcam_60fps'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          720p 60FPS
        </button>

        <button
          onClick={() => onChangeStream('webcam_1080p')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            activeStream === 'webcam_1080p'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          1080p 60FPS
        </button>
      </div>

      {/* Live Audio Meter & Volume Controls */}
      <div className="flex items-center gap-2 rounded-md bg-zinc-950 border border-zinc-800 px-2.5 py-1">
        {/* Mic Level Indicator */}
        <div className="flex items-center gap-1.5" title="Live Microphone Activity">
          <Mic className={`h-3.5 w-3.5 ${audioLevel > 5 ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
          <div className="h-2 w-12 rounded-full bg-zinc-800 overflow-hidden flex items-center">
            <div
              className={`h-full transition-all duration-75 ${audioLevel > 50 ? 'bg-emerald-400' : 'bg-blue-500'}`}
              style={{ width: `${Math.max(4, audioLevel)}%` }}
            />
          </div>
        </div>

        {/* Audio Mute/Unmute Toggle */}
        <button
          onClick={onToggleMute}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            !isMuted
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title={isMuted ? 'Click to Unmute Live Audio' : 'Mute Audio'}
        >
          {isMuted ? (
            <>
              <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px]">Unmute</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px]">Audio On</span>
            </>
          )}
        </button>

        {/* Volume Slider */}
        {!isMuted && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="w-14 h-1 accent-blue-500 bg-zinc-800 rounded-lg cursor-pointer"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Snapshot */}
        <button
          onClick={onSnapshot}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors active:scale-98 shadow-xs"
        >
          <Camera className="h-3.5 w-3.5 text-blue-500" />
          <span>Snapshot</span>
        </button>

        {/* Record */}
        <button
          onClick={onToggleRecording}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors active:scale-98 shadow-xs border ${
            isRecording
              ? 'border-rose-700 bg-rose-600 text-white hover:bg-rose-500 animate-pulse'
              : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          <Disc className={`h-3.5 w-3.5 ${isRecording ? 'text-white' : 'text-rose-500'}`} />
          <span>{isRecording ? `Stop (${recordingElapsed}s)` : 'Record'}</span>
        </button>

        <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

        {/* Refresh */}
        <button
          onClick={onReconnect}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Reconnect Stream"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {/* PiP */}
        <button
          onClick={onTogglePiP}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Picture in Picture"
        >
          <PictureInPicture className="h-3.5 w-3.5" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Fullscreen"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
