export interface SystemTelemetry {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  ram_percent: number;
  disk_free_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  cpu_count: number;
  uptime_seconds?: number;
  uptime_formatted?: string;
  network_sent_mbps?: number;
  network_recv_mbps?: number;
}

export interface UpdateCheckInfo {
  update_available: boolean;
  current_commit: string;
  latest_commit: string;
  latest_commit_message: string;
  latest_commit_date: string;
  branch: string;
  last_checked: number;
}

export interface CameraResolutionOption {
  label: string;
  value: string;
  fps: string;
  width?: number;
  height?: number;
}

export interface CameraDevice {
  device: string;
  name: string;
  formats?: string[];
  resolution?: string;
  resolutions?: string[];
  supported_resolutions?: CameraResolutionOption[];
  fps?: number;
  zone?: string;
  source?: string;
  is_online?: boolean;
}

export interface RecordingClip {
  filename: string;
  size_mb: number;
  created_at: number;
  url: string;
  local_path?: string;
}

export interface SnapshotItem {
  filename: string;
  size_kb?: number;
  size_mb?: number;
  created_at: number;
  url: string;
  local_path?: string;
}

export interface StreamStats {
  fps: number;
  resolution: string;
  latencyMs: number;
  bitrateKbps: number;
  connectionState: 'connecting' | 'connected' | 'failed' | 'disconnected';
  protocol: 'WebRTC' | 'MSE' | 'MP4 Fallback';
}

export interface S3Config {
  enabled: boolean;
  endpoint_url: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  region: string;
  auto_upload: boolean;
}

export interface SambaConfig {
  enabled: boolean;
  host: string;
  share: string;
  username: string;
  password?: string;
  local_mount_path: string;
  auto_sync: boolean;
}

export interface StorageLocationInfo {
  recordings_path: string;
  snapshots_path: string;
  free_gb: number;
  total_gb: number;
  used_gb: number;
  disk_percent: number;
  recordings_mb: number;
  snapshots_mb: number;
  faces_mb: number;
  is_writable: boolean;
}

export interface SurveillanceEvent {
  id: string | number;
  timestamp?: number;
  time?: string;
  event_type?: 'face' | 'motion' | 'vehicle' | 'snapshot' | 'recording';
  type?: string;
  title: string;
  details?: string;
  camera_id?: string;
  camera?: string;
  thumbnail_url?: string;
  thumbnail?: string;
  clip_url?: string;
}

export interface EnrolledPerson {
  id: string;
  name: string;
  matchPercentage: number;
  photo_url?: string;
  image?: string;
  created_at?: number;
  last_seen?: number;
  lastSeen?: string;
  isKnown: boolean;
}

export interface TargetDetection {
  id: string;
  label: string;
  type: 'face' | 'person' | 'motion' | 'vehicle' | string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  velocity?: [number, number];
}

export interface TrackerSettings {
  enabled: boolean;
  show_bounding_boxes: boolean;
  show_corner_markers: boolean;
  show_center_reticles: boolean;
  show_metadata_tags: boolean;
  show_motion_vectors: boolean;
  detect_faces: boolean;
  detect_motion: boolean;
  hud_theme: 'cyber_blue' | 'tactical_green' | 'alert_amber' | 'white_mono' | string;
}

export interface CustomTracker {
  id: number;
  camera_id: string;
  name: string;
  action_label: string;
  trigger_type: 'door_open' | 'motion_zone' | 'presence' | 'line_cross' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  sensitivity: number;
  color: string;
  is_active: number;
  last_triggered?: number;
  state: 'NORMAL' | 'TRIGGERED' | 'OPEN DETECTED' | 'CLOSED' | string;
  delta?: number;
}

export interface UserAccount {
  id: number;
  username: string;
  display_name: string;
  role: 'admin' | 'viewer';
  created_at: number;
  last_login?: number;
}

export interface UserSessionLog {
  id: number;
  session_id: string;
  username: string;
  display_name?: string;
  role: string;
  ip_address: string;
  device_info: string;
  location: string;
  login_time: number;
  last_heartbeat: number;
  logout_time?: number;
  logout_reason: string;
  status: 'active' | 'ended';
}

export interface SystemDriveInfo {
  name: string;
  path: string;
  label: string;
  free_gb: number;
  total_gb: number;
  fstype?: string;
}

export interface DirectoryItem {
  name: string;
  path: string;
  is_writable: boolean;
  is_dir: boolean;
}

export interface DirectoryBrowseResult {
  current_path: string;
  parent_path: string | null;
  is_writable: boolean;
  free_gb: number;
  total_gb: number;
  used_gb: number;
  disk_percent: number;
  folders: DirectoryItem[];
  drives: SystemDriveInfo[];
  breadcrumbs: { name: string; path: string }[];
}



