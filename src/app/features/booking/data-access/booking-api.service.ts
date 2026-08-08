import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { backendConfig } from '../../../core/config/backend.config';
import {
	BookingConfirmation,
	ChatAgentResponse,
	ChatInboundMessageRequest,
	CreateBookingRequest,
	PublicBusiness,
	PublicService
} from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingApiService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = backendConfig.baseUrl;

	getBusiness(businessId: string): Observable<PublicBusiness> {
		return this.http.get<PublicBusiness>(`${this.baseUrl}/api/public/businesses/${businessId}`);
	}

	getBusinessBySlug(slug: string): Observable<PublicBusiness> {
		return this.http.get<PublicBusiness>(`${this.baseUrl}/api/public/businesses/by-slug/${slug}`);
	}

	getServices(businessId: string): Observable<PublicService[]> {
		return this.http.get<PublicService[]>(`${this.baseUrl}/api/public/businesses/${businessId}/services`);
	}

	getAvailableStarts(serviceId: string, dateIso: string, inputs: Record<string, number> = {}): Observable<string[]> {
		let params = new HttpParams().set('date', dateIso);
		for (const [key, value] of Object.entries(inputs)) {
			params = params.set(`input.${key}`, String(value));
		}
		return this.http.get<string[]>(`${this.baseUrl}/api/public/services/${serviceId}/available-starts`, { params });
	}

	createBooking(request: CreateBookingRequest): Observable<BookingConfirmation> {
		return this.http.post<BookingConfirmation>(`${this.baseUrl}/api/public/appointments`, request);
	}

	sendChatMessage(request: ChatInboundMessageRequest): Observable<ChatAgentResponse> {
		return this.http.post<ChatAgentResponse>(`${this.baseUrl}/api/public/chat-agent/messages`, request);
	}
}
