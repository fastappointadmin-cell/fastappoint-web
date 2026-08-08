import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardApiService } from '../../data-access/dashboard-api.service';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { DashboardAppointment } from '../../models/dashboard-appointment.model';

export interface CustomerSummary {
  phone: string;
  name: string;
  appointments: DashboardAppointment[];
  services: string[];
  totalCount: number;
}

@Component({
  selector: 'app-dashboard-customers-page',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './dashboard-customers-page.html',
  styleUrl: './dashboard-customers-page.scss',
})
export class DashboardCustomersPage implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly facade = inject(DashboardFacade);

  protected readonly allAppointments = signal<DashboardAppointment[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchQuery = signal('');
  protected readonly expandedPhone = signal<string | null>(null);

  protected readonly customers = computed((): CustomerSummary[] => {
    const map = new Map<string, DashboardAppointment[]>();
    for (const appt of this.allAppointments()) {
      const key = appt.customerPhone;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    const result: CustomerSummary[] = [];
    for (const [phone, appts] of map.entries()) {
      const sorted = [...appts].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      const name = sorted[0].customerName;
      const services = [
        ...new Set(appts.map(a => a.serviceName ?? a.manualLabel).filter(Boolean)),
      ] as string[];
      result.push({ phone, name, appointments: sorted, services, totalCount: appts.length });
    }
    return result.sort((a, b) => b.totalCount - a.totalCount);
  });

  protected readonly filteredCustomers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(
      c => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  });

  ngOnInit(): void {
    const businessId = this.facade.selectedBusinessId();
    if (!businessId) return;
    this.api.getAppointments(businessId).subscribe({
      next: (list) => {
        this.allAppointments.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleExpand(phone: string): void {
    this.expandedPhone.update(cur => (cur === phone ? null : phone));
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'badge--pending',
      CONFIRMED: 'badge--confirmed',
      COMPLETED: 'badge--completed',
      CANCELLED: 'badge--cancelled',
    };
    return map[status] ?? 'badge--default';
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
