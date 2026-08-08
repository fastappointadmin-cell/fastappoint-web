import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardApiService } from '../../data-access/dashboard-api.service';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { DashboardAppointment } from '../../models/dashboard-appointment.model';

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-dashboard-bookings-page',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './dashboard-bookings-page.html',
  styleUrl: './dashboard-bookings-page.scss',
})
export class DashboardBookingsPage implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly facade = inject(DashboardFacade);

  protected readonly appointments = signal<DashboardAppointment[]>([]);
  protected readonly loading = signal(true);
  protected readonly activeFilter = signal<StatusFilter>('PENDING');
  protected readonly actionLoading = signal<string | null>(null);

  protected readonly filters: StatusFilter[] = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

  protected readonly filtered = computed(() => {
    const filter = this.activeFilter();
    const all = this.appointments();
    if (filter === 'ALL') return all;
    return all.filter(a => a.status === filter);
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const businessId = this.facade.selectedBusinessId();
    if (!businessId) return;
    this.loading.set(true);
    this.api.getAppointments(businessId).subscribe({
      next: (list) => {
        const order: Record<string, number> = { PENDING: 0, CONFIRMED: 1, COMPLETED: 2, CANCELLED: 3 };
        this.appointments.set(
          [...list].sort((a, b) => {
            const so = (order[a.status] ?? 9) - (order[b.status] ?? 9);
            if (so !== 0) return so;
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
          })
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected setFilter(f: StatusFilter): void {
    this.activeFilter.set(f);
  }

  protected confirm(id: string): void {
    this.actionLoading.set(id);
    this.api.confirmAppointment(id).subscribe({
      next: (updated) => this.updateOne(updated),
      error: () => this.actionLoading.set(null),
    });
  }

  protected cancel(id: string): void {
    this.actionLoading.set(id);
    this.api.cancelAppointment(id).subscribe({
      next: (updated) => this.updateOne(updated),
      error: () => this.actionLoading.set(null),
    });
  }

  protected complete(id: string): void {
    this.actionLoading.set(id);
    this.api.completeAppointment(id).subscribe({
      next: (updated) => this.updateOne(updated),
      error: () => this.actionLoading.set(null),
    });
  }

  private updateOne(updated: DashboardAppointment): void {
    this.actionLoading.set(null);
    this.appointments.update(list => list.map(a => a.id === updated.id ? updated : a));
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  protected label(appt: DashboardAppointment): string {
    return appt.serviceName ?? appt.manualLabel ?? '—';
  }
}
