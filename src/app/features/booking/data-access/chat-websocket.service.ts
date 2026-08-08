import { Injectable, OnDestroy } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

export interface ChatWsInbound {
	conversationId: string;
	toPhoneNumber: string;
	fromPhoneNumber: string;
	customerName?: string;
	message: string;
}

export type ChatWsMessageType = 'typing' | 'reply' | 'error';

export interface ChatWsOutbound {
	conversationId: string;
	type: ChatWsMessageType;
	reply?: string;
	error?: string;
}

/**
 * Manages a single long-lived STOMP-over-WebSocket connection to the backend
 * chat endpoint proxied through ng serve at /ws/chat/websocket.
 *
 * SockJS is intentionally NOT used: its HTTP fallbacks (iframe, jsonp, xhr-polling)
 * get intercepted by Angular's router and cause route-not-found errors in dev.
 * A plain WebSocket works fine for all modern browsers and avoids that problem.
 */
@Injectable({ providedIn: 'root' })
export class ChatWebSocketService implements OnDestroy {
	private readonly stomp = new RxStomp();
	private readonly destroy$ = new Subject<void>();

	constructor() {
		const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/chat`;
		this.stomp.configure({
			brokerURL: wsUrl,
			reconnectDelay: 5000
		});
		this.stomp.activate();
	}

	/** Emits all server-pushed frames for the given conversationId. */
	messages$(conversationId: string): Observable<ChatWsOutbound> {
		return this.stomp.watch(`/topic/chat/${conversationId}`).pipe(
			takeUntil(this.destroy$),
			map((frame) => JSON.parse(frame.body) as ChatWsOutbound),
			filter((msg) => msg.conversationId === conversationId)
		);
	}

	send(payload: ChatWsInbound): void {
		this.stomp.publish({
			destination: '/app/chat.send',
			body: JSON.stringify(payload)
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.stomp.deactivate();
	}
}
