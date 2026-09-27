import {Injectable} from '@angular/core';
import {UserService} from 'src/app/api/services/user.service';

const STORAGE_PREFIX = 'ontrack.user';
const STORAGE_SUFFIX = 'peerProgress.advanced';

/**
 * Stores only the PPI presentation preference, never peer-progress data.
 *
 * The key is scoped to the authenticated user so a shared browser cannot show
 * one person's choice to another account. Local storage is intentionally used
 * here because Advanced is a display-only choice that must survive navigation,
 * a normal app resume and a later browser session.
 */
@Injectable({providedIn: 'root'})
export class PeerProgressDisplayPreferenceService {
  private readonly memoryFallback: Map<number, boolean> = new Map();

  constructor(private readonly userService: UserService) {}

  get enabled(): boolean {
    const userId = this.currentUserId;
    if (userId === null) {
      return false;
    }

    try {
      const stored = globalThis.localStorage?.getItem(this.storageKey(userId));
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Hardened/private browsers may reject local storage. The per-user
      // in-memory fallback still preserves navigation within this session.
    }

    return this.memoryFallback.get(userId) ?? false;
  }

  setEnabled(enabled: boolean): boolean {
    const userId = this.currentUserId;
    if (userId === null) {
      return false;
    }

    this.memoryFallback.set(userId, enabled);

    try {
      globalThis.localStorage?.setItem(this.storageKey(userId), String(enabled));
    } catch {
      // Keep the per-user in-memory value when durable storage is unavailable.
    }

    return enabled;
  }

  static storageKeyFor(userId: number): string {
    return `${STORAGE_PREFIX}.${userId}.${STORAGE_SUFFIX}`;
  }

  private storageKey(userId: number): string {
    return PeerProgressDisplayPreferenceService.storageKeyFor(userId);
  }

  private get currentUserId(): number | null {
    const id = this.userService.currentUser?.id;
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
