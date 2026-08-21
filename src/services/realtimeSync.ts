import { SyncMessage, WorkstationUser, NavigationTab } from '../types';

const SYNC_CHANNEL_NAME = 'mat_ref_live_sync_channel_v1';
const USER_SESSION_KEY = 'mat_ref_workstation_user_v1';

// Vibrant distinct avatar colors for workstations
const USER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1'  // Indigo
];

type SyncListener = (msg: SyncMessage) => void;
type PresenceListener = (users: WorkstationUser[]) => void;

class RealtimeSyncService {
  private channel: BroadcastChannel | null = null;
  private currentUser: WorkstationUser;
  private activeUsers: Map<string, WorkstationUser> = new Map();
  private syncListeners: Set<SyncListener> = new Set();
  private presenceListeners: Set<PresenceListener> = new Set();
  private heartbeatTimer: any = null;
  private cleanupTimer: any = null;
  private lastSyncTimestamp: string = new Date().toISOString();

  constructor() {
    this.currentUser = this.loadOrCreateUser();
    this.initChannel();
    this.startHeartbeat();
  }

  private loadOrCreateUser(): WorkstationUser {
    try {
      const stored = sessionStorage.getItem(USER_SESSION_KEY) || localStorage.getItem(USER_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastActive: new Date().toISOString()
        };
      }
    } catch (e) {
      // Fallback
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const newUser: WorkstationUser = {
      id: `station-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workstationName: `Workstation-${randomNum}`,
      userName: `QC Inspector #${randomNum}`,
      color,
      lastActive: new Date().toISOString()
    };

    try {
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(newUser));
    } catch (e) {}

    return newUser;
  }

  private initChannel() {
    if (typeof window === 'undefined') return;

    try {
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingMessage(event.data);
        };
      }

      // Storage event listener fallback for cross-window syncing
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'mat_ref_cross_storage_sync' && e.newValue) {
          try {
            const msg: SyncMessage = JSON.parse(e.newValue);
            if (msg.sender.id !== this.currentUser.id) {
              this.handleIncomingMessage(msg);
            }
          } catch (err) {}
        }
      });

      // Cleanup on beforeunload
      window.addEventListener('beforeunload', () => {
        this.broadcast({
          id: `leave-${Date.now()}`,
          type: 'PRESENCE_LEAVE',
          sender: this.currentUser,
          timestamp: new Date().toISOString()
        });
      });
    } catch (err) {
      console.warn('Realtime BroadcastChannel initialization error:', err);
    }
  }

  private handleIncomingMessage(msg: SyncMessage) {
    if (!msg || !msg.sender) return;

    this.lastSyncTimestamp = new Date().toISOString();

    // Update peer presence
    if (msg.type === 'PRESENCE_LEAVE') {
      this.activeUsers.delete(msg.sender.id);
      this.notifyPresence();
    } else {
      this.activeUsers.set(msg.sender.id, {
        ...msg.sender,
        lastActive: msg.timestamp
      });
      this.notifyPresence();
    }

    // Dispatch to subscribers
    this.syncListeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  private startHeartbeat() {
    // Send heartbeat every 3 seconds
    this.heartbeatTimer = setInterval(() => {
      this.currentUser.lastActive = new Date().toISOString();
      this.broadcast({
        id: `hb-${Date.now()}`,
        type: 'PRESENCE_HEARTBEAT',
        sender: this.currentUser,
        timestamp: new Date().toISOString()
      });
    }, 3000);

    // Clean stale users (inactive for > 10 seconds)
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - 10000;
      let changed = false;
      this.activeUsers.forEach((user, id) => {
        if (new Date(user.lastActive).getTime() < cutoff && id !== this.currentUser.id) {
          this.activeUsers.delete(id);
          changed = true;
        }
      });
      if (changed) {
        this.notifyPresence();
      }
    }, 4000);
  }

  public broadcast(msg: SyncMessage) {
    this.lastSyncTimestamp = new Date().toISOString();

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
      }
    }

    // Also trigger storage event for legacy/fallback tab synchronization
    try {
      localStorage.setItem('mat_ref_cross_storage_sync', JSON.stringify(msg));
    } catch (e) {}
  }

  public broadcastMutation(
    type: SyncMessage['type'],
    entityIdentifier: string,
    summary: string,
    payload?: any
  ) {
    const msg: SyncMessage = {
      id: `mutation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      sender: this.currentUser,
      timestamp: new Date().toISOString(),
      entityIdentifier,
      summary,
      payload
    };
    this.broadcast(msg);
  }

  public updateUserInfo(workstationName: string, userName: string) {
    this.currentUser.workstationName = workstationName.trim() || this.currentUser.workstationName;
    this.currentUser.userName = userName.trim() || this.currentUser.userName;
    this.currentUser.lastActive = new Date().toISOString();

    try {
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(this.currentUser));
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(this.currentUser));
    } catch (e) {}

    this.broadcast({
      id: `hb-update-${Date.now()}`,
      type: 'PRESENCE_HEARTBEAT',
      sender: this.currentUser,
      timestamp: new Date().toISOString()
    });

    this.notifyPresence();
  }

  public updateActiveTab(tab: NavigationTab, editingItemCode?: string) {
    this.currentUser.currentTab = tab;
    this.currentUser.currentEditingItemCode = editingItemCode;
    this.currentUser.lastActive = new Date().toISOString();

    this.broadcast({
      id: `tab-${Date.now()}`,
      type: 'PRESENCE_HEARTBEAT',
      sender: this.currentUser,
      timestamp: new Date().toISOString()
    });
  }

  public getCurrentUser(): WorkstationUser {
    return { ...this.currentUser };
  }

  public getActiveUsers(): WorkstationUser[] {
    const list: WorkstationUser[] = [this.currentUser];
    this.activeUsers.forEach((user, id) => {
      if (id !== this.currentUser.id) {
        list.push(user);
      }
    });
    return list;
  }

  public getLastSyncTime(): string {
    return this.lastSyncTimestamp;
  }

  public subscribe(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  public subscribePresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    listener(this.getActiveUsers());
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  private notifyPresence() {
    const list = this.getActiveUsers();
    this.presenceListeners.forEach((listener) => {
      try {
        listener(list);
      } catch (err) {
        console.error('Error in presence listener:', err);
      }
    });
  }

  public destroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.channel) this.channel.close();
  }
}

export const realtimeSync = new RealtimeSyncService();
