/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  User, 
  Lock, 
  ShieldAlert, 
  KeyRound, 
  Terminal, 
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2
} from "lucide-react";
import { UserAccount } from "../types";
import { supabase } from "../supabase";

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // We rely on App.tsx to handle session restoration.
  // This screen only appears if the user is not logged in.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please specify a valid Username.");
      return;
    }
    if (password.length < 4) {
      setError("Password must contain at least 4 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // 1. Check if user exists
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("username", username.trim())
          .maybeSingle();

        if (existingUser) {
          setError("Username is already taken.");
          setLoading(false);
          return;
        }

        // 2. Generate random 8 digit roomcode
        const newRoomcode = Math.floor(10000000 + Math.random() * 90000000).toString();

        // 3. Insert new user
        const { error: insertError } = await supabase
          .from("users")
          .insert([{ username: username.trim(), password: password, roomcode: newRoomcode }]);

        if (insertError) {
          setError("Registration failed. Please try again.");
          setLoading(false);
          return;
        }

        const newAccount: UserAccount = {
          username: username.trim(),
          roomcode: newRoomcode,
          registeredAt: new Date().toISOString(),
        };
        onLoginSuccess(newAccount);
      } else {
        // Login existing account
        const { data: user, error: fetchError } = await supabase
          .from("users")
          .select("*")
          .eq("username", username.trim())
          .eq("password", password)
          .maybeSingle();

        if (fetchError || !user) {
          setError("Invalid username or password. Please try again.");
        } else {
          const account: UserAccount = {
            username: user.username,
            roomcode: user.roomcode,
            registeredAt: new Date().toISOString(),
          };
          onLoginSuccess(account);
        }
      }
    } catch (err) {
      setError("Database connection failed. Please check your Supabase keys.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="login-screen-container"
      className="flex-1 flex flex-col md:flex-row items-stretch overflow-hidden bg-[#08080A] text-zinc-100"
    >
      {/* Visual / Marketing and Technology Column */}
      <div className="w-full md:w-5/12 bg-[#0C0C0E] p-8 md:p-12 border-b md:border-b-0 md:border-r border-[#222226] flex flex-col justify-between">
        <div>
          {/* Logo + App name */}
          <div className="flex items-center gap-3 mb-10">
            <img src="/alter.png" alt="Alter Logo" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <p className="text-white font-bold text-xl tracking-widest font-mono">ALTER</p>
              <p className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">Voice &amp; Call Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-light font-serif italic tracking-tight text-white mb-5 leading-tight">
            Establish Secure <br />
            <span className="text-blue-500 font-semibold not-italic font-sans tracking-wide text-3xl block mt-1 uppercase">
              Connections
            </span>
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed mb-8">
            Call Code connects multiple peers directly using secure peer-to-peer WebRTC channels. 
            No complex room directories or invitations needed. Share a private call code to join instantly.
          </p>

          {/* Quick Features List */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-zinc-900 border border-[#28282C] flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200 tracking-wide">Zero-Latency Channels</p>
                <p className="text-[10px] text-zinc-500">P2P audio pipelines engineered directly into the client.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-zinc-900 border border-[#28282C] flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200 tracking-wide">Supabase Realtime Sync</p>
                <p className="text-[10px] text-zinc-500">Configured to handle instant signaling exchange over channels.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic info at bottom */}
        <div>
          <div className="mt-8 pt-6 border-t border-[#222226] text-[10px] font-mono text-zinc-500 space-y-1.5">
            <div className="flex justify-between">
              <span>CLIENT LAYER:</span>
              <span className="text-blue-400 font-bold">AES_256_ACTIVE</span>
            </div>
            <div className="flex justify-between">
              <span>DATABASE INTEGRATION:</span>
              <span className="text-emerald-500">SUPABASE_CONNECTED</span>
            </div>
            <div className="flex justify-between">
              <span>RTC DRIVERS:</span>
              <span className="text-emerald-500">READY</span>
            </div>
          </div>

          {/* Made by Orbisoft */}
          <div className="mt-8 pt-5 border-t border-[#222226] flex items-center justify-between">
            <p className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase">Made by Orbisoft</p>
            <a
              href="https://orbisoft.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-blue-500 hover:text-blue-300 transition-colors tracking-widest"
            >
              orbisoft.co ↗
            </a>
          </div>
        </div>
      </div>

      {/* Main Interactive Form Column with dot-matrix overlay */}
      <div className="w-full md:w-7/12 flex flex-col justify-center items-center p-6 md:p-12 bg-[#08080A] relative sophisticated-grid-bg">
        <div className="w-full max-w-md z-10">
          {/* Header depending on first install */}
          <div className="text-center md:text-left mb-8">
            <h1 className="text-4xl font-light font-serif italic text-white mb-2">
              {isRegistering ? "Register Account" : "Secure Entry"}
            </h1>
            <p className="text-xs text-zinc-400 tracking-wide font-light">
              {isRegistering
                ? "Create a new operator identity to access the terminal."
                : "Enter your credentials to unlock the voice communications terminal."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error alerts */}
            {error && (
              <motion.div 
                id="login-error-alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-lg text-xs flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono text-[11px]">{error}</span>
              </motion.div>
            )}

            {/* Username Input */}
            <div>
              <label className="block text-[10px] font-mono tracking-[0.2em] text-zinc-400 mb-1.5 uppercase">
                Operator Identity ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter unique ID (e.g. j_vance_92)"
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#0C0C0E] border border-[#28282C] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono tracking-wider"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[10px] font-mono tracking-[0.2em] text-zinc-400 mb-1.5 uppercase">
                Terminal Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-12 py-2.5 bg-[#0C0C0E] border border-[#28282C] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Form actions */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-850 text-white font-semibold rounded-lg text-xs uppercase tracking-[0.25em] shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all duration-200 focus:outline-none cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>INITIALIZING CRYPTO DRIVER...</span>
                </>
              ) : (
                <>
                  <span>{isRegistering ? "Register New Identity" : "Establish Connection"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle login vs register */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsRegistering(!isRegistering);
                setUsername("");
                setPassword("");
              }}
              className="text-[10px] font-mono tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isRegistering 
                ? "ALREADY REGISTERED? LOG IN TO TERMINAL" 
                : "NEED AN ACCOUNT? REGISTER HERE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
