import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { backendConfig } from '../../../core/config/backend.config';

export interface ContactMessageRequest {
	name: string;
	email: string;
	message: string;
}

@Injectable({ providedIn: 'root' })
export class MarketingApiService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = backendConfig.baseUrl;

	sendContactMessage(request: ContactMessageRequest): Observable<void> {
		return this.http.post<void>(`${this.baseUrl}/api/public/contact/messages`, request);
	}
}
