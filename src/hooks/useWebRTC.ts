import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';

export interface RemotePeer {
  id: string;
  username: string;
  isScreenSharing: boolean;
  remoteAudioStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
}

export interface WebRTCState {
  status: 'idle' | 'joining' | 'connected' | 'ended';
  localAudioStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isScreenSharing: boolean;
  remotePeers: RemotePeer[];
  error: string | null;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

export function useWebRTC(roomCode: string, username: string, onAppData?: (from: string, data: string) => void) {
  const [state, setState] = useState<WebRTCState>({
    status: 'idle',
    localAudioStream: null,
    localScreenStream: null,
    isMuted: false,
    isScreenSharing: false,
    remotePeers: [],
    error: null,
  });

  // Map of peerUsername -> RTCPeerConnection
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidate queue per peer (received before remote description is set)
  const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const injectedAudioRef = useRef<MediaStreamTrack | null>(null);
  const usernameRef = useRef(username);
  usernameRef.current = username;

  // ─── Utility: update or add a remote peer in state ────────────────────────
  const updateRemotePeer = useCallback((peerUsername: string, updates: Partial<RemotePeer>) => {
    setState(s => {
      const exists = s.remotePeers.some(p => p.username === peerUsername);
      if (exists) {
        return {
          ...s,
          remotePeers: s.remotePeers.map(p =>
            p.username === peerUsername ? { ...p, ...updates } : p
          )
        };
      }
      const newPeer: RemotePeer = {
        id: peerUsername,
        username: peerUsername,
        isScreenSharing: false,
        remoteAudioStream: null,
        remoteScreenStream: null,
        ...updates,
      };
      return { ...s, remotePeers: [...s.remotePeers, newPeer] };
    });
  }, []);

  const removeRemotePeer = useCallback((peerUsername: string) => {
    const pc = pcs.current.get(peerUsername);
    if (pc) { pc.close(); pcs.current.delete(peerUsername); }
    iceCandidateQueue.current.delete(peerUsername);
    setState(s => ({
      ...s,
      remotePeers: s.remotePeers.filter(p => p.username !== peerUsername),
    }));
  }, []);

  // ─── Broadcast helper ─────────────────────────────────────────────────────
  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  // ─── Drain queued ICE candidates once remote desc is ready ────────────────
  const drainQueue = useCallback(async (peerUsername: string) => {
    const pc = pcs.current.get(peerUsername);
    const queue = iceCandidateQueue.current.get(peerUsername) ?? [];
    if (pc && pc.remoteDescription && queue.length > 0) {
      for (const c of queue) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
      }
      iceCandidateQueue.current.set(peerUsername, []);
    }
  }, []);

