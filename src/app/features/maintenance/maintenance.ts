import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceComponent {
  private readonly config = inject(RuntimeConfigService);

  protected readonly message = this.config.maintenanceMessage;
}
