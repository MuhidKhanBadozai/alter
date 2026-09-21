import { useState, useEffect, useRef } from 'react';
import { RemotePeer } from './useWebRTC';

export function useSpeakingVolumes(
  localStream: MediaStream | null,
  remotePeers: RemotePeer[],
  isMuted: boolean,
  isDeafened: boolean
) {
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const sourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const currentMap = new Map<string, AnalyserNode>();
    const currentSources = new Map<string, MediaStreamAudioSourceNode>();

    const setupAnalyser = (id: string, stream: MediaStream) => {
      if (stream.getAudioTracks().length === 0) return;
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        // Note: Do not connect analyser to ctx.destination here! We play remote streams via <audio> tags.
        currentMap.set(id, analyser);
        currentSources.set(id, source);
      } catch (e) {
        console.warn('Failed to attach analyser for', id, e);
      }
    };

    if (localStream && !isMuted) {
      setupAnalyser('local-user', localStream);
    }

    if (!isDeafened) {
      for (const peer of remotePeers) {
        if (peer.remoteAudioStream) {
          setupAnalyser(peer.username, peer.remoteAudioStream);
        }
      }
    }

    // Update refs
    analysersRef.current = currentMap;
    sourcesRef.current.forEach((src, id) => {
      if (!currentSources.has(id)) src.disconnect();
    });
    sourcesRef.current = currentSources;

    return () => {
      // Cleanup happens on next effect run or unmount
    };
  }, [localStream, remotePeers, isMuted, isDeafened]);

  // Polling loop
  useEffect(() => {
    let animationFrameId: number;
    const dataArray = new Uint8Array(256); // Half of fftSize (128 bins)

    const tick = () => {
      setVolumes(prev => {
        let hasChanges = false;
        const next = { ...prev };

        for (const [id, analyser] of analysersRef.current.entries()) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale to 0-100 roughly
          const vol = Math.min(100, (avg / 128) * 100);
          
          if (next[id] !== vol) {
            hasChanges = true;
            next[id] = vol;
          }
        }

        // Zero out disconnected ones
        for (const id of Object.keys(next)) {
          if (!analysersRef.current.has(id) && next[id] !== 0) {
            hasChanges = true;
            next[id] = 0;
          }
        }

        return hasChanges ? next : prev;
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return volumes;
}
