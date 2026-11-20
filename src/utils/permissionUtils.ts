import { logger } from './logger';

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Checks microphone permission status using navigator.permissions.query
 */
export async function checkMicrophonePermissionStatus(): Promise<MicPermissionState> {
  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as MicPermissionState;
    } catch (e) {
      logger.info("navigator.permissions.query for 'microphone' not supported by browser engine:", e);
      return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Subscribes to microphone permission changes if supported by the browser
 */
export function subscribeToMicrophonePermissionChanges(
  onChange: (state: MicPermissionState) => void
): () => void {
  let permissionStatusObj: PermissionStatus | null = null;
  let listener: (() => void) | null = null;

  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        permissionStatusObj = status;
        listener = () => {
          onChange(status.state as MicPermissionState);
        };
        if (typeof status.addEventListener === 'function') {
          status.addEventListener('change', listener);
        } else {
          status.onchange = listener;
        }
      })
      .catch((err) => {
        logger.info("Could not subscribe to permission changes:", err);
      });
  }

  return () => {
    if (permissionStatusObj && listener) {
      if (typeof permissionStatusObj.removeEventListener === 'function') {
        permissionStatusObj.removeEventListener('change', listener);
      } else {
        permissionStatusObj.onchange = null;
      }
    }
  };
}
