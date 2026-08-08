const GOOGLE_MAPS_HOST_PATTERNS = [
	/(^|\.)google\.[a-z.]+$/i,
	/(^|\.)googleusercontent\.com$/i,
	/^maps\.app\.goo\.gl$/i
];

function decodeCandidate(value: string): string {
	return decodeURIComponent(value.replace(/\+/g, ' ')).replace(/\s+/g, ' ').trim();
}

function looksLikeAddress(value: string): boolean {
	if (!value) {
		return false;
	}

	if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value.replace(/\s+/g, ''))) {
		return false;
	}

	return /[A-Za-z\u00C0-\u024F]/.test(value);
}

function extractFirstMatchingCandidate(candidates: Array<string | null | undefined>): string | null {
	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}

		const decoded = decodeCandidate(candidate)
			.replace(/^\/+|\/+$/g, '')
			.replace(/\s*,\s*/g, ', ');

		if (looksLikeAddress(decoded)) {
			return decoded;
		}
	}

	return null;
}

export function normalizeGoogleMapsLink(rawValue: string | null | undefined): string {
	return rawValue?.trim() ?? '';
}

export function isGoogleMapsLink(rawValue: string | null | undefined): boolean {
	const normalized = normalizeGoogleMapsLink(rawValue);
	if (!normalized) {
		return false;
	}

	try {
		const url = new URL(normalized);
		return GOOGLE_MAPS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
	} catch {
		return false;
	}
}

export function extractAddressFromGoogleMapsLink(rawValue: string | null | undefined): string | null {
	const normalized = normalizeGoogleMapsLink(rawValue);
	if (!normalized) {
		return null;
	}

	try {
		const url = new URL(normalized);
		const pathSegments = url.pathname
			.split('/')
			.map((segment) => segment.trim())
			.filter(Boolean);
		const placeIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === 'place');
		const searchIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === 'search');

		return extractFirstMatchingCandidate([
			url.searchParams.get('q'),
			url.searchParams.get('query'),
			url.searchParams.get('destination'),
			url.searchParams.get('daddr'),
			placeIndex >= 0 ? pathSegments[placeIndex + 1] : null,
			searchIndex >= 0 ? pathSegments[searchIndex + 1] : null
		]);
	} catch {
		return null;
	}
}
