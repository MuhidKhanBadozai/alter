/// <reference types="vite/client" />

export interface UpdateCheckResult {
  status: 'update-available' | 'up-to-date' | 'no-release' | 'error';
  currentVersion: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  htmlUrl?: string;
  downloadUrl?: string;
  assetName?: string;
  assetSize?: number;
  owner?: string;
  repo?: string;
  message?: string;
  error?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

declare global {
  interface Window {
    electronAPI?: {
      searchYoutube: (query: string) => Promise<string | null>;
      recommendYoutube: (query: string) => Promise<string | null>;
      getStreamBaseUrl: () => string;
      getAppVersion: () => Promise<string>;
      getUpdateConfig: () => Promise<{ owner: string; repo: string; version: string }>;
      setUpdateConfig: (config: { owner: string; repo: string }) => Promise<{ owner: string; repo: string }>;
      checkForUpdates: (customRepo?: { owner: string; repo: string }) => Promise<UpdateCheckResult>;
      startDownloadUpdate: () => Promise<{ success: boolean; error?: string; isDev?: boolean }>;
      quitAndInstall: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onDownloadProgress: (callback: (data: UpdateProgress) => void) => () => void;
      onUpdateDownloaded: (callback: (data: { version: string }) => void) => () => void;
      onUpdateError: (callback: (data: { error: string }) => void) => () => void;
    };
  }
}
