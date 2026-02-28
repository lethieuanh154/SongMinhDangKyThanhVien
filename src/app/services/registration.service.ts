import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerResponse } from '../models/customer-response.model';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly apiUrl = `${environment.apiUrl}/api/customer/register`;

  constructor(private http: HttpClient) {}

  register(name: string, phone: string): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.apiUrl, { name, phone });
  }
}
