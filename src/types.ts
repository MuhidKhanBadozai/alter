/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserAccount {
  username: string;
  password?: string;
  roomcode?: string;
  registeredAt: string;
}

export enum CallPhase {
  IDLE = "IDLE",
  REQUESTING_MEDIA = "REQUESTING_MEDIA",
  CONNECTING_SIGNALING = "CONNECTING_SIGNALING",
  SDP_EXCHANGE = "SDP_EXCHANGE",
  ICE_GATHERING = "ICE_GATHERING",
  CONNECTED = "CONNECTED",
}

export interface Participant {
  id: string;
  username: string;
  isLocal: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  speakingVolume: number; // 0 to 100 for simulated wave graphics
  joinedAt: string;
  avatarUrl?: string;
  isScreenSharing?: boolean;
}

export interface CallSession {
  code: string;
  phase: CallPhase;
  startTime: number;
  participants: Participant[];
}

export interface SignalingLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "signaling";
  message: string;
}

export interface AudioSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  volume: number; // 0 to 100
  noiseCancellation: boolean;
  echoCancellation: boolean;
  studioVoiceBoost?: boolean; // +100% volume amplification & speech presence
  noiseGate?: boolean;        // 100% noise gate suppression for ambient silence
}
