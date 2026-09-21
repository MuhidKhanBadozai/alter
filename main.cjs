const { app, BrowserWindow, shell, desktopCapturer, session, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const ytSearch = require('yt-search');
const ytdlBase = require('youtube-dl-exec');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const isPackaged = __dirname.includes('app.asar');
const binPath = isPackaged 
  ? path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe')
  : undefined;
const youtubedl = isPackaged ? ytdlBase.create(binPath) : ytdlBase;

const isDev = process.env.NODE_ENV === 'development';
const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';

let mainWindow = null;
let githubOwner = 'MuhidKhanBadozai';
let githubRepo = 'alter';

// Configure electron-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/** Semantic version comparison: returns true if remote > current */
function isHigherVersion(remote, current) {
  const cleanRemote = (remote || '').replace(/^[vV]/, '').trim();
  const cleanCurrent = (current || '').replace(/^[vV]/, '').trim();
  const rParts = cleanRemote.split('.').map(n => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/** Queries GitHub Releases API for the latest published release */
function fetchLatestGitHubRelease(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases/latest`,
      headers: {
        'User-Agent': 'Alter-App-Updater',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse GitHub response'));
          }
        } else if (res.statusCode === 404) {
          resolve(null); // No releases published yet
        } else {
          reject(new Error(`GitHub API returned status ${res.statusCode}`));
        }
      });
    }).on('error', err => reject(err));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    title: 'Alter',
    backgroundColor: '#08080A',
    icon: path.join(__dirname, 'public', 'alter.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
  });

  mainWindow = win;

  if (isDev) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Open external links in the system browser, not inside Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    mainWindow = null;
  });
}

// ─── ELECTRON-UPDATER EVENT FORWARDING ───────────────────────────────────────
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
    });
  }
});

autoUpdater.on('error', (err) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', {
      error: err ? err.message : 'Unknown updater error',
    });
  }
});

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources && sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback();
      }
    }).catch((err) => {
      console.error('Error getting sources', err);
      callback();
    });
  });

  ipcMain.handle('search-youtube', async (event, query) => {
    try {
      const r = await ytSearch(query);
      return r.videos[0]?.videoId || null;
    } catch (e) {
      console.error('ytSearch error:', e);
      return null;
    }
  });

  ipcMain.handle('recommend-youtube', async (event, query) => {
    try {
      const r = await ytSearch(query);
      return r.videos[1]?.videoId || r.videos[0]?.videoId || null;
    } catch (e) {
      console.error('ytRecommend error:', e);
      return null;
    }
  });

  // ─── VERSION CONTROL & AUTO-UPDATER IPC HANDLERS ─────────────────────────
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-update-config', () => {
    return {
      owner: githubOwner,
      repo: githubRepo,
      version: app.getVersion(),
    };
  });

  ipcMain.handle('set-update-config', (event, { owner, repo }) => {
    if (owner) githubOwner = owner.trim();
    if (repo) githubRepo = repo.trim();
    return { owner: githubOwner, repo: githubRepo };
  });

  ipcMain.handle('open-external', (event, url) => {
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('check-for-updates', async (event, customRepo) => {
    const owner = customRepo?.owner?.trim() || githubOwner;
    const repo = customRepo?.repo?.trim() || githubRepo;
    const currentVersion = app.getVersion();

    try {
      // If running packaged app, configure electron-updater
      if (app.isPackaged) {
        try {
          autoUpdater.setFeedURL({
            provider: 'github',
            owner,
            repo,
          });
        } catch (e) {
          console.warn('autoUpdater setFeedURL warning:', e.message);
        }
      }

      // Check GitHub Releases API
      const release = await fetchLatestGitHubRelease(owner, repo);
      if (!release) {
        return {
          status: 'no-release',
          currentVersion,
          owner,
          repo,
          message: 'No published releases found on GitHub yet.',
        };
      }

      const latestVersion = release.tag_name ? release.tag_name.replace(/^[vV]/, '').trim() : '';
      const hasUpdate = isHigherVersion(latestVersion, currentVersion);

      const asset = (release.assets || []).find(a => a.name.endsWith('.exe')) || release.assets?.[0];

      return {
        status: hasUpdate ? 'update-available' : 'up-to-date',
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseName: release.name || release.tag_name,
        releaseNotes: release.body || 'No release notes provided.',
        publishedAt: release.published_at,
        htmlUrl: release.html_url,
        downloadUrl: asset?.browser_download_url || release.html_url,
        assetName: asset?.name || 'Installer',
        assetSize: asset?.size || 0,
        owner,
        repo,
      };
    } catch (err) {
      return {
        status: 'error',
        currentVersion,
        error: err.message,
        owner,
        repo,
      };
    }
  });

  ipcMain.handle('start-download-update', async () => {
    if (app.isPackaged) {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      return { 
        success: false, 
        isDev: true,
        error: 'In development mode. In the packaged build, this will download and install the update automatically.' 
      };
    }
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  // Start a local HTTP server for audio streaming (Electron production)
  const streamServer = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://localhost`);
    if (reqUrl.pathname === '/api/stream') {
      const videoId = reqUrl.searchParams.get('id');
      if (!videoId) { res.statusCode = 400; res.end(); return; }
      
      youtubedl(`https://www.youtube.com/watch?v=${videoId}`, { dumpJson: true, noWarnings: true }).then(output => {
        const format = output.formats.reverse().find(f => f.vcodec === 'none' && f.acodec !== 'none') || output.formats[0];
        if (!format || !format.url) { res.statusCode = 500; res.end('No audio format'); return; }
        
        res.setHeader('Content-Type', format.ext === 'webm' ? 'audio/webm' : 'audio/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        
        https.get(format.url, (proxyRes) => {
          proxyRes.pipe(res);
          proxyRes.on('error', err => { console.error('proxy stream error:', err.message); res.end(); });
        }).on('error', err => { console.error('https get error:', err.message); res.end(); });

      }).catch(err => { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })); });
    } else if (reqUrl.pathname === '/api/search') {
      const query = reqUrl.searchParams.get('q');
      if (!query) { res.statusCode = 400; res.end(); return; }
      ytSearch(query).then(r => {
        const videoId = r.videos[0]?.videoId || null;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ videoId }));
      }).catch(err => { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })); });
    } else if (reqUrl.pathname === '/api/recommend') {
      const query = reqUrl.searchParams.get('q');
      if (!query) { res.statusCode = 400; res.end(); return; }
      ytSearch(query).then(r => {
        const videoId = r.videos[1]?.videoId || r.videos[0]?.videoId || null;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ videoId }));
      }).catch(err => { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })); });
    } else {
      res.statusCode = 404;
      res.end();
    }
  });

  streamServer.listen(47891, '127.0.0.1', () => {
    console.log('Harami stream server running on port 47891');
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
