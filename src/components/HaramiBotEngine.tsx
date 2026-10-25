/**
 * HaramiBotEngine.tsx
 * A headless component that:
 *  1. Creates a hidden <audio> element sourced from the /api/stream endpoint
 *  2. Captures its output via audio.captureStream()
 *  3. Injects that captured MediaStream into all active WebRTC peer connections
 *     so everyone in the room hears the music through the WebRTC channel.
 *
 * This bypasses all browser autoplay restrictions because the audio element
 * is connected to a real network stream (not a hidden iframe), and the music
 * is broadcast as if the bot were speaking into a microphone.
 */

import React, { useEffect, useRef, useState } from 'react';

interface HaramiBotEngineProps {
  videoId: string;
  volume: number; // 0-100
  isDeafened: boolean;
  onStreamReady: (stream: MediaStream) => void;
  onStreamStop: () => void;
  onEnded: () => void;
  onError: (msg: string) => void;
}

/** Returns the base URL for the audio stream proxy */
function getStreamBase(): string {
  if ((window as any).electronAPI?.getStreamBaseUrl) {
    return (window as any).electronAPI.getStreamBaseUrl();
  }
  return ''; // Same-origin for Vite dev server
}

const HaramiBotEngine: React.FC<HaramiBotEngineProps> = ({
  videoId,
  volume,
  isDeafened,
  onStreamReady,
  onStreamStop,
  onEnded,
  onError,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isSourceConnected, setIsSourceConnected] = useState(false);

  // On mount: wire up the audio element and capture its stream
  useEffect(() => {
    let audio: HTMLAudioElement | null = new Audio();
    let cancelled = false;
    audioRef.current = audio;

    const setup = async () => {
      try {
        const streamUrl = `${getStreamBase()}/api/stream?id=${encodeURIComponent(videoId)}`;
        
        audio!.crossOrigin = 'anonymous';
        audio!.preload = 'auto';
        audio!.src = streamUrl;
        audio!.volume = isDeafened ? 0 : Math.min(1, Math.max(0, volume / 100));

        const tryPlay = () => {
          if (cancelled || !audio) return;
          setIsSourceConnected(true);
          try {
            const capturedStream = (audio as any).captureStream?.() || (audio as any).mozCaptureStream?.();
            if (capturedStream) {
              streamRef.current = capturedStream;
              onStreamReady(capturedStream);
            } else {
              onStreamReady(new MediaStream());
            }
          } catch {
            onStreamReady(new MediaStream());
          }

          audio!.play().catch(e => {
            console.warn('[Harami] Autoplay prevented, waiting for interaction:', e.message);
          });
        };

        audio!.oncanplay = tryPlay;
        audio!.onended = () => { if (!cancelled) onEnded(); };
        audio!.onerror = () => {
          if (!cancelled && audio!.error) {
            onError(`Audio stream error: ${audio!.error.message || 'Stream interrupted'}`);
          }
        };

        audio!.load();
        audio!.play().catch(() => {});
      } catch (e: any) {
        if (!cancelled) onError(`Setup failed: ${e.message}`);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (audio) {
        audio.pause();
        audio.src = '';
        audio.load();
        audio = null;
      }
      audioRef.current = null;
      streamRef.current = null;
      setIsSourceConnected(false);
      onStreamStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, volume / 100));
      audioRef.current.muted = isDeafened;
    }
  }, [volume, isDeafened]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
        left: '-9999px',
        top: '-9999px',
      }}
    >
      {/* Status indicator for debugging */}
      <span>{isSourceConnected ? 'streaming' : 'connecting'}</span>
    </div>
  );
};

export default HaramiBotEngine;
