import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type Status = 'success' | 'error';

@Component({
  selector: 'app-order-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-result.html',
  styleUrl: './order-result.scss',
})
export class OrderResultComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly navState = (history.state || {}) as {
    status?: Status;
    email?: string;
    error?: string;
  };

  status = computed<Status>(() => {
    const qp = (this.route.snapshot.queryParamMap.get('status') || '') as Status;
    return (this.navState.status || qp || 'error') === 'success' ? 'success' : 'error';
  });

  email = computed(() => String(this.navState.email || ''));
  error = computed(() => String(this.navState.error || ''));
}
