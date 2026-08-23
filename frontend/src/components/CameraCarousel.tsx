import React from 'react';
import { Plus, Video } from 'lucide-react';
import { CameraDevice } from '../types';

interface CameraCarouselProps {
  devices: CameraDevice[];
  activeCamera: string;
  onSelectCamera: (cam: string) => void;
  onAddCamera: () => void;
}

export const CameraCarousel: React.FC<CameraCarouselProps> = ({
  devices,
  activeCamera,
  onSelectCamera,
  onAddCamera,
}) => {
  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300">Connected Cameras</h3>
        <span className="text-[10px] text-zinc-500 font-medium">
          {devices.length} Active Device{devices.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {devices.map((cam, idx) => {
          const camLabel = `CAM ${idx + 1}`;
          const isSelected = activeCamera === camLabel || (idx === 0 && !activeCamera);
          return (
            <div
              key={cam.device}
              onClick={() => onSelectCamera(camLabel)}
              className={`group relative rounded-xl overflow-hidden aspect-video border bg-zinc-950 cursor-pointer transition-all flex flex-col justify-between p-2.5 ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-950/10'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Top Row: Device Name & LIVE Badge */}
              <div className="flex items-center justify-between z-10">
                <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                  {camLabel}
                </span>
                <span className="inline-flex items-center gap-1 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded text-[9px] font-semibold text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>

              {/* Center Icon Graphic */}
              <div className="flex items-center justify-center my-auto py-1">
                <div className={`p-2 rounded-full ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-900 text-zinc-500'}`}>
                  <Video className="h-5 w-5" />
                </div>
              </div>

              {/* Bottom Row: Hardware Device Name */}
              <div className="truncate z-10">
                <p className="text-[10px] text-zinc-300 font-medium truncate" title={cam.name}>
                  {cam.name}
                </p>
                <span className="text-[9px] text-zinc-500 font-mono">{cam.device}</span>
              </div>
            </div>
          );
        })}

        {/* Add Camera Card */}
        <button
          onClick={onAddCamera}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors aspect-video text-zinc-400 hover:text-zinc-200 p-2"
        >
          <div className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <Plus className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-[10px] font-medium">Add RTSP / IP Cam</span>
        </button>
      </div>
    </div>
  );
};
