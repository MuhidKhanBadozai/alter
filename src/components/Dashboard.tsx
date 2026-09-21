/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import HaramiBotEngine from "./HaramiBotEngine";
import {
  Phone,
  PhoneOff,
  Plus,
  Users,
  Radio,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Terminal,
  Sparkles,
  Share2,
  Settings,
  CircleDot,
  CheckCircle,
  HelpCircle,
  MessageSquare,
  Check,
  Image as ImageIcon
} from "lucide-react";
import { UserAccount, CallPhase, Participant, SignalingLog, AudioSettings } from "../types";
import StreamVisualizer from "./StreamVisualizer";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAudioEnhancer } from "../hooks/useAudioEnhancer";

interface DashboardProps {
  user: UserAccount;
  audioSettings: AudioSettings;
  onOpenSettings: () => void;
}

export default function Dashboard({ user, audioSettings, onOpenSettings }: DashboardProps) {
  // Input call code state
  const [callCode, setCallCode] = useState<string>("");
  const [isDeafened, setIsDeafened] = useState<boolean>(false);

  // Harami Bot state
  const [isHaramiActive, setIsHaramiActive] = useState<boolean>(false);
  const [haramiVideoId, setHaramiVideoId] = useState<string | null>(null);
  const [haramiStatus, setHaramiStatus] = useState<string>('');
  // Tracks the last /play query so we can fetch recommendations when a song ends
  const haramiQueryRef = useRef<string>('');

  // Remote mute state tracking
  const [remoteMutes, setRemoteMutes] = useState<Record<string, boolean>>({});

  // Core calling state
  const [isInCall, setIsInCall] = useState<boolean>(false);

  // App Data custom sync simulation
  const [appDataMessage, setAppDataMessage] = useState<string>("");
  const [appDataFeed, setAppDataFeed] = useState<{ sender: string; text: string; image?: string; time: string }[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAppData = useCallback((from: string, data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'harami_play') {
         setIsHaramiActive(true);
         setHaramiVideoId(parsed.videoId);
         return; 
      }
      if (parsed.type === 'harami_stop') {
         setIsHaramiActive(false);
         setHaramiVideoId(null);
         return;
      }
      if (parsed.type === 'mute_status') {
         setRemoteMutes(prev => ({ ...prev, [from]: parsed.isMuted }));
         return;
      }
      setAppDataFeed(prev => [
        ...prev,
        {
          sender: from,
          text: parsed.text || "",
          image: parsed.image || undefined,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      if (parsed.text?.toLowerCase() === '@harami') {
         setIsHaramiActive(true);
      }
    } catch {
      // Fallback for plain text
      setAppDataFeed(prev => [
        ...prev,
        {
          sender: from,
          text: data,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      if (data.toLowerCase() === '@harami') {
         setIsHaramiActive(true);
      }
    }
  }, []);

  const rtc = useWebRTC(callCode, user.username, handleAppData, {
    inputDeviceId: audioSettings.inputDeviceId,
    noiseCancellation: audioSettings.noiseCancellation,
    echoCancellation: audioSettings.echoCancellation,
  });
  const isMuted = rtc.isMuted;
  const callPhase = rtc.status === 'idle' || rtc.status === 'ended'
    ? CallPhase.IDLE
    : rtc.status === 'connected'
      ? CallPhase.CONNECTED
      : CallPhase.CONNECTING_SIGNALING;

  const [callDuration, setCallDuration] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Signaling logger
  const [logs, setLogs] = useState<SignalingLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Individual peer volume state (supports 0% to 200% boost)
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({
    "local-user": 100,
    "peer-alice": 100,
    "peer-bob": 100,
  });

  // Studio-grade audio pipeline:
  // - 100% Volume Amplification (2.0x base multiplier, presence EQ, dynamic compression, soft limiter)
  // - 100% Noise Reduction (85Hz HighPass, 12.5kHz LowPass, real-time intelligent Noise Gate)
  const volumes = useAudioEnhancer(
    rtc.localAudioStream,
    rtc.remotePeers,
    isMuted,
    isDeafened,
    audioSettings.volume,
    peerVolumes,
    audioSettings.noiseGate !== false,
    audioSettings.studioVoiceBoost !== false
  );
  const [simulatedFeedType, setSimulatedFeedType] = useState<"matrix" | "topo" | "wave">("matrix");

  // Derive participants from RTC remotePeers (with real usernames)
  const participants: Participant[] = [
    {
      id: "local-user",
      username: `${user.username} (You)`,
      isLocal: true,
      isMuted: rtc.isMuted,
      isDeafened: isDeafened,
      isSpeaking: (volumes['local-user'] ?? 0) > 8,
      speakingVolume: volumes['local-user'] ?? 0,
      joinedAt: new Date().toLocaleTimeString(),
      isScreenSharing: rtc.isScreenSharing,
    },
    ...rtc.remotePeers.map(peer => ({
      id: peer.username,
      username: peer.username,
      isLocal: false,
      isMuted: !!remoteMutes[peer.username],
      isDeafened: false,
      isSpeaking: (volumes[peer.username] ?? 0) > 8,
      speakingVolume: volumes[peer.username] ?? 0,
      joinedAt: new Date().toLocaleTimeString(),
      isScreenSharing: peer.isScreenSharing,
    }))
  ];

  if (isHaramiActive) {
    participants.push({
      id: "harami-bot",
      username: "Harami (Bot)",
      isLocal: false,
      isMuted: false,
      isDeafened: false,
      isSpeaking: haramiStatus === 'playing',
      speakingVolume: haramiStatus === 'playing' ? 50 : 0,
      joinedAt: new Date().toLocaleTimeString(),
      isScreenSharing: false,
    });
  }

  // Screen sharer: find first remote peer sharing, or local
  const screenSharingPeer = rtc.remotePeers.find(p => p.isScreenSharing);
  const screenSharerId = screenSharingPeer ? screenSharingPeer.username : rtc.isScreenSharing ? "local-user" : null;
  const localScreenStream = rtc.localScreenStream;

  // Keepalive references for remote audio streams
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  useEffect(() => {
    for (const peer of rtc.remotePeers) {
      const el = remoteAudioRefs.current.get(peer.username);
      if (el && peer.remoteAudioStream && el.srcObject !== peer.remoteAudioStream) {
        el.srcObject = peer.remoteAudioStream;
        el.play().catch(() => { });
      }
    }
  }, [rtc.remotePeers]);

  const handleVolumeChange = (id: string, vol: number) => {
    setPeerVolumes((prev) => ({
      ...prev,
      [id]: vol,
    }));
  };

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Handle active timer
  useEffect(() => {
    if (isInCall && callPhase === CallPhase.CONNECTED) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isInCall, callPhase]);



  // Log adding utility
  const addLog = (message: string, type: "info" | "success" | "warning" | "error" | "signaling" = "info") => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        timestamp,
        type,
        message,
      },
    ]);
  };

  // Start Personal Room (using user's permanent roomcode)
  const handleCreateRoom = async () => {
    if (!user.roomcode) {
      addLog("Personal room code not found in your account.", "error");
      return;
    }
    setCallCode(user.roomcode);
    setIsInCall(true);
    setLogs([]);
    setAppDataFeed([]);
    addLog(`Creating personal room [${user.roomcode}]...`, "info");
    addLog(`Subscribing to Supabase channel: call-${user.roomcode}`, "signaling");
  };

  // Join a call flow
  const handleJoinCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callCode.trim()) return;

    const code = callCode.trim();
    setCallCode(code);
    setIsInCall(true);
    setLogs([]);
    setAppDataFeed([]);

    addLog(`Subscribing to Supabase channel: call-${code}`, "signaling");
    addLog(`Requesting microphone access...`, "info");
  };

  // Leave call
  const handleLeaveCall = () => {
    addLog("Closing WebRTC peer connection...", "warning");
    addLog("Stopping local audio streams & microphone buffers...", "warning");
    addLog(`Leaving Supabase channel: 'call-${callCode}'`, "warning");

    rtc.endCall();

    setTimeout(() => {
      setIsInCall(false);
    }, 400);
  };

  // Toggle user mute state
  const handleToggleMute = () => {
    rtc.toggleMute();
    const newMuteState = !rtc.isMuted; // Use inverted current state since toggle happens synchronously
    addLog(`Toggled microphone`, "warning");
    rtc.broadcastAppData('app_data', JSON.stringify({ type: 'mute_status', isMuted: newMuteState }));
  };

  // Toggle user deafen state
  const handleToggleDeafen = () => {
    setIsDeafened(!isDeafened);
    addLog(`${!isDeafened ? "Deafened" : "Un-deafened"} channel output streams`, "warning");
  };

  const searchYouTube = async (query: string) => {
    try {
      if ((window as any).electronAPI) {
        return await (window as any).electronAPI.searchYoutube(query);
      } else {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        return json.videoId || null;
      }
    } catch (e) {
      console.error("Harami search error:", e);
    }
    return null;
  };

  /** Fetches the 2nd YouTube search result for a query — used for auto-play recommendations */
  const getRecommendation = async (query: string) => {
    try {
      if ((window as any).electronAPI?.recommendYoutube) {
        return await (window as any).electronAPI.recommendYoutube(query);
      } else {
        const res = await fetch(`/api/recommend?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        return json.videoId || null;
      }
    } catch (e) {
      console.error("Harami recommend error:", e);
    }
    return null;
  };

  // Send app data (text only)
  const handleSendAppData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appDataMessage.trim()) return;

    const text = appDataMessage.trim();
    const isBotSummon = text.toLowerCase() === '@harami';
    const isBotPlay = text.toLowerCase().startsWith('/play ');
    const isBotStop = text.toLowerCase() === '/stop';

    if (isBotSummon) {
      setIsHaramiActive(true);
    }

    // Add locally to feed
    setAppDataFeed((prev) => [
      ...prev,
      {
        sender: `${user.username} (You)`,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    addLog(`→ Broadcasting app_data text message`, "signaling");
    rtc.broadcastAppData('app_data', JSON.stringify({ text }));
    setAppDataMessage("");

    if (isBotPlay) {
      const query = text.slice(6).trim();
      haramiQueryRef.current = query; // remember for auto-recommendations
      addLog(`Harami searching for: ${query}...`, "info");
      const videoId = await searchYouTube(query);
      if (videoId) {
         rtc.broadcastAppData('app_data', JSON.stringify({ type: 'harami_play', videoId }));
         setIsHaramiActive(true);
         setHaramiVideoId(videoId);
         setHaramiStatus('searching...');
         addLog(`Harami loading audio for video ID: ${videoId}`, "info");
      } else {
         addLog(`Harami failed to find song: ${query}`, "error");
      }
    }

    if (isBotStop) {
      rtc.broadcastAppData('app_data', JSON.stringify({ type: 'harami_stop' }));
      setIsHaramiActive(false);
      setHaramiVideoId(null);
      addLog(`Harami stopped.`, "warning");
    }
  };

  // Image Upload helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image to fit within Realtime broadcast limits (max width 800px)
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > 800) {
          height = Math.round((height * 800) / width);
          width = 800;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

          // Render locally
          setAppDataFeed((prev) => [
            ...prev,
            {
              sender: `${user.username} (You)`,
              text: "",
              image: compressedBase64,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);

          addLog(`→ Broadcasting app_data image payload`, "signaling");
          rtc.broadcastAppData('app_data', JSON.stringify({ text: "", image: compressedBase64 }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // reset input
    e.target.value = '';
  };

  useEffect(() => {
    // Listen for incoming app data from rtc (we'll assume the hook doesn't currently expose arbitrary payloads out of the box, but if it did, we'd handle it here)
  }, []);

  // When callCode + isInCall are ready, actually join the room
  useEffect(() => {
    if (isInCall && callCode) {
      rtc.joinRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, callCode]);

  // Log rtc status changes
  useEffect(() => {
    if (rtc.status === 'joining') {
      addLog("Connecting to Supabase Realtime channel...", "signaling");
      addLog("Gathering ICE candidates (STUN: stun.l.google.com:19302)...", "info");
    } else if (rtc.status === 'connected') {
      addLog(`✔ WebRTC connected! Peers in room: ${rtc.remotePeers.map(p => p.username).join(', ') || 'Waiting...'}`, "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtc.status]);

  // Log when a new remote peer joins
  useEffect(() => {
    if (rtc.remotePeers.length > 0) {
      const latest = rtc.remotePeers[rtc.remotePeers.length - 1];
      addLog(`← Peer joined: ${latest.username}`, "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtc.remotePeers.length]);

  // Add a peer simulation inside room
  const handleSimulateNewPeer = () => {
    // No-op in real integration — real peers join via Supabase
  };

  // Start screen share
  const handleStartScreenShare = async () => {
    addLog("Initializing Screen Sharing capture pipeline...", "info");
    const stream = await rtc.startScreenShare();
    if (stream) {
      addLog("✔ Display media captured successfully. WebRTC Video pipeline active.", "success");
      addLog("→ Broadcasting screen share status to remote peers over Supabase...", "signaling");
    } else {
      addLog("⚠ getDisplayMedia blocked or unavailable.", "error");
    }
  };

  const handleStopScreenShare = () => {
    addLog("Terminating screen share stream...", "warning");
    rtc.stopScreenShare();
    addLog("✔ Screen share stream closed.", "info");
  };

  const handleSimulatePeerScreenShare = (peerId: string) => {
    // Disabled in real integration, remote streams come automatically from RTC
  };

  // Format call duration helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      id="dashboard-container"
      className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#08080A] text-zinc-100"
    >
      {/* ── Image Lightbox Overlay ──────────────────────────────────────────── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          {/* Toolbar */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Download button */}
            <a
              href={lightboxSrc}
              download="chat-image.jpg"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold font-mono transition-colors shadow-lg"
              title="Download Image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </a>
            {/* Close button */}
            <button
              onClick={() => setLightboxSrc(null)}
              className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <img
            src={lightboxSrc}
            alt="Full size preview"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] rounded-xl border border-zinc-700 shadow-2xl object-contain"
          />

          {/* Hint */}
          <p className="absolute bottom-4 text-[10px] text-zinc-500 font-mono">Click outside or press Esc to close</p>
        </div>
      )}

      {/* Hidden audio elements for keepalive (muted so audio outputs exclusively via enhanced Web Audio DSP graph) */}
      {rtc.remotePeers.map(peer => (
        <audio
          key={peer.username}
          autoPlay
          playsInline
          muted
          className="hidden"
          ref={(el) => {
            if (el) {
              remoteAudioRefs.current.set(peer.username, el);
              if (peer.remoteAudioStream && el.srcObject !== peer.remoteAudioStream) {
                el.srcObject = peer.remoteAudioStream;
                el.play().catch(() => { });
              }
            } else {
              remoteAudioRefs.current.delete(peer.username);
            }
          }}
        />
      ))}

      {/* Harami Bot Engine - local streaming */}
      {isHaramiActive && haramiVideoId && (
        <HaramiBotEngine
          videoId={haramiVideoId}
          volume={peerVolumes['harami-bot'] !== undefined ? peerVolumes['harami-bot'] : 100}
          isDeafened={isDeafened}
          onStreamReady={(stream) => {
            setHaramiStatus('playing');
            addLog('✔ Harami is playing audio locally (no mic bleed).', 'success');
          }}
          onStreamStop={() => {
            setHaramiStatus('');
          }}
          onEnded={async () => {
            addLog('Harami song ended. Fetching next recommendation...', 'info');
            setHaramiStatus('ended');
            const query = haramiQueryRef.current;
            if (!query) return; // no query stored, stop
            const nextId = await getRecommendation(query);
            if (nextId) {
              addLog(`▶ Auto-playing recommendation for "${query}"`, 'info');
              rtc.broadcastAppData('app_data', JSON.stringify({ type: 'harami_play', videoId: nextId }));
              setHaramiVideoId(nextId);
              setHaramiStatus('searching...');
            } else {
              addLog('Harami: no recommendation found, stopping.', 'warning');
              setIsHaramiActive(false);
              setHaramiVideoId(null);
            }
          }}
          onError={(msg) => {
            addLog(`Harami error: ${msg}`, 'error');
            setHaramiStatus('error');
          }}
        />
      )}

      {/* Navigation and quick diagnostic Sidebar */}
      <div className="w-full md:w-68 border-b md:border-b-0 md:border-r border-[#222226] bg-[#0C0C0E] p-4 flex flex-col justify-between shrink-0">

        {/* ── Logo / Brand navbar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 pb-3.5 mb-3.5 border-b border-[#1A1A1E]">
          <img src="/alter.png" alt="Alter" className="w-7 h-7 rounded-lg object-contain shrink-0" />
          <div className="overflow-hidden flex-1">
            <p className="text-white font-bold text-sm tracking-widest font-mono leading-none">ALTER</p>
            <p className="text-[8px] text-zinc-600 font-mono tracking-widest uppercase leading-none mt-0.5">Voice Platform</p>
          </div>
          <a
            href="https://orbisoft.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] font-mono text-zinc-600 hover:text-blue-400 transition-colors tracking-wider shrink-0"
            title="Visit orbisoft.co"
          >
            orbisoft.co
          </a>
        </div>

        {!isInCall ? (
          <div className="flex flex-col justify-between flex-1 min-h-0 space-y-6">
            <div className="space-y-6">
              {/* Active Operator Card */}
              <div className="p-3 bg-[#161619] border border-[#28282C] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-9 h-9 rounded bg-[#08080A] border border-[#28282C] flex items-center justify-center text-blue-400 font-bold text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] text-zinc-500 font-mono tracking-widest">ACTIVE AGENT</p>
                    <p className="text-xs font-semibold text-zinc-200 truncate tracking-wide font-mono">{user.username.toUpperCase()}</p>
                  </div>
                </div>
                <button
                  id="btn-trigger-settings"
                  onClick={onOpenSettings}
                  className="p-1.5 hover:bg-[#08080A] rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-transparent hover:border-[#28282C]"
                  title="System Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Local Diagnostics */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500 tracking-[0.2em] uppercase">
                  <span>HARDWARE MATRIX</span>
                  <span className="text-[9px] bg-zinc-950 px-1.5 py-0.5 rounded border border-[#28282C] text-blue-400 font-bold font-mono">P2P</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-zinc-400 font-mono">
                  <button
                    id="btn-sidebar-toggle-mic-idle"
                    onClick={handleToggleMute}
                    className={`w-full flex items-center justify-between gap-2 p-2.5 rounded border transition-all text-left cursor-pointer ${isMuted
                      ? "bg-rose-950/10 border-rose-900/40 text-rose-400 hover:bg-rose-950/25"
                      : "bg-zinc-950/40 border-[#28282C] hover:bg-[#161619]"
                      }`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    <div className="flex items-center gap-2 overflow-hidden truncate">
                      {isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate text-[11px]">
                        {isMuted ? "Mic is Muted" : (audioSettings.inputDeviceId === "default-mic" ? "Default Mic" : "Audio Pipeline Active")}
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold ${isMuted ? "text-rose-500" : "text-emerald-500"}`}>
                      {isMuted ? "OFF" : "ON"}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 bg-zinc-950/40 p-2.5 rounded border border-[#28282C]">
                    <Volume2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate flex-1">Speakers Output</span>
                    <span className="text-[9px] text-zinc-400">{audioSettings.volume}%</span>
                  </div>
                </div>
              </div>

              {/* Quick Info & Tips */}
              <div className="bg-[#161619] border border-[#28282C] rounded-lg p-4 text-[11px] text-zinc-400 space-y-2.5 leading-relaxed">
                <p className="font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider font-mono text-[10px]">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>What is a "Call Code"?</span>
                </p>
                <p className="font-light">
                  A Call Code is a temporary session token. Anyone who enters the exact same code is routed to the same Supabase Realtime communication channel and connected peer-to-peer automatically.
                </p>
              </div>
            </div>

            {/* Connection health indicator */}
            <div className="pt-4 border-t border-[#222226] flex items-center justify-between text-[9px] font-mono text-zinc-500 tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                <span>RTC READY</span>
              </span>
              <span>PING: 18ms</span>
            </div>
          </div>
        ) : (
          /* DISCORD STYLE ACTIVE CALL SIDEBAR */
          <div className="flex flex-col justify-between flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              {/* Voice Channel Header */}
              <div className="p-3 bg-[#111214] border border-[#222226] rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider truncate uppercase">Voice Connected</span>
                  </div>
                  <span className="text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/30">
                    {callDuration > 0 ? formatTime(callDuration) : "00:00"}
                  </span>
                </div>
                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1.5 truncate">
                  Channel: <span className="text-blue-400 font-bold">{callCode}</span>
                </p>
              </div>

              {/* Connected Voice participants list */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-0">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">
                  <span>VOICE USERS ({participants.length})</span>
                  <button
                    id="btn-sidebar-add-peer"
                    onClick={handleSimulateNewPeer}
                    className="text-[9px] text-blue-400 hover:text-blue-300 font-bold transition-all cursor-pointer font-mono"
                    title="Simulate Peer Join"
                  >
                    + ADD PEER
                  </button>
                </div>

                {/* Studio DSP 100% Boost & 100% Noise Reduction Status Indicator */}
                <div className="bg-[#161619]/90 border border-blue-900/40 rounded-md p-2 flex items-center justify-between text-[9px] font-mono shadow-[0_0_10px_rgba(59,130,246,0.06)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)] animate-pulse" />
                    <span className="text-blue-400 font-bold tracking-wider">DSP BOOST +100%</span>
                  </div>
                  <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40 text-[8px] font-bold tracking-wider">
                    NOISE GATE 100%
                  </span>
                </div>

                <div className="space-y-2.5">
                  {participants.map((p) => {
                    const vol = peerVolumes[p.id] !== undefined ? peerVolumes[p.id] : 100;
                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-lg border transition-all ${p.isSpeaking
                          ? "bg-[#161619] border-emerald-900/50 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
                          : "bg-[#0C0C0E] border-[#222226]"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            {/* Speaking Indicator Ring */}
                            <div className="relative shrink-0">
                              <div className={`w-7 h-7 rounded-full bg-[#161619] border flex items-center justify-center font-bold text-[10px] text-blue-400 font-mono transition-all ${p.isSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-[#28282C]"
                                }`}>
                                {p.username.slice(0, 2).toUpperCase()}
                              </div>
                              {p.isSpeaking && (
                                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0C0C0E]" />
                              )}
                            </div>

                            <div className="overflow-hidden flex-1">
                              <div className="flex items-center gap-1 overflow-hidden">
                                <span className="text-xs font-semibold text-zinc-200 truncate">{p.username}</span>
                                {p.isScreenSharing && (
                                  <span className="text-[7px] bg-blue-950/40 text-blue-400 px-1 py-0.2 rounded border border-blue-900/30 font-mono font-bold animate-pulse shrink-0">SCREEN</span>
                                )}
                              </div>
                              <span className="text-[8px] text-zinc-500 font-mono block uppercase">
                                {p.isLocal ? "YOU / OWNER" : "SECURE_PEER"}
                              </span>
                            </div>
                          </div>

                          {/* Icons / Mic status right align */}
                          <div className="flex items-center gap-1 shrink-0">
                            {p.isMuted ? (
                              <MicOff className="w-3 h-3 text-rose-400" />
                            ) : p.isSpeaking ? (
                              <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
                            ) : (
                              <Mic className="w-3 h-3 text-zinc-600" />
                            )}
                          </div>
                        </div>

                        {/* DISCORD STYLE INDIVIDUAL USER VOLUME SLIDER */}
                        {!p.isLocal && (
                          <div className="mt-2 pt-2 border-t border-[#222226]/50 flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={vol}
                              onChange={(e) => handleVolumeChange(p.id, parseInt(e.target.value))}
                              className="flex-1 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-blue-500 range-sm"
                            />
                            <span className="text-[9px] font-mono text-zinc-400 shrink-0 min-w-[28px] text-right">
                              {vol}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* DISCORD STYLE FOOTER SETTINGS BAR AT THE BOTTOM */}
            <div className="bg-[#111214] border-t border-[#222226] -mx-4 -mb-4 p-3 mt-4 flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[#161619] border border-[#28282C] flex items-center justify-center font-bold text-[10px] text-blue-400 font-mono">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#111214]" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[11px] font-semibold text-zinc-200 truncate font-mono">{user.username}</p>
                  <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-wider truncate">Connected</p>
                </div>
              </div>

              {/* Action triggers */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer ${isMuted ? "text-rose-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleToggleDeafen}
                  className={`p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer ${isDeafened ? "text-rose-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  title={isDeafened ? "Un-deafen Audio" : "Deafen Audio"}
                >
                  {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {screenSharerId === "local-user" ? (
                  <button
                    onClick={handleStopScreenShare}
                    className="p-1.5 rounded bg-blue-950/40 text-blue-400 border border-blue-900/30 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900/30 transition-all cursor-pointer animate-pulse"
                    title="Stop Screen Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartScreenShare}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                    title="Share Screen"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={handleLeaveCall}
                  className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.2)] ml-1"
                  title="Disconnect Room"
                >
                  <PhoneOff className="w-3 h-3 fill-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {!isInCall ? (
            /* IDLE SCREEN: Join or Create Room */
            <motion.div
              key="idle-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 overflow-y-auto sophisticated-grid-bg"
            >
              <div className="w-full max-w-lg text-center space-y-8 z-10">
                {/* Visual Banner */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full" />
                    <div className="relative w-16 h-16 rounded bg-[#0C0C0E] border border-[#222226] flex items-center justify-center text-blue-500 shadow-2xl">
                      <Radio className="w-7 h-7 animate-pulse text-blue-400" />
                    </div>
                  </div>
                </div>

                {/* Introductory copywriting */}
                <div>
                  <h2 className="text-4xl font-light font-serif italic text-white tracking-tight">
                    Secure Voice Rooms
                  </h2>
                  <p className="text-zinc-400 text-xs max-w-xs mx-auto mt-3 font-light leading-relaxed">
                    Generate an instant secure call code to coordinate with your team, or enter an active key below to join.
                  </p>
                </div>

                {/* Calling Form */}
                <form onSubmit={handleJoinCall} className="space-y-4 max-w-md mx-auto">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="relative flex-1">
                      <input
                        id="input-call-code"
                        type="text"
                        required
                        value={callCode}
                        onChange={(e) => setCallCode(e.target.value.toUpperCase())}
                        placeholder="ENTER SESSION CODE (e.g. ALPHA-9)"
                        className="block w-full px-4 py-3 bg-[#0C0C0E] border border-[#28282C] rounded-lg text-center text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500 tracking-[0.15em] font-mono uppercase"
                      />
                    </div>
                    <button
                      id="btn-join-call"
                      type="submit"
                      className="py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 fill-white" />
                      <span>Join Room</span>
                    </button>
                  </div>

                  {/* Code Generator & Assistant Controls */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      id="btn-create-room"
                      type="button"
                      onClick={handleCreateRoom}
                      className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Start Personal Room ({user.roomcode || "Loading..."})</span>
                    </button>
                    <span className="text-[10px] text-zinc-600 font-mono tracking-tight">
                      Supabase Channel: Standby
                    </span>
                  </div>
                </form>

                {/* WebRTC Flow Explanation Helper Box */}
                <div className="max-w-md mx-auto p-4.5 bg-[#161619] border border-[#28282C] rounded-lg text-left space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-blue-500 font-bold font-mono text-[10px] uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    <span>Communication Architecture</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 font-mono text-[10px] leading-relaxed">
                    <li>Entering a code opens a secure <strong className="text-zinc-200">Supabase Channel</strong>.</li>
                    <li>Audio devices initialize locally to hook into standard WebRTC buffers.</li>
                    <li>Both parties perform standard <strong className="text-zinc-200">SDP Exchange (Offer & Answer)</strong>.</li>
                    <li>ICE Candidates connect peer-to-peer with stun servers automatically.</li>
                  </ol>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE CALL COMPONENT SCREEN */
            <motion.div
              key="active-call"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#08080A]"
            >
              {/* Active calling middle section: Voice/Screen Stage + Integrated Chat */}
              <div className="flex-1 flex flex-col min-h-0 border-r border-[#222226]">
                {/* 1. Voice Call Stage Header */}
                <div className="flex items-center justify-between bg-[#0C0C0E] border-b border-[#222226] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#161619] border border-[#28282C] flex items-center justify-center text-blue-400">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase">Active Session Room:</span>
                        <span className="text-[10px] font-bold text-blue-400 bg-zinc-950 px-2 py-0.5 rounded border border-[#28282C] font-mono tracking-widest uppercase">
                          {callCode}
                        </span>
                      </div>
                      <p className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest mt-0.5">Secure WebRTC Voice Channel</p>
                    </div>
                  </div>

                  {/* Top-right Actions bar */}
                  <div className="flex items-center gap-2.5">
                    {/* Simulated stream toggler if we want to change simulated screenshare type */}
                    {screenSharerId && (
                      <div className="hidden sm:flex items-center gap-1.5 bg-zinc-950/60 p-1 rounded border border-[#28282C]">
                        <span className="text-[8px] font-mono text-zinc-500 px-1 uppercase">Stream Feed:</span>
                        {(["matrix", "topo", "wave"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setSimulatedFeedType(type)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono border uppercase transition-all ${simulatedFeedType === type
                              ? "bg-blue-950/40 border-blue-900/50 text-blue-400 font-bold"
                              : "bg-transparent border-transparent text-zinc-600 hover:text-zinc-300"
                              }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timer */}
                    <div className="flex items-center gap-2 bg-zinc-950 border border-[#28282C] px-2.5 py-1 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[11px] font-mono font-bold text-zinc-300">
                        {callPhase === CallPhase.CONNECTED ? formatTime(callDuration) : "SIGNALING..."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Call Stage Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#08080A] sophisticated-grid-bg">
                  {callPhase !== CallPhase.CONNECTED ? (
                    /* Loading Pipeline */
                    <div className="text-center space-y-4 max-w-xs mx-auto py-12">
                      <div className="relative inline-flex items-center justify-center">
                        <div className="w-12 h-12 border-2 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                        <Radio className="w-4 h-4 text-blue-400 absolute animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-white uppercase tracking-widest font-mono">
                          WebRTC Signaling Handshake
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono animate-pulse">
                          {callPhase === CallPhase.CONNECTING_SIGNALING ? "Opening Supabase signaling..." : "Setting up connection..."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Active Voice/Video Streams list */
                    <div className="space-y-4">
                      {/* Screenshare theater if active */}
                      {screenSharerId ? (
                        <div className="shrink-0">
                          <StreamVisualizer
                            sharerName={
                              screenSharerId === "local-user"
                                ? `${user.username} (You)`
                                : screenSharingPeer?.username || "Remote Peer"
                            }
                            isLocal={screenSharerId === "local-user"}
                            videoStream={screenSharerId === "local-user" ? localScreenStream : (screenSharingPeer?.remoteScreenStream ?? null)}
                            feedType={simulatedFeedType}
                          />
                        </div>
                      ) : (
                        <div className="shrink-0 flex items-center justify-center p-12 border-2 border-dashed border-[#222226] rounded-xl bg-[#08080A]">
                          <button
                            onClick={handleStartScreenShare}
                            className="flex flex-col items-center gap-3 p-6 rounded-xl hover:bg-[#111214] border border-transparent hover:border-[#222226] transition-all group"
                          >
                            <div className="w-16 h-16 rounded-full bg-blue-950/40 border border-blue-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Share2 className="w-8 h-8 text-blue-400 group-hover:text-blue-300" />
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-zinc-200">Share Your Screen</p>
                              <p className="text-xs text-zinc-500 font-mono mt-1">Broadcast your display to all peers in the room</p>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Participant Audio Grids */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {participants.map((p) => (
                          <div
                            key={p.id}
                            className={`p-3 rounded-lg border transition-all duration-300 relative overflow-hidden flex items-center justify-between ${p.isSpeaking
                              ? "bg-[#0C0C0E] border-emerald-950/60 shadow-[0_0_15px_rgba(16,185,129,0.06)]"
                              : "bg-[#0C0C0E] border-[#222226] hover:border-[#28282C]"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 z-10 overflow-hidden flex-1 pr-2">
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded bg-zinc-950 border border-[#28282C] flex items-center justify-center font-bold text-xs text-blue-400 font-mono">
                                  {p.username.slice(0, 2).toUpperCase()}
                                </div>
                                {p.isSpeaking && (
                                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#0C0C0E]" />
                                )}
                              </div>

                              <div className="overflow-hidden">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <p className="text-xs font-semibold text-zinc-200 truncate">{p.username}</p>
                                  {p.isScreenSharing && (
                                    <span className="text-[7px] bg-blue-950/40 text-blue-400 px-1 py-0.2 rounded border border-blue-900/30 font-mono font-bold animate-pulse shrink-0">SCREEN</span>
                                  )}
                                </div>
                                <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5 truncate">
                                  {p.isLocal ? "YOU / HOST" : "SECURE_PEER"}
                                </p>
                              </div>
                            </div>

                            {/* Soundwave bounce UI visualization */}
                            <div className="flex items-center gap-2 shrink-0 z-10">
                              {p.isSpeaking ? (
                                <div className="flex items-end gap-[1.5px] h-4 w-7">
                                  <div className="w-[2.5px] bg-emerald-500 rounded transition-all duration-150" style={{ height: `${Math.max(3, p.speakingVolume * 0.4)}px` }} />
                                  <div className="w-[2.5px] bg-emerald-500 rounded transition-all duration-150" style={{ height: `${Math.max(3, p.speakingVolume * 0.9)}px` }} />
                                  <div className="w-[2.5px] bg-emerald-500 rounded transition-all duration-150" style={{ height: `${Math.max(3, p.speakingVolume * 0.6)}px` }} />
                                  <div className="w-[2.5px] bg-emerald-500 rounded transition-all duration-150" style={{ height: `${Math.max(3, p.speakingVolume * 0.3)}px` }} />
                                </div>
                              ) : (
                                <div className="flex items-end gap-[1.5px] h-4 w-7">
                                  <div className="w-[2.5px] bg-zinc-800 rounded h-0.5" />
                                  <div className="w-[2.5px] bg-zinc-800 rounded h-0.5" />
                                  <div className="w-[2.5px] bg-zinc-800 rounded h-0.5" />
                                  <div className="w-[2.5px] bg-zinc-800 rounded h-0.5" />
                                </div>
                              )}

                              {/* Action controls / Status icon */}
                              {p.isMuted ? (
                                <div className="p-1 bg-rose-950/20 rounded text-rose-400 border border-rose-900/30 shrink-0">
                                  <MicOff className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="p-1 bg-zinc-900 rounded text-zinc-600 border border-[#28282C] shrink-0">
                                  <Mic className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            {/* Ambient active speak container background glow */}
                            {p.isSpeaking && (
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Diagnostic trigger list inside Voice grid area */}
                      {/* {!screenSharerId && (
                        <div className="p-3.5 bg-zinc-950/30 border border-[#222226]/60 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 font-mono">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                            <span>Want to simulate screen sharing? Trigger peer streams locally:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {participants.filter(p => !p.isLocal).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleSimulatePeerScreenShare(p.id)}
                                className="py-1 px-2.5 rounded bg-zinc-900 hover:bg-[#161619] border border-[#28282C] text-[10px] text-blue-400 transition-colors cursor-pointer"
                              >
                                {screenSharerId === p.id ? `Stop ${p.username.split(" ")[0]}` : `Share ${p.username.split(" ")[0]}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )} */}
                    </div>
                  )}
                </div>

                {/* 3. DISCORD STYLE INTEGRATED MIDDLE CHAT BOX */}
                <div className="h-64 sm:h-72 border-t border-[#222226] bg-[#0E0F11] flex flex-col min-h-0">
                  <div className="px-4 py-2.5 bg-[#0C0C0E] border-b border-[#222226] flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider font-bold text-zinc-300">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span># voice-data-channel</span>
                      <span className="text-[8px] bg-[#1a1b1f] px-1.5 py-0.2 rounded text-zinc-500 border border-[#28282C] font-normal uppercase">TEXT_SYNC</span>
                    </div>
                    <span className="text-[8px] font-mono text-zinc-500">P2P DATA LINK</span>
                  </div>

                  {/* Message feed viewport */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#0C0C0E]/40 text-xs flex flex-col justify-start">
                    {appDataFeed.length === 0 ? (
                      <div className="my-auto text-center space-y-2 max-w-sm mx-auto">
                        <MessageSquare className="w-7 h-7 text-zinc-700 mx-auto" />
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Welcome to #voice-data-channel!</p>
                        <p className="text-[10px] font-sans text-zinc-600 font-light leading-relaxed">
                          This text channel transmits data safely via WebRTC P2P Data Channels. Anyone with the call code can chat and broadcast data packets in real-time.
                        </p>
                      </div>
                    ) : (
                      appDataFeed.map((msg, index) => (
                        <div key={index} className="flex items-start gap-3 hover:bg-[#111214]/30 p-1 -mx-2 px-2 rounded transition-colors group">
                          {/* Chat User Avatar */}
                          <div className="w-7 h-7 rounded-full bg-zinc-950 border border-[#28282C] flex items-center justify-center font-bold text-[9px] text-blue-400 font-mono shrink-0">
                            {msg.sender.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="space-y-1 overflow-hidden flex-1">
                            <div className="flex items-baseline gap-2 font-mono text-[10px] text-zinc-500">
                              <span className="font-bold text-zinc-200">{msg.sender}</span>
                              <span className="text-[8px] font-light text-zinc-600">{msg.time}</span>
                            </div>
                            {msg.text && (
                              <p className="text-zinc-300 font-sans leading-relaxed text-[11px] font-light break-words">{msg.text}</p>
                            )}
                            {msg.image && (
                              <div className="mt-1">
                                <img
                                  src={msg.image}
                                  alt="Chat attachment"
                                  onClick={() => setLightboxSrc(msg.image!)}
                                  className="max-w-[200px] sm:max-w-[240px] rounded-lg border border-[#28282C] object-contain max-h-48 cursor-zoom-in hover:opacity-90 transition-opacity"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Message write input form */}
                  <form onSubmit={handleSendAppData} className="p-3 bg-[#0C0C0E] border-t border-[#222226]/50 flex items-center gap-2 relative">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-[#161619] rounded-lg transition-colors shrink-0 cursor-pointer border border-transparent hover:border-[#28282C]"
                      title="Upload Image"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <input
                      id="input-broadcast-message"
                      type="text"
                      value={appDataMessage}
                      onChange={(e) => setAppDataMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-[#161619] border border-[#28282C] rounded-lg py-2 px-3.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 placeholder-zinc-700 font-mono tracking-wide"
                    />
                    <button
                      id="btn-broadcast-submit"
                      type="submit"
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shrink-0 cursor-pointer shadow-[0_0_8px_rgba(59,130,246,0.2)] disabled:opacity-50"
                      title="Send Message"
                      disabled={!appDataMessage.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

              {/* WebRTC Realtime Signaling logs on the right side panel */}
              <div className="w-full lg:w-76 flex flex-col justify-between shrink-0 bg-[#0C0C0E] min-h-0">
                {/* Live WebRTC Handshake Logging console */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-3.5 bg-[#0C0C0E] border-b border-[#222226] flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-blue-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-blue-500" />
                      <span>Signaling Handshake</span>
                    </span>
                    <span className="text-[8px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-[#28282C] font-mono">
                      LOGS
                    </span>
                  </div>

                  {/* Terminal logger viewport */}
                  <div className="flex-1 p-4 font-mono text-[9px] overflow-y-auto space-y-1.5 bg-zinc-950/40">
                    {logs.map((log) => (
                      <div key={log.id} className="leading-relaxed flex items-start gap-1">
                        <span className="text-zinc-600 shrink-0 font-normal">{log.timestamp}</span>
                        <span className={`shrink-0 select-none font-semibold ${log.type === "success" ? "text-emerald-500" :
                          log.type === "warning" ? "text-amber-500" :
                            log.type === "error" ? "text-rose-500" :
                              log.type === "signaling" ? "text-blue-400" : "text-zinc-500"
                          }`}>
                          {log.type === "success" ? "[OK]" :
                            log.type === "warning" ? "[WARN]" :
                              log.type === "error" ? "[ERR]" :
                                log.type === "signaling" ? "[SIGNAL]" : "[SYS]"}
                        </span>
                        <span className={`${log.type === "success" ? "text-emerald-400/90" :
                          log.type === "warning" ? "text-amber-400/90" :
                            log.type === "error" ? "text-rose-400/90" :
                              log.type === "signaling" ? "text-blue-300/95" : "text-zinc-300/95"
                          }`}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
