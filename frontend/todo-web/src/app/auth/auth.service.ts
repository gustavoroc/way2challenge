import { Injectable, inject, signal } from '@angular/core';
import { AuthApi, Session } from '../http/auth-api';

const STORAGE_KEY = 'todo.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApi);

  readonly session = signal<Session | null>(readStoredSession());

  async login(username: string, password: string): Promise<void> {
    const session = await this.authApi.login(username, password);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  // The outbox stays in IndexedDB and is sent after the next login.
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
  }

  isExpired(): boolean {
    const session = this.session();
    if (!session) return false;

    return new Date(session.expiresAt).getTime() <= Date.now();
  }
}

// A session saved in another format (older version of the app) counts as signed out.
function readStoredSession(): Session | null {
  try {
    const storedSession = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Session> | null;
    if (storedSession?.userId && storedSession.token && storedSession.expiresAt) return storedSession as Session;
  } catch {}

  localStorage.removeItem(STORAGE_KEY);
  return null;
}
