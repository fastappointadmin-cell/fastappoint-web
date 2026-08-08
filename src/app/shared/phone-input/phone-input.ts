import {
	Component,
	computed,
	forwardRef,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CountryCode, getCountries, getCountryCallingCode, parsePhoneNumber, AsYouType } from 'libphonenumber-js';

export interface PhoneCountry {
	iso: CountryCode;
	dialCode: string;
	name: string;
}

const COUNTRY_NAMES: Partial<Record<CountryCode, string>> = {
	RO: 'România', US: 'United States', GB: 'United Kingdom', DE: 'Germania',
	FR: 'Franța', IT: 'Italia', ES: 'Spania', PT: 'Portugalia',
	NL: 'Olanda', BE: 'Belgia', AT: 'Austria', CH: 'Elveția',
	PL: 'Polonia', CZ: 'Cehia', SK: 'Slovacia', HU: 'Ungaria',
	BG: 'Bulgaria', HR: 'Croația', RS: 'Serbia', MD: 'Moldova',
	UA: 'Ucraina', TR: 'Turcia', GR: 'Grecia', SE: 'Suedia',
	NO: 'Norvegia', DK: 'Danemarca', FI: 'Finlanda', IE: 'Irlanda',
	CA: 'Canada', AU: 'Australia', NZ: 'Noua Zeelandă',
};

const ALL_COUNTRIES: PhoneCountry[] = getCountries()
	.map((iso) => ({
		iso,
		dialCode: '+' + getCountryCallingCode(iso),
		name: COUNTRY_NAMES[iso] ?? iso,
	}))
	.sort((a, b) => {
		// Romania first, then alphabetical
		if (a.iso === 'RO') return -1;
		if (b.iso === 'RO') return 1;
		return a.name.localeCompare(b.name);
	});

/**
 * Phone number input with country selector.
 * Implements ControlValueAccessor so it can be used with [(ngModel)] or reactive forms.
 * Emits E.164 strings (e.g. +40741234567) or empty string if blank.
 * Default country: Romania (RO, +40).
 */
@Component({
	selector: 'app-phone-input',
	imports: [FormsModule],
	templateUrl: './phone-input.html',
	styleUrl: './phone-input.scss',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => PhoneInputComponent),
			multi: true,
		},
	],
})
export class PhoneInputComponent implements ControlValueAccessor, OnInit {
	readonly defaultCountry = input<CountryCode>('RO');
	readonly placeholder = input('');
	readonly name = input('phone');

	protected readonly countries = ALL_COUNTRIES;
	protected readonly selectedCountry = signal<PhoneCountry>(ALL_COUNTRIES.find(c => c.iso === 'RO')!);
	protected readonly localNumber = signal('');
	protected readonly open = signal(false);
	protected readonly filterQuery = signal('');

	protected readonly filteredCountries = computed(() => {
		const q = this.filterQuery().toLowerCase().trim();
		if (!q) return this.countries;
		return this.countries.filter(
			c => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.iso.toLowerCase().includes(q)
		);
	});

	private onChange: (value: string) => void = () => {};
	private onTouched: () => void = () => {};
	private disabled = false;

	ngOnInit(): void {
		const def = this.countries.find(c => c.iso === this.defaultCountry()) ?? ALL_COUNTRIES.find(c => c.iso === 'RO')!;
		this.selectedCountry.set(def);
	}

	// ControlValueAccessor: called by Angular when parent sets value
	writeValue(e164: string): void {
		if (!e164) {
			this.localNumber.set('');
			return;
		}
		try {
			const parsed = parsePhoneNumber(e164);
			const country = this.countries.find(c => c.iso === parsed.country);
			if (country) this.selectedCountry.set(country);
			this.localNumber.set(parsed.nationalNumber as string);
		} catch {
			this.localNumber.set(e164);
		}
	}

	registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
	registerOnTouched(fn: () => void): void { this.onTouched = fn; }
	setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

	protected onInput(raw: string): void {
		this.localNumber.set(raw);
		this.onChange(this.toE164(raw));
	}

	protected onBlur(): void {
		this.onTouched();
		// Format on blur using AsYouType for nicer display
		const formatted = new AsYouType(this.selectedCountry().iso).input(this.localNumber());
		if (formatted) this.localNumber.set(formatted);
	}

	protected selectCountry(country: PhoneCountry): void {
		this.selectedCountry.set(country);
		this.open.set(false);
		this.filterQuery.set('');
		this.onChange(this.toE164(this.localNumber()));
	}

	protected toggleDropdown(): void {
		this.open.update(v => !v);
		if (!this.open()) this.filterQuery.set('');
	}

	protected closeDropdown(): void {
		setTimeout(() => {
			this.open.set(false);
			this.filterQuery.set('');
		}, 150);
	}

	private toE164(local: string): string {
		if (!local.trim()) return '';
		try {
			const parsed = parsePhoneNumber(local, this.selectedCountry().iso);
			return parsed.isValid() ? parsed.format('E.164') : this.selectedCountry().dialCode + local.replace(/^0+/, '').replace(/\D/g, '');
		} catch {
			return this.selectedCountry().dialCode + local.replace(/^0+/, '').replace(/\D/g, '');
		}
	}

	/** Converts ISO 3166-1 alpha-2 code to regional indicator emoji flag. */
	protected flag(iso: string): string {
		return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('');
	}
}
