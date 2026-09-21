/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Monitor, Cpu, Radio, ShieldAlert, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";

interface StreamVisualizerProps {
  sharerName: string;
  isLocal: boolean;
  videoStream: MediaStream | null;
  feedType: "matrix" | "topo" | "wave";
}

export default function StreamVisualizer({
  sharerName,
  isLocal,
  videoStream,
  feedType
}: StreamVisualizerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(100);

  // Bind local actual video stream if available
  useEffect(() => {
    if (videoStream && videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Handle Volume Changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Fullscreen management
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Canvas loop for high-fidelity simulations
  useEffect(() => {
    if (videoStream) return; // Use native video player instead of simulated canvas

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 640);
    let height = (canvas.height = canvas.offsetHeight || 360);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth || 640;
        height = canvas.height = canvas.offsetHeight || 360;
      }
    };
    window.addEventListener("resize", handleResize);

    // Simulation states
    // 1. Matrix State
    const columns = Math.floor(width / 16);
    const rainDrops: number[] = Array(columns).fill(0).map(() => Math.random() * -100);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*()_+{}[]|:;<>?";

    // 2. Topology State
    interface Node {
      x: number;
      y: number;
      label: string;
      radius: number;
      pulse: number;
    }
    const nodes: Node[] = [
      { x: 0.2, y: 0.3, label: "Operator (You)", radius: 6, pulse: 0 },
      { x: 0.8, y: 0.35, label: "Alice (Lead)", radius: 6, pulse: 1.5 },
      { x: 0.5, y: 0.75, label: "Bob (Support)", radius: 6, pulse: 3.0 },
      { x: 0.35, y: 0.5, label: "Signaling Hub", radius: 4, pulse: 4.5 },
    ];
    let packetTimer = 0;
    const packets: { from: Node; to: Node; progress: number }[] = [];

    // 3. Wave state
    let waveOffset = 0;

    // Loop
    const render = () => {
      ctx.fillStyle = "rgba(8, 8, 10, 0.2)"; // Soft trails
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background grid for high-tech look
      ctx.strokeStyle = "rgba(40, 40, 44, 0.15)";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (feedType === "matrix") {
        // --- MATRIX MODE ---
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)"; // Blue tinted raindrops
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

        for (let i = 0; i < rainDrops.length; i++) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          const x = i * 16;
          const y = rainDrops[i];

          // Make leading char brighter blue
          ctx.fillStyle = "rgba(147, 197, 253, 0.9)";
          ctx.fillText(text, x, y);

          ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
          ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - 16);
          ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - 32);

          rainDrops[i] += 4;
          if (rainDrops[i] > height && Math.random() > 0.975) {
            rainDrops[i] = 0;
          }
        }

        // Draw system details overlay
        ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillText(`STREAM: SECURE_BINARY_ARRAY`, 20, 30);
        ctx.fillText(`RESOLVED TYPE: MATRIX_DECRYPTION_FEED`, 20, 45);
        ctx.fillText(`FPS: 60.00 | PARITY: OK`, 20, 60);

      } else if (feedType === "topo") {
        // --- TOPOLOGY MODE ---
        packetTimer++;
        if (packetTimer % 40 === 0 && packets.length < 8) {
          const fromIdx = Math.floor(Math.random() * nodes.length);
          let toIdx = Math.floor(Math.random() * nodes.length);
          while (toIdx === fromIdx) {
            toIdx = Math.floor(Math.random() * nodes.length);
          }
          packets.push({
            from: nodes[fromIdx],
            to: nodes[toIdx],
            progress: 0
          });
        }

        // Render connection lines
        ctx.strokeStyle = "rgba(40, 40, 44, 0.4)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x * width, nodes[i].y * height);
            ctx.lineTo(nodes[j].x * width, nodes[j].y * height);
            ctx.stroke();
          }
        }

        // Render moving packets
        for (let i = packets.length - 1; i >= 0; i--) {
          const p = packets[i];
          p.progress += 0.015;

          const startX = p.from.x * width;
          const startY = p.from.y * height;
          const endX = p.to.x * width;
          const endY = p.to.y * height;

          const currentX = startX + (endX - startX) * p.progress;
          const currentY = startY + (endY - startY) * p.progress;

          // Drawing glowing packets
          ctx.beginPath();
          ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#3b82f6";
          ctx.shadowColor = "#3b82f6";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0; // reset

          if (p.progress >= 1) {
            packets.splice(i, 1);
          }
        }

        // Render nodes
        nodes.forEach((n) => {
          const px = n.x * width;
          const py = n.y * height;

          n.pulse += 0.05;
          const pulseRadius = n.radius + Math.sin(n.pulse) * 4;

          // Pulse ring
          ctx.beginPath();
          ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Core node
          ctx.beginPath();
          ctx.arc(px, py, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#1e1e24";
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          // Labels
          ctx.fillStyle = "rgba(228, 228, 231, 0.8)";
          ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(n.label, px - 40, py - 12);
        });

        ctx.fillStyle = "rgba(228, 228, 231, 0.4)";
        ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillText(`P2P ROUTING: STUN GATHERED PEERS`, 20, 30);

      } else {
        // --- WAVE OSCILLOSCOPE MODE ---
        waveOffset += 0.05;
        ctx.lineWidth = 1.5;

        // Draw multiple glowing sine waves
        const colors = [
          "rgba(59, 130, 246, 0.8)", // bright blue
          "rgba(147, 197, 253, 0.4)", // light blue
          "rgba(30, 58, 138, 0.5)"  // dark blue
        ];

        const amplitudes = [25, 45, 15];
        const frequencies = [0.01, 0.005, 0.02];
        const speeds = [1, 1.5, 0.7];

        for (let w = 0; w < colors.length; w++) {
          ctx.strokeStyle = colors[w];
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * frequencies[w] + waveOffset * speeds[w]) * amplitudes[w];
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }

        // Text telemetry
        ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillText(`CHANNEL FREQUENCY DIAGNOSTICS`, 20, 30);
        ctx.fillText(`SAMPLING: 48.0 KHZ stereo`, 20, 45);
        ctx.fillText(`LATENCY: 12ms | JITTER: 0.8ms`, 20, 60);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [feedType, videoStream]);

  return (
    <div
      id="stream-visualizer-container"
      ref={containerRef}
      className={`w-full relative bg-[#08080A] border-[#222226] overflow-hidden group ${isFullscreen ? 'fixed inset-0 z-50 border-0' : 'rounded border aspect-video'}`}
    >
      {/* 1. Video stream render (if real video stream is available) */}
      {videoStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        /* 2. Simulation Canvas fallback */
        <canvas ref={canvasRef} className="w-full h-full block" />
      )}

      {/* Grid Pattern overlay for tech aesthetic */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(59,130,246,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* High-tech telemetry borders */}
      <div className="absolute top-2.5 left-3.5 flex items-center gap-2 bg-[#0C0C0E]/95 border border-[#222226] px-2.5 py-1 rounded">
        <Monitor className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
        <span className="text-[10px] font-mono font-bold text-zinc-300 tracking-wider">
          {sharerName.toUpperCase()}'S STREAM
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
      </div>

      <div className="absolute bottom-2.5 left-3.5 flex items-center gap-3 bg-[#0C0C0E]/95 border border-[#222226] px-2.5 py-1 rounded text-[9px] font-mono text-zinc-500">
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-zinc-600" />
          <span>DECODE: {videoStream ? "H.264/WebRTC" : "SIMULATED_DSP"}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-zinc-600" />
          <span>P2P SECURE</span>
        </div>
      </div>

      <div className="absolute top-2.5 right-3.5 bg-[#0C0C0E]/95 border border-[#222226] px-2.5 py-1 rounded text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
        </span>
        <span>{feedType} Feed</span>
      </div>

      {/* Controls Overlay (Volume & Fullscreen) */}
      <div className={`absolute bottom-2.5 right-3.5 flex items-center gap-4 bg-[#0C0C0E]/95 border border-[#222226] px-3 py-1.5 rounded text-zinc-300 z-10 transition-opacity ${isFullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {/* Volume Control (only show if not local, as local is muted) */}
        {!isLocal && videoStream && (
          <div className="flex items-center gap-2" title="Adjust stream volume">
            {volume === 0 ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        )}
        
        {/* Fullscreen Toggle */}
        <button 
          onClick={toggleFullscreen} 
          className="hover:text-blue-400 transition-colors flex items-center gap-1"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Frame boundary marks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-600" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-600" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-600" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-600" />
    </div>
  );
}

