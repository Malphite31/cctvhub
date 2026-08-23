import React, { useState, useRef } from 'react';
import { CustomTracker, TrackerSettings } from '../types';
import { Crosshair, X } from 'lucide-react';

interface TrackerHUDOverlayProps {
  settings: TrackerSettings;
  customTrackers: CustomTracker[];
  isDrawingMode: boolean;
  onBoxDrawn: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onToggleTracker?: (id: number) => void;
  onDeleteTracker?: (id: number) => void;
  onCancelDrawing?: () => void;
}

export const TrackerHUDOverlay: React.FC<TrackerHUDOverlayProps> = ({
  isDrawingMode,
  onBoxDrawn,
  onCancelDrawing,
}) => {
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Mouse / Touch event handlers for drawing custom bounding box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingMode || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDrawingStart({ x, y });
    setCurrentDrag({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingMode || !drawingStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCurrentDrag({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawingMode || !drawingStart || !currentDrag) {
      setDrawingStart(null);
      setCurrentDrag(null);
      return;
    }

    const minX = Math.min(drawingStart.x, currentDrag.x);
    const minY = Math.min(drawingStart.y, currentDrag.y);
    const width = Math.abs(currentDrag.x - drawingStart.x);
    const height = Math.abs(currentDrag.y - drawingStart.y);

    // If box has meaningful size (> 3% of screen)
    if (width > 3 && height > 3) {
      onBoxDrawn({
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
      });
    }

    setDrawingStart(null);
    setCurrentDrag(null);
  };

  if (!isDrawingMode) return null;

  // Active Dragging Preview Box
  const dragBox = drawingStart && currentDrag ? {
    left: `${Math.min(drawingStart.x, currentDrag.x)}%`,
    top: `${Math.min(drawingStart.y, currentDrag.y)}%`,
    width: `${Math.abs(currentDrag.x - drawingStart.x)}%`,
    height: `${Math.abs(currentDrag.y - drawingStart.y)}%`,
  } : null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="absolute inset-0 z-30 overflow-hidden select-none cursor-crosshair pointer-events-auto bg-black/25 backdrop-blur-[1px]"
    >
      {/* 1. Drawing Mode Active Banner with Cancel button */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-40">
        <div className="bg-[#3B82F6] text-white px-3 py-1 rounded-full font-mono text-[11px] font-semibold shadow-2xl flex items-center gap-1.5 animate-pulse pointer-events-none">
          <Crosshair className="h-3.5 w-3.5" />
          <span>DRAG ON VIDEO TO SELECT OBJECT / DOOR TO TRACK</span>
        </div>

        {onCancelDrawing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancelDrawing();
            }}
            className="p-1 px-2 rounded-full bg-[#181818] hover:bg-[#222222] text-zinc-300 hover:text-white border border-[#333333] text-[10px] font-mono flex items-center gap-1 shadow-2xl transition-colors"
          >
            <X className="h-3 w-3" />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* 2. Live Drawing Box Preview */}
      {dragBox && (
        <div
          className="absolute border-2 border-dashed border-[#3B82F6] bg-[#3B82F6]/15 rounded pointer-events-none"
          style={dragBox}
        >
          {/* Corner Brackets */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">
              Release to Configure Object
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
