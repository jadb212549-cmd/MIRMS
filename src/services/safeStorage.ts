/**
 * Safe Storage Service
 * Provides fail-safe wrappers around localStorage and sessionStorage.
 * If storage is blocked (e.g. strict corporate Windows 11 policy, private browsing,
 * iframe sandboxing, or disabled cookies), it falls back to an in-memory store
 * so the application NEVER crashes or gets stuck on loading.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

class SafeStorageWrapper {
  private fallbackStore = new MemoryStorage();
  private storageType: 'localStorage' | 'sessionStorage';
  private isAvailable: boolean | null = null;

  constructor(type: 'localStorage' | 'sessionStorage') {
    this.storageType = type;
  }

  private checkAvailability(): boolean {
    if (this.isAvailable !== null) return this.isAvailable;
    if (typeof window === 'undefined') {
      this.isAvailable = false;
      return false;
    }

    try {
      const storage = window[this.storageType];
      if (!storage) {
        this.isAvailable = false;
        return false;
      }
      const testKey = `__storage_test_${this.storageType}__`;
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      this.isAvailable = true;
      return true;
    } catch (e) {
      console.warn(`[SafeStorage] ${this.storageType} is unavailable or restricted. Using in-memory fallback.`, e);
      this.isAvailable = false;
      return false;
    }
  }

  public getItem(key: string): string | null {
    if (this.checkAvailability()) {
      try {
        return window[this.storageType].getItem(key);
      } catch (err) {
        console.warn(`[SafeStorage] Failed to getItem('${key}') from ${this.storageType}:`, err);
      }
    }
    return this.fallbackStore.getItem(key);
  }

  public setItem(key: string, value: string): void {
    const strVal = String(value);
    if (this.checkAvailability()) {
      try {
        window[this.storageType].setItem(key, strVal);
        return;
      } catch (err: any) {
        console.warn(`[SafeStorage] Failed to setItem('${key}') on ${this.storageType}:`, err);
        // If quota exceeded or error, still save in fallback memory store
      }
    }
    this.fallbackStore.setItem(key, strVal);
  }

  public removeItem(key: string): void {
    if (this.checkAvailability()) {
      try {
        window[this.storageType].removeItem(key);
      } catch (err) {
        console.warn(`[SafeStorage] Failed to removeItem('${key}') from ${this.storageType}:`, err);
      }
    }
    this.fallbackStore.removeItem(key);
  }

  public clear(): void {
    if (this.checkAvailability()) {
      try {
        window[this.storageType].clear();
      } catch (err) {
        console.warn(`[SafeStorage] Failed to clear ${this.storageType}:`, err);
      }
    }
    this.fallbackStore.clear();
  }

  public getJSON<T>(key: string, defaultValue: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[SafeStorage] Failed to parse JSON for key "${key}", using default`, e);
      return defaultValue;
    }
  }

  public setJSON(key: string, value: any): void {
    try {
      const serialized = JSON.stringify(value);
      this.setItem(key, serialized);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to serialize JSON for key "${key}"`, e);
    }
  }

  public get length(): number {
    if (this.checkAvailability()) {
      try {
        return window[this.storageType].length;
      } catch {}
    }
    return this.fallbackStore.length;
  }

  public key(index: number): string | null {
    if (this.checkAvailability()) {
      try {
        return window[this.storageType].key(index);
      } catch {}
    }
    return this.fallbackStore.key(index);
  }
}

export const safeLocalStorage = new SafeStorageWrapper('localStorage');
export const safeSessionStorage = new SafeStorageWrapper('sessionStorage');
