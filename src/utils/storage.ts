/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';

/**
 * A robust, bulletproof storage utility for localStorage and sessionStorage.
 * Prevents application crashes in restricted or private browsing environments.
 */
class SafeStorage {
  private isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
    try {
      const storage = window[type];
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return false;
    }
  }

  public getItem(key: string, defaultValue: string = ''): string {
    try {
      if (typeof window === 'undefined') return defaultValue;
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      logger.warn(`[SafeStorage] Failed to get item "${key}" from localStorage:`, e);
      return defaultValue;
    }
  }

  public setItem(key: string, value: string): boolean {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      logger.error(`[SafeStorage] Failed to set item "${key}" in localStorage:`, e);
      
      // Handle QuotaExceededError
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        this.attemptEmergencyCleanup();
      }
      return false;
    }
  }

  public removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
    } catch (e) {
      logger.warn(`[SafeStorage] Failed to remove item "${key}" from localStorage:`, e);
    }
  }

  public clear(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      logger.warn('[SafeStorage] Failed to clear storage:', e);
    }
  }

  public getSessionItem(key: string, defaultValue: string = ''): string {
    try {
      if (typeof window === 'undefined') return defaultValue;
      return sessionStorage.getItem(key) || defaultValue;
    } catch (e) {
      logger.warn(`[SafeStorage] Failed to get item "${key}" from sessionStorage:`, e);
      return defaultValue;
    }
  }

  public setSessionItem(key: string, value: string): void {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.setItem(key, value);
    } catch (e) {
      logger.error(`[SafeStorage] Failed to set item "${key}" in sessionStorage:`, e);
    }
  }

  public removeSessionItem(key: string): void {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.removeItem(key);
    } catch (e) {
      logger.warn(`[SafeStorage] Failed to remove item "${key}" from sessionStorage:`, e);
    }
  }

  public parseJSON<T>(key: string, defaultValue: T): T {
    const value = this.getItem(key);
    if (!value) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      logger.error(`[SafeStorage] JSON parse error for key "${key}":`, e);
      return defaultValue;
    }
  }

  public getJson<T>(key: string, defaultValue: T): T {
    return this.parseJSON<T>(key, defaultValue);
  }

  private attemptEmergencyCleanup(): void {
    try {
      logger.info('[SafeStorage] Attempting emergency cleanup due to quota exceeded...');
      // Clear oldest history or non-critical logs if needed
      // For now, just log that we are at limit
    } catch (e) {
      // ignore
    }
  }
}

export const safeStorage = new SafeStorage();
