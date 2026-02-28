import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ZaloCallbackResponse, ZaloLoginResponse } from '../models/customer-response.model';

const ZALO_SESSION_KEY = 'zalo_session';

@Injectable({ providedIn: 'root' })
export class ZaloService {
  private readonly baseUrl = `${environment.apiUrl}/api/zalo`;

  constructor(private http: HttpClient) {}

  getLoginUrl(): Observable<ZaloLoginResponse> {
    return this.http.get<ZaloLoginResponse>(`${this.baseUrl}/login`);
  }

  exchangeCode(code: string): Observable<ZaloCallbackResponse> {
    return this.http.post<ZaloCallbackResponse>(`${this.baseUrl}/callback`, { code });
  }

  saveSession(data: ZaloCallbackResponse): void {
    sessionStorage.setItem(ZALO_SESSION_KEY, JSON.stringify(data));
  }

  getSession(): ZaloCallbackResponse | null {
    const raw = sessionStorage.getItem(ZALO_SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearSession(): void {
    sessionStorage.removeItem(ZALO_SESSION_KEY);
  }
}
