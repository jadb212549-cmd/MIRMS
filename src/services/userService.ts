export interface AppUser {
  fullName: string;
  shortName: string; // e.g. "JD. Stone"
  idNumber: string;
  passwordHash: string; // stored simply or hashed
  role: 'admin' | 'user';
  createdAt: string;
}

export interface AllowedId {
  idNumber: string;
  role: 'admin' | 'user';
  note?: string;
}

const STORAGE_KEYS = {
  REGISTERED_USERS: 'mirms_registered_users_v1',
  ALLOWED_IDS: 'mirms_allowed_ids_v1',
};

const SESSION_KEYS = {
  CURRENT_USER: 'mirms_current_user_v1',
};

// Initial allowed ID numbers for registration
const DEFAULT_ALLOWED_IDS: AllowedId[] = [
  { idNumber: 'ADMIN123', role: 'admin', note: 'Default Admin Account ID' },
  { idNumber: 'USER123', role: 'user', note: 'Default User Account ID' },
  { idNumber: 'JD999', role: 'user', note: 'JD Stone Account ID' },
  { idNumber: 'QA100', role: 'user', note: 'Quality Inspector ID' },
];

// Initial pre-registered users so the app starts fully functional
const DEFAULT_USERS: AppUser[] = [
  {
    fullName: 'System Administrator',
    shortName: 'Sys Admin',
    idNumber: 'ADMIN123',
    passwordHash: 'admin', // Simple password for ease of use
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    fullName: 'Juan Dela Cruz',
    shortName: 'JD. Stone',
    idNumber: 'USER123',
    passwordHash: 'user',
    role: 'user',
    createdAt: new Date().toISOString(),
  }
];

class UserService {
  private registeredUsers: AppUser[] = [];
  private allowedIds: AllowedId[] = [];
  private currentUser: AppUser | null = null;
  private changeListeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    // Load allowed IDs
    const storedAllowed = localStorage.getItem(STORAGE_KEYS.ALLOWED_IDS);
    if (storedAllowed) {
      this.allowedIds = JSON.parse(storedAllowed);
    } else {
      this.allowedIds = [...DEFAULT_ALLOWED_IDS];
      localStorage.setItem(STORAGE_KEYS.ALLOWED_IDS, JSON.stringify(this.allowedIds));
    }

