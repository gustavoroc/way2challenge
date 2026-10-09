import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error' | 'session_expired';

// The indicator in the header. Both jobs report here.
@Injectable({ providedIn: 'root' })
export class SyncStatusService {
  private readonly auth = inject(AuthService);

  readonly status = signal<SyncStatus>('offline');

  constructor() {
    window.addEventListener('offline', () => this.status.set('offline'));
  }

  // A job only talks to the server with a connection and a signed-in, non-expired session.
  canSync(): boolean {
    if (!navigator.onLine) {
      this.status.set('offline');
      return false;
    }

    if (!this.auth.session()) return false;

    if (this.auth.isExpired()) {
      this.status.set('session_expired');
      return false;
    }

    return true;
  }

  // Runs a job's server call, showing "syncing" while it runs and the result after.
  async track(serverCall: () => Promise<void>): Promise<void> {
    this.status.set('syncing');

    try {
      await serverCall();
      this.status.set('synced');
    } catch (error) {
      this.status.set(statusForError(error));
    }
  }
}

function statusForError(error: unknown): SyncStatus {
  if (!(error instanceof HttpErrorResponse)) return 'error';
  if (error.status === 0) return 'offline';
  if (error.status === 401) return 'session_expired';

  return 'error';
}
