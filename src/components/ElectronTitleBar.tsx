/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Minimize2, 
  Square, 
  X, 
  Radio, 
  Cpu, 
  Clock 
} from "lucide-react";

interface ElectronTitleBarProps {
  appName?: string;
  isLoggedIn: boolean;
  username?: string;
  onCloseApp?: () => void;
}

export default function ElectronTitleBar({ 
  appName = "Call Code Client", 
  isLoggedIn, 
  username,
  onCloseApp
}: ElectronTitleBarProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      id="electron-title-bar"
      className="electron-drag flex items-center justify-between bg-[#0C0C0E] border-b border-[#222226] px-4 py-2 text-xs text-zinc-400 select-none h-11 w-full"
    >
      {/* Left side: App Logo and title */}
      <div className="flex items-center gap-2.5">
        <div className="w-5.5 h-5.5 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-[10px] tracking-tighter">
          CC
        </div>
        <span className="font-light text-zinc-100 tracking-[0.2em] text-[11px] uppercase font-sans">
          {appName}
        </span>
        <span className="text-[9px] bg-[#161619] text-blue-400 px-1.5 py-0.5 rounded border border-[#28282C] font-mono">
          v1.4.0-desktop
        </span>
      </div>

      {/* Middle side: Live Diagnostics */}
      <div className="hidden md:flex items-center gap-4 text-zinc-400">
        <div className="flex items-center gap-1.5 bg-[#161619] px-2.5 py-0.5 rounded border border-[#28282C]">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          <span className="text-[10px] text-zinc-300 tracking-wider font-mono">SIGNALING ACTIVE</span>
        </div>
        {isLoggedIn && username && (
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
            <Cpu className="w-3 h-3 text-blue-400" />
            <span className="tracking-wider">NODE: <strong className="text-zinc-200 font-medium">{username.toUpperCase()}</strong></span>
          </div>
        )}
      </div>

      {/* Right side: Electron buttons & Time */}
      <div className="flex items-center gap-4 electron-no-drag">
        {/* Time display */}
        <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[10px] bg-[#161619] px-2.5 py-0.5 rounded border border-[#28282C] tracking-widest">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>{time || "19:42:44"}</span>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-0.5">
          <button 
            id="btn-win-min"
            className="p-1 hover:bg-[#161619] text-zinc-600 hover:text-zinc-300 rounded transition-colors duration-150 cursor-pointer"
            title="Minimize"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button 
            id="btn-win-max"
            className="p-1 hover:bg-[#161619] text-zinc-600 hover:text-zinc-300 rounded transition-colors duration-150 cursor-pointer"
            title="Maximize"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button 
            id="btn-win-close"
            onClick={onCloseApp}
            className="p-1 hover:bg-rose-950/80 hover:text-rose-400 text-zinc-600 rounded transition-colors duration-150 cursor-pointer"
            title="Close Application"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
