import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  imports: [TranslocoPipe],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.scss'
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);
}
