import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MainPlayer } from './components/MainPlayer';
import { CameraStrip } from './components/CameraStrip';
import { RightEventsPanel } from './components/RightEventsPanel';
import { DVRTimeline } from './components/DVRTimeline';
import { EventsLogView } from './components/EventsLogView';
import { FaceProfilesView } from './components/FaceProfilesView';
import { StorageView } from './components/StorageView';
import { SystemView } from './components/SystemView';
import { UsersView } from './components/UsersView';
import { SessionLogsView } from './components/SessionLogsView';
import { SettingsModal } from './components/SettingsModal';
import { EnrollFaceModal } from './components/EnrollFaceModal';
import { EventDetailsModal } from './components/EventDetailsModal';
import { SoftwareUpdateModal } from './components/SoftwareUpdateModal';
import { LoginScreen } from './components/LoginScreen';

import { useLiveAudio } from './hooks/useLiveAudio';
import { useWebRTCStream } from './hooks/useWebRTCStream';
import {
  SystemTelemetry,
  CameraDevice,
  RecordingClip,
  SnapshotItem,
  StorageLocationInfo,
  SurveillanceEvent,
  EnrolledPerson,
  UpdateCheckInfo
} from './types';

export const App: React.FC = () => {
  // User Authentication State (backed by SQLite database)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('cctv_auth_token') || sessionStorage.getItem('cctv_auth_token'));
  });

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    display_name: string;
    role: string;
  }>(() => ({
    username: localStorage.getItem('cctv_username') || sessionStorage.getItem('cctv_username') || 'admin',
    display_name: localStorage.getItem('cctv_display_name') || sessionStorage.getItem('cctv_display_name') || 'Administrator',
    role: localStorage.getItem('cctv_role') || sessionStorage.getItem('cctv_role') || 'admin',
  }));

  const [activeTab, setActiveTab] = useState<'live' | 'recordings' | 'events' | 'faces' | 'storage' | 'system' | 'users' | 'sessions'>('live');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [gridMode, setGridMode] = useState<'1x1' | '2x2' | '1+3'>('1x1');

  // Real Telemetry State
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);

  // Real Camera Hardware State
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<string>(() => {
    return localStorage.getItem('cctv_active_device') || '0';
  });

  // Storage Location State
  const [storageLocation, setStorageLocation] = useState<StorageLocationInfo | null>(null);

  // Media State
  const [recordings, setRecordings] = useState<RecordingClip[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);

  // Audio Devices & State
  const [audioDevices, setAudioDevices] = useState<any[]>([]);
  const [activeAudioDevice, setActiveAudioDevice] = useState<number | string | null>(null);

  // Biometrics & Events State
  const [faces, setFaces] = useState<EnrolledPerson[]>([]);
  const [isFaceRecognitionEnabled, setIsFaceRecognitionEnabled] = useState(true);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SurveillanceEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  // Software Updates State
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Live Audio Hook
  const {
    isMuted,
    volume,
    audioLevel,
    toggleMute,
    changeVolume
  } = useLiveAudio();

  // WebRTC Hook
  const {
    videoRef,
    stats,
    reconnect
  } = useWebRTCStream({ streamName: 'cctv_live' });

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Real API Fetch Functions
  const fetchTelemetry = async () => {
    if (document.hidden) return;
    try {
      const res = await fetch('/api/telemetry/system');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch {}
  };

  const fetchDevices = async () => {
    try {
      const [res, streamCfgRes] = await Promise.all([
        fetch('/api/cameras/list'),
        fetch('/api/stream/config').catch(() => null)
      ]);

      let backendActiveDevice: string | null = null;
      if (streamCfgRes && streamCfgRes.ok) {
        try {
          const cfgData = await streamCfgRes.json();
          if (cfgData && cfgData.active_device !== undefined) {
            backendActiveDevice = String(cfgData.active_device);
          }
        } catch {}
      }

      if (res.ok) {
        const data = await res.json();
        const camList = data.cameras || data.devices || [];
        setDevices(camList);
        if (camList.length > 0) {
          const normalize = (val: string) => val ? String(val).replace('/dev/video', '') : '';
          const savedLocal = localStorage.getItem('cctv_active_device');
          const matchSaved = savedLocal ? camList.find((d: any) => String(d.device) === savedLocal || normalize(d.device) === normalize(savedLocal)) : null;
          const matchBackend = backendActiveDevice ? camList.find((d: any) => String(d.device) === backendActiveDevice || normalize(d.device) === normalize(backendActiveDevice)) : null;
          const matchCurrent = activeDevice ? camList.find((d: any) => String(d.device) === activeDevice || normalize(d.device) === normalize(activeDevice)) : null;

          if (matchSaved) {
            setActiveDevice(String(matchSaved.device));
          } else if (matchBackend) {
            setActiveDevice(String(matchBackend.device));
            localStorage.setItem('cctv_active_device', String(matchBackend.device));
          } else if (matchCurrent) {
            setActiveDevice(String(matchCurrent.device));
            localStorage.setItem('cctv_active_device', String(matchCurrent.device));
          } else {
            const firstDev = String(camList[0].device);
            setActiveDevice(firstDev);
            localStorage.setItem('cctv_active_device', firstDev);
          }
        } else {
          setActiveDevice('');
          localStorage.removeItem('cctv_active_device');
        }
      }
    } catch {}
  };

  const fetchAudioDevices = async () => {
    try {
      const res = await fetch('/api/stream/audio/devices');
      if (res.ok) {
        const data = await res.json();
        setAudioDevices(data.devices || []);
        if (data.active_device !== undefined) {
          setActiveAudioDevice(data.active_device);
        }
      }
    } catch {}
  };

  const fetchStorageLocation = async () => {
    try {
      const res = await fetch('/api/storage/location');
      if (res.ok) {
        const data = await res.json();
        setStorageLocation(data);
      }
    } catch {}
  };

  const fetchRecordings = async () => {
    try {
      const [clipsRes, snapsRes] = await Promise.all([
        fetch('/api/recordings/clips'),
        fetch('/api/recordings/snapshots'),
      ]);
      if (clipsRes.ok) {
        const data = await clipsRes.json();
        setRecordings(data.recordings || data.clips || []);
      }
      if (snapsRes.ok) {
        const data = await snapsRes.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {}
  };

  const fetchFaces = async () => {
    try {
      const res = await fetch('/api/faces/list');
      if (res.ok) {
        const data = await res.json();
        setFaces(data.faces || []);
      }
    } catch {}
  };

  const fetchEvents = async () => {
    if (document.hidden) return;
    try {
      const res = await fetch('/api/events/list');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {}
  };

  const fetchUpdateCheck = async (force = false) => {
    try {
      const url = force ? '/api/system/update/check?force=true' : '/api/system/version';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
        if (force) {
          if (data.update_available) {
            showToast(`Update available: ${data.latest_commit}`);
          } else {
            showToast('System is up to date!');
          }
        }
      }
    } catch {}
  };

  // User Session Heartbeat & Profile Sync
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch user profile to ensure synced permissions
    const token = localStorage.getItem('cctv_auth_token') || sessionStorage.getItem('cctv_auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('cctv_username', data.user.username);
            localStorage.setItem('cctv_display_name', data.user.display_name);
            localStorage.setItem('cctv_role', data.user.role);
          }
        })
        .catch(() => {});
    }

    // Keepalive Heartbeat every 25s
    const sendHeartbeat = () => {
      const curToken = localStorage.getItem('cctv_auth_token') || sessionStorage.getItem('cctv_auth_token');
      if (curToken) {
        fetch('/api/auth/session/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${curToken}` }
        }).catch(() => {});
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 25000);

    // Record Disconnect / Quit timestamp on tab close or navigation away
    const handleQuit = () => {
      const curToken = localStorage.getItem('cctv_auth_token') || sessionStorage.getItem('cctv_auth_token');
      if (curToken && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ token: curToken })], { type: 'application/json' });
        navigator.sendBeacon('/api/auth/session/quit', blob);
      }
    };

    window.addEventListener('beforeunload', handleQuit);
    window.addEventListener('pagehide', handleQuit);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleQuit);
      window.removeEventListener('pagehide', handleQuit);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentUser.role === 'viewer' && (activeTab === 'users' || activeTab === 'sessions')) {
      setActiveTab('live');
    }
  }, [currentUser.role, activeTab]);

  useEffect(() => {
    if (!isFaceRecognitionEnabled && activeTab === 'faces') {
      setActiveTab('live');
    }
  }, [isFaceRecognitionEnabled, activeTab]);

  const fetchTrackerSettings = () => {
    if (!activeDevice) return;
    fetch(`/api/stream/tracker-settings?dev=${encodeURIComponent(activeDevice)}`)
      .then((res) => res.json())
      .then((data) => {
        const settingsData = data.settings || data;
        if (settingsData && settingsData.detect_faces !== undefined) {
          setIsFaceRecognitionEnabled(Boolean(settingsData.detect_faces));
        }
      })
      .catch(() => {});
  };

  // Initial Pollers
  useEffect(() => {
    fetchTelemetry();
    fetchDevices();
    fetchAudioDevices();
    fetchStorageLocation();
    fetchRecordings();
    fetchFaces();
    fetchEvents();
    fetchUpdateCheck();
    fetchTrackerSettings();

    const telemetryInterval = setInterval(fetchTelemetry, 3000);
    const eventsInterval = setInterval(fetchEvents, 4000);
    const devicesInterval = setInterval(fetchDevices, 10000);
    const trackerInterval = setInterval(fetchTrackerSettings, 5000);
    const updateInterval = setInterval(() => fetchUpdateCheck(false), 60000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(eventsInterval);
      clearInterval(devicesInterval);
      clearInterval(trackerInterval);
      clearInterval(updateInterval);
    };
  }, []);

  // Recording Timer
  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingElapsed(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Handlers
  const handleSelectCamera = async (dev: string) => {
    const devStr = String(dev);
    setActiveDevice(devStr);
    localStorage.setItem('cctv_active_device', devStr);
    try {
      await fetch(`/api/stream/switch-camera?device=${encodeURIComponent(devStr)}`, { method: 'POST' });
    } catch {}
    showToast(`Switched active camera to Dev ${devStr}`);
  };

  const handleSelectAudioDevice = async (devIndex: number | string) => {
    setActiveAudioDevice(devIndex);
    try {
      const res = await fetch(`/api/stream/switch-audio?device_index=${encodeURIComponent(devIndex)}`, { method: 'POST' });
      if (res.ok) {
        showToast(`Switched audio input device`);
      } else {
        showToast('Error switching microphone', true);
      }
    } catch {
      showToast('Error switching microphone', true);
    }
  };

  const handleSnapshot = async () => {
    try {
      const res = await fetch('/api/recordings/snapshot', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`Snapshot saved: ${data.filename || 'snapshot.jpg'}`);
        fetchRecordings();
        fetchEvents();
        fetchStorageLocation();
      } else {
        showToast(`Snapshot failed: ${data.detail || 'Camera unavailable'}`, true);
      }
    } catch {
      showToast('Error capturing snapshot', true);
    }
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      try {
        const res = await fetch('/api/recordings/record/start', { method: 'POST' });
        const data = await res.json();
        if (res.ok && (data.status === 'success' || data.status === 'started' || data.status === 'already_recording')) {
          setIsRecording(true);
          showToast('Started MP4 video recording');
          fetchEvents();
        } else {
          showToast(`Failed to start recording: ${data.detail || data.status}`, true);
        }
      } catch {
        showToast('Failed to start recording', true);
      }
    } else {
      try {
        const res = await fetch('/api/recordings/record/stop', { method: 'POST' });
        const data = await res.json();
        setIsRecording(false);
        if (res.ok) {
          const savedName = data.filename || data.file || 'recording.mp4';
          const sizeStr = data.size_mb ? ` (${data.size_mb} MB)` : '';
          showToast(`Recording saved: ${savedName}${sizeStr}`);
          fetchRecordings();
          fetchEvents();
          fetchStorageLocation();
        } else {
          showToast('Recording stopped');
          fetchRecordings();
        }
      } catch {
        setIsRecording(false);
        showToast('Recording stopped');
        fetchRecordings();
      }
    }
  };

  const handleDeleteRecording = async (filename: string) => {
    try {
      const res = await fetch(`/api/recordings/clip/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted ${filename}`);
        fetchRecordings();
        fetchStorageLocation();
      } else {
        showToast('Failed to delete recording', true);
      }
    } catch {
      showToast('Failed to delete recording', true);
    }
  };

  const handleDeleteSnapshot = async (filename: string) => {
    try {
      const res = await fetch(`/api/recordings/snapshot/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted snapshot ${filename}`);
        fetchRecordings();
        fetchStorageLocation();
      } else {
        showToast('Failed to delete snapshot', true);
      }
    } catch {
      showToast('Failed to delete snapshot', true);
    }
  };

  const handleDeleteFace = async (id: string) => {
    try {
      const res = await fetch(`/api/faces/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Face profile removed');
        fetchFaces();
        fetchStorageLocation();
      } else {
        showToast('Failed to remove face profile', true);
      }
    } catch {
      showToast('Failed to remove face profile', true);
    }
  };

  const handleOpenEvent = (event: SurveillanceEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = async (id: string | number) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted event log #${id}`);
        fetchEvents();
      } else {
        showToast('Failed to delete event log', true);
      }
    } catch {
      showToast('Failed to delete event log', true);
    }
  };

  const handleClearEvents = async () => {
    setEvents([]);
    try {
      let res = await fetch('/api/events/clear', { method: 'DELETE' });
      if (!res.ok) {
        res = await fetch('/api/events/clear', { method: 'POST' });
      }
      if (res.ok) {
        showToast('Cleared all event logs');
      } else {
        showToast('Failed to clear event logs', true);
      }
    } catch {
      showToast('Error clearing event logs', true);
    } finally {
      fetchEvents();
    }
  };

  const handleBatchDeleteEvents = async (ids: (string | number)[]) => {
    try {
      const numIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id));
      const res = await fetch('/api/events/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: numIds })
      });
      if (res.ok) {
        showToast(`Deleted ${ids.length} event log(s)`);
        fetchEvents();
      } else {
        showToast('Failed to batch delete event logs', true);
      }
    } catch {
      showToast('Failed to batch delete event logs', true);
    }
  };

  const handleBatchDeleteRecordings = async (filenames: string[]) => {
    try {
      setRecordings((prev) => prev.filter((r) => !filenames.includes(r.filename)));
      const res = await fetch('/api/recordings/clips/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Deleted ${data.deleted_count || filenames.length} video recording(s)`);
      } else {
        showToast('Failed to delete some recordings', true);
        fetchRecordings();
      }
    } catch {
      showToast('Error deleting recordings', true);
      fetchRecordings();
    }
  };

  const handleBatchDeleteSnapshots = async (filenames: string[]) => {
    try {
      setSnapshots((prev) => prev.filter((s) => !filenames.includes(s.filename)));
      const res = await fetch('/api/recordings/snapshots/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Deleted ${data.deleted_count || filenames.length} snapshot(s)`);
      } else {
        showToast('Failed to delete some snapshots', true);
      }
    } catch {
      showToast('Error deleting snapshots', true);
    } finally {
      fetchRecordings();
      fetchStorageLocation();
    }
  };

  const handleClearRecordings = async () => {
    try {
      setRecordings([]);
      const res = await fetch('/api/recordings/clips/clear', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Permanently cleared ${data.deleted_count || 0} video recording(s)`);
      } else {
        showToast('Failed to clear video recordings', true);
      }
    } catch {
      showToast('Error clearing recordings', true);
    } finally {
      fetchRecordings();
      fetchStorageLocation();
    }
  };

  const handleClearSnapshots = async () => {
    try {
      setSnapshots([]);
      const res = await fetch('/api/recordings/snapshots/clear', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Permanently cleared ${data.deleted_count || 0} snapshot(s)`);
      } else {
        showToast('Failed to clear snapshots', true);
      }
    } catch {
      showToast('Error clearing snapshots', true);
    } finally {
      fetchRecordings();
      fetchStorageLocation();
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleLoginSuccess = (user: { username: string; display_name: string; role: string }) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('cctv_username', user.username);
    localStorage.setItem('cctv_display_name', user.display_name);
    localStorage.setItem('cctv_role', user.role);
    showToast(`Welcome back, ${user.display_name} (${user.role === 'admin' ? 'Administrator' : 'Family Member'})`);
    fetchTelemetry();
    fetchDevices();
    fetchStorageLocation();
    fetchRecordings();
    fetchFaces();
    fetchEvents();
  };

  const handleLogout = () => {
    const token = localStorage.getItem('cctv_auth_token') || sessionStorage.getItem('cctv_auth_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('cctv_auth_token');
    localStorage.removeItem('cctv_username');
    localStorage.removeItem('cctv_display_name');
    localStorage.removeItem('cctv_role');
    sessionStorage.removeItem('cctv_auth_token');
    sessionStorage.removeItem('cctv_username');
    sessionStorage.removeItem('cctv_display_name');
    sessionStorage.removeItem('cctv_role');
    setIsAuthenticated(false);
    showToast('Signed out of surveillance session');
  };

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#080808] text-white flex flex-row font-sans selection:bg-[#3B82F6] selection:text-white">
      {/* Left Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        telemetry={telemetry}
        devices={devices}
        storageLocation={storageLocation}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        userRole={currentUser.role}
        isFaceRecognitionEnabled={isFaceRecognitionEnabled}
      />

      {/* Right Column (Navbar + Main Content) */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          telemetry={telemetry}
          unreadEventsCount={events.length}
          recentEvents={events}
          updateInfo={updateInfo}
          currentUser={currentUser}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSignOut={handleLogout}
          onNavigateToEvents={() => setActiveTab('events')}
          onOpenEventDetails={handleOpenEvent}
        />

        {/* Center/Right Content Area */}
        <main className={`flex-1 min-h-0 bg-[#080808] flex flex-col ${
          activeTab === 'live' ? 'p-2 sm:p-3 overflow-y-auto xl:overflow-hidden' : 'p-2.5 sm:p-4 md:p-6 overflow-y-auto'
        }`}>
          {/* VIEW 1: LIVE SURVEILLANCE */}
          {activeTab === 'live' && (
            <div className="w-full flex flex-col xl:h-full justify-between gap-2.5 sm:gap-3 max-w-[1850px] mx-auto pb-6 xl:pb-0">
              {/* Row 1: Main Player + Right Events Panel (Desktop side-by-side, Mobile stacked) */}
              <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-2.5 sm:gap-3 items-stretch">
                {/* Main Camera Viewport (Always on top) */}
                <div className="w-full flex-1 min-w-0 xl:h-full flex flex-col">
                  <MainPlayer
                    videoRef={videoRef}
                    stats={stats}
                    devices={devices}
                    activeDevice={activeDevice}
                    onSelectDevice={handleSelectCamera}
                    isRecording={isRecording}
                    recordingElapsed={recordingElapsed}
                    onSnapshot={handleSnapshot}
                    onToggleRecording={handleToggleRecording}
                    onToggleFullscreen={handleToggleFullscreen}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    audioLevel={audioLevel}
                    volume={volume}
                    onChangeVolume={changeVolume}
                    audioDevices={audioDevices}
                    activeAudioDevice={activeAudioDevice}
                    onSelectAudioDevice={handleSelectAudioDevice}
                    gridMode={gridMode}
                    onChangeGridMode={setGridMode}
                    onReconnect={reconnect}
                    onRefreshDevices={fetchDevices}
                    onShowToast={showToast}
                    userRole={currentUser.role}
                    telemetry={telemetry}
                  />
                </div>

                {/* Desktop Right Events & Face Recognition Sidebar */}
                <div className="hidden xl:flex w-80 xl:w-[380px] 2xl:w-[440px] flex-col gap-3 shrink-0 h-full">
                  <RightEventsPanel
                    events={events}
                    faces={faces}
                    onViewAllEvents={() => setActiveTab('events')}
                    onViewAllFaces={() => setActiveTab('faces')}
                    onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
                    onOpenEvent={handleOpenEvent}
                    userRole={currentUser.role}
                    isFaceRecognitionEnabled={isFaceRecognitionEnabled}
                  />
                </div>
              </div>

              {/* Row 2: Camera Carousel Strip */}
              <div className="shrink-0">
                <CameraStrip
                  devices={devices}
                  activeDevice={activeDevice}
                  onSelectDevice={handleSelectCamera}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onRefreshDevices={fetchDevices}
                  onShowToast={showToast}
                  userRole={currentUser.role}
                />
              </div>

              {/* Mobile Only: Events & Faces below Camera Carousel */}
              <div className="xl:hidden flex flex-col gap-3 w-full">
                <RightEventsPanel
                  events={events}
                  faces={faces}
                  onViewAllEvents={() => setActiveTab('events')}
                  onViewAllFaces={() => setActiveTab('faces')}
                  onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
                  onOpenEvent={handleOpenEvent}
                  userRole={currentUser.role}
                  isFaceRecognitionEnabled={isFaceRecognitionEnabled}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: RECORDINGS ARCHIVE */}
          {activeTab === 'recordings' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <DVRTimeline
                recordings={recordings}
                snapshots={snapshots}
                storageLocation={storageLocation}
                onDeleteClip={handleDeleteRecording}
                onDeleteSnapshot={handleDeleteSnapshot}
                onBatchDeleteClips={handleBatchDeleteRecordings}
                onBatchDeleteSnapshots={handleBatchDeleteSnapshots}
                onClearClips={handleClearRecordings}
                onClearSnapshots={handleClearSnapshots}
                onRefresh={fetchRecordings}
                onShowToast={showToast}
                userRole={currentUser.role}
              />
            </div>
          )}

          {/* VIEW 3: EVENTS LOG */}
          {activeTab === 'events' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <EventsLogView
                events={events}
                onRefresh={fetchEvents}
                onShowToast={showToast}
                onOpenEvent={handleOpenEvent}
                onDeleteEvent={handleDeleteEvent}
                onClearEvents={handleClearEvents}
                onBatchDeleteEvents={handleBatchDeleteEvents}
                userRole={currentUser.role}
              />
            </div>
          )}

          {/* VIEW 4: BIOMETRICS & FACES */}
          {activeTab === 'faces' && isFaceRecognitionEnabled && (
            <div className="flex-1 min-h-0 flex flex-col">
              <FaceProfilesView
                faces={faces}
                onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
                onDeleteFace={handleDeleteFace}
                onRefresh={fetchFaces}
                userRole={currentUser.role}
                activeDevice={activeDevice}
              />
            </div>
          )}

          {/* VIEW 5: STORAGE INFRASTRUCTURE */}
          {activeTab === 'storage' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <StorageView
                storageLocation={storageLocation}
                onRefresh={fetchStorageLocation}
                onShowToast={showToast}
                userRole={currentUser.role}
              />
            </div>
          )}

          {/* VIEW 6: SYSTEM TELEMETRY */}
          {activeTab === 'system' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <SystemView
                telemetry={telemetry}
                devices={devices}
                updateInfo={updateInfo}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                onCheckUpdate={() => fetchUpdateCheck(true)}
                onRefresh={fetchTelemetry}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* VIEW 7: USERS & FAMILY ACCESS */}
          {activeTab === 'users' && currentUser.role !== 'viewer' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <UsersView onShowToast={showToast} />
            </div>
          )}

          {/* VIEW 8: DEVICE & SESSION AUDIT LOGS */}
          {activeTab === 'sessions' && currentUser.role !== 'viewer' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <SessionLogsView onShowToast={showToast} />
            </div>
          )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs font-medium shadow-2xl flex items-center gap-2.5 ${
              toastMsg.isError
                ? 'bg-[#181010] text-rose-300 border-rose-900/60'
                : 'bg-[#121212] text-white border-[#333333]'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                toastMsg.isError ? 'bg-rose-500' : 'bg-[#3B82F6]'
              }`}
            />
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Software Update Modal */}
      <SoftwareUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onRefreshCheck={() => fetchUpdateCheck(true)}
        onShowToast={showToast}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        devices={devices}
        activeDevice={activeDevice}
        onSelectDevice={handleSelectCamera}
        audioDevices={audioDevices}
        activeAudioDevice={activeAudioDevice}
        onSelectAudioDevice={handleSelectAudioDevice}
        onRefreshStorageLocation={fetchStorageLocation}
        onShowToast={showToast}
        userRole={currentUser.role}
      />

      {/* Face Enrollment Modal */}
      <EnrollFaceModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        activeDevice={activeDevice}
        onFaceEnrolled={() => {
          fetchFaces();
          fetchEvents();
        }}
        onShowToast={showToast}
      />

      {/* Event Details & Media Modal */}
      <EventDetailsModal
        isOpen={isEventModalOpen}
        event={selectedEvent}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEvent(null);
        }}
        onDeleteEvent={handleDeleteEvent}
        onShowToast={showToast}
      />
    </div>
  );
};

export default App;

