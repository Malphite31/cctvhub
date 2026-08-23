import React, { useState, useEffect } from 'react';
import { CustomTracker } from '../types';
import {
  X,
  Crosshair,
  DoorOpen,
  Activity,
  Save,
  Trash2
} from 'lucide-react';

interface CustomObjectTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraId: string;
  initialBounds?: { x: number; y: number; width: number; height: number };
  editingTracker?: CustomTracker | null;
  onSaved: () => void;
}

const PRESET_TEMPLATES = [
  { name: 'Front Entrance Door', action: 'Door Opened Alert', trigger: 'door_open', color: '#3B82F6' },
  { name: 'Backyard Gate', action: 'Gate Opened Warning', trigger: 'door_open', color: '#10B981' },
  { name: 'Server Rack Cabinet', action: 'Tamper & Access Alarm', trigger: 'door_open', color: '#EF4444' },
  { name: 'Cash Register Counter', action: 'Restricted Access Alert', trigger: 'motion_zone', color: '#F59E0B' },
  { name: 'Vault / Safe Door', action: 'Safe Opened Emergency', trigger: 'door_open', color: '#8B5CF6' },
  { name: 'Driveway Parking Area', action: 'Vehicle / Entry Detected', trigger: 'motion_zone', color: '#3B82F6' },
];

const COLOR_OPTIONS = [
  { hex: '#3B82F6', label: 'Cyber Blue' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#EF4444', label: 'Crimson' },
  { hex: '#8B5CF6', label: 'Purple' },
];

export const CustomObjectTrackerModal: React.FC<CustomObjectTrackerModalProps> = ({
  isOpen,
  onClose,
  cameraId,
  initialBounds = { x: 25, y: 25, width: 40, height: 45 },
  editingTracker = null,
  onSaved,
}) => {
  const [name, setName] = useState('Front Entrance Door');
  const [actionLabel, setActionLabel] = useState('Door Opened Alert');
  const [triggerType, setTriggerType] = useState('door_open');
  const [sensitivity, setSensitivity] = useState(65);
  const [color, setColor] = useState('#3B82F6');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingTracker) {
      setName(editingTracker.name);
      setActionLabel(editingTracker.action_label);
      setTriggerType(editingTracker.trigger_type || 'door_open');
      setSensitivity(editingTracker.sensitivity || 60);
      setColor(editingTracker.color || '#3B82F6');
    } else {
      setName('Front Entrance Door');
      setActionLabel('Door Opened Alert');
      setTriggerType('door_open');
      setSensitivity(65);
      setColor('#3B82F6');
    }
  }, [editingTracker, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setName(preset.name);
    setActionLabel(preset.action);
    setTriggerType(preset.trigger);
    setColor(preset.color);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter an object name (e.g. Main Door)');
      return;
    }
    if (!actionLabel.trim()) {
      setErrorMsg('Please enter an action name (e.g. Door Opened)');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      if (editingTracker) {
        // Update existing
        const res = await fetch(`/api/trackers/${editingTracker.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            action_label: actionLabel,
            trigger_type: triggerType,
            sensitivity,
            color,
          }),
        });
        if (!res.ok) throw new Error('Failed to update object tracker');
      } else {
        // Create new
        const res = await fetch('/api/trackers/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            camera_id: String(cameraId),
            name,
            action_label: actionLabel,
            trigger_type: triggerType,
            x: initialBounds.x,
            y: initialBounds.y,
            width: initialBounds.width,
            height: initialBounds.height,
            sensitivity,
            color,
          }),
        });
        if (!res.ok) throw new Error('Failed to create object tracker');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving object tracker');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTracker) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/trackers/${editingTracker.id}`, { method: 'DELETE' });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setErrorMsg('Failed to delete tracker');
      }
    } catch {
      setErrorMsg('Error deleting tracker');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222] bg-[#141414]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#3B82F6]">
              <Crosshair className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white font-sans">
                {editingTracker ? 'Edit Object Tracker' : 'Configure Custom Object Tracker'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                Camera {cameraId} • Bounding Box Selection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#202020] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Quick Preset Templates */}
          {!editingTracker && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Quick Preset Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PRESET_TEMPLATES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2 rounded-lg border border-[#262626] bg-[#161616] hover:bg-[#202020] hover:border-zinc-700 text-left transition-colors flex flex-col justify-between"
                  >
                    <span className="font-medium text-white text-[11px] truncate block">{preset.name}</span>
                    <span className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate block">{preset.action}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Object Name */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              1. Tracked Object Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Entrance Door, Safe Box, Side Window"
              className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white font-sans text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
            />
          </div>

          {/* 2. Custom Action / Trigger Name */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              2. Trigger Action Label
            </label>
            <input
              type="text"
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              placeholder="e.g. Door Opened, Vault Opened Alert, Unauthorized Touch"
              className="w-full bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white font-sans text-xs focus:border-[#3B82F6] focus:outline-none transition-colors"
            />
          </div>

          {/* 3. Trigger Condition Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              3. Trigger Condition Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTriggerType('door_open')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  triggerType === 'door_open'
                    ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white'
                    : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <DoorOpen className={`h-4 w-4 ${triggerType === 'door_open' ? 'text-[#3B82F6]' : 'text-zinc-500'}`} />
                <div>
                  <div className="font-semibold text-xs text-white">Door / Gate Open</div>
                  <div className="text-[9px] text-zinc-400">State changes when opened</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTriggerType('motion_zone')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  triggerType === 'motion_zone'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Activity className={`h-4 w-4 ${triggerType === 'motion_zone' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="font-semibold text-xs text-white">Intrusion Zone</div>
                  <div className="text-[9px] text-zinc-400">Trigger on movement inside area</div>
                </div>
              </button>
            </div>
          </div>

          {/* Sensitivity Slider */}
          <div className="space-y-1.5 bg-[#151515] p-2.5 rounded-lg border border-[#222222]">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-zinc-400">Trigger Sensitivity</span>
              <span className="text-[#3B82F6] font-bold">{sensitivity}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="95"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
            <div className="flex justify-between text-[8px] font-mono text-zinc-500">
              <span>Low (Large shifts only)</span>
              <span>Medium</span>
              <span>High (Subtle shifts)</span>
            </div>
          </div>

          {/* Color Theme */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              4. Bounding Box Color
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono transition-colors ${
                    color === c.hex
                      ? 'border-white text-white font-bold bg-white/10'
                      : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#222222]">
            {editingTracker ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Delete Tracker</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-zinc-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving...' : editingTracker ? 'Update Tracker' : 'Save & Track Object'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
