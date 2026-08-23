import React, { useState } from 'react';
import {
  X,
  Camera,
  Upload,
  UserPlus,
  ScanFace,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface EnrollFaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFaceEnrolled: () => void;
  onShowToast: (msg: string, isError?: boolean) => void;
  activeDevice?: string;
}

interface DetectedBbox {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
}

export const EnrollFaceModal: React.FC<EnrollFaceModalProps> = ({
  isOpen,
  onClose,
  onFaceEnrolled,
  onShowToast,
  activeDevice = '0',
}) => {
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [detectedBbox, setDetectedBbox] = useState<DetectedBbox | null>(null);
  const [croppedPortrait, setCroppedPortrait] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [enrollMethod, setEnrollMethod] = useState<'webcam' | 'upload'>('webcam');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setDetectedBbox(null);
      setCroppedPortrait(null);
      setIsAnalyzingPhoto(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/faces/preview/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (res.ok && data.bbox) {
          setDetectedBbox(data.bbox);
          if (data.cropped_portrait) {
            setCroppedPortrait(data.cropped_portrait);
          }
        }
      } catch (err) {
        console.error('Error analyzing face in uploaded photo:', err);
      } finally {
        setIsAnalyzingPhoto(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Please enter the person\'s name or identity ID', true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (enrollMethod === 'webcam') {
        const formData = new FormData();
        formData.append('name', name.trim());

        const res = await fetch('/api/faces/enroll/webcam', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          onShowToast(`Enrolled "${name}" • Face extracted & indexed`);
          setName('');
          onFaceEnrolled();
          onClose();
        } else {
          onShowToast(`Failed: ${data.detail || 'Webcam face extraction error'}`, true);
        }
      } else {
        if (!selectedFile) {
          onShowToast('Please select a photo file to upload', true);
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('file', selectedFile);

        const res = await fetch('/api/faces/enroll/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          onShowToast(`Enrolled "${name}" from uploaded photo`);
          setName('');
          setSelectedFile(null);
          setFilePreview(null);
          setDetectedBbox(null);
          setCroppedPortrait(null);
          onFaceEnrolled();
          onClose();
        } else {
          onShowToast(`Failed: ${data.detail || 'Upload error'}`, true);
        }
      }
    } catch {
      onShowToast('Error connecting to biometric enrollment service', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222] bg-[#141414]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#3B82F6]">
              <ScanFace className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Biometric Facial Enrollment
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                Auto-tracking face scanner & isolated portrait crop
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Method Selector Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEnrollMethod('webcam')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-all ${
                enrollMethod === 'webcam'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#3B82F6]'
                  : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Live Optical Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setEnrollMethod('upload')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-all ${
                enrollMethod === 'upload'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#3B82F6]'
                  : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Photo</span>
            </button>
          </div>

          {/* LIVE WEBCAM SCANNER VIEWPORT (Auto-tracks faces dynamically via stream HUD) */}
          {enrollMethod === 'webcam' && (
            <div className="space-y-1.5">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[#2a2a2a] shadow-inner flex items-center justify-center group">
                <img
                  src={`/api/stream/live?dev=${activeDevice || '0'}`}
                  alt="Live Biometric Scanner"
                  className="w-full h-full object-cover"
                />

                {/* Viewport Corner Brackets */}
                <div className="absolute inset-2 pointer-events-none">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#3B82F6]/70" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#3B82F6]/70" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#3B82F6]/70" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#3B82F6]/70" />
                </div>

                {/* Top Status Header */}
                <div className="absolute top-2.5 left-2.5 bg-black/85 backdrop-blur-xs px-2 py-0.5 rounded border border-[#333] flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 shadow-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>BIO-RADAR: AUTO-TRACKING ACTIVE</span>
                </div>

                {/* Top Right Specs */}
                <div className="absolute top-2.5 right-2.5 bg-black/85 backdrop-blur-xs px-2 py-0.5 rounded border border-[#333] text-[9px] font-mono text-[#3B82F6] shadow-md">
                  400x400 AUTO-CROP
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 font-mono bg-[#161616] p-2 rounded-lg border border-[#222222] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
                <span>The optical scanner tracks moving faces in real-time and isolates only the face portrait.</span>
              </p>
            </div>
          )}

          {/* UPLOAD PHOTO METHOD (With Auto-Tracked Face Bounding Box & Cropped Portrait) */}
          {enrollMethod === 'upload' && (
            <div className="space-y-2.5">
              {filePreview ? (
                <div className="space-y-2">
                  {/* Uploaded Image Viewport with Dynamic Auto-Tracked Bounding Box */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[#2a2a2a] flex items-center justify-center">
                    <img
                      src={filePreview}
                      alt="Uploaded Subject"
                      className="w-full h-full object-contain"
                    />

                    {/* Auto-Tracked Face Reticle on Uploaded Image */}
                    {detectedBbox && (
                      <div
                        className="absolute border-2 border-dashed border-[#3B82F6] rounded-xl shadow-[0_0_18px_rgba(59,130,246,0.6)] transition-all duration-300"
                        style={{
                          left: `${detectedBbox.x_pct}%`,
                          top: `${detectedBbox.y_pct}%`,
                          width: `${detectedBbox.w_pct}%`,
                          height: `${detectedBbox.h_pct}%`,
                        }}
                      >
                        {/* Brackets */}
                        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#3B82F6]" />
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#3B82F6]" />
                        <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#3B82F6]" />
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#3B82F6]" />

                        {/* Animated Laser Beam */}
                        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent shadow-[0_0_10px_#3B82F6] animate-[bounce_2s_infinite]" />

                        {/* Top Face Locked Tag */}
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 border border-[#3B82F6] px-1.5 py-0.2 rounded text-[8px] font-mono text-[#3B82F6] whitespace-nowrap shadow-lg">
                          FACE AUTO-TRACKED
                        </span>
                      </div>
                    )}

                    {/* Top Status */}
                    <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-xs px-2 py-0.5 rounded border border-[#333] flex items-center gap-1.5 text-[9px] font-mono text-emerald-400">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      <span>{isAnalyzingPhoto ? 'TRACKING FACE...' : 'FACE DETECTED'}</span>
                    </div>

                    {/* Change Photo Button */}
                    <label className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 hover:bg-zinc-800 text-zinc-300 rounded border border-[#333] text-[9px] font-mono cursor-pointer transition-colors">
                      Change Photo
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>

                  {/* Cropped Biometric Face Portrait Preview */}
                  {croppedPortrait && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#161616] border border-[#262626]">
                      <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-[#3B82F6] shrink-0 bg-black">
                        <img src={croppedPortrait} alt="Cropped Face Portrait" className="h-full w-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] font-mono text-emerald-400 text-center py-0.2">
                          400x400
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs font-sans">
                          Extracted Biometric Portrait
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          Isolated subject face normalized for database matching.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label className="relative aspect-video rounded-xl border-2 border-dashed border-[#333333] hover:border-[#3B82F6] bg-[#141414] hover:bg-[#181818] flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all">
                  <div className="p-3 rounded-full bg-[#1c1c1c] text-[#3B82F6] mb-2 border border-[#262626]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs text-white font-medium">
                    Click to select subject image file
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1">
                    Supports JPG, PNG, WEBP (Face will be auto-tracked and cropped)
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* Name / Identifier Input Field */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Person's Full Name or Subject ID
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe, VIP-04, Officer Sarah"
              className="w-full bg-[#161616] border border-[#262626] rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-mono"
              required
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-[#181818] hover:bg-[#222222] text-zinc-400 hover:text-white font-mono transition-colors text-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (enrollMethod === 'upload' && !selectedFile)}
              className="px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 active:scale-[0.99] text-white font-semibold font-sans flex items-center gap-1.5 transition-all text-xs disabled:opacity-40 shadow-lg shadow-[#3B82F6]/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>{isSubmitting ? 'Enrolling Face...' : 'Enroll Face Identity'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