    // Load registered users
    const storedUsers = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    if (storedUsers) {
      this.registeredUsers = JSON.parse(storedUsers);
    } else {
      this.registeredUsers = [...DEFAULT_USERS];
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(this.registeredUsers));
    }

    // Load current logged in user (from session storage so they are logged out on app close)
    const storedCurrent = sessionStorage.getItem(SESSION_KEYS.CURRENT_USER);
    if (storedCurrent) {
      this.currentUser = JSON.parse(storedCurrent);
    } else {
      this.currentUser = null;
    }
  }

  public subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in user service listener:', err);
      }
    });
  }

  public getCurrentUser(): AppUser | null {
    return this.currentUser;
  }

  public getRegisteredUsers(): AppUser[] {
    return [...this.registeredUsers];
  }

  public getAdminUsers(): AppUser[] {
    const admins = this.registeredUsers.filter(u => u.role === 'admin');
    if (admins.length > 0) return admins;
    return [DEFAULT_USERS[0]];
  }

  public getAllowedIds(): AllowedId[] {
    return [...this.allowedIds];
  }

  // Admin manages the allowed IDs
  public addAllowedId(idNumber: string, role: 'admin' | 'user', note?: string): boolean {
    const trimmed = idNumber.trim().toUpperCase();
    if (!trimmed) return false;

    // Check if already exists
    if (this.allowedIds.some(item => item.idNumber === trimmed)) {
      return false;
    }

    this.allowedIds.push({ idNumber: trimmed, role, note: note?.trim() });
    localStorage.setItem(STORAGE_KEYS.ALLOWED_IDS, JSON.stringify(this.allowedIds));
    this.notifyListeners();
    return true;
  }

  public removeAllowedId(idNumber: string): boolean {
    const trimmed = idNumber.trim().toUpperCase();
    const index = this.allowedIds.findIndex(item => item.idNumber === trimmed);
    if (index === -1) return false;

    this.allowedIds.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.ALLOWED_IDS, JSON.stringify(this.allowedIds));
    this.notifyListeners();
    return true;
  }

  // Register a new user
  public registerUser(fullName: string, shortName: string, idNumber: string, password: string): { success: boolean; error?: string; user?: AppUser } {
    const normId = idNumber.trim().toUpperCase();
    const name = fullName.trim();
    const sName = shortName.trim();
    const pass = password.trim();

    if (!name || !sName || !normId || !pass) {
      return { success: false, error: 'All fields are required.' };
    }

    // Check if ID is allowed
    const allowed = this.allowedIds.find(item => item.idNumber === normId);
    if (!allowed) {
      return { 
        success: false, 
        error: `ID Number "${normId}" is not authorized for registration. Please contact the administrator.` 
      };
    }

    // Check if ID is already registered
    if (this.registeredUsers.some(user => user.idNumber === normId)) {
      return { success: false, error: 'This ID number is already registered. Please log in.' };
    }

    const newUser: AppUser = {
      fullName: name,
      shortName: sName,
      idNumber: normId,
      passwordHash: pass, // Plain storage for convenience/portable design
      role: allowed.role,
      createdAt: new Date().toISOString()
    };

    this.registeredUsers.push(newUser);
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(this.registeredUsers));

    // Auto log in after registering
    this.currentUser = newUser;
    sessionStorage.setItem(SESSION_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));

    this.notifyListeners();
    return { success: true, user: newUser };
  }

  // Log in
  public login(idNumber: string, password: string): { success: boolean; error?: string; user?: AppUser } {
    const normId = idNumber.trim().toUpperCase();
    const pass = password.trim();

    if (!normId || !pass) {
      return { success: false, error: 'ID Number and Password are required.' };
    }

    const user = this.registeredUsers.find(u => u.idNumber === normId);
    if (!user) {
      return { success: false, error: 'ID number is not registered. Please sign up.' };
    }

    if (user.passwordHash !== pass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    this.currentUser = user;
    sessionStorage.setItem(SESSION_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return { success: true, user };
  }

  // Log out
  public logout(): void {
    this.currentUser = null;
    sessionStorage.removeItem(SESSION_KEYS.CURRENT_USER);
    this.notifyListeners();
  }

  // Admin manages registered users
  public deleteUser(idNumber: string): boolean {
    const trimmed = idNumber.trim().toUpperCase();
    const index = this.registeredUsers.findIndex(u => u.idNumber === trimmed);
    if (index === -1) return false;

    // Prevent deleting the very last admin
    const userToDelete = this.registeredUsers[index];
    if (userToDelete.role === 'admin') {
      const adminCount = this.registeredUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) return false;
    }

    this.registeredUsers.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(this.registeredUsers));
    this.notifyListeners();
    return true;
  }

  // Reset to factory settings (keep only ADMIN123)
  public resetToFactory(): void {
    const adminAccount = this.registeredUsers.find(u => u.idNumber === 'ADMIN123') || DEFAULT_USERS.find(u => u.idNumber === 'ADMIN123')!;
    this.registeredUsers = [adminAccount];
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(this.registeredUsers));
    
    // Reset allowed IDs to defaults
    this.allowedIds = [...DEFAULT_ALLOWED_IDS];
    localStorage.setItem(STORAGE_KEYS.ALLOWED_IDS, JSON.stringify(this.allowedIds));
    
    // Log out if the current user is not ADMIN123
    if (this.currentUser && this.currentUser.idNumber !== 'ADMIN123') {
      this.currentUser = null;
      sessionStorage.removeItem(SESSION_KEYS.CURRENT_USER);
    }
    
    this.notifyListeners();
  }
}

export const userService = new UserService();
