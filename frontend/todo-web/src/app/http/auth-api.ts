import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';

export interface Session {
  userId: string;
  username: string;
  token: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(username: string, password: string): Promise<Session> {
    const request = this.http.post<Session>(`${API_URL}/auth/login`, { username, password });

    return firstValueFrom(request);
  }
}