  // ─── Create a RTCPeerConnection for a specific remote peer ────────────────
  const createPeerConnection = useCallback((peerUsername: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcs.current.set(peerUsername, pc);
    iceCandidateQueue.current.set(peerUsername, []);

    // Add local audio tracks
    const localAudio = localAudioStreamRef.current;
    if (localAudio) localAudio.getTracks().forEach(track => pc.addTrack(track, localAudio));

    // Add local screen tracks if already sharing when this peer joins
    const localScreen = localScreenStreamRef.current;
    if (localScreen) localScreen.getTracks().forEach(track => pc.addTrack(track, localScreen));

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      const track = event.track;

      if (track.kind === 'audio') {
        setState(s => {
          const peer = s.remotePeers.find(p => p.username === peerUsername);
          const currentStream = peer?.remoteAudioStream || new MediaStream();
          if (!currentStream.getTracks().includes(track)) {
            currentStream.addTrack(track);
          }
          const updatedPeer: RemotePeer = peer
            ? { ...peer, remoteAudioStream: currentStream }
            : {
              id: peerUsername,
              username: peerUsername,
              remoteAudioStream: currentStream,
              remoteScreenStream: null,
              isScreenSharing: false
            };

          return {
            ...s,
            remotePeers: peer
              ? s.remotePeers.map(p => p.username === peerUsername ? updatedPeer : p)
              : [...s.remotePeers, updatedPeer]
          };
        });
      } else if (track.kind === 'video') {
        const stream = event.streams[0] ?? new MediaStream([track]);
        updateRemotePeer(peerUsername, { remoteScreenStream: stream, isScreenSharing: true });
        track.onended = () => {
          updateRemotePeer(peerUsername, { remoteScreenStream: null, isScreenSharing: false });
        };
      }
    };

    // Relay ICE candidates through Supabase
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        broadcast('ice_candidate', {
          from: usernameRef.current,
          to: peerUsername,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setState(s => ({ ...s, status: 'connected' }));
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removeRemotePeer(peerUsername);
      }
    };

    return pc;
  }, [broadcast, updateRemotePeer, removeRemotePeer]);

  // ─── Microphone access ────────────────────────────────────────────────────
  const getMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
        video: false,
      });
      localAudioStreamRef.current = stream;
      setState(s => ({ ...s, localAudioStream: stream, error: null }));
      return stream;
    } catch {
      setState(s => ({ ...s, error: 'Could not access microphone.' }));
      return null;
    }
  }, []);

  // ─── Toggle mute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localAudioStreamRef.current;
    if (!stream) return;
    setState(s => {
      const newMuted = !s.isMuted;
      stream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
      return { ...s, isMuted: newMuted };
    });
  }, []);

  // ─── Inject / remove a custom audio stream into all peer connections ────────
  const injectAudioStream = useCallback((stream: MediaStream) => {
    const newTrack = stream.getAudioTracks()[0];
    if (!newTrack) return;
    injectedAudioRef.current = newTrack;
    for (const pc of pcs.current.values()) {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(newTrack).catch(e => console.warn('replaceTrack error:', e));
      } else {
        pc.addTrack(newTrack, stream);
      }
    }
  }, []);

  const removeInjectedAudio = useCallback(() => {
    const micTrack = localAudioStreamRef.current?.getAudioTracks()[0];
    if (!micTrack) return;
    for (const pc of pcs.current.values()) {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(micTrack).catch(e => console.warn('replaceTrack error:', e));
      }
    }
    injectedAudioRef.current = null;
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localScreenStreamRef.current = stream;
      setState(s => ({ ...s, localScreenStream: stream, isScreenSharing: true }));

      // Add screen tracks to ALL existing peer connections and renegotiate
      for (const [peerUsername, pc] of pcs.current.entries()) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          broadcast('webrtc_offer', { from: usernameRef.current, to: peerUsername, sdp: offer });
        } catch (e) {
          console.warn('Screen share renegotiation error:', e);
        }
      }

      broadcast('screen_share_started', { from: usernameRef.current });

      // When user stops sharing from browser UI
      stream.getVideoTracks()[0].onended = () => stopScreenShare();

      return stream;
    } catch {
      setState(s => ({ ...s, error: 'Could not share screen.' }));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast]);

  const stopScreenShare = useCallback(() => {
    const stream = localScreenStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      localScreenStreamRef.current = null;
    }
    setState(s => ({ ...s, localScreenStream: null, isScreenSharing: false }));
    broadcast('screen_share_stopped', { from: usernameRef.current });
  }, [broadcast]);

  // ─── Initialize Supabase Realtime signaling channel ───────────────────────
  const initSignaling = useCallback(() => {
    if (!roomCode) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const chan = supabase.channel(`call-${roomCode}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = chan;

    // ── Someone joined → we send them an offer (all existing peers do this) ──
    chan.on('broadcast', { event: 'user_joined' }, async ({ payload }) => {
      const joinerName = payload.username as string;
      if (!joinerName || joinerName === usernameRef.current) return;

      // Add to peer list immediately so their name appears in UI
      updateRemotePeer(joinerName, { username: joinerName });

      // Create connection and send offer
      const pc = pcs.current.get(joinerName) ?? createPeerConnection(joinerName);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        broadcast('webrtc_offer', { from: usernameRef.current, to: joinerName, sdp: offer });
      } catch (e) { console.error('Offer error:', e); }
    });

    // ── Received a WebRTC offer → create and send an answer ──────────────────
    chan.on('broadcast', { event: 'webrtc_offer' }, async ({ payload }) => {
      if (payload.to !== usernameRef.current) return;
      const offererName = payload.from as string;

      const pc = pcs.current.get(offererName) ?? createPeerConnection(offererName);
      updateRemotePeer(offererName, { username: offererName });

      try {
        // Handle offer-glare (both sides offered simultaneously)
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await drainQueue(offererName);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        broadcast('webrtc_answer', { from: usernameRef.current, to: offererName, sdp: answer });
      } catch (e) { console.error('Offer handling error:', e); }
    });

    // ── Received an answer ────────────────────────────────────────────────────
    chan.on('broadcast', { event: 'webrtc_answer' }, async ({ payload }) => {
      if (payload.to !== usernameRef.current) return;
      const answererName = payload.from as string;
      const pc = pcs.current.get(answererName);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await drainQueue(answererName);
        } catch (e) { console.error('Answer handling error:', e); }
      }
    });

    // ── ICE candidates ────────────────────────────────────────────────────────
    chan.on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
      if (payload.to !== usernameRef.current) return;
      const fromName = payload.from as string;
      const pc = pcs.current.get(fromName);
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
      } else {
        // Queue until remote description is set
        const q = iceCandidateQueue.current.get(fromName) ?? [];
        q.push(payload.candidate);
        iceCandidateQueue.current.set(fromName, q);
      }
    });

    // ── Peer left ─────────────────────────────────────────────────────────────
    chan.on('broadcast', { event: 'user_left' }, ({ payload }) => {
      const leaverName = payload.username as string;
      if (leaverName && leaverName !== usernameRef.current) removeRemotePeer(leaverName);
    });

    // ── Screen share signaling ────────────────────────────────────────────────
    chan.on('broadcast', { event: 'screen_share_started' }, ({ payload }) => {
      updateRemotePeer(payload.from as string, { isScreenSharing: true });
    });
    chan.on('broadcast', { event: 'screen_share_stopped' }, ({ payload }) => {
      updateRemotePeer(payload.from as string, { isScreenSharing: false, remoteScreenStream: null });
    });

    // ── App data ──────────────────────────────────────────────────────────────
    chan.on('broadcast', { event: 'app_data' }, ({ payload }) => {
      if (onAppData) {
        onAppData(payload.from as string, payload.data as string);
      }
    });

    // ── Subscribe then announce our presence to the room ─────────────────────
    chan.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        broadcast('user_joined', { username: usernameRef.current });
      }
    });
  }, [roomCode, broadcast, createPeerConnection, updateRemotePeer, removeRemotePeer, drainQueue, onAppData]);

  // ─── Public joinRoom action ───────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    setState(s => ({ ...s, status: 'joining', remotePeers: [], error: null }));
    const stream = await getMicrophone();
    if (stream) initSignaling();
  }, [getMicrophone, initSignaling]);

  // ─── End call + cleanup ───────────────────────────────────────────────────
  const endCall = useCallback(() => {
    broadcast('user_left', { username: usernameRef.current });
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear();
    iceCandidateQueue.current.clear();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    localAudioStreamRef.current?.getTracks().forEach(t => t.stop());
    localScreenStreamRef.current?.getTracks().forEach(t => t.stop());
    localAudioStreamRef.current = null;
    localScreenStreamRef.current = null;
    setState({
      status: 'ended',
      localAudioStream: null,
      localScreenStream: null,
      isMuted: false,
      isScreenSharing: false,
      remotePeers: [],
      error: null,
    });
  }, [broadcast]);

  const broadcastAppData = useCallback((event: string, data: string) => {
    broadcast(event, { from: usernameRef.current, data });
  }, [broadcast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { endCall(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    joinRoom,
    endCall,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    broadcastAppData,
    injectAudioStream,
    removeInjectedAudio,
  };
}
