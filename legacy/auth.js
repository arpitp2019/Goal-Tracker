/**
 * FlowDash Authentication Service
 * Handles user sessions and authorization state.
 * For production, replace this with a backend (e.g. Firebase).
 */

const AUTH_KEY = 'flowdash_user_session';
const USERS_KEY = 'flowdash_registered_users';
const TRACKER_STORAGE_PREFIX = 'flowdash_tracker_state';
const DRIVE_SYNC_LOCK_KEY = 'flowdash_drive_sync_lock';
const DRIVE_SYNC_LOCK_TTL = 15000;
const DRIVE_SYNC_LOCK_POLL_MS = 120;

// --- SHARED CONFIG ---
const CLIENT_ID = '216540498622-2ccjhuedqhpkelaea8nv2suaicps07ov.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyDD8NYtI5kgrTEfaqX3Uiq6ovUBiXp83Dc';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

const cloneJSON = (value) => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

const createDefaultDriveState = () => ({
  goals: [],
  habits: [],
  vault: [],
  decision: {
    threads: [],
    settings: {}
  }
});

const safeParseJSON = (raw, fallback) => {
  if (raw === null || raw === undefined) return cloneJSON(fallback);
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored JSON, falling back to defaults.', err);
    return cloneJSON(fallback);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AuthService = {
  // Check if user is logged in
  isAuthenticated() {
    return !!this.getCurrentUser();
  },

  // Get current logged in user details
  getCurrentUser() {
    const session = localStorage.getItem(AUTH_KEY);
    if (!session) return null;

    try {
      return JSON.parse(session);
    } catch (err) {
      console.warn('Invalid auth session found. Clearing it.', err);
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  },

  // Register a new user
  signUp(username, email, password) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    // Check if user already exists
    if (users.find(u => u.email === email)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser = { username, email, password, id: Date.now().toString() };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Auto login after signup
    this.login(email, password);
    return newUser;
  },

  // Log in a user
  login(email, password) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Store session (exclude password)
    const sessionData = { 
      username: user.username, 
      email: user.email, 
      id: user.id,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
    return sessionData;
  },

  // Log in a user via Google
  loginWithGoogle(payload) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    let user = users.find(u => u.email === payload.email);

    if (!user) {
      // Auto-signup for Google users
      user = { 
        username: payload.name, 
        email: payload.email, 
        picture: payload.picture,
        id: 'google_' + payload.sub,
        source: 'google'
      };
      users.push(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    const sessionData = { 
      username: user.username, 
      email: user.email, 
      picture: user.picture,
      id: user.id,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
    return sessionData;
  },

  // Log out
  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('flowdash_drive_token');
    window.location.href = 'login.html';
  },

  // --- STORAGE HELPERS ---
  Storage: {
    getScopedKey(baseKey) {
      const user = AuthService.getCurrentUser();
      if (!user || !user.id) return null;
      return `${TRACKER_STORAGE_PREFIX}:${user.id}:${baseKey}`;
    },

    loadJSON(baseKey, fallbackValue) {
      const scopedKey = this.getScopedKey(baseKey);
      if (!scopedKey) return cloneJSON(fallbackValue);

      const scopedRaw = localStorage.getItem(scopedKey);
      const legacyRaw = localStorage.getItem(baseKey);

      if (scopedRaw !== null) {
        if (legacyRaw !== null) {
          localStorage.removeItem(baseKey);
        }
        return safeParseJSON(scopedRaw, fallbackValue);
      }

      if (legacyRaw !== null) {
        const migrated = safeParseJSON(legacyRaw, fallbackValue);
        try {
          localStorage.setItem(scopedKey, JSON.stringify(migrated));
          localStorage.removeItem(baseKey);
        } catch (err) {
          console.warn('Could not migrate legacy tracker data.', err);
        }
        return cloneJSON(migrated);
      }

      return cloneJSON(fallbackValue);
    },

    saveJSON(baseKey, value) {
      const scopedKey = this.getScopedKey(baseKey);
      if (!scopedKey) return cloneJSON(value);

      localStorage.setItem(scopedKey, JSON.stringify(value));
      return cloneJSON(value);
    },

    clearJSON(baseKey) {
      const scopedKey = this.getScopedKey(baseKey);
      if (!scopedKey) return;
      localStorage.removeItem(scopedKey);
    }
  },

  // --- DRIVE SERVICE ---
  Drive: {
    gapiInited: false,
    initPromise: null,
    tokenClient: null,
    driveFileId: null,
    syncQueue: Promise.resolve(),
    pendingAuthorizePromise: null,
    pendingAuthorizeResolve: null,
    pendingAuthorizeReject: null,
    syncLockKey: DRIVE_SYNC_LOCK_KEY,
    syncLockTTL: DRIVE_SYNC_LOCK_TTL,
    syncLockPollMs: DRIVE_SYNC_LOCK_POLL_MS,

    // Initialize GAPI and GIS
    async init() {
      if (this.initPromise) return this.initPromise;
      if (this.gapiInited && this.tokenClient) return Promise.resolve();
      
      this.initPromise = new Promise((resolve, reject) => {
        // Load GAPI
        const script = document.createElement('script');
        script.src = "https://apis.google.com/js/api.js";
        script.onerror = () => {
          this.initPromise = null;
          reject(new Error('Failed to load Google API script.'));
        };
        script.onload = () => {
          gapi.load('client', async () => {
            try {
              await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
              this.gapiInited = true;
              console.log("Drive GAPI Ready");
            } catch (err) {
              this.initPromise = null;
              reject(err);
              return;
            }
            
            // Load GIS
            const gisScript = document.createElement('script');
            gisScript.src = "https://accounts.google.com/gsi/client";
            gisScript.onerror = () => {
              this.initPromise = null;
              reject(new Error('Failed to load Google Identity Services.'));
            };
            gisScript.onload = () => {
              this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID, scope: SCOPES, callback: (resp) => this.onTokenResponse(resp)
              });
              console.log("Drive GIS Ready");
              
            // Auto-reconnect if token exists
              const savedToken = localStorage.getItem('flowdash_drive_token');
              if (savedToken) {
                gapi.client.setToken({ access_token: savedToken });
                this.findOrCreateSaveFile()
                  .catch((err) => console.error("Drive File Init Error", err))
                  .finally(resolve);
              } else {
                resolve();
              }
            };
            document.head.appendChild(gisScript);
          });
        };
        document.head.appendChild(script);
      });

      return this.initPromise;
    },

    async authorize() {
      if (this.pendingAuthorizePromise) return this.pendingAuthorizePromise;
      if (!this.tokenClient) await this.init();

      const pendingPromise = new Promise((resolve, reject) => {
        this.pendingAuthorizeResolve = resolve;
        this.pendingAuthorizeReject = reject;
      });
      this.pendingAuthorizePromise = pendingPromise;

      try {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (err) {
        this.rejectPendingAuthorize(err);
      }

      return pendingPromise;
    },

    onTokenResponse(resp) {
      if (resp.error) {
        console.error("Drive Auth Error:", resp.error);
        localStorage.removeItem('flowdash_drive_token');
        this.rejectPendingAuthorize(new Error(resp.error));
        return;
      }

      localStorage.setItem('flowdash_drive_token', resp.access_token);
      if (gapi.client && typeof gapi.client.setToken === 'function') {
        gapi.client.setToken({ access_token: resp.access_token });
      }

      Promise.resolve(this.findOrCreateSaveFile())
        .catch((err) => {
          console.error("Drive File Init Error", err);
        })
        .finally(() => {
          this.resolvePendingAuthorize(resp.access_token);
        });
    },

    async findOrCreateSaveFile() {
      try {
        let res = await gapi.client.drive.files.list({
          spaces: 'appDataFolder', q: "name='flowdash_suite_sync.json'", fields: 'files(id)'
        });
        if (res.result.files && res.result.files.length > 0) {
          this.driveFileId = res.result.files[0].id;
        } else {
          let metadata = { name: 'flowdash_suite_sync.json', parents: ['appDataFolder'] };
          let file = new Blob([JSON.stringify(createDefaultDriveState())], {type: 'application/json'});
          let formData = new FormData();
          formData.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
          formData.append('file', file);
          let fetchRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
            body: formData
          });
          let json = await fetchRes.json();
          this.driveFileId = json.id;
        }
      } catch (e) { console.error("Drive File Init Error", e); }
    },

    async sync(key, data) {
      const payload = cloneJSON(data);
      const task = async () => {
        if (!this.driveFileId) return payload;

        return this.withSyncLock(async () => {
          try {
            const token = gapi.client && typeof gapi.client.getToken === 'function'
              ? gapi.client.getToken()
              : null;
            if (!token || !token.access_token) return payload;

            // Read the freshest remote snapshot immediately before patching.
            const res = await gapi.client.drive.files.get({ fileId: this.driveFileId, alt: 'media' });
            const rawBody = res && typeof res.body === 'string' ? res.body : '';
            let fullState = rawBody ? JSON.parse(rawBody) : createDefaultDriveState();
            if (!fullState || typeof fullState !== 'object') {
              fullState = createDefaultDriveState();
            } else {
              fullState = {
                ...createDefaultDriveState(),
                ...fullState
              };
            }

            fullState[key] = payload;

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.driveFileId}?uploadType=media`, {
              method: 'PATCH',
              headers: new Headers({
                'Authorization': 'Bearer ' + token.access_token,
                'Content-Type': 'application/json'
              }),
              body: JSON.stringify(fullState)
            });

            return fullState[key];
          } catch (e) {
            console.error("Drive Sync Error", e);
            return payload;
          }
        });
      };

      this.syncQueue = this.syncQueue.then(task, task);
      return this.syncQueue;
    },

    async withSyncLock(task) {
      const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      while (true) {
        const current = this.readSyncLock();
        const now = Date.now();
        const lockExpired = !current || typeof current.expiresAt !== 'number' || current.expiresAt <= now;

        if (lockExpired) {
          if (this.tryAcquireSyncLock(owner)) break;
        }

        await sleep(this.syncLockPollMs);
      }

      try {
        return await task();
      } finally {
        this.releaseSyncLock(owner);
      }
    },

    readSyncLock() {
      try {
        const raw = localStorage.getItem(this.syncLockKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (err) {
        return null;
      }
    },

    tryAcquireSyncLock(owner) {
      const record = { owner, expiresAt: Date.now() + this.syncLockTTL };
      try {
        localStorage.setItem(this.syncLockKey, JSON.stringify(record));
        const stored = this.readSyncLock();
        return !!stored && stored.owner === owner;
      } catch (err) {
        return false;
      }
    },

    releaseSyncLock(owner) {
      try {
        const stored = this.readSyncLock();
        if (stored && stored.owner === owner) {
          localStorage.removeItem(this.syncLockKey);
        }
      } catch (err) {}
    },

    resolvePendingAuthorize(value) {
      if (this.pendingAuthorizeResolve) {
        this.pendingAuthorizeResolve(value);
      }
      this.clearPendingAuthorize();
    },

    rejectPendingAuthorize(error) {
      if (this.pendingAuthorizeReject) {
        this.pendingAuthorizeReject(error);
      }
      this.clearPendingAuthorize();
    },

    clearPendingAuthorize() {
      this.pendingAuthorizePromise = null;
      this.pendingAuthorizeResolve = null;
      this.pendingAuthorizeReject = null;
    }
  },

  // Security check for protected pages
  protect() {
    if (!this.isAuthenticated()) {
      // Don't redirect if we're already on login page
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
    }
  }
};

// Automatic protection check on load
if (typeof window !== 'undefined') {
  AuthService.protect();
}
