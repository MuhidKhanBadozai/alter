/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  User, 
  Settings, 
  Volume2, 
  Mic, 
  ToggleLeft, 
  ToggleRight, 
  LogOut, 
  Database, 
  X, 
  Laptop,
  CheckCircle,
  HelpCircle,
  GitBranch,
  Download,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ArrowUpCircle,
  Edit2,
  Check
} from "lucide-react";
import { UserAccount, AudioSettings } from "../types";
import { UpdateCheckResult, UpdateProgress } from "../vite-env";

interface SettingsMenuProps {
  user: UserAccount;
  audioSettings: AudioSettings;
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  onSignOut: () => void;
  onClose: () => void;
}

export default function SettingsMenu({ 
  user, 
  audioSettings, 
  setAudioSettings, 
  onSignOut, 
  onClose 
}: SettingsMenuProps) {
  const [availableInputs, setAvailableInputs] = useState<{ id: string; label: string }[]>([]);
  const [availableOutputs, setAvailableOutputs] = useState<{ id: string; label: string }[]>([]);
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Version control & auto-updater state
  const [appVersion, setAppVersion] = useState<string>("1.1.0");
  const [githubOwner, setGithubOwner] = useState<string>("MuhidKhanBadozai");
  const [githubRepo, setGithubRepo] = useState<string>("alter");
  const [isEditingRepo, setIsEditingRepo] = useState<boolean>(false);
  const [tempOwner, setTempOwner] = useState<string>("MuhidKhanBadozai");
  const [tempRepo, setTempRepo] = useState<string>("alter");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isUpdateReady, setIsUpdateReady] = useState<boolean>(false);

  // Load app version and updater configuration on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion?.().then(v => {
        if (v) setAppVersion(v);
      }).catch(() => {});

      window.electronAPI.getUpdateConfig?.().then(cfg => {
        if (cfg?.owner) {
          setGithubOwner(cfg.owner);
          setTempOwner(cfg.owner);
        }
        if (cfg?.repo) {
          setGithubRepo(cfg.repo);
          setTempRepo(cfg.repo);
        }
      }).catch(() => {});

      const unbindProgress = window.electronAPI.onDownloadProgress?.((data: UpdateProgress) => {
        setIsDownloading(true);
        setDownloadProgress(data.percent);
      });

      const unbindDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
        setIsDownloading(false);
        setIsUpdateReady(true);
        setSuccessMsg("Update downloaded! Ready to install.");
      });

      const unbindError = window.electronAPI.onUpdateError?.((err) => {
        setIsDownloading(false);
        setUpdateResult(prev => prev ? { ...prev, status: 'error', error: err.error } : null);
      });

      return () => {
        unbindProgress?.();
        unbindDownloaded?.();
        unbindError?.();
      };
    }
  }, []);

  const handleSaveRepo = () => {
    const cleanOwner = tempOwner.trim() || "MuhidKhanBadozai";
    const cleanRepo = tempRepo.trim() || "alter";
    setGithubOwner(cleanOwner);
    setGithubRepo(cleanRepo);
    setIsEditingRepo(false);
    window.electronAPI?.setUpdateConfig?.({ owner: cleanOwner, repo: cleanRepo });
    setSuccessMsg("Updated target GitHub repository!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateResult(null);
    try {
      if (window.electronAPI?.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates({ owner: githubOwner, repo: githubRepo });
        setUpdateResult(result);
      } else {
        // Web simulation fallback
        const res = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`);
        if (res.status === 404) {
          setUpdateResult({
            status: 'no-release',
            currentVersion: appVersion,
            message: 'No published releases found on GitHub yet.',
          });
        } else if (res.ok) {
          const data = await res.json();
          const latestTag = (data.tag_name || '').replace(/^[vV]/, '');
          const isHigher = latestTag !== appVersion && latestTag > appVersion;
          setUpdateResult({
            status: isHigher ? 'update-available' : 'up-to-date',
            currentVersion: appVersion,
            latestVersion: latestTag,
            hasUpdate: isHigher,
            releaseName: data.name || data.tag_name,
            releaseNotes: data.body,
            publishedAt: data.published_at,
            htmlUrl: data.html_url,
            downloadUrl: data.assets?.[0]?.browser_download_url || data.html_url,
          });
        } else {
          setUpdateResult({
            status: 'error',
            currentVersion: appVersion,
            error: `GitHub returned HTTP ${res.status}`,
          });
        }
      }
    } catch (e: any) {
      setUpdateResult({
        status: 'error',
        currentVersion: appVersion,
        error: e.message || 'Failed to check updates',
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (window.electronAPI?.startDownloadUpdate) {
      setIsDownloading(true);
      setDownloadProgress(0);
      const res = await window.electronAPI.startDownloadUpdate();
      if (!res.success) {
        setIsDownloading(false);
        if (updateResult?.downloadUrl) {
          window.electronAPI.openExternal?.(updateResult.downloadUrl);
        }
      }
    } else if (updateResult?.downloadUrl) {
      window.open(updateResult.downloadUrl, '_blank');
    }
  };

  const handleInstallUpdate = () => {
    window.electronAPI?.quitAndInstall?.();
  };

  // Retrieve actual system media devices where possible
  useEffect(() => {
    async function fetchDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices
            .filter((d) => d.kind === "audioinput")
            .map((d, index) => ({
              id: d.deviceId || `input-${index}`,
              label: d.label || `Microphone ${index + 1} (${d.deviceId.slice(0, 5)}...)`,
            }));
          const outputs = devices
            .filter((d) => d.kind === "audiooutput")
            .map((d, index) => ({
              id: d.deviceId || `output-${index}`,
              label: d.label || `Speaker Output ${index + 1} (${d.deviceId.slice(0, 5)}...)`,
            }));

          if (inputs.length > 0) setAvailableInputs(inputs);
          else fallbackInputs();

          if (outputs.length > 0) setAvailableOutputs(outputs);
          else fallbackOutputs();
        } else {
          fallbackInputs();
          fallbackOutputs();
        }
      } catch (err) {
        fallbackInputs();
        fallbackOutputs();
      }
    }

    function fallbackInputs() {
      setAvailableInputs([
        { id: "default-mic", label: "Default System Microphone" },
        { id: "usb-mic", label: "Studio USB Condenser Mic" },
        { id: "headset-mic", label: "Integrated Headset Mic" },
      ]);
    }

    function fallbackOutputs() {
      setAvailableOutputs([
        { id: "default-output", label: "Default System Speakers" },
        { id: "headphones", label: "PnP Stereo Headphones" },
        { id: "hdmi-out", label: "HDMI External Monitor Audio" },
      ]);
    }

    fetchDevices();
  }, []);

  const handleSaveSettings = () => {
    setSuccessMsg("Settings updated successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div 
      id="settings-panel-overlay"
      className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#0C0C0E] border-l border-[#222226] shadow-2xl z-50 flex flex-col justify-between text-zinc-200"
    >
      {/* Header */}
      <div className="p-4.5 border-b border-[#222226] flex items-center justify-between bg-[#161619]/40">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-300 font-mono">System Preferences</h3>
        </div>
        <button 
          id="btn-close-settings"
          onClick={onClose}
          className="p-1 hover:bg-[#161619] rounded transition-colors text-zinc-500 hover:text-zinc-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Settings Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* SUCCESS ALERTS */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded text-emerald-400 text-xs flex items-center gap-2 font-mono">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg.toUpperCase()}</span>
          </div>
        )}

        {/* Section 1: User Account Details */}
        <div className="space-y-3.5">
          <h4 className="text-[10px] uppercase font-mono tracking-[0.25em] text-blue-500 font-bold">Operator Profile</h4>
          <div className="bg-[#161619] border border-[#28282C] p-4.5 rounded-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#08080A] border border-[#28282C] flex items-center justify-center text-blue-400 font-mono font-bold text-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[9px] text-zinc-500 font-mono tracking-widest">USER ID CODE</p>
                <p className="text-sm font-bold text-zinc-200 truncate tracking-wide font-mono">{user.username.toUpperCase()}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222226] space-y-2 text-[10px] font-mono text-zinc-400">
              <div className="flex justify-between">
                <span className="tracking-wider">REGISTERED AT:</span>
                <span className="text-zinc-300">
                  {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : "07/09/2026"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="tracking-wider">NODE HASH:</span>
                <span className="text-zinc-300 font-mono uppercase">NODE_P2P_LOCAL</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="tracking-wider">REALTIME STATE:</span>
                <span className="text-amber-400 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/40 text-[9px]">LOCAL_PERSIST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Audio Device Configuration */}
        <div className="space-y-3.5">
          <h4 className="text-[10px] uppercase font-mono tracking-[0.25em] text-blue-500 font-bold">Audio Core Setup</h4>
          <div className="bg-[#161619] border border-[#28282C] p-4.5 rounded-lg space-y-4">
            
            {/* Input Device */}
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-zinc-500" />
                Audio Input Source
              </label>
              <select
                id="select-audio-input"
                value={audioSettings.inputDeviceId}
                onChange={(e) => {
                  setAudioSettings(prev => ({ ...prev, inputDeviceId: e.target.value }));
                  handleSaveSettings();
                }}
                className="block w-full bg-[#08080A] border border-[#28282C] rounded py-2 px-2.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 font-mono tracking-wide"
              >
                {availableInputs.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#161619]">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Device */}
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                Audio Output Target
              </label>
              <select
                id="select-audio-output"
                value={audioSettings.outputDeviceId}
                onChange={(e) => {
                  setAudioSettings(prev => ({ ...prev, outputDeviceId: e.target.value }));
                  handleSaveSettings();
                }}
                className="block w-full bg-[#08080A] border border-[#28282C] rounded py-2 px-2.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 font-mono tracking-wide"
              >
                {availableOutputs.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#161619]">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker Volume Slider */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-1 tracking-wider">
                <span>MONITOR VOLUME</span>
                <span>{audioSettings.volume}%</span>
              </div>
              <input
                id="slider-audio-volume"
                type="range"
                min="0"
                max="100"
                value={audioSettings.volume}
                onChange={(e) => {
                  setAudioSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }));
                }}
                className="w-full accent-blue-500 bg-[#08080A] rounded h-1 appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Premium Processing Toggle Controls */}
        <div className="space-y-3.5">
          <h4 className="text-[10px] uppercase font-mono tracking-[0.25em] text-blue-500 font-bold">Hardware Acceleration</h4>
          <div className="bg-[#161619] border border-[#28282C] p-4.5 rounded-lg space-y-3.5">
            
            {/* Echo Cancellation */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Acoustic Echo Cancellation</p>
                <p className="text-[10px] text-zinc-500">Filter audio feedback loops automatically.</p>
              </div>
              <button
                id="toggle-echo-cancel"
                onClick={() => {
                  setAudioSettings(prev => ({ ...prev, echoCancellation: !prev.echoCancellation }));
                  handleSaveSettings();
                }}
                className="text-blue-500 hover:text-blue-400 cursor-pointer"
              >
                {audioSettings.echoCancellation ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-zinc-700" />
                )}
              </button>
            </div>

            {/* Noise Cancellation */}
            <div className="flex items-center justify-between pt-3 border-t border-[#222226]">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Intelligent Noise Suppression</p>
                <p className="text-[10px] text-zinc-500">Filters environment static hums and background sounds.</p>
              </div>
              <button
                id="toggle-noise-cancel"
                onClick={() => {
                  setAudioSettings(prev => ({ ...prev, noiseCancellation: !prev.noiseCancellation }));
                  handleSaveSettings();
                }}
                className="text-blue-500 hover:text-blue-400 cursor-pointer"
              >
                {audioSettings.noiseCancellation ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-zinc-700" />
                )}
              </button>
            </div>

            {/* Studio Voice Boost (+100% Volume) */}
            <div className="flex items-center justify-between pt-3 border-t border-[#222226]">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-zinc-200">Studio Voice Boost (+100%)</p>
                  <span className="text-[8px] bg-blue-950/60 text-blue-400 px-1 py-0.2 rounded border border-blue-800/40 font-mono font-bold">2.0× GAIN</span>
                </div>
                <p className="text-[10px] text-zinc-500">Doubles voice loudness with vocal presence EQ & dynamic leveling.</p>
              </div>
              <button
                id="toggle-studio-boost"
                onClick={() => {
                  setAudioSettings(prev => ({ ...prev, studioVoiceBoost: prev.studioVoiceBoost === false ? true : false }));
                  handleSaveSettings();
                }}
                className="text-blue-500 hover:text-blue-400 cursor-pointer"
              >
                {audioSettings.studioVoiceBoost !== false ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-zinc-700" />
                )}
              </button>
            </div>

            {/* 100% Noise Gate */}
            <div className="flex items-center justify-between pt-3 border-t border-[#222226]">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-zinc-200">100% Realtime Noise Gate</p>
                  <span className="text-[8px] bg-emerald-950/60 text-emerald-400 px-1 py-0.2 rounded border border-emerald-800/40 font-mono font-bold">-60dB GATE</span>
                </div>
                <p className="text-[10px] text-zinc-500">Completely silences room tone, fans, and breathing when not talking.</p>
              </div>
              <button
                id="toggle-noise-gate"
                onClick={() => {
                  setAudioSettings(prev => ({ ...prev, noiseGate: prev.noiseGate === false ? true : false }));
                  handleSaveSettings();
                }}
                className="text-blue-500 hover:text-blue-400 cursor-pointer"
              >
                {audioSettings.noiseGate !== false ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-zinc-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Version Control & GitHub Auto-Updater */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] uppercase font-mono tracking-[0.25em] text-blue-500 font-bold flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" />
              Version Control & Updates
            </h4>
            <span className="text-[9px] bg-zinc-900 text-blue-400 px-1.5 py-0.5 rounded border border-[#28282C] font-mono font-bold">
              v{appVersion}
            </span>
          </div>

          <div className="bg-[#161619] border border-[#28282C] p-4.5 rounded-lg space-y-4">
            {/* Repository Info */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="tracking-wider">GITHUB REPOSITORY:</span>
                {!isEditingRepo ? (
                  <button
                    onClick={() => setIsEditingRepo(true)}
                    className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={handleSaveRepo}
                    className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold font-mono"
                  >
                    <Check className="w-2.5 h-2.5" />
                    Save
                  </button>
                )}
              </div>

              {!isEditingRepo ? (
                <div className="flex items-center justify-between bg-[#08080A] border border-[#28282C] px-2.5 py-2 rounded text-xs font-mono text-zinc-300">
                  <span className="truncate">{githubOwner}/{githubRepo}</span>
                  <button
                    onClick={() => {
                      if (window.electronAPI?.openExternal) {
                        window.electronAPI.openExternal(`https://github.com/${githubOwner}/${githubRepo}`);
                      } else {
                        window.open(`https://github.com/${githubOwner}/${githubRepo}`, '_blank');
                      }
                    }}
                    className="text-zinc-500 hover:text-blue-400 cursor-pointer p-0.5"
                    title="Open in GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <input
                    type="text"
                    value={tempOwner}
                    onChange={(e) => setTempOwner(e.target.value)}
                    placeholder="Owner"
                    className="flex-1 bg-[#08080A] border border-[#28282C] rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-zinc-600">/</span>
                  <input
                    type="text"
                    value={tempRepo}
                    onChange={(e) => setTempRepo(e.target.value)}
                    placeholder="Repo"
                    className="flex-1 bg-[#08080A] border border-[#28282C] rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Check for updates button */}
            <button
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdate || isDownloading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-blue-300 rounded text-xs font-mono font-bold tracking-wider transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? "CHECKING GITHUB RELEASES..." : "CHECK FOR UPDATES"}</span>
            </button>

            {/* Update Result Display */}
            {updateResult && (
              <div className="space-y-3 pt-3 border-t border-[#222226]">
                {updateResult.status === 'update-available' && (
                  <div className="bg-blue-950/25 border border-blue-800/50 rounded p-3 space-y-2.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                        <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
                        UPDATE AVAILABLE: v{updateResult.latestVersion}
                      </span>
                      <span className="text-[9px] text-zinc-400">Installed: v{updateResult.currentVersion}</span>
                    </div>

                    {updateResult.releaseName && (
                      <p className="text-[11px] text-zinc-200 font-semibold">{updateResult.releaseName}</p>
                    )}

                    {updateResult.releaseNotes && (
                      <div className="max-h-24 overflow-y-auto text-[10px] text-zinc-400 bg-[#08080A]/60 p-2 rounded border border-[#28282C] leading-relaxed whitespace-pre-wrap">
                        {updateResult.releaseNotes}
                      </div>
                    )}

                    {/* Download / Progress / Install actions */}
                    {isUpdateReady ? (
                      <button
                        onClick={handleInstallUpdate}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50 transition-all font-mono tracking-wider"
                      >
                        <CheckCircle className="w-4 h-4" />
                        RESTART & INSTALL v{updateResult.latestVersion}
                      </button>
                    ) : isDownloading ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>DOWNLOADING UPDATE...</span>
                          <span className="text-blue-400 font-bold">{downloadProgress}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleDownloadUpdate}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-950/50 transition-all font-mono tracking-wider"
                      >
                        <Download className="w-3.5 h-3.5" />
                        DOWNLOAD UPDATE (v{updateResult.latestVersion})
                      </button>
                    )}
                  </div>
                )}

                {updateResult.status === 'up-to-date' && (
                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/40 rounded flex items-center gap-2 text-emerald-400 text-xs font-mono">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>App is up to date! (v{updateResult.currentVersion})</span>
                  </div>
                )}

                {updateResult.status === 'no-release' && (
                  <div className="p-2.5 bg-zinc-900/40 border border-zinc-800 rounded text-zinc-400 text-[10px] font-mono space-y-1.5">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>No releases on GitHub yet</span>
                    </div>
                    <p className="text-zinc-500 leading-relaxed">
                      Publish your first release on <span className="text-blue-400">{githubOwner}/{githubRepo}</span> with tag <span className="text-emerald-400 font-bold">v{appVersion}</span> or higher. Alter will detect it automatically!
                    </p>
                  </div>
                )}

                {updateResult.status === 'error' && (
                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded flex items-center gap-2 text-rose-400 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span className="truncate">{updateResult.error || "Update check failed."}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer controls: logout */}
      <div className="p-4.5 border-t border-[#222226] bg-[#08080A] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
          <Laptop className="w-3.5 h-3.5 text-zinc-600" />
          <span>Local Simulation</span>
        </div>
        <button
          id="btn-sign-out"
          onClick={onSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-[#161619] border border-[#28282C] text-rose-400 hover:text-rose-300 text-[10px] uppercase font-mono tracking-widest rounded transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Client</span>
        </button>
      </div>
    </div>
  );
}
