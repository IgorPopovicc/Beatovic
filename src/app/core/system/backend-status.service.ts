import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BackendStatusService {
  readonly unavailable = signal(false);

  markUnavailable(): void {
    this.unavailable.set(true);
  }

  markAvailable(): void {
    this.unavailable.set(false);
  }
}
