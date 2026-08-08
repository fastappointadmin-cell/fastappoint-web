import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { PhoneInputComponent } from '../../../../shared/phone-input/phone-input';

export interface CustomerCandidate {
  name: string;
  phone: string;
}

/**
 * Nume + telefon client, cu autocomplete: tastând în oricare din cele două câmpuri, sugerează clienți deja
 * cunoscuți (din `candidates`) care se potrivesc pe nume SAU telefon; alegerea unei sugestii completează
 * AMBELE câmpuri deodată.
 */
@Component({
  selector: 'app-customer-fields',
  imports: [FormsModule, TranslocoPipe, PhoneInputComponent],
  templateUrl: './customer-fields.html',
  styleUrl: './customer-fields.scss'
})
export class CustomerFieldsComponent {
  readonly name = input('');
  readonly phone = input('');
  readonly candidates = input<CustomerCandidate[]>([]);

  readonly nameChange = output<string>();
  readonly phoneChange = output<string>();

  protected readonly activeField = signal<'name' | 'phone' | null>(null);

  /**
   * Textul folosit pentru filtrare, oglindit local -- NU citit direct din `name()`/`phone()` (input-urile
   * primite de la părinte). Un `[ngModel]` "controlat" (valoarea vine înapoi de la părinte după fiecare
   * emit) poate întârzia cu un tick înainte ca noua valoare să ajungă înapoi ca input, moment în care lista
   * de sugestii s-ar calcula pe textul VECHI și ar apărea goală/ar clipi. Actualizat sincron la fiecare tastă
   * apăsată, ca lista să reflecte mereu exact ce tocmai s-a scris.
   */
  private readonly nameQuery = signal('');
  private readonly phoneQuery = signal('');

  protected readonly nameSuggestions = computed(() => this.filter(this.nameQuery()));
  protected readonly phoneSuggestions = computed(() => this.filter(this.phoneQuery()));

  /** Incrementat la fiecare open/select -- un `closeSoon` programat înaintea celei mai recente acțiuni e ignorat
   * la declanșare, ca o închidere întârziată "rătăcită" să nu mai apuce să închidă un dropdown redeschis între
   * timp (ex. blur-ul unui click pe sugestie urmat imediat de un focus/input nou). */
  private closeToken = 0;

  constructor() {
    // Resincronizează textul local dacă valoarea vine schimbată din afară (ex. formularul e resetat de părinte).
    effect(() => this.nameQuery.set(this.name()));
    effect(() => this.phoneQuery.set(this.phone()));
  }

  protected onNameInput(value: string): void {
    this.nameQuery.set(value);
    this.nameChange.emit(value);
    // Redeschide/actualizează la fiecare tastă apăsată -- nu doar la focus -- ca lista să rămână vie și după o
    // alegere anterioară din autocomplete (userul poate corecta/continua să scrie fără să iasă din câmp).
    this.openFor('name');
  }

  protected onPhoneInput(value: string): void {
    this.phoneQuery.set(value);
    this.phoneChange.emit(value);
    this.openFor('phone');
  }

  protected openFor(field: 'name' | 'phone'): void {
    this.closeToken += 1;
    this.activeField.set(field);
  }

  /** Delay scurt înainte de închidere: dă timp evenimentului `mousedown` de pe o sugestie să se declanșeze
   * primul (altfel blur-ul ar închide dropdown-ul înainte ca click-ul pe sugestie să apuce să înregistreze). */
  protected closeSoon(): void {
    const token = this.closeToken;
    setTimeout(() => {
      if (token === this.closeToken) {
        this.activeField.set(null);
      }
    }, 150);
  }

  protected select(candidate: CustomerCandidate): void {
    this.closeToken += 1;
    this.nameQuery.set(candidate.name);
    this.phoneQuery.set(candidate.phone);
    this.nameChange.emit(candidate.name);
    this.phoneChange.emit(candidate.phone);
    this.activeField.set(null);
  }

  private filter(query: string): CustomerCandidate[] {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      return [];
    }
    return this.candidates()
      .filter((candidate) => candidate.name.toLowerCase().includes(trimmed) || candidate.phone.toLowerCase().includes(trimmed))
      .slice(0, 5);
  }
}
