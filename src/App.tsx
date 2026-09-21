/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import ElectronTitleBar from "./components/ElectronTitleBar";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import SettingsMenu from "./components/SettingsMenu";
import { UserAccount, AudioSettings } from "./types";

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Audio state
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    inputDeviceId: "default-mic",
    outputDeviceId: "default-output",
    volume: 80,
    noiseCancellation: true,
    echoCancellation: true,
    studioVoiceBoost: true,
    noiseGate: true,
  });

  // Check if an operator account is already stored and active
  useEffect(() => {
    const rawAccount = localStorage.getItem("call_code_master_account");
    const sessionActive = localStorage.getItem("call_code_session_active");

    if (rawAccount && sessionActive === "true") {
      try {
        const acc = JSON.parse(rawAccount) as UserAccount;
        setCurrentUser(acc);
        setIsLoggedIn(true);
      } catch (e) {
        // Clear corrupt storage
        localStorage.removeItem("call_code_session_active");
      }
    }
  }, []);

  const handleLoginSuccess = (account: UserAccount) => {
    setCurrentUser(account);
    setIsLoggedIn(true);
    localStorage.setItem("call_code_master_account", JSON.stringify(account));
    localStorage.setItem("call_code_session_active", "true");
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setIsSettingsOpen(false);
    localStorage.removeItem("call_code_session_active");
  };

  const handleCloseApp = () => {
    // Simulate close window behavior
    if (confirm("Are you sure you want to quit the Call Code terminal session?")) {
      handleSignOut();
      alert("Application terminated successfully (simulation). Please refresh page to launch again.");
    }
  };

  return (
    <div
      id="app-bezel-frame"
      className="w-full h-screen flex flex-col bg-[#08080A] font-sans antialiased text-zinc-100 overflow-hidden select-none"
    >
      {/* 1. Desktop Titlebar */}
      <ElectronTitleBar
        appName="Alter"
        isLoggedIn={isLoggedIn}
        username={currentUser?.username}
        onCloseApp={handleCloseApp}
      />

      {/* 2. Main Content Routing Pipeline */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            <motion.div
              key="auth-route"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <LoginScreen onLoginSuccess={handleLoginSuccess} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-route"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <Dashboard
                user={currentUser!}
                audioSettings={audioSettings}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Settings Drawer Slide Overlay */}
        <AnimatePresence>
          {isSettingsOpen && currentUser && (
            <>
              {/* Backdrop */}
              <motion.div
                key="settings-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-black/60 z-40 cursor-pointer"
              />
              {/* Drawer Container */}
              <motion.div
                key="settings-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="absolute right-0 top-0 bottom-0 z-50 h-full w-full sm:w-96"
              >
                <SettingsMenu
                  user={currentUser}
                  audioSettings={audioSettings}
                  setAudioSettings={setAudioSettings}
                  onSignOut={handleSignOut}
                  onClose={() => setIsSettingsOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
