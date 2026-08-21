import React, { useState, useEffect, useRef } from 'react';
import { WorkstationUser, SyncMessage } from '../types';
import { realtimeSync } from '../services/realtimeSync';
import { db } from '../services/db';
import { 
  Users, 
  FolderSync, 
  CheckCircle2, 
  RefreshCw, 
  Edit3, 
  Laptop, 
  Activity, 
  X, 
  Save, 
  ShieldCheck,
  Radio
} from 'lucide-react';

interface MultiUserPresenceBadgeProps {
  onNotify?: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const MultiUserPresenceBadge: React.FC<MultiUserPresenceBadgeProps> = ({ onNotify }) => {
  const [users, setUsers] = useState<WorkstationUser[]>([]);
  const [currentUser, setCurrentUser] = useState<WorkstationUser>(realtimeSync.getCurrentUser());
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [stationNameInput, setStationNameInput] = useState('');
  const [userNameInput, setUserNameInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubPresence = realtimeSync.subscribePresence((activeUsers) => {
      setUsers(activeUsers);
      setCurrentUser(realtimeSync.getCurrentUser());
    });

    const unsubSync = realtimeSync.subscribe((msg: SyncMessage) => {
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditingProfile(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubPresence();
      unsubSync();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenModal = () => {
    setCurrentUser(realtimeSync.getCurrentUser());
    setStationNameInput(currentUser.workstationName);
    setUserNameInput(currentUser.userName);
    setIsOpen(!isOpen);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationNameInput.trim() || !userNameInput.trim()) return;

    realtimeSync.updateUserInfo(stationNameInput, userNameInput);
    const updated = realtimeSync.getCurrentUser();
    setCurrentUser(updated);
    setIsEditingProfile(false);
    
    if (onNotify) {
      onNotify('Workstation Updated', `Identified as "${updated.userName}" on "${updated.workstationName}"`, 'success');
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    await db.reloadFromDisk();
    realtimeSync.broadcast({
      id: `manual-sync-${Date.now()}`,
      type: 'PRESENCE_HEARTBEAT',
      sender: realtimeSync.getCurrentUser(),
      timestamp: new Date().toISOString()
    });
    setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setTimeout(() => {
      setIsSyncing(false);
      if (onNotify) {
        onNotify('Shared Folder Synced', 'Successfully refreshed latest master catalog and reference records.', 'info');
      }
    }, 400);
  };

  const otherUsers = users.filter(u => u.id !== currentUser.id);

  return (
    <div className="relative" ref={dropdownRef} id="multi-user-presence-container">
      {/* Trigger Button */}
      <button
        id="multi-user-presence-trigger"
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors shadow-sm"
        title="Shared Folder Real-Time Concurrency & Workstations"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>

        <div className="flex items-center gap-1.5">
          <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-medium">Shared Folder Live</span>
          <span className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-800/50">
            {users.length} {users.length === 1 ? 'Station' : 'Stations'}
          </span>
        </div>

        {/* Mini Avatar Circles */}
        <div className="flex -space-x-1 ml-0.5 overflow-hidden">
          {users.slice(0, 3).map((u) => (
            <div
              key={u.id}
              style={{ backgroundColor: u.color }}
              className="inline-block h-4 w-4 rounded-full ring-1 ring-slate-900 text-[8px] font-bold text-white flex items-center justify-center uppercase shadow-xs"
              title={`${u.workstationName} (${u.userName})`}
            >
              {u.userName.charAt(0)}
            </div>
          ))}
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div 
          id="multi-user-presence-popover"
          className="absolute right-0 mt-2 w-84 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Shared Folder Real-Time Sync
                </h4>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Multi-User Concurrent Access Active
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Current Workstation Card */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-blue-500" />
                  This Workstation (Local Node)
                </span>
                {!isEditingProfile && (
                  <button
                    onClick={() => {
                      setStationNameInput(currentUser.workstationName);
                      setUserNameInput(currentUser.userName);
                      setIsEditingProfile(true);
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Identity
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                      Workstation Name / Machine Tag
                    </label>
                    <input
                      type="text"
                      value={stationNameInput}
                      onChange={(e) => setStationNameInput(e.target.value)}
                      placeholder="e.g. Workstation-QC-Lab1"
                      className="w-full text-xs px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                      Inspector / User Name
                    </label>
                    <input
                      type="text"
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value)}
                      placeholder="e.g. QC Lead Sarah"
                      className="w-full text-xs px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-2.5 py-1 rounded text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1 shadow-sm"
                    >
                      <Save className="w-3 h-3" /> Save Node Info
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: currentUser.color }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                  >
                    {currentUser.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.userName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="font-mono bg-slate-200 dark:bg-slate-700/80 px-1 py-0.2 rounded text-[10px]">
                        {currentUser.workstationName}
                      </span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active (Host)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Connected Workstations List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  Concurrent Stations ({users.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Last check: {lastSyncTime}
                </span>
              </div>

              <div className="space-y-1.5">
                {/* Local station row */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      style={{ backgroundColor: currentUser.color }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    >
                      {currentUser.userName.charAt(0)}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.userName}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">({currentUser.workstationName})</span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    You
                  </span>
                </div>

                {/* Other workstations */}
                {otherUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ backgroundColor: user.color }}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      >
                        {user.userName.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{user.userName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">({user.workstationName})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>Online</span>
                    </div>
                  </div>
                ))}

                {otherUsers.length === 0 && (
                  <div className="p-3 text-center rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                    No other workstations currently detected on the shared folder. Open the application on other network machines or tabs to collaborate simultaneously.
                  </div>
                )}
              </div>
            </div>

            {/* Sync Action & Diagnostics */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Instant atomic shared locking</span>
              </div>
              <button
                id="btn-force-sync-shared"
                onClick={handleForceSync}
                disabled={isSyncing}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Force Sync Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
