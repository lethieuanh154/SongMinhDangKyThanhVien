import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerResponse } from '../models/customer-response.model';

const STORAGE_KEY = 'registered_customer';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly baseUrl = `${environment.apiUrl}/api/customer`;

  constructor(private http: HttpClient) {}

  register(name: string, phone: string, zaloUserId?: string): Observable<CustomerResponse> {
    const body: Record<string, string> = { name, phone };
    if (zaloUserId) {
      body['zalo_user_id'] = zaloUserId;
    }
    return this.http.post<CustomerResponse>(`${this.baseUrl}/register`, body);
  }

  getCard(customerCode: string): Observable<CustomerResponse> {
    return this.http.get<CustomerResponse>(`${this.baseUrl}/card/${customerCode}`);
  }

  saveCustomer(data: { customer_code: string; barcode_value: string; name: string; phone: string }): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  getSavedCustomer(): { customer_code: string; barcode_value: string; name: string; phone: string } | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearSavedCustomer(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
